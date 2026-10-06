import { randomUUID } from "node:crypto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { MockLanguageModelV3, simulateReadableStream } from "ai/test";
import { PROTOCOL_VERSION, type RunAgentInput } from "@ag-ui/client";
import { createCopilotChatClient, type CopilotChatBindings } from "@/adapters/agents/chat-client";
import { RunScopedAgent } from "@/adapters/agents/run-scoped-agent";
import { createExecutionGate } from "@/adapters/agents/chat-policy";
import { createBusinessRunScope } from "@/adapters/mcp/run-scope";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { createBusinessToolCatalog } from "@/server/mcp/catalog";
import { calculateBudgetTool } from "@/server/mcp/tools/calculate-budget/definition";
import type { BusinessTool, BusinessToolContext } from "@/core/tools/definition";
import type { ChatTranscriptMessage } from "@/contracts/chat-tools";
import { collectTranscriptTools, ToolStatusView } from "@/ui/chat/tool-renderers";
import { createBusinessHttpFixture, multiplyValueTool } from "../helpers/business-mcp";

const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => { for (const close of cleanup.splice(0).reverse()) await close(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });
const usage = { inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined }, outputTokens: { total: 1, text: 1, reasoning: undefined } };

it("matches SDK discovery input semantics for ordinary Zod object schemas", async () => {
  const fixture = await createBusinessHttpFixture({ definitions: [multiplyValueTool], enabledTools: ["multiply_value"] }); cleanup.push(fixture.close);
  const client = new Client({ name: "schema-acceptance", version: "1.0.0" }, { versionNegotiation: { mode: "auto" } }); cleanup.push(() => client.close());
  await client.connect(new StreamableHTTPClientTransport(fixture.config.url, { requestInit: { headers: { authorization: `Bearer ${fixture.config.token}` } } }));
  const discovered = (await client.listTools()).tools[0];
  const local = createBusinessToolCatalog([multiplyValueTool], ["multiply_value"]).list()[0];
  expect(discovered.inputSchema).not.toHaveProperty("additionalProperties");
  expect(discovered.outputSchema).toHaveProperty("additionalProperties", false);
  expect(local.inputJsonSchema).toEqual(discovered.inputSchema);
  expect(local.outputJsonSchema).toEqual(discovered.outputSchema);
});

