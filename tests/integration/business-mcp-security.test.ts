import { randomUUID } from "node:crypto";
import { afterEach, expect, it, vi } from "vitest";
import { MockLanguageModelV3, simulateReadableStream } from "ai/test";
import { EventType, PROTOCOL_VERSION, type BaseEvent, type RunAgentInput, type RunFinishedEvent } from "@ag-ui/client";
import { InMemoryAgentRunner } from "@copilotkit/runtime/v2";
import { lastValueFrom, toArray } from "rxjs";
import { z } from "zod";
import { RunScopedAgent } from "@/adapters/agents/run-scoped-agent";
import { createExecutionGate } from "@/adapters/agents/chat-policy";
import { createBusinessRunScope } from "@/adapters/mcp/run-scope";
import { calculateBudgetTool } from "@/server/mcp/tools/calculate-budget/definition";
import type { BusinessTool } from "@/core/tools/definition";
import { createBusinessHttpFixture } from "../helpers/business-mcp";

const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => { for (const close of cleanup.splice(0).reverse()) await close(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });
const args = { currency: "USD", budgetMinor: 100, items: [{ label: "Food", amountMinor: 30 }] };
const usage = { inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined }, outputTokens: { total: 1, text: 1, reasoning: undefined } };
function input(): RunAgentInput { return { protocolVersion: PROTOCOL_VERSION, threadId: randomUUID(), runId: randomUUID(), state: {}, messages: [{ id: randomUUID(), role: "user", content: "Calculate" }], tools: [], context: [], forwardedProps: {} }; }
function model(toolName = "business__calculate_budget", argumentsJson = JSON.stringify(args)) {
  return new MockLanguageModelV3({ doStream: async () => ({ stream: simulateReadableStream({ chunks: [
    { type: "stream-start", warnings: [] }, { type: "tool-call", toolCallId: "security-call", toolName, input: argumentsJson },
    { type: "finish", finishReason: { unified: "tool-calls", raw: "tool_calls" }, usage },
  ] }) }) });
}
function assertSafeFailure(events: BaseEvent[]) {
  expect(events.filter((event) => event.type === EventType.RUN_ERROR)).toEqual([{ type: EventType.RUN_ERROR, message: "Chưa kết nối" }]);
  expect(events.some((event) => event.type === EventType.TOOL_CALL_RESULT || event.type === EventType.RUN_FINISHED)).toBe(false);
  expect(JSON.stringify(events)).not.toContain("RAW_SECRET");
  expect(JSON.stringify(events)).not.toContain("acceptance-business-only-token");
}

it.each(["wrong-token", "input", "denied", "output", "throw", "isError", "malformed"])("contains %s failures before MCP output reaches the model or UI over actual HTTP", async (kind) => {
  const fixture = await createBusinessHttpFixture({ transform: async (response, method) => {
    if (method !== "tools/call" || !["isError", "malformed"].includes(kind)) return response;
    const encoded = await response.json();
    encoded.result = kind === "isError" ? { isError: true, content: [{ type: "text", text: "RAW_SECRET_MCP_HEADERS" }] } : { structuredContent: { totalMinor: "RAW_SECRET_MCP_SCHEMA" } };
    return Response.json(encoded);
  } });
  cleanup.push(fixture.close);
  const execute = vi.spyOn(calculateBudgetTool, "execute");
  if (kind === "throw") execute.mockRejectedValue(new Error("RAW_SECRET_STACK_TOKEN"));
  if (kind === "output") execute.mockResolvedValue({ currency: "USD", totalMinor: -1, remainingMinor: 0, overBudget: false, itemCount: 0 });
  const m = model(kind === "denied" ? "business__unregistered" : undefined, kind === "input" ? JSON.stringify({ ...args, budgetMinor: -1 }) : undefined);
  const agent = new RunScopedAgent({ model: m, config: { ...fixture.config, ...(kind === "wrong-token" ? { token: "wrong-token" } : {}) }, gate: createExecutionGate(), diagnostics: () => {} });
  const events = await lastValueFrom(agent.run(input()).pipe(toArray()));
  assertSafeFailure(events);
  expect(m.doStreamCalls).toHaveLength(kind === "wrong-token" ? 0 : 1);
  expect(execute).toHaveBeenCalledTimes(["wrong-token", "input", "denied"].includes(kind) ? 0 : 1);
  if (["wrong-token", "input", "denied"].includes(kind)) expect(fixture.methods).not.toContain("tools/call");
  if (["throw", "output"].includes(kind)) expect(JSON.stringify(fixture.responses)).not.toContain("RAW_SECRET");
});

