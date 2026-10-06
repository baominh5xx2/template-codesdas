import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { InMemoryAgentRunner } from "@copilotkit/runtime/v2";
import { PROTOCOL_VERSION } from "@ag-ui/client";
import type { BusinessMcpConfig } from "@/server/mcp/config";
import { createChatRequestHandler } from "@/server/chat/http";
import { loadChatConfig } from "@/server/chat/config";
import { CHAT_NOTICE, CHAT_LIMITS } from "@/contracts/chat";
import { createChatProviderFixture, type ChatProviderFixture } from "../helpers/chat-provider";

describe("createChatRequestHandler integration", () => {
  let fixture: ChatProviderFixture;

  beforeEach(async () => {
    fixture = await createChatProviderFixture();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fixture.close();
  });

  function runRequest(signal?: AbortSignal) {
    return new Request("http://127.0.0.1:3000/api/copilotkit/agent/default/run", { method: "POST", headers: { "Content-Type": "application/json", Origin: "http://127.0.0.1:3000" }, signal,
      body: JSON.stringify({ protocolVersion: PROTOCOL_VERSION, threadId: randomUUID(), runId: randomUUID(), messages: [{ id: randomUUID(), role: "user", content: "hello" }], state: {}, tools: [], context: [], forwardedProps: {} }),
    });
  }
  it("accepts the native Host origin when Next normalizes a loopback request URL", async () => {
    const handler = createChatRequestHandler(loadChatConfig({ CHAT_MODEL_BASE_URL: fixture.baseUrl, CHAT_MODEL_ID: "test-model" }), () => {});
    const request = runRequest();
    const normalized = new Request(request.url.replace("127.0.0.1", "localhost"), { method: "POST", headers: { ...Object.fromEntries(request.headers), host: "127.0.0.1:3000", "x-forwarded-host": "attacker.example" }, body: await request.text() });
    const response = await handler(normalized);
    expect(response.status).toBe(200); expect(await response.text()).toContain("Xin chào");
    expect(fixture.requests).toHaveLength(1);
  });
  it.each(["attacker.example:3000", "127.0.0.1:3000/path", "user@127.0.0.1:3000", "127.0.0.1:3000?query", "127.0.0.1:3000#fragment", "http://127.0.0.1:3000", "127.0.0.1\\:3000", "127.0.0.1:3000 other", "127%2e0%2e0%2e1:3000"])("rejects mismatched or malformed native Host %s without trusting forwarded headers", async (host) => {
    const handler = createChatRequestHandler(loadChatConfig({ CHAT_MODEL_BASE_URL: fixture.baseUrl, CHAT_MODEL_ID: "test-model" }), () => {});
    const request = runRequest(); request.headers.set("host", host); request.headers.set("x-forwarded-host", "127.0.0.1:3000");
    const response = await handler(request);
    expect(response.status).toBe(403); expect(await response.json()).toMatchObject({ message: CHAT_NOTICE }); expect(fixture.requests).toHaveLength(0);
  });
  it("enabled unavailable MCP fails closed before calling the model", async () => {
    const config: Extract<BusinessMcpConfig, { enabled: true }> = { enabled: true, url: new URL("http://127.0.0.1:3199/api/mcp/business"), token: "wrong-token", enabledTools: ["calculate_budget"], allowedHosts: ["127.0.0.1"], allowedOrigins: [] };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("RAW_SECRET_MCP_TOKEN_ERROR", { status: 401 }));
    const handler = createChatRequestHandler(loadChatConfig({ CHAT_MODEL_BASE_URL: fixture.baseUrl, CHAT_MODEL_ID: "test-model" }), () => {}, { businessMcp: config });
    const response = await handler(runRequest());
    const text = await response.text();
    expect(text).toContain(CHAT_NOTICE); expect(text).not.toContain("RAW_SECRET"); expect(text).not.toContain("RUN_FINISHED"); expect(fixture.requests).toHaveLength(0);
  });
  it.each(["request", "reader"])("%s cancellation stops the exact run and aborts provider execution", async (kind) => {
    fixture.setScenario("slow");
    const runner = new InMemoryAgentRunner(); const stop = vi.spyOn(runner, "stop");
    const handler = createChatRequestHandler(loadChatConfig({ CHAT_MODEL_BASE_URL: fixture.baseUrl, CHAT_MODEL_ID: "test-model" }), () => {}, { runner });
    const abort = new AbortController(); const request = runRequest(abort.signal); const identity = await request.clone().json();
    const response = await handler(request); const reader = response.body!.getReader();
    await reader.read(); await vi.waitFor(() => expect(fixture.requests).toHaveLength(1));
    if (kind === "request") abort.abort(); else await reader.cancel();
    await vi.waitFor(() => expect(stop).toHaveBeenCalledWith({ threadId: identity.threadId, runId: identity.runId }));
    await vi.waitFor(() => expect(fixture.requests[0].aborted).toBe(true));
    if (kind === "request") await reader.cancel();
    expect(stop).toHaveBeenCalledTimes(1); runner.clearThreads();
  });

  it("returns 503 with CHAT_NOTICE when config is unavailable", async () => {
    const handler = createChatRequestHandler(loadChatConfig({}), () => {});
    const res = await handler(new Request("http://127.0.0.1:3000/api/copilotkit/info"));

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toEqual({
      code: "chat_unavailable",
      message: CHAT_NOTICE,
    });
  });

  it("rejects browser mutations with cross-origin or missing origin", async () => {
    const configResult = loadChatConfig({
      CHAT_MODEL_BASE_URL: fixture.baseUrl,
      CHAT_MODEL_ID: "test-model",
    });
    const handler = createChatRequestHandler(configResult, () => {});

    // Missing origin on POST
    const resMissingOrigin = await handler(
      new Request("http://127.0.0.1:3000/api/copilotkit/agent/default/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId: "t1", runId: "r1", messages: [] }),
      })
    );
    expect(resMissingOrigin.status).toBe(403);
    const bodyMissing = await resMissingOrigin.json();
    expect(bodyMissing.message).toBe(CHAT_NOTICE);

    // Cross origin on POST
    const resCrossOrigin = await handler(
      new Request("http://127.0.0.1:3000/api/copilotkit/agent/default/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://attacker-site.com",
        },
        body: JSON.stringify({ threadId: "t1", runId: "r1", messages: [] }),
      })
    );
    expect(resCrossOrigin.status).toBe(403);
    const bodyCross = await resCrossOrigin.json();
    expect(bodyCross.message).toBe(CHAT_NOTICE);
  });

  it("rejects oversized request bodies > 256 KiB with status 413", async () => {
    const configResult = loadChatConfig({
      CHAT_MODEL_BASE_URL: fixture.baseUrl,
      CHAT_MODEL_ID: "test-model",
    });
    const handler = createChatRequestHandler(configResult, () => {});

    const hugeString = "a".repeat(CHAT_LIMITS.bodyBytes + 10);
    const res = await handler(
      new Request("http://127.0.0.1:3000/api/copilotkit/agent/default/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://127.0.0.1:3000",
        },
        body: JSON.stringify({ threadId: "t1", runId: "r1", messages: [], extra: hugeString }),
      })
    );

    expect(res.status).toBe(413);
    const body = await res.json();
    expect(body.message).toBe(CHAT_NOTICE);
  });

  it("accepts the browser origin when Next normalizes its internal request URL hostname", async () => {
    const handler = createChatRequestHandler(loadChatConfig({ CHAT_MODEL_BASE_URL: fixture.baseUrl, CHAT_MODEL_ID: "test-model" }), () => {});
    const response = await handler(new Request("http://localhost:3101/api/copilotkit/agent/default/run", {
      method: "POST", headers: { Host: "127.0.0.1:3101", Origin: "http://127.0.0.1:3101", "Content-Type": "application/json" },
      body: JSON.stringify({ threadId: "123e4567-e89b-12d3-a456-426614174000", runId: "123e4567-e89b-12d3-a456-426614174001", state: {}, messages: [{ id: "123e4567-e89b-12d3-a456-426614174002", role: "user", content: "normalized origin" }], tools: [], context: [], forwardedProps: {} }),
    }));
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('"type":"RUN_FINISHED"');
  });

  it.each([
    { origin: "http://attacker.invalid:3101", host: "127.0.0.1:3101" },
    { origin: "http://127.0.0.1:3101/path", host: "127.0.0.1:3101" },
    { origin: "null", host: "127.0.0.1:3101" },
    { origin: "http://127.0.0.1:3101", host: "127.0.0.1:3101/extra" },
    { origin: "http://127.0.0.1:3101", host: "user@127.0.0.1:3101" },
  ])("rejects malformed/cross-origin authority $origin/$host", async ({ origin, host }) => {
    const handler = createChatRequestHandler(loadChatConfig({ CHAT_MODEL_BASE_URL: fixture.baseUrl, CHAT_MODEL_ID: "test-model" }), () => {});
    const response = await handler(new Request("http://localhost:3101/api/copilotkit/agent/default/run", { method: "POST", headers: { Origin: origin, Host: host }, body: "{}" }));
    expect(response.status).toBe(403);
    expect(fixture.requests).toHaveLength(0);
  });

  it("rejects user message exceeding 8000 input chars with status 400", async () => {
    const configResult = loadChatConfig({
      CHAT_MODEL_BASE_URL: fixture.baseUrl,
      CHAT_MODEL_ID: "test-model",
    });
    const handler = createChatRequestHandler(configResult, () => {});

    const longMessage = "x".repeat(CHAT_LIMITS.inputChars + 1);
    const res = await handler(
      new Request("http://127.0.0.1:3000/api/copilotkit/agent/default/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://127.0.0.1:3000",
        },
        body: JSON.stringify({
          threadId: "123e4567-e89b-12d3-a456-426614174000",
          runId: "123e4567-e89b-12d3-a456-426614174001",
          state: {},
          messages: [
            {
              id: "123e4567-e89b-12d3-a456-426614174002",
              role: "user",
              content: longMessage,
            },
          ],
          tools: [],
          context: [],
          forwardedProps: {},
        }),
      })
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toBe(CHAT_NOTICE);
  });

  it("rejects malformed JSON body on /run with status 400", async () => {
    const configResult = loadChatConfig({
      CHAT_MODEL_BASE_URL: fixture.baseUrl,
      CHAT_MODEL_ID: "test-model",
    });
    const handler = createChatRequestHandler(configResult, () => {});

    const res = await handler(
      new Request("http://127.0.0.1:3000/api/copilotkit/agent/default/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://127.0.0.1:3000",
        },
        body: "{ bad json",
      })
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toBe(CHAT_NOTICE);
  });

  it("masks unsupported endpoint 404 with CHAT_NOTICE", async () => {
    const configResult = loadChatConfig({
      CHAT_MODEL_BASE_URL: fixture.baseUrl,
      CHAT_MODEL_ID: "test-model",
    });
    const handler = createChatRequestHandler(configResult, () => {});

    const res = await handler(
      new Request("http://127.0.0.1:3000/api/copilotkit/unsupported-endpoint")
    );

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.message).toBe(CHAT_NOTICE);
  });

  it("successfully streams execution for valid RunAgentInput", async () => {
    const configResult = loadChatConfig({
      CHAT_MODEL_BASE_URL: fixture.baseUrl,
      CHAT_MODEL_ID: "test-model",
      CHAT_MODEL_API_KEY: "secret-key",
    });
    const handler = createChatRequestHandler(configResult, () => {});

    const res = await handler(
      new Request("http://127.0.0.1:3000/api/copilotkit/agent/default/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://127.0.0.1:3000",
        },
        body: JSON.stringify({
          threadId: "123e4567-e89b-12d3-a456-426614174000",
          runId: "123e4567-e89b-12d3-a456-426614174001",
          state: {},
          messages: [
            {
              id: "123e4567-e89b-12d3-a456-426614174002",
              role: "user",
              content: "Xin chào!",
            },
          ],
          tools: [],
          context: [],
          forwardedProps: {},
        }),
      })
    );

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("Xin chào");
    // Verify provider received request
    expect(fixture.requests.length).toBeGreaterThan(0);
    expect(fixture.requests[0].authorization).toBe("Bearer secret-key");
  });

  it("masks provider rejection with CHAT_NOTICE and does not leak RAW_SECRET_ERROR", async () => {
    fixture.setScenario("reject", 401);

    const configResult = loadChatConfig({
      CHAT_MODEL_BASE_URL: fixture.baseUrl,
      CHAT_MODEL_ID: "test-model",
    });
    const handler = createChatRequestHandler(configResult, () => {});

    const res = await handler(
      new Request("http://127.0.0.1:3000/api/copilotkit/agent/default/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://127.0.0.1:3000",
        },
        body: JSON.stringify({
          threadId: "123e4567-e89b-12d3-a456-426614174000",
          runId: "123e4567-e89b-12d3-a456-426614174001",
          state: {},
          messages: [
            {
              id: "123e4567-e89b-12d3-a456-426614174002",
              role: "user",
              content: "Hello fail test",
            },
          ],
          tools: [],
          context: [],
          forwardedProps: {},
        }),
      })
    );

    const text = await res.text();
    expect(text).not.toContain("RAW_SECRET_ERROR");
    expect(text).toContain(CHAT_NOTICE);
  });

  it("masks partial-fail with CHAT_NOTICE without crashing or leaking sentinel", async () => {
    fixture.setScenario("partial-fail");

    const configResult = loadChatConfig({
      CHAT_MODEL_BASE_URL: fixture.baseUrl,
      CHAT_MODEL_ID: "test-model",
    });
    const handler = createChatRequestHandler(configResult, () => {});

    const res = await handler(
      new Request("http://127.0.0.1:3000/api/copilotkit/agent/default/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://127.0.0.1:3000",
        },
        body: JSON.stringify({
          threadId: "123e4567-e89b-12d3-a456-426614174000",
          runId: "123e4567-e89b-12d3-a456-426614174001",
          state: {},
          messages: [
            {
              id: "123e4567-e89b-12d3-a456-426614174002",
              role: "user",
              content: "Hello partial fail",
            },
          ],
          tools: [],
          context: [],
          forwardedProps: {},
        }),
      })
    );

    const text = await res.text();
    expect(text).not.toContain("RAW_SECRET_ERROR");
    expect(text).toContain(CHAT_NOTICE);
  });

  it("allows stop requests to route to SDK without run-input validation failure", async () => {
    const configResult = loadChatConfig({
      CHAT_MODEL_BASE_URL: fixture.baseUrl,
      CHAT_MODEL_ID: "test-model",
    });
    const handler = createChatRequestHandler(configResult, () => {});

    // Stop request sends threadId and runId without run input format
    const res = await handler(
      new Request("http://127.0.0.1:3000/api/copilotkit/agent/default/stop", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://127.0.0.1:3000",
        },
        body: JSON.stringify({
          threadId: "123e4567-e89b-12d3-a456-426614174000",
          runId: "123e4567-e89b-12d3-a456-426614174001",
        }),
      })
    );

    // Should not return 400 (which would happen if run input validation ran on stop)
    expect(res.status).not.toBe(400);
  });
});
