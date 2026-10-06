import http from "node:http";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { McpServer, WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/server";
import { BuiltInAgent, InMemoryAgentRunner, type MCPClientProvider } from "@copilotkit/runtime/v2";
import { MockLanguageModelV3, simulateReadableStream } from "ai/test";
import { lastValueFrom, toArray } from "rxjs";
import { z } from "zod";

// Official registry /@modelcontextprotocol/{client,server}: latest stable 2.3.1
// (2026-10-06). CopilotKit 1.77.0 MCPClientProvider.tools(): Promise<ToolSet>
// accepts AI SDK 6.0.300 tools via BuiltInAgent.mcpClients. Providers are caller
// owned: BuiltInAgent neither creates nor closes them. AgentRunner.run/stop and
// AbstractAgent middleware's next.run()/next.abortRun() are supported delegation.
// This entire adapter is a probe, not the production provider or run scope.
const input = z.object({ amount: z.number().nonnegative() });
const output = z.object({ total: z.number().nonnegative() });
type ToolSet = Awaited<ReturnType<MCPClientProvider["tools"]>>;
const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => { for (const close of cleanups.splice(0).reverse()) await close(); });

async function fixture(mode: "ok" | "error" | "invalid" | "slow" = "ok") {
  const calls: unknown[] = [];
  const pending = new Set<() => void>();
  const server = http.createServer(async (req, res) => {
    // Official stateless HTTP transport/server instances must be per request.
    const mcp = new McpServer({ name: "compatibility", version: "1" });
    mcp.registerTool("calculate_budget", { inputSchema: input, outputSchema: mode === "invalid" ? undefined : output }, async (args) => {
      calls.push(args);
      if (mode === "slow") await new Promise<void>((resolve) => pending.add(resolve));
      if (mode === "error") return { isError: true, content: [{ type: "text", text: "budget rejected" }] };
      const structuredContent = mode === "invalid" ? { total: "invalid" } : { total: args.amount * 2 };
      return { content: [{ type: "text", text: JSON.stringify(structuredContent) }], structuredContent };
    });
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    try {
      await mcp.connect(transport);
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const response = await transport.handleRequest(new Request(`http://127.0.0.1${req.url}`, {
        method: req.method,
        headers: new Headers(req.headers as Record<string, string>),
        ...(chunks.length ? { body: Buffer.concat(chunks) } : {}),
      }));
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) { res.writeHead(500); res.end(String(error)); }
    finally { await mcp.close(); }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No port");
  const client = new Client({ name: "compatibility-probe", version: "1" });
  const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${address.port}/mcp`));
  await client.connect(transport);
  const closeClient = vi.spyOn(client, "close");
  const closeServer = vi.spyOn(server, "close");
  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    for (const resolve of pending) resolve();
    await client.close();
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  };
  cleanups.push(close);
  return { client, calls, close, closeClient, closeServer };
}

function provider(client: Client): MCPClientProvider {
  return { async tools(): Promise<ToolSet> {
    const listed = await client.listTools();
    const discovered = listed.tools.find((t) => t.name === "calculate_budget");
    if (!discovered || discovered.inputSchema.type !== "object") throw new Error("Invalid tool schema");
    // Validate the discovered schema against this probe's known tool contract;
    // Standard Schema (Zod) avoids instance-specific AI SDK schema brand symbols.
    expect(discovered.inputSchema.properties?.amount).toMatchObject({ type: "number", minimum: 0 });
    expect(discovered.inputSchema.required).toEqual(["amount"]);
    return { calculate_budget: {
      description: discovered.description,
      inputSchema: input,
      execute: async (args, { abortSignal }) => {
        const result = await client.callTool({ name: discovered.name, arguments: input.parse(args) }, { signal: abortSignal });
        if (result.isError) throw new Error("MCP tool rejected");
        return output.parse(result.structuredContent);
      },
    } };
  } };
}

function model(amount = 10) {
  return new MockLanguageModelV3({ doStream: {
    stream: simulateReadableStream({ chunks: [
      { type: "stream-start", warnings: [] },
      { type: "tool-call", toolCallId: "call-1", toolName: "calculate_budget", input: JSON.stringify({ amount }) },
      { type: "finish", finishReason: { unified: "tool-calls", raw: "tool_calls" }, usage: { inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined }, outputTokens: { total: 1, text: 1, reasoning: undefined } } },
    ] }),
  } });
}
function runInput() {
  return { threadId: randomUUID(), runId: randomUUID(), state: {}, messages: [{ id: randomUUID(), role: "user" as const, content: "Calculate budget" }], tools: [], context: [], forwardedProps: {} };
}

describe("official MCP v2 compatibility", () => {
  it("initializes, discovers, calls structured output, and closes real HTTP", async () => {
    const f = await fixture();
    const listed = await f.client.listTools();
    expect(listed.tools[0].name).toBe("calculate_budget");
    expect(listed.tools[0].inputSchema.type).toBe("object");
    expect((await f.client.callTool({ name: "calculate_budget", arguments: { amount: 10 } })).structuredContent).toEqual({ total: 20 });
    await f.close(); await f.close();
    expect(f.closeClient).toHaveBeenCalledTimes(1);
    expect(f.closeServer).toHaveBeenCalledTimes(1);
  });
  it("registers a discovered ToolSet through BuiltInAgent and AgentRunner delegation", async () => {
    const f = await fixture();
    const p = provider(f.client);
    const tools = await p.tools();
    expect(tools.calculate_budget.inputSchema).toBeDefined();
    const m = model();
    const agent = new BuiltInAgent({ model: m, mcpClients: [p], maxSteps: 1 });
    const delegated = vi.fn();
    agent.use((input, next) => { delegated(); return next.run(input); });
    const runner = new InMemoryAgentRunner();
    const input = runInput();
    agent.messages = input.messages;
    const events = await lastValueFrom(runner.run({ agent, input, threadId: input.threadId }).pipe(toArray()));
    expect(delegated).toHaveBeenCalledTimes(1);
    expect(f.calls).toEqual([{ amount: 10 }]);
    expect(events.some((event) => event.type === "TOOL_CALL_RESULT" && "content" in event && String(event.content).includes("20"))).toBe(true);
    expect(m.doStreamCalls[0].tools?.some((t) => t.name === "calculate_budget")).toBe(true);
    await f.close(); await f.close();
    expect(f.closeClient).toHaveBeenCalledTimes(1);
    runner.clearThreads();
  });
  it("rejects invalid input before HTTP, isError, and invalid structured output", async () => {
    for (const mode of ["ok", "error", "invalid"] as const) {
      const f = await fixture(mode);
      const tools = await provider(f.client).tools();
      const execute = tools.calculate_budget.execute!;
      const options = { toolCallId: "test", messages: [], abortSignal: new AbortController().signal };
      await expect(execute({ amount: -1 }, options)).rejects.toThrow();
      expect(f.calls).toEqual([]);
      if (mode === "error") await expect(execute({ amount: 10 }, options)).rejects.toThrow("MCP tool rejected");
      if (mode === "invalid") await expect(execute({ amount: 10 }, options)).rejects.toBeInstanceOf(z.ZodError);
      await f.close();
    }
  });
  it("propagates runner stop through delegated BuiltInAgent to official callTool abort", async () => {
    const f = await fixture("slow");
    const callTool = vi.spyOn(f.client, "callTool");
    const p = provider(f.client);
    const agent = new BuiltInAgent({ model: model(), mcpClients: [p], maxSteps: 1 });
    agent.use((input, next) => next.run(input));
    const runner = new InMemoryAgentRunner();
    const input = runInput();
    agent.messages = input.messages;
    const complete = lastValueFrom(runner.run({ agent, input, threadId: input.threadId }).pipe(toArray()));
    await vi.waitFor(() => expect(f.calls).toHaveLength(1));
    const signal = callTool.mock.calls[0][1]?.signal;
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(signal?.aborted).toBe(false);
    expect(await runner.stop({ threadId: input.threadId, runId: input.runId })).toBe(true);
    await vi.waitFor(() => expect(signal?.aborted).toBe(true));
    await expect(callTool.mock.results[0].value).rejects.toThrow();
    await complete;
    await f.close(); await f.close();
    expect(f.closeClient).toHaveBeenCalledTimes(1);
    runner.clearThreads();
  });
});
