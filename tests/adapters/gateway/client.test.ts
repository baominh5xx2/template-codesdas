import { describe, expect, it, vi } from "vitest";
import { loadGatewayConfig } from "@/adapters/gateway/config";
import { createGatewayClient, GatewayError } from "@/adapters/gateway/client";
import { createGateway } from "@/adapters/gateway";

const config = { baseUrl: "https://gw.test", apiKey: "secret-key" };
const noSleep = async () => {};

describe("loadGatewayConfig", () => {
  it("is unavailable without a key and defaults the base URL", () => {
    expect(loadGatewayConfig({})).toEqual({ available: false, cause: "missing_config" });
    expect(loadGatewayConfig({ AI_GATEWAY_API_KEY: " k " })).toEqual({ available: true, config: { baseUrl: "https://api.thucchien.ai", apiKey: "k" } });
  });
  it("rejects credentials in URLs and whitespace keys, trims trailing slashes", () => {
    expect(loadGatewayConfig({ AI_GATEWAY_API_KEY: "k", AI_GATEWAY_BASE_URL: "https://u:p@x.test" }).available).toBe(false);
    expect(loadGatewayConfig({ AI_GATEWAY_API_KEY: "a b" }).available).toBe(false);
    expect(loadGatewayConfig({ AI_GATEWAY_API_KEY: "k", AI_GATEWAY_BASE_URL: "ftp://x.test" }).available).toBe(false);
    expect(loadGatewayConfig({ AI_GATEWAY_API_KEY: "k", AI_GATEWAY_BASE_URL: "http://127.0.0.1:4000/v1/" })).toMatchObject({ config: { baseUrl: "http://127.0.0.1:4000/v1" } });
  });
});

describe("createGatewayClient", () => {
  it("sends bearer auth and JSON, and reads the cost header", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => Response.json({ ok: 1 }, { headers: { "x-litellm-response-cost": "0.0123" } }));
    const result = await createGatewayClient(config, { fetch }).json("/x", { json: { a: 1 } });
    expect(result).toMatchObject({ data: { ok: 1 }, cost: 0.0123 });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("https://gw.test/x");
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer secret-key");
    expect(init?.body).toBe('{"a":1}');
  });

  it("retries 429 and 5xx with backoff, honouring retry-after", async () => {
    const sleep = vi.fn<(ms: number) => Promise<void>>(noSleep);
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(new Response("slow down", { status: 429, headers: { "retry-after": "2" } }))
      .mockResolvedValueOnce(new Response("boom", { status: 503 }))
      .mockResolvedValueOnce(Response.json({ ok: true }));
    await expect(createGatewayClient(config, { fetch, sleep }).json("/x")).resolves.toMatchObject({ data: { ok: true } });
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls[0][0]).toBe(2000);
  });

  it("does not retry 5xx for non-idempotent calls, but still retries 429", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(new Response("", { status: 429 }))
      .mockResolvedValueOnce(new Response("", { status: 500 }));
    const error = await createGatewayClient(config, { fetch, sleep: noSleep }).json("/v1/videos", { json: {}, idempotent: false }).catch((e) => e);
    expect(error).toMatchObject({ code: "gateway_upstream", status: 500 });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("maps errors to codes without leaking the key and keeps a trimmed upstream detail", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => Response.json({ error: { message: "Invalid model name" } }, { status: 400 }));
    const error = await createGatewayClient(config, { fetch }).json("/x").catch((e) => e);
    expect(error).toBeInstanceOf(GatewayError);
    expect(error).toMatchObject({ code: "gateway_bad_request", status: 400, detail: "Invalid model name", message: "gateway_bad_request" });
    expect(JSON.stringify(error)).not.toContain("secret-key");
    expect(fetch).toHaveBeenCalledTimes(1);
    const auth = await createGatewayClient(config, { fetch: async () => new Response("", { status: 401 }) }).json("/x").catch((e) => e);
    expect(auth.code).toBe("gateway_auth");
  });

  it("reports cancellation and gives up after the retry budget", async () => {
    const abort = new AbortController();
    abort.abort();
    const cancelled = await createGatewayClient(config, { fetch: vi.fn() }).json("/x", { signal: abort.signal }).catch((e) => e);
    expect(cancelled.code).toBe("gateway_cancelled");
    const fetch = vi.fn<typeof globalThis.fetch>(async () => { throw new TypeError("fetch failed"); });
    const network = await createGatewayClient(config, { fetch, sleep: noSleep }).json("/x", { retries: 2 }).catch((e) => e);
    expect(network.code).toBe("gateway_upstream");
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("never runs more than maxConcurrency requests at once", async () => {
    let active = 0, peak = 0;
    const fetch = vi.fn<typeof globalThis.fetch>(async () => {
      peak = Math.max(peak, ++active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return Response.json({});
    });
    const client = createGatewayClient(config, { fetch, maxConcurrency: 2 });
    await Promise.all(Array.from({ length: 7 }, () => client.json("/x")));
    expect(peak).toBe(2);
    expect(fetch).toHaveBeenCalledTimes(7);
  });
});

describe("createGateway", () => {
  it("rejects every call with gateway_unavailable when unconfigured", async () => {
    const gateway = createGateway(null);
    expect(gateway.available).toBe(false);
    await expect(gateway.generateImage({ prompt: "x" })).rejects.toMatchObject({ code: "gateway_unavailable" });
    await expect(gateway.chat({ messages: [] })).rejects.toMatchObject({ code: "gateway_unavailable" });
  });
});
