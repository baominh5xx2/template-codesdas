import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MockLanguageModelV3, simulateReadableStream } from "ai/test";
import { EventType, PROTOCOL_VERSION, type RunAgentInput, type BaseEvent, type RunFinishedEvent } from "@ag-ui/client";
import { InMemoryAgentRunner } from "@copilotkit/runtime/v2";
import { lastValueFrom, toArray } from "rxjs";
import { RunScopedAgent } from "@/adapters/agents/run-scoped-agent";
import { createExecutionGate } from "@/adapters/agents/chat-policy";
import { createBusinessRunScope } from "@/adapters/mcp/run-scope";
import { createBusinessMcpHttpHandler } from "@/server/mcp/http";
import type { BusinessMcpConfig } from "@/server/mcp/config";
import { calculateBudgetTool } from "@/server/mcp/tools/calculate-budget/definition";

const config: Extract<BusinessMcpConfig, { enabled: true }> = { enabled: true, url: new URL("http://127.0.0.1:3199/api/mcp/business"), token: "task-five-token", enabledTools: ["calculate_budget"], allowedHosts: ["127.0.0.1"], allowedOrigins: [] };
const args = { currency: "USD", budgetMinor: 100, items: [{ label: "Food", amountMinor: 30 }] };
const usage = { inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined }, outputTokens: { total: 1, text: 1, reasoning: undefined } };
function input(): RunAgentInput { return { protocolVersion: PROTOCOL_VERSION, threadId: randomUUID(), runId: randomUUID(), state: {}, messages: [{ id: randomUUID(), role: "user", content: "Calculate" }], tools: [], context: [], forwardedProps: {} }; }
function model(toolName = "business__calculate_budget", toolInput = JSON.stringify(args), continuation?: (signal: AbortSignal | undefined) => Promise<void>) {
  let calls = 0;
  return new MockLanguageModelV3({ doStream: async (options) => {
    if (calls++ === 0) return { stream: simulateReadableStream({ chunks: [
      { type: "stream-start", warnings: [] },
      { type: "tool-input-start", id: "call", toolName },
      { type: "tool-input-delta", id: "call", delta: toolInput },
      { type: "tool-input-end", id: "call" },
      { type: "tool-call", toolCallId: "call", toolName, input: toolInput },
      { type: "finish", finishReason: { unified: "tool-calls", raw: "tool_calls" }, usage },
    ] }) };
    await continuation?.(options.abortSignal);
    return { stream: simulateReadableStream({ chunks: [
      { type: "stream-start", warnings: [] }, { type: "text-start", id: "answer" },
      { type: "text-delta", id: "answer", delta: "Total 30; remaining 70" }, { type: "text-end", id: "answer" },
      { type: "finish", finishReason: { unified: "stop", raw: "stop" }, usage },
    ] }) };
  } });
}
function fetchProtocol() {
  const handler = createBusinessMcpHttpHandler(config);
  return vi.fn<typeof fetch>(async (url, init) => handler.fetch(new Request(String(url), { ...init, headers: { ...Object.fromEntries(new Headers(init?.headers)), host: "127.0.0.1:3199" } })));
}
function setup(m = model(), fetch = fetchProtocol()) {
  const gate = createExecutionGate(); const close = vi.fn();
  const agent = new RunScopedAgent({ model: m, config, gate, diagnostics: () => {}, scopeFactory: async (options) => {
    const scope = await createBusinessRunScope({ ...options, fetch });
    return { ...scope, close: async () => { close(); await scope.close(); } };
  } });
  return { agent, gate, close, m, fetch };
}
async function run(agent: RunScopedAgent) { return lastValueFrom(agent.run(input()).pipe(toArray())); }
afterEach(() => vi.restoreAllMocks());

