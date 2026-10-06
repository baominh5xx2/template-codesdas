import { expect, it, vi } from "vitest";
import { createBoundedBusinessFetch } from "@/adapters/mcp/business-client";

const url = new URL("http://127.0.0.1:3199/api/mcp/business");
it("bounds streamed response bytes and cancels the reader without buffering oversized data", async () => {
  const cancel = vi.fn();
  const fetch = vi.fn(async () => new Response(new ReadableStream({ start(c) { c.enqueue(new Uint8Array(32769)); }, cancel }), { headers: { "content-type": "application/json" } }));
  await expect(createBoundedBusinessFetch(url, "token", new AbortController().signal, fetch)(url)).rejects.toThrow("Chưa kết nối");
  expect(cancel).toHaveBeenCalledTimes(1);
});
it("permits the exact limit and sends only dedicated credentials with redirects forbidden", async () => {
  const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response("x".repeat(32768)));
  const bounded = createBoundedBusinessFetch(url, "token", new AbortController().signal, fetch);
  expect((await bounded(url, { headers: { cookie: "untrusted", authorization: "other", origin: "http://evil" } })).status).toBe(200);
  const init = fetch.mock.calls[0][1]!;
  expect(init.redirect).toBe("error"); expect(init.credentials).toBe("omit");
  const headers = new Headers(init.headers);
  expect(headers.get("authorization")).toBe("Bearer token"); expect(headers.has("cookie")).toBe(false); expect(headers.has("origin")).toBe(false);
  await expect(bounded("http://evil.example/api/mcp/business")).rejects.toThrow("Chưa kết nối");
  expect(fetch).toHaveBeenCalledTimes(1);
});
it("measures UTF-8 bytes, rejects declared oversized bodies and propagates abort to fetch", async () => {
  const cancel = vi.fn(); const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response(new ReadableStream({ cancel }), { headers: { "content-length": "32769" } }));
  await expect(createBoundedBusinessFetch(url, "token", new AbortController().signal, fetch)(url)).rejects.toThrow("Chưa kết nối"); expect(cancel).toHaveBeenCalledTimes(1);
  const multibyte = vi.fn<typeof globalThis.fetch>(async () => new Response("é".repeat(16385)));
  await expect(createBoundedBusinessFetch(url, "token", new AbortController().signal, multibyte)(url)).rejects.toThrow("Chưa kết nối");
  const abort = new AbortController(); let observed: AbortSignal | null | undefined;
  const pending = vi.fn<typeof globalThis.fetch>(async (_url, init) => { observed = init?.signal; await new Promise<void>((resolve) => observed!.addEventListener("abort", () => resolve(), { once: true })); throw new Error("raw abort"); });
  const call = createBoundedBusinessFetch(url, "token", abort.signal, pending)(url); const rejection = expect(call).rejects.toThrow("Chưa kết nối");
  abort.abort(); await rejection; expect(observed?.aborted).toBe(true);
});
it("honors cancellation already carried by a Request before issuing HTTP", async () => {
  const abort = new AbortController(); abort.abort(); const fetch = vi.fn<typeof globalThis.fetch>();
  await expect(createBoundedBusinessFetch(url, "token", new AbortController().signal, fetch)(new Request(url, { signal: abort.signal }))).rejects.toThrow("Chưa kết nối");
  expect(fetch).not.toHaveBeenCalled();
});
