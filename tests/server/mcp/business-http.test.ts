import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { BusinessTool, BusinessToolContext } from "@/core/tools/definition";
import { loadBusinessMcpConfig } from "@/server/mcp/config";
import { createBusinessMcpHttpHandler } from "@/server/mcp/http";
import { BUSINESS_MCP_MAX_RESPONSE_BYTES, sanitizeBusinessMcpResponse } from "@/server/mcp/errors";
import { calculateBudgetTool } from "@/server/mcp/tools/calculate-budget/definition";
import { POST } from "@/app/api/mcp/business/route";

const values = {
  BUSINESS_MCP_ENABLED: "true", BUSINESS_MCP_URL: "http://localhost/api/mcp/business",
  BUSINESS_MCP_TOKEN: "business-test-token", BUSINESS_MCP_TOOLS: "calculate_budget",
  BUSINESS_MCP_ALLOWED_HOSTS: "localhost", BUSINESS_MCP_ALLOWED_ORIGINS: "http://localhost:3000",
};
const sample = { currency: "USD", budgetMinor: 10000, items: [{ label: "Venue", amountMinor: 6500 }, { label: "Food", amountMinor: 4500 }] };
afterEach(() => { vi.unstubAllEnvs(); });

function request(method = "tools/list", params?: unknown, headers: Record<string, string | undefined> = {}, body?: string, signal?: AbortSignal) {
  const requestHeaders = new Headers({
    host: "localhost", authorization: "Bearer business-test-token",
    accept: "application/json, text/event-stream", "content-type": "application/json",
  });
  for (const [key, value] of Object.entries(headers)) if (value !== undefined) requestHeaders.set(key, value);
  return new Request(values.BUSINESS_MCP_URL, { method: "POST", signal, headers: requestHeaders,
    body: body ?? JSON.stringify({ jsonrpc: "2.0", id: 1, method, ...(params ? { params } : {}) }) });
}
function fixture(definitions: readonly BusinessTool<unknown, unknown>[] = [calculateBudgetTool], names = "calculate_budget") {
  const handler = createBusinessMcpHttpHandler(loadBusinessMcpConfig({ ...values, BUSINESS_MCP_TOOLS: names }), definitions);
  return handler;
}
async function payload(response: Response) {
  const text = await response.text();
  if (response.headers.get("content-type")?.includes("text/event-stream")) {
    return JSON.parse(text.split("\n").find((line) => line.startsWith("data: "))!.slice(6));
  }
  return JSON.parse(text);
}
const echo: BusinessTool<{ value: string }, { value: string }> = {
  name: "echo", version: "1.0.0", description: "Echo input", kind: "read",
  input: z.object({ value: z.string() }), output: z.object({ value: z.string() }),
  async execute(input) { return input; },
};

describe("business MCP config", () => {
  it("defaults off without reading pgEdge settings", () => {
    expect(loadBusinessMcpConfig({ MCP_AUTH_TOKEN: "pgedge-secret", PGEDGE_MCP_URL: "not a URL" })).toEqual({ enabled: false });
  });
  it.each(["BUSINESS_MCP_URL", "BUSINESS_MCP_TOKEN", "BUSINESS_MCP_TOOLS", "BUSINESS_MCP_ALLOWED_HOSTS", "BUSINESS_MCP_ALLOWED_ORIGINS"])("requires %s when enabled", (key) => {
    expect(() => loadBusinessMcpConfig({ ...values, [key]: undefined, MCP_AUTH_TOKEN: "pgedge-secret" })).toThrow("business_mcp_config_invalid");
  });
  it.each([
    { BUSINESS_MCP_ENABLED: "yes" }, { BUSINESS_MCP_URL: "https://token@backend/mcp" },
    { BUSINESS_MCP_URL: "file:///private-path" }, { BUSINESS_MCP_URL: "https://backend/mcp#fragment" },
    { BUSINESS_MCP_TOOLS: "*" }, { BUSINESS_MCP_ALLOWED_HOSTS: "*" },
    { BUSINESS_MCP_ALLOWED_ORIGINS: "*" }, { BUSINESS_MCP_ALLOWED_ORIGINS: "https://site/path" },
  ])("rejects unsafe backend config %j without leaking credentials", (change) => {
    expect(() => loadBusinessMcpConfig({ ...values, ...change, BUSINESS_MCP_TOKEN: "config-secret" })).toThrow("business_mcp_config_invalid");
  });
});