describe("run-scoped BuiltInAgent tools", () => {
  it("executes a real handler and supplies validated output to the next model step", async () => {
    const s = setup(); const events = await run(s.agent);
    expect(events.some((e) => e.type === EventType.TOOL_CALL_RESULT && "content" in e && String(e.content).includes('"totalMinor":30'))).toBe(true);
    expect(events.some((e) => e.type === EventType.TEXT_MESSAGE_CHUNK && "delta" in e && e.delta === "Total 30; remaining 70")).toBe(true);
    expect(s.m.doStreamCalls).toHaveLength(2);
    expect(s.m.doStreamCalls[0].tools?.map((tool) => tool.type === "function" ? tool.name : tool.type)).toEqual(["business__calculate_budget"]);
    expect(JSON.stringify(s.m.doStreamCalls[1].prompt)).toContain('"remainingMinor":70');
    expect(s.close).toHaveBeenCalledTimes(1);
    expect(s.gate.acquire("next", "run")).toBe(true);
  });
  it("opens a fresh scope for each clone/run while preserving AbstractAgent state", async () => {
    const s = setup(); await run(s.agent);
    s.agent.messages = [{ id: "retained", role: "user", content: "follow-up" }];
    const cloned = s.agent.clone(); expect(cloned.messages).toEqual(s.agent.messages); expect(cloned.messages).not.toBe(s.agent.messages);
    await run(cloned);
    expect(s.close).toHaveBeenCalledTimes(2);
    expect(s.fetch.mock.calls.filter((call) => JSON.parse(String(call[1]?.body)).method === "server/discover")).toHaveLength(2);
  });
  it.each(["input", "json", "unknown"])("rejects %s before SDK execution or model continuation", async (kind) => {
    const m = model(kind === "unknown" ? "secret__denied" : undefined, kind === "input" ? JSON.stringify({ ...args, budgetMinor: -1 }) : kind === "json" ? "RAW_SECRET_MALFORMED" : undefined);
    const s = setup(m); const handler = vi.spyOn(calculateBudgetTool, "execute");
    const events = await run(s.agent);
    expect(handler).not.toHaveBeenCalled(); expect(m.doStreamCalls).toHaveLength(1);
    expect(events.filter((e) => e.type === EventType.RUN_ERROR)).toEqual([{ type: EventType.RUN_ERROR, message: "Chưa kết nối" }]);
    expect(events.some((e) => [EventType.TOOL_CALL_ARGS, EventType.TOOL_CALL_RESULT, EventType.RUN_FINISHED].includes(e.type))).toBe(false);
    expect(JSON.stringify(events)).not.toContain("RAW_SECRET"); expect(s.close).toHaveBeenCalledTimes(1);
  });
  it.each(["throw", "output"])("latches %s failure before any tool result or next model step", async (kind) => {
    vi.spyOn(calculateBudgetTool, "execute").mockImplementation(async () => { if (kind === "throw") throw new Error("RAW_SECRET_TOKEN_STACK"); return { currency: "USD", totalMinor: -1, remainingMinor: 0, overBudget: false, itemCount: 0 }; });
    const s = setup(); const events = await run(s.agent);
    expect(s.m.doStreamCalls).toHaveLength(1);
    expect(events.filter((e) => e.type === EventType.RUN_ERROR)).toEqual([{ type: EventType.RUN_ERROR, message: "Chưa kết nối" }]);
    expect(events.some((e) => e.type === EventType.TOOL_CALL_RESULT || e.type === EventType.RUN_FINISHED)).toBe(false);
    expect(JSON.stringify(events)).not.toContain("RAW_SECRET"); expect(s.close).toHaveBeenCalledTimes(1);
  });
  it("fails connection before model invocation", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response("RAW_SECRET", { status: 401 }));
    const s = setup(model(), fetch); const events = await run(s.agent);
    expect(s.m.doStreamCalls).toHaveLength(0); expect(events).toEqual([{ type: EventType.RUN_ERROR, message: "Chưa kết nối" }]);
    expect(s.gate.acquire("next", "run")).toBe(true);
  });
  it.each(["isError", "malformed"])("suppresses raw %s protocol results before model and UI", async (kind) => {
    const real = fetchProtocol();
    const fetch = vi.fn<typeof globalThis.fetch>(async (url, init) => {
      const response = await real(url, init);
      if (JSON.parse(String(init?.body)).method !== "tools/call") return response;
      const body = await response.json();
      body.result = kind === "isError" ? { isError: true, content: [{ type: "text", text: "RAW_SECRET_MCP_ERROR" }] } : { structuredContent: { totalMinor: "RAW_SECRET_MALFORMED" } };
      return Response.json(body);
    });
    const s = setup(model(), fetch); const events = await run(s.agent);
    expect(s.m.doStreamCalls).toHaveLength(1);
    expect(events.filter((e) => e.type === EventType.RUN_ERROR)).toEqual([{ type: EventType.RUN_ERROR, message: "Chưa kết nối" }]);
    expect(events.some((e) => e.type === EventType.TOOL_CALL_RESULT || e.type === EventType.RUN_FINISHED)).toBe(false);
    expect(JSON.stringify(events)).not.toContain("RAW_SECRET"); expect(s.close).toHaveBeenCalledTimes(1);
  });
  it("deadline aborts discovery and releases the gate before the safe failure", async () => {
    vi.useFakeTimers();
    try {
      let signal: AbortSignal | undefined;
      const gate = createExecutionGate();
      const m = model();
      const agent = new RunScopedAgent({ model: m, config, gate, diagnostics: () => {}, deadlineMs: 10, scopeFactory: async (options) => {
        signal = options.signal;
        await new Promise<void>((resolve) => options.signal.addEventListener("abort", () => resolve(), { once: true }));
        throw new Error("RAW_SECRET_TIMEOUT");
      } });
      const eventsPromise = run(agent); await vi.advanceTimersByTimeAsync(10);
      expect(await eventsPromise).toEqual([{ type: EventType.RUN_ERROR, message: "Chưa kết nối" }]);
      expect(signal?.aborted).toBe(true); expect(m.doStreamCalls).toHaveLength(0); expect(gate.acquire("next", "run")).toBe(true);
    } finally { vi.useRealTimers(); }
  });
  it.each(["connection", "tool", "continuation"])("Stop during %s aborts and suppresses late output; next run proceeds", async (stage) => {
    let signal: AbortSignal | null | undefined;
    const wait = async (s: AbortSignal | null | undefined) => { signal = s; await new Promise<void>((resolve) => { if (s?.aborted) resolve(); else s?.addEventListener("abort", () => resolve(), { once: true }); }); };
    const realFetch = fetchProtocol();
    const fetch = vi.fn<typeof globalThis.fetch>(async (url, init) => { if (stage === "connection" && JSON.parse(String(init?.body)).method === "server/discover") { await wait(init?.signal); throw new Error("RAW_SECRET"); } return realFetch(url, init); });
    if (stage === "tool") vi.spyOn(calculateBudgetTool, "execute").mockImplementation(async (_args, context) => { await wait(context.signal); return { currency: "USD", totalMinor: 30, remainingMinor: 70, overBudget: false, itemCount: 1 }; });
    const s = setup(model(undefined, undefined, stage === "continuation" ? wait : undefined), fetch);
    const runner = new InMemoryAgentRunner(); const i = input(); s.agent.messages = i.messages; s.agent.threadId = i.threadId;
    const eventsPromise = lastValueFrom(runner.run({ agent: s.agent, input: i, threadId: i.threadId }).pipe(toArray()));
    await vi.waitFor(() => expect(signal).toBeDefined());
    expect(await runner.stop({ threadId: i.threadId, runId: i.runId })).toBe(true);
    const events = await eventsPromise; expect(signal?.aborted).toBe(true);
    expect(events.some((e) => e.type === EventType.RUN_ERROR || e.type === EventType.TEXT_MESSAGE_CONTENT)).toBe(false);
    if (stage !== "continuation") expect(events.some((e) => e.type === EventType.TOOL_CALL_RESULT && "content" in e && String(e.content).includes('"totalMinor"'))).toBe(false);
    expect(events.some((e) => e.type === EventType.RUN_FINISHED && (e as RunFinishedEvent).outcome?.type === "cancelled")).toBe(true);
    expect(s.close).toHaveBeenCalledTimes(stage === "connection" ? 0 : 1);
    expect(s.gate.acquire("next", "run")).toBe(true); runner.clearThreads();
  });
  it("unsubscribing aborts connection and releases the gate without an error", async () => {
    let signal: AbortSignal | null | undefined;
    const fetch = vi.fn<typeof globalThis.fetch>(async (_url, init) => { signal = init?.signal; await new Promise<void>((resolve) => signal?.addEventListener("abort", () => resolve(), { once: true })); throw new Error("secret"); });
    const s = setup(model(), fetch); const events: BaseEvent[] = [];
    const subscription = s.agent.run(input()).subscribe((e) => events.push(e));
    await vi.waitFor(() => expect(signal).toBeDefined()); subscription.unsubscribe();
    await vi.waitFor(() => expect(signal?.aborted).toBe(true));
    expect(events).toEqual([]); await vi.waitFor(() => expect(s.gate.acquire("next", "run")).toBe(true));
  });
  it("rejects concurrent clones without releasing the active run's gate", async () => {
    let signal: AbortSignal | undefined;
    const gate = createExecutionGate(); const close = vi.fn();
    const agent = new RunScopedAgent({ model: model(), config, gate, diagnostics: () => {}, scopeFactory: async (options) => { signal = options.signal; await new Promise<void>((resolve) => options.signal.addEventListener("abort", () => resolve(), { once: true })); return { provider: { tools: async () => ({}) }, close }; } });
    const first = agent.run(input()).subscribe(); await vi.waitFor(() => expect(signal).toBeDefined());
    expect(await run(agent.clone())).toEqual([{ type: EventType.RUN_ERROR, message: "Chưa kết nối" }]);
    expect(gate.acquire("other", "run")).toBe(false); first.unsubscribe();
    await vi.waitFor(() => expect(close).toHaveBeenCalledTimes(1)); expect(gate.acquire("other", "run")).toBe(true);
  });
});