it("rejects oversized encoded output over HTTP before the next model step", async () => {
  const large: BusinessTool<{ ok: boolean }, { value: string }> = {
    name: "large_result", version: "1.0.0", description: "Test result cap", kind: "read", input: z.object({ ok: z.boolean() }).strict(), output: z.object({ value: z.string() }).strict(),
    async execute() { return { value: "RAW_SECRET_OVERSIZED".repeat(1000) }; },
  };
  const definitions = [large];
  const fixture = await createBusinessHttpFixture({ definitions, enabledTools: [large.name] }); cleanup.push(fixture.close);
  const m = model("business__large_result", '{"ok":true}');
  const agent = new RunScopedAgent({ model: m, config: fixture.config, gate: createExecutionGate(), diagnostics: () => {}, scopeFactory: (options) => createBusinessRunScope({ ...options, definitions }) });
  const events = await lastValueFrom(agent.run(input()).pipe(toArray()));
  assertSafeFailure(events); expect(m.doStreamCalls).toHaveLength(1);
  const response = fixture.responses.find((response) => response.method === "tools/call")!;
  expect(response.body).not.toContain("RAW_SECRET"); expect(Buffer.byteLength(response.body)).toBeLessThanOrEqual(32768);
});

it.each(["timeout", "stop"])("%s aborts the real HTTP request and cooperative handler with no late result", async (kind) => {
  const fixture = await createBusinessHttpFixture(); cleanup.push(fixture.close);
  let observed: AbortSignal | undefined;
  let settled = false;
  const original = calculateBudgetTool.execute;
  vi.spyOn(calculateBudgetTool, "execute").mockImplementation(async (args, context) => {
    observed = context.signal;
    await new Promise<void>((resolve) => { if (context.signal.aborted) resolve(); else context.signal.addEventListener("abort", () => resolve(), { once: true }); });
    settled = true;
    return original(args, context);
  });
  const m = model();
  const agent = new RunScopedAgent({ model: m, config: fixture.config, gate: createExecutionGate(), diagnostics: () => {}, deadlineMs: kind === "timeout" ? 1000 : undefined });
  const i = input(); agent.messages = i.messages; agent.threadId = i.threadId;
  const runner = new InMemoryAgentRunner(); cleanup.push(async () => { runner.clearThreads(); });
  const pending = lastValueFrom(runner.run({ agent, input: i, threadId: i.threadId }).pipe(toArray()));
  await vi.waitFor(() => expect(observed).toBeDefined());
  if (kind === "stop") expect(await runner.stop({ threadId: i.threadId, runId: i.runId })).toBe(true);
  const events = await pending;
  await vi.waitFor(() => expect(observed?.aborted).toBe(true));
  await vi.waitFor(() => expect(settled).toBe(true));
  expect(m.doStreamCalls).toHaveLength(1);
  expect(events.some((event) => event.type === EventType.TOOL_CALL_RESULT && "content" in event && String(event.content).includes("totalMinor"))).toBe(false);
  if (kind === "timeout") assertSafeFailure(events);
  else { expect(events.some((event) => event.type === EventType.RUN_ERROR)).toBe(false); expect(events.some((event) => event.type === EventType.RUN_FINISHED && (event as RunFinishedEvent).outcome?.type === "cancelled")).toBe(true); }
});

it("spends a per-run three-call budget and denies the fourth call before HTTP dispatch", async () => {
  const fixture = await createBusinessHttpFixture(); cleanup.push(fixture.close);
  const scope = await createBusinessRunScope({ config: fixture.config, threadId: "thread", runId: "run", signal: new AbortController().signal }); cleanup.push(scope.close);
  const tools = await scope.provider.tools();
  const execute = tools.business__calculate_budget.execute!;
  for (let index = 0; index < 3; index++) expect(await execute(args, { toolCallId: `budget-${index}`, messages: [] })).toMatchObject({ totalMinor: 30 });
  await expect(execute(args, { toolCallId: "fourth", messages: [] })).rejects.toThrow("Chưa kết nối");
  expect(fixture.methods.filter((method) => method === "tools/call")).toHaveLength(3);
});
