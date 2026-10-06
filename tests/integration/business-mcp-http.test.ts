import http from "node:http";
import { afterEach, expect, it, vi } from "vitest";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { z } from "zod";
import { POST } from "@/app/api/mcp/business/route";
import { calculateBudgetTool } from "@/server/mcp/tools/calculate-budget/definition";
import type { BusinessTool, BusinessToolContext } from "@/core/tools/definition";
import { createBusinessMcpHttpHandler } from "@/server/mcp/http";
import { loadBusinessMcpConfig } from "@/server/mcp/config";

const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => { for (const close of cleanup.splice(0).reverse()) await close(); vi.unstubAllEnvs(); });

async function fixture(handle: (request: Request) => Promise<Response> = POST, enabledTools = "calculate_budget") {
  const dispatched: string[] = [];
  const delivered: string[] = [];
  const responses: Array<{ method: string; status: number; body: string }> = [];
  let activeRequests = 0;
  const server = http.createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const body = Buffer.concat(chunks);
    if (body.length) dispatched.push(JSON.parse(body.toString()).method);
    const abort = new AbortController();
    res.on("close", () => { if (!res.writableEnded) abort.abort(); });
    activeRequests++;
    try {
      const response = await handle(new Request(`http://127.0.0.1${req.url}`, {
        method: req.method, headers: new Headers(req.headers as Record<string, string>), signal: abort.signal,
        ...(body.length ? { body } : {}),
      }));
      const output = Buffer.from(await response.arrayBuffer());
      if (body.length) responses.push({ method: JSON.parse(body.toString()).method, status: response.status, body: output.toString() });
      if (!res.destroyed) {
        if (body.length) delivered.push(JSON.parse(body.toString()).method);
        res.writeHead(response.status, Object.fromEntries(response.headers));
        res.end(output);
      }
    } finally {
      activeRequests--;
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  cleanup.push(async () => { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No port");
  const url = `http://127.0.0.1:${address.port}/api/mcp/business`;
  for (const [key, value] of Object.entries({
    BUSINESS_MCP_ENABLED: "true", BUSINESS_MCP_URL: url, BUSINESS_MCP_TOKEN: "route-test-token",
    BUSINESS_MCP_TOOLS: enabledTools, BUSINESS_MCP_ALLOWED_HOSTS: "127.0.0.1", BUSINESS_MCP_ALLOWED_ORIGINS: "http://localhost:3000",
  })) vi.stubEnv(key, value);
  const client = new Client({ name: "business-http-test", version: "1.0.0" }, { versionNegotiation: { mode: "auto" } });
  cleanup.push(() => client.close());
  await client.connect(new StreamableHTTPClientTransport(new URL(url), { requestInit: { headers: { authorization: "Bearer route-test-token" }, redirect: "error" } }));
  expect(client.getProtocolEra()).toBe("modern");
  return { client, dispatched, delivered, responses, activeRequests: () => activeRequests };
}

it("initializes, discovers, and executes calculate_budget via official client and the actual HTTP route", async () => {
  const { client, dispatched } = await fixture();
  const execute = vi.spyOn(calculateBudgetTool, "execute");
  cleanup.push(async () => { execute.mockRestore(); });
  const tools = await client.listTools();
  expect(tools.tools.map((tool) => tool.name)).toEqual(["calculate_budget"]);
  expect(tools.tools[0].inputSchema.type).toBe("object");
  expect(tools.tools[0].outputSchema?.type).toBe("object");
  const result = await client.callTool({ name: "calculate_budget", arguments: { currency: "VND", budgetMinor: 500000, items: [{ label: "Room", amountMinor: 120000 }, { label: "Food", amountMinor: 85000 }] } });
  expect(result.structuredContent).toEqual({ currency: "VND", totalMinor: 205000, remainingMinor: 295000, overBudget: false, itemCount: 2 });
  expect(execute).toHaveBeenCalledTimes(1);
  expect(dispatched).toContain("tools/list");
  expect(dispatched).toContain("tools/call");
  expect(dispatched.some((method) => method === "initialize" || method === "server/discover")).toBe(true);
});

it("delivers real client disconnect to a cooperative route handler through Request.signal", async () => {
  const { client, delivered, activeRequests } = await fixture();
  let observed: BusinessToolContext | undefined;
  let settled = false;
  const original = calculateBudgetTool.execute;
  const execute = vi.spyOn(calculateBudgetTool, "execute").mockImplementation(async (input, context) => {
    observed = context;
    await new Promise<void>((resolve) => {
      if (context.signal.aborted) resolve();
      else context.signal.addEventListener("abort", () => resolve(), { once: true });
    });
    settled = true;
    return original(input, context);
  });
  cleanup.push(async () => { execute.mockRestore(); });
  const abort = new AbortController();
  const call = client.callTool({ name: "calculate_budget", arguments: { currency: "USD", budgetMinor: 1, items: [] } }, { signal: abort.signal });
  const rejection = expect(call).rejects.toThrow();
  await vi.waitFor(() => expect(observed).toBeDefined());
  abort.abort();
  await rejection;
  await vi.waitFor(() => expect(settled).toBe(true));
  await vi.waitFor(() => expect(activeRequests()).toBe(0));
  expect(observed!.signal.aborted).toBe(true);
  expect(delivered).not.toContain("tools/call");
});

it("bounds oversized custom output before SDK encoding and keeps the full MCP response under 32 KiB", async () => {
  const echo: BusinessTool<{ value: string }, { value: string }> = {
    name: "echo", version: "1.0.0", description: "Echo boundary input", kind: "read",
    input: z.object({ value: z.string() }), output: z.object({ value: z.string() }),
    async execute(input) { return input; },
  };
  const { client, responses } = await fixture((request) => createBusinessMcpHttpHandler(loadBusinessMcpConfig(process.env), [echo]).fetch(request), "echo");
  const value = "x".repeat(5000);
  const result = await client.callTool({ name: "echo", arguments: { value } });
  const response = responses.findLast((response) => response.method === "tools/call")!;
  expect(Buffer.byteLength(response.body)).toBeLessThanOrEqual(32768);
  expect(result.isError).toBe(true);
  expect(response.status).toBe(200);
  expect(JSON.stringify(JSON.parse(response.body).result)).toContain("business_mcp_result_too_large");
  expect(response.body).not.toContain(value);

  const accepted = await client.callTool({ name: "echo", arguments: { value: "x".repeat(3500) } });
  expect(accepted.structuredContent).toEqual({ value: "x".repeat(3500) });
  const acceptedResponse = responses.findLast((response) => response.method === "tools/call")!;
  expect(acceptedResponse.status).toBe(200);
  expect(Buffer.byteLength(acceptedResponse.body)).toBeLessThan(32768);
});
