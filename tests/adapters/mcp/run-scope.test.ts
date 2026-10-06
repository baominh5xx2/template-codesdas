import { afterEach, expect, it, vi } from "vitest";
import { createBusinessRunScope } from "@/adapters/mcp/run-scope";
import { createBusinessMcpHttpHandler } from "@/server/mcp/http";
import type { BusinessMcpConfig } from "@/server/mcp/config";
import { calculateBudgetTool } from "@/server/mcp/tools/calculate-budget/definition";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

const config: Extract<BusinessMcpConfig, { enabled: true }> = { enabled: true, url: new URL("http://127.0.0.1:3199/api/mcp/business"), token: "scope-token", enabledTools: ["calculate_budget"], allowedHosts: ["127.0.0.1"], allowedOrigins: [] };
const input = { currency: "USD", budgetMinor: 10, items: [] };
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
function protocolFetch() {
  const handler = createBusinessMcpHttpHandler(config);
  return vi.fn<typeof fetch>(async (url, init) => handler.fetch(new Request(String(url), { ...init, headers: { ...Object.fromEntries(new Headers(init?.headers)), host: "127.0.0.1:3199" } })));
}
it("uses modern protocol, real discovery/call and closes exactly once", async () => {
  const transportClose = vi.spyOn(StreamableHTTPClientTransport.prototype, "close");
  const fetch = protocolFetch();
  const scope = await createBusinessRunScope({ config, threadId: "thread", runId: "run", signal: new AbortController().signal, fetch });
  const close = vi.spyOn(scope.client, "close");
  const tools = await scope.provider.tools();
  expect(await tools.business__calculate_budget.execute!(input, { toolCallId: "call", messages: [] })).toEqual({ currency: "USD", totalMinor: 0, remainingMinor: 10, overBudget: false, itemCount: 0 });
  expect(scope.client.getProtocolEra()).toBe("modern");
  await scope.close(); await scope.close(); expect(close).toHaveBeenCalledTimes(1); expect(transportClose).toHaveBeenCalledTimes(1);
});
it("serializes calls and atomically rejects the fourth without executing it", async () => {
  const original = calculateBudgetTool.execute;
  let active = 0; let maximum = 0;
  const handler = vi.spyOn(calculateBudgetTool, "execute").mockImplementation(async (args, context) => { active++; maximum = Math.max(maximum, active); await new Promise((r) => setTimeout(r, 2)); active--; return original(args, context); });
  const scope = await createBusinessRunScope({ config, threadId: "t", runId: "r", signal: new AbortController().signal, fetch: protocolFetch() });
  const execute = (await scope.provider.tools()).business__calculate_budget.execute!;
  await Promise.all([1, 2, 3].map((id) => execute(input, { toolCallId: String(id), messages: [] })));
  expect(maximum).toBe(1); expect(handler).toHaveBeenCalledTimes(3);
  await expect(execute(input, { toolCallId: "4", messages: [] })).rejects.toThrow("Chưa kết nối");
  expect(scope.signal.aborted).toBe(true); await scope.close();
});
it("invalid inputs fail before HTTP and latch the run failure", async () => {
  const fetch = protocolFetch(); const failure = vi.fn();
  const scope = await createBusinessRunScope({ config, threadId: "t", runId: "r", signal: new AbortController().signal, fetch, onFailure: failure });
  const count = fetch.mock.calls.length;
  await expect((await scope.provider.tools()).business__calculate_budget.execute!({ ...input, budgetMinor: -1 }, { toolCallId: "bad", messages: [] })).rejects.toThrow("Chưa kết nối");
  expect(fetch).toHaveBeenCalledTimes(count); expect(failure).toHaveBeenCalledTimes(1); expect(scope.signal.aborted).toBe(true); await scope.close();
});
it("Stop aborts HTTP and cooperative handler and rejects late results", async () => {
  let handlerSignal: AbortSignal | undefined; let settled = false;
  vi.spyOn(calculateBudgetTool, "execute").mockImplementation(async (_args, context) => { handlerSignal = context.signal; await new Promise<void>((resolve) => context.signal.addEventListener("abort", () => resolve(), { once: true })); settled = true; return { currency: "USD", totalMinor: 0, remainingMinor: 10, overBudget: false, itemCount: 0 }; });
  const abort = new AbortController(); const failure = vi.fn();
  const scope = await createBusinessRunScope({ config, threadId: "t", runId: "r", signal: abort.signal, fetch: protocolFetch(), onFailure: failure });
  const call = (await scope.provider.tools()).business__calculate_budget.execute!(input, { toolCallId: "c", messages: [] }); const rejection = expect(call).rejects.toThrow("Chưa kết nối");
  await vi.waitFor(() => expect(handlerSignal).toBeDefined()); abort.abort(); await rejection;
  expect(handlerSignal!.aborted).toBe(true); expect(settled).toBe(true); expect(failure).not.toHaveBeenCalled(); await scope.close();
});
it("rejects legacy fallback before tool discovery or execution", async () => {
  const methods: string[] = [];
  const fetch = vi.fn<typeof globalThis.fetch>(async (_url, init) => {
    if (init?.method === "GET") return new Response(null, { status: 405 });
    const request = JSON.parse(String(init?.body)); methods.push(request.method);
    if (request.method === "server/discover") return Response.json({ jsonrpc: "2.0", id: request.id, error: { code: -32601, message: "legacy only" } });
    if (request.method === "initialize") return Response.json({ jsonrpc: "2.0", id: request.id, result: { protocolVersion: "2025-11-25", capabilities: { tools: {} }, serverInfo: { name: "legacy", version: "1" } } });
    return new Response(null, { status: 202 });
  });
  const close = vi.spyOn(Client.prototype, "close");
  await expect(createBusinessRunScope({ config, threadId: "t", runId: "r", signal: new AbortController().signal, fetch })).rejects.toMatchObject({ message: "Chưa kết nối", code: "legacy_protocol_denied" });
  expect(methods).toContain("initialize"); expect(methods).not.toContain("tools/list"); expect(methods).not.toContain("tools/call"); expect(close).toHaveBeenCalledTimes(1);
});
it.each(["connect", "discovery"] as const)("aborts %s at 5 seconds, closes once, and never retries", async (stage) => {
  vi.useFakeTimers();
  const real = protocolFetch(); let observed: AbortSignal | null | undefined; let settled = false; let blocked = 0;
  const fetch = vi.fn<typeof globalThis.fetch>(async (url, init) => {
    const method = JSON.parse(String(init?.body)).method;
    if ((stage === "connect" && method === "server/discover") || (stage === "discovery" && method === "tools/list")) {
      blocked++; observed = init?.signal;
      await new Promise<void>((resolve) => init?.signal?.addEventListener("abort", () => resolve(), { once: true })); settled = true;
      throw new Error("secret token stack");
    }
    return real(url, init);
  });
  const close = vi.spyOn(Client.prototype, "close"); const failure = vi.fn();
  const create = createBusinessRunScope({ config, threadId: "t", runId: "r", signal: new AbortController().signal, fetch, onFailure: failure });
  const rejection = expect(create).rejects.toThrow("Chưa kết nối");
  await vi.advanceTimersByTimeAsync(100); expect(observed?.aborted).toBe(false);
  await vi.advanceTimersByTimeAsync(4900); await rejection;
  expect(observed?.aborted).toBe(true); expect(settled).toBe(true); expect(blocked).toBe(1); expect(close).toHaveBeenCalledTimes(1); expect(failure).toHaveBeenCalledTimes(1);
});
it("includes queue wait in the 15 second deadline and aborts all handler work", async () => {
  vi.useFakeTimers(); let active = 0; let settled = 0;
  vi.spyOn(calculateBudgetTool, "execute").mockImplementation(async (_args, context) => { active++; await new Promise<void>((resolve) => context.signal.addEventListener("abort", () => resolve(), { once: true })); active--; settled++; return { currency: "USD", totalMinor: 0, remainingMinor: 10, overBudget: false, itemCount: 0 }; });
  const scope = await createBusinessRunScope({ config, threadId: "t", runId: "r", signal: new AbortController().signal, fetch: protocolFetch() });
  const execute = (await scope.provider.tools()).business__calculate_budget.execute!;
  const first = execute(input, { toolCallId: "1", messages: [] }); const firstRejected = expect(first).rejects.toThrow("Chưa kết nối");
  const queued = execute(input, { toolCallId: "2", messages: [] }); const queuedRejected = expect(queued).rejects.toThrow("Chưa kết nối");
  await vi.advanceTimersByTimeAsync(14999); expect(active).toBe(1);
  await vi.advanceTimersByTimeAsync(1); await firstRejected; await queuedRejected;
  expect(active).toBe(0); expect(settled).toBe(1); await scope.close();
});
it("uses the remaining run deadline and closes an idle whole run at 120 seconds", async () => {
  vi.useFakeTimers(); let time = 0;
  const scope = await createBusinessRunScope({ config, threadId: "t", runId: "r", signal: new AbortController().signal, fetch: protocolFetch(), now: () => time });
  const close = vi.spyOn(scope.client, "close");
  await vi.advanceTimersByTimeAsync(120000); expect(scope.signal.aborted).toBe(true); await scope.close(); expect(close).toHaveBeenCalledTimes(1);
  const second = await createBusinessRunScope({ config, threadId: "t", runId: "r2", signal: new AbortController().signal, fetch: protocolFetch(), now: () => time });
  time = 119500;
  let handlerAborted = false;
  vi.spyOn(calculateBudgetTool, "execute").mockImplementation(async (_args, context) => { await new Promise<void>((resolve) => context.signal.addEventListener("abort", () => resolve(), { once: true })); handlerAborted = true; return { currency: "USD", totalMinor: 0, remainingMinor: 10, overBudget: false, itemCount: 0 }; });
  const call = (await second.provider.tools()).business__calculate_budget.execute!(input, { toolCallId: "c", messages: [] }); const rejection = expect(call).rejects.toThrow("Chưa kết nối");
  await vi.advanceTimersByTimeAsync(499); expect(handlerAborted).toBe(false);
  await vi.advanceTimersByTimeAsync(1); await rejection; expect(handlerAborted).toBe(true); await second.close();
});
it("treats the agent execute AbortSignal as interruption and closes once", async () => {
  let observed: AbortSignal | undefined;
  vi.spyOn(calculateBudgetTool, "execute").mockImplementation(async (_args, context) => { observed = context.signal; await new Promise<void>((resolve) => context.signal.addEventListener("abort", () => resolve(), { once: true })); return { currency: "USD", totalMinor: 0, remainingMinor: 10, overBudget: false, itemCount: 0 }; });
  const failure = vi.fn(); const scope = await createBusinessRunScope({ config, threadId: "t", runId: "r", signal: new AbortController().signal, fetch: protocolFetch(), onFailure: failure });
  const close = vi.spyOn(scope.client, "close"); const abort = new AbortController();
  const call = (await scope.provider.tools()).business__calculate_budget.execute!(input, { toolCallId: "c", messages: [], abortSignal: abort.signal }); const rejection = expect(call).rejects.toThrow("Chưa kết nối");
  await vi.waitFor(() => expect(observed).toBeDefined()); abort.abort(); await rejection;
  expect(observed!.aborted).toBe(true); expect(failure).not.toHaveBeenCalled(); await scope.close(); expect(close).toHaveBeenCalledTimes(1);
});
it("latches interruption across sibling executions with different AbortSignals", async () => {
  let observed: AbortSignal | undefined;
  const handler = vi.spyOn(calculateBudgetTool, "execute").mockImplementation(async (_args, context) => { observed = context.signal; await new Promise<void>((resolve) => context.signal.addEventListener("abort", () => resolve(), { once: true })); return { currency: "USD", totalMinor: 0, remainingMinor: 10, overBudget: false, itemCount: 0 }; });
  const failure = vi.fn(); const scope = await createBusinessRunScope({ config, threadId: "t", runId: "r", signal: new AbortController().signal, fetch: protocolFetch(), onFailure: failure });
  const close = vi.spyOn(scope.client, "close"); const firstAbort = new AbortController(); const siblingAbort = new AbortController();
  const execute = (await scope.provider.tools()).business__calculate_budget.execute!;
  const first = execute(input, { toolCallId: "first", messages: [], abortSignal: firstAbort.signal }); const firstRejected = expect(first).rejects.toThrow("Chưa kết nối");
  const sibling = execute(input, { toolCallId: "queued", messages: [], abortSignal: siblingAbort.signal }); const siblingRejected = expect(sibling).rejects.toThrow("Chưa kết nối");
  await vi.waitFor(() => expect(observed).toBeDefined()); firstAbort.abort(); await firstRejected; await siblingRejected;
  expect(siblingAbort.signal.aborted).toBe(false); expect(observed!.aborted).toBe(true); expect(handler).toHaveBeenCalledTimes(1);
  expect(failure).not.toHaveBeenCalled(); await scope.close(); expect(close).toHaveBeenCalledTimes(1);
});
it.each(["error", "invalid", "disconnect"] as const)("sanitizes %s before returning output and closes once", async (mode) => {
  const real = protocolFetch(); let calls = 0;
  const fetch = vi.fn<typeof globalThis.fetch>(async (url, init) => {
    const request = JSON.parse(String(init?.body));
    if (request.method !== "tools/call") return real(url, init);
    calls++;
    if (mode === "disconnect") throw new Error("Bearer private-secret raw stack");
    return Response.json({ jsonrpc: "2.0", id: request.id, result: mode === "error" ? { isError: true, content: [{ type: "text", text: "Bearer private-secret" }] } : { structuredContent: { currency: "bad" }, content: [] } });
  });
  const failure = vi.fn(); const scope = await createBusinessRunScope({ config, threadId: "t", runId: "r", signal: new AbortController().signal, fetch, onFailure: failure }); const close = vi.spyOn(scope.client, "close");
  await expect((await scope.provider.tools()).business__calculate_budget.execute!(input, { toolCallId: "c", messages: [] })).rejects.toThrow("Chưa kết nối");
  expect(calls).toBe(1); expect(failure).toHaveBeenCalledTimes(1); await scope.close(); expect(close).toHaveBeenCalledTimes(1);
});
it("rejects oversized input without HTTP and ignores an error thrown by failure observer", async () => {
  const fetch = protocolFetch(); const scope = await createBusinessRunScope({ config, threadId: "t", runId: "r", signal: new AbortController().signal, fetch, onFailure() { throw new Error("secret"); } });
  const count = fetch.mock.calls.length;
  await expect((await scope.provider.tools()).business__calculate_budget.execute!({ ...input, extra: "x".repeat(32768) }, { toolCallId: "c", messages: [] })).rejects.toThrow("Chưa kết nối");
  expect(fetch).toHaveBeenCalledTimes(count); expect(scope.signal.aborted).toBe(true); await scope.close();
});
it("denies the fourth concurrent invocation atomically, and closes a pre-aborted run without HTTP", async () => {
  const handler = vi.spyOn(calculateBudgetTool, "execute");
  const failure = vi.fn(); const scope = await createBusinessRunScope({ config, threadId: "t", runId: "r", signal: new AbortController().signal, fetch: protocolFetch(), onFailure: failure });
  const execute = (await scope.provider.tools()).business__calculate_budget.execute!;
  const results = await Promise.allSettled([1, 2, 3, 4].map((i) => execute(input, { toolCallId: String(i), messages: [] })));
  expect(results.every((r) => r.status === "rejected")).toBe(true); expect(handler).not.toHaveBeenCalled(); expect(failure).toHaveBeenCalledTimes(1); await scope.close();
  const fetch = protocolFetch(); const close = vi.spyOn(Client.prototype, "close"); const abort = new AbortController(); abort.abort();
  await expect(createBusinessRunScope({ config, threadId: "t", runId: "r2", signal: abort.signal, fetch })).rejects.toThrow("Chưa kết nối");
  expect(fetch).not.toHaveBeenCalled(); expect(close).toHaveBeenCalledTimes(1);
});