describe("business MCP HTTP guards and protocol", () => {
  it("keeps the actual route disabled by default", async () => {
    vi.stubEnv("BUSINESS_MCP_ENABLED", "false");
    expect((await POST(request())).status).toBe(503);
  });
  it("serves valid bearer discovery and returns equivalent structured/text output", async () => {
    const handler = fixture();
    const response = await handler.fetch(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
    expect((await payload(response)).result.tools.map((tool: { name: string }) => tool.name)).toEqual(["calculate_budget"]);
    const result = (await payload(await handler.fetch(request("tools/call", { name: "calculate_budget", arguments: sample })))).result;
    expect(result.structuredContent).toEqual({ currency: "USD", totalMinor: 11000, remainingMinor: -1000, overBudget: true, itemCount: 2 });
    expect(JSON.parse(result.content[0].text)).toEqual(result.structuredContent);
  });
  it.each(["", "Bearer wrong-secret", "Basic business-test-token"])("rejects unauthorized protocol requests before parsing: %s", async (authorization) => {
    const response = await fixture().fetch(request("tools/list", undefined, { authorization }, "not JSON with private-secret"));
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toBe("Bearer");
    expect(await response.text()).not.toMatch(/private-secret|wrong-secret|business-test-token/);
  });
  it.each([{ host: "" }, { host: "attacker.invalid" }, { host: "localhost@attacker.invalid" }, { origin: "https://attacker.invalid" }, { origin: "http://localhost:9999" }, { origin: "null" }, { origin: "" }])("denies Host/Origin %j", async (headers) => {
    const response = await fixture().fetch(request("tools/list", undefined, headers));
    expect(response.status).toBe(403);
    expect(await response.text()).not.toContain("attacker.invalid");
  });
  it("hides disabled tools from discovery and rejects direct calls without executing", async () => {
    const calls: unknown[] = [];
    const disabled = { ...echo, async execute(input: { value: string }) { calls.push(input); return input; } };
    const handler = fixture([calculateBudgetTool, disabled]);
    expect((await payload(await handler.fetch(request()))).result.tools).toHaveLength(1);
    for (const name of ["echo", "missing-private-secret", "business__calculate_budget"]) {
      const denied = await payload(await handler.fetch(request("tools/call", { name, arguments: { value: "private-secret" } })));
      expect(denied.error ?? denied.result?.isError).toBeTruthy();
      expect(JSON.stringify(denied)).not.toContain("private-secret");
    }
    expect(calls).toEqual([]);
  });
  it("validates input before execution and sanitizes SDK validation errors", async () => {
    const calls: unknown[] = [];
    const tool = { ...calculateBudgetTool, async execute(input: typeof sample, context: BusinessToolContext) { calls.push(input); return calculateBudgetTool.execute(input, context); } };
    const invalid = { ...sample, currency: "private-input-secret" };
    const response = await fixture([tool]).fetch(request("tools/call", { name: "calculate_budget", arguments: invalid }));
    const result = await payload(response);
    expect(result.error ?? result.result?.isError).toBeTruthy();
    expect(JSON.stringify(result)).not.toContain("private-input-secret");
    expect(calls).toEqual([]);
  });
  it("rejects declared and streamed request bodies over 256 KiB", async () => {
    const handler = fixture();
    const body = " ".repeat(256 * 1024 + 1);
    for (const headers of [{}, { "content-length": String(body.length) }]) {
      expect((await handler.fetch(request("tools/list", undefined, headers, body))).status).toBe(413);
    }
  });
  it("accepts a 256 KiB request body", async () => {
    const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" });
    expect((await fixture().fetch(request("tools/list", undefined, {}, body.padEnd(256 * 1024, " ")))).status).toBe(200);
  });
  it("includes request ID and JSON-RPC envelope in the final response cap", async () => {
    const id = "private-id-secret".repeat(2500);
    const response = await fixture().fetch(request("tools/list", undefined, {}, JSON.stringify({ jsonrpc: "2.0", id, method: "tools/list" })));
    const body = await response.text();
    expect(Buffer.byteLength(body)).toBeLessThanOrEqual(32768);
    expect(response.status).toBe(500);
    expect(JSON.parse(body)).toEqual({ jsonrpc: "2.0", id: null, error: { code: -32603, message: "business_mcp_result_too_large" } });
    expect(body).not.toContain("private-id-secret");
  });
  it("rejects tool results over 32 KiB using UTF-8 wire bytes", async () => {
    const handler = fixture([echo], "echo");
    const result = (await payload(await handler.fetch(request("tools/call", { name: "echo", arguments: { value: "😀".repeat(9000) } })))).result;
    expect(result.isError).toBe(true);
    expect(result.content).toEqual([{ type: "text", text: "business_mcp_result_too_large" }]);
    expect(result.structuredContent).toBeUndefined();
  });
  it("stops reading an oversized SDK response at the response cap", async () => {
    let cancelled = false;
    let enqueued = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        enqueued += 1;
        controller.enqueue(new Uint8Array(16 * 1024).fill(0x20));
      },
      cancel() { cancelled = true; },
    });
    const safe = await sanitizeBusinessMcpResponse(new Response(body, { headers: { "content-type": "application/json" } }));
    expect(safe.status).toBe(500);
    expect(Buffer.byteLength(await safe.text())).toBeLessThanOrEqual(BUSINESS_MCP_MAX_RESPONSE_BYTES);
    expect(cancelled).toBe(true);
    expect(enqueued).toBeLessThanOrEqual(3);
  });
  it.each(["throw", "output"])("sanitizes handler %s errors without secrets", async (mode) => {
    const broken = { ...echo, async execute() { if (mode === "throw") throw new Error("Authorization: Bearer private-handler-secret"); return { value: 5 } as unknown as { value: string }; } };
    const result = await payload(await fixture([broken], "echo").fetch(request("tools/call", { name: "echo", arguments: { value: "x" } })));
    expect(result.result.isError).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/private-handler-secret|Authorization|Zod/);
  });
  it("sanitizes malformed protocol headers and payload errors", async () => {
    const handler = fixture();
    for (const req of [request("private-method-secret"), request("tools/list", undefined, { "mcp-protocol-version": "private-version-secret" }), request("tools/list", undefined, {}, "{private-json-secret")]) {
      const response = await handler.fetch(req);
      expect(await response.text()).not.toMatch(/private-.*-secret/);
      expect(response.headers.get("location")).toBeNull();
    }
  });
  it("joins HTTP abort with the official callback signal for cooperative handlers", async () => {
    let observed: BusinessToolContext | undefined;
    let settled = false;
    const slow = { ...echo, async execute(input: { value: string }, context: BusinessToolContext) {
      observed = context;
      await new Promise<void>((resolve) => { if (context.signal.aborted) resolve(); else context.signal.addEventListener("abort", () => resolve(), { once: true }); });
      settled = true;
      context.signal.throwIfAborted();
      return input;
    } };
    const abort = new AbortController();
    const correlation = { threadId: "thread-123", runId: "run-456", toolCallId: "call-789" };
    const response = fixture([slow], "echo").fetch(request("tools/call", { name: "echo", arguments: { value: "x" }, _meta: { "com.hackathon-starter/business-context": correlation } }, {}, undefined, abort.signal));
    await vi.waitFor(() => expect(observed).toBeDefined());
    abort.abort(new Error("private-abort-secret"));
    await response;
    expect(observed!.signal.aborted).toBe(true);
    expect(settled).toBe(true);
    expect(observed).toMatchObject(correlation);
    expect(observed!.deadline).toBeGreaterThan(Date.now() - 1000);
  });
});