it.each(["calculate_budget", "multiply_value"] as const)("runs %s over real MCP HTTP through BuiltInAgent, transcript and the existing inline renderer", async (name) => {
  const selected = name === "calculate_budget" ? calculateBudgetTool : multiplyValueTool;
  let executionContext: BusinessToolContext | undefined;
  const tracked = {
    ...selected,
    async execute(input: unknown, context: BusinessToolContext) {
      executionContext = context;
      return selected.execute(input as never, context);
    },
  } as BusinessTool<unknown, unknown>;
  const definitions = [calculateBudgetTool, ...(name === "calculate_budget" ? [] : [multiplyValueTool])].map((definition) => definition.name === name ? tracked : definition);
  const fixture = await createBusinessHttpFixture({ definitions, enabledTools: ["calculate_budget", ...(name === "calculate_budget" ? [] : ["multiply_value"])] });
  cleanup.push(fixture.close);
  const args = name === "calculate_budget" ? { currency: "VND", budgetMinor: 200_000, items: [{ label: "Room", amountMinor: 120_000 }, { label: "Food", amountMinor: 85_000 }] } : { value: 7, factor: 6 };
  const expected = name === "calculate_budget" ? { currency: "VND", totalMinor: 205_000, remainingMinor: -5_000, overBudget: true, itemCount: 2 } : { product: 42 };
  const exposed = `business__${name}`;
  let called = false;
  const model = new MockLanguageModelV3({ doStream: async (options) => {
    if (!called) {
      called = true;
      expect(options.tools?.some((tool) => tool.type === "function" && tool.name === exposed)).toBe(true);
      return { stream: simulateReadableStream({ chunks: [
        { type: "stream-start", warnings: [] }, { type: "tool-call", toolCallId: "acceptance-call", toolName: exposed, input: JSON.stringify(args) },
        { type: "finish", finishReason: { unified: "tool-calls", raw: "tool_calls" }, usage },
      ] }) };
    }
    // Derive the answer from the actual next-step prompt, not fixture output.
    const toolMessage = options.prompt.findLast((message) => message.role === "tool");
    if (!toolMessage || toolMessage.role !== "tool") throw new Error("No tool result in model continuation");
    const result = toolMessage.content.find((part) => part.type === "tool-result");
    expect(result?.output).toEqual({ type: "json", value: expected });
    if (!result || result.output.type !== "json") throw new Error("Expected validated JSON result");
    const answer = `Kết quả: ${JSON.stringify(result.output.value)}`;
    return { stream: simulateReadableStream({ chunks: [
      { type: "stream-start", warnings: [] }, { type: "text-start", id: "answer" }, { type: "text-delta", id: "answer", delta: answer }, { type: "text-end", id: "answer" },
      { type: "finish", finishReason: { unified: "stop", raw: "stop" }, usage },
    ] }) };
  } });
  const agent = new RunScopedAgent({ model, config: fixture.config, gate: createExecutionGate(), diagnostics: () => {}, scopeFactory: (options) => createBusinessRunScope({ ...options, definitions }) });
  const bindings = { agent, copilotkit: { runAgent: ({ runId }: { runId: string }) => agent.runAgent({ runId }), stopAgent: () => agent.abortRun() } } as unknown as CopilotChatBindings;
  const client = createCopilotChatClient(bindings);
  const request: RunAgentInput = { protocolVersion: PROTOCOL_VERSION, threadId: randomUUID(), runId: randomUUID(), state: {}, messages: [{ id: randomUUID(), role: "user", content: "Tính kết quả" }], tools: [], context: [], forwardedProps: {} };
  let transcript: ChatTranscriptMessage[] = [];
  const terminal: string[] = [];
  await client.run({ threadId: request.threadId, runId: request.runId, messages: request.messages as ChatTranscriptMessage[] }, { started() {}, messages(value) { transcript = value; }, terminal(value) { terminal.push(value); } });
  expect(terminal).toEqual(["completed"]);
  expect(model.doStreamCalls).toHaveLength(2);
  expect(fixture.methods).toEqual(["server/discover", "tools/list", "tools/call"]);
  const result = transcript.find((message) => message.role === "tool");
  expect(result).toMatchObject({ role: "tool", output: expected, toolCallId: "acceptance-call", threadId: request.threadId, runId: request.runId });
  expect(executionContext).toMatchObject({ threadId: request.threadId, runId: request.runId, toolCallId: "acceptance-call" });
  expect(transcript.some((message) => message.role === "assistant" && message.content === `Kết quả: ${JSON.stringify(expected)}`)).toBe(true);
  const projected = [...collectTranscriptTools(transcript).values()];
  expect(projected).toHaveLength(1);
  expect(projected[0].call).toMatchObject({ exposedName: exposed, toolName: name, toolVersion: "1.0.0", status: "completed" });
  const html = renderToStaticMarkup(createElement(ToolStatusView, projected[0]));
  if (name === "calculate_budget") { expect(html).toContain("205.000 VND"); expect(html).toContain("Vượt ngân sách"); }
  else { expect(html).toContain("multiply_value"); expect(html).toContain("42"); expect(html).toContain("Hoàn tất"); }
  // The following turn replays the completed pair without executing the tool again.
  await client.run({ threadId: request.threadId, runId: randomUUID(), messages: [...transcript, { id: randomUUID(), role: "user", content: "Nhắc lại kết quả" }] }, { started() {}, messages() {}, terminal(value) { expect(value).toBe("completed"); } });
  expect(model.doStreamCalls).toHaveLength(3);
  expect(fixture.methods.filter((method) => method === "tools/call")).toHaveLength(1);
});
