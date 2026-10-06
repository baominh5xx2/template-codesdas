import { expect, it, vi } from "vitest";
import { createBusinessToolProvider } from "@/adapters/mcp/tool-provider";
import { createBusinessToolCatalog } from "@/server/mcp/catalog";
import { calculateBudgetTool } from "@/server/mcp/tools/calculate-budget/definition";
import { decodeBusinessResult } from "@/adapters/mcp/results";
import { z } from "zod";

const catalog = createBusinessToolCatalog([calculateBudgetTool], ["calculate_budget"]);
const registration = catalog.list()[0];
const discovery = [{ name: "calculate_budget", inputSchema: registration.inputJsonSchema, outputSchema: registration.outputJsonSchema }];
it("exposes stable namespace and local Standard Schema only after compatible discovery", async () => {
  const execute = vi.fn();
  const tools = await createBusinessToolProvider(catalog, discovery, execute).tools();
  expect(Object.keys(tools)).toEqual(["business__calculate_budget"]);
  expect(tools.business__calculate_budget.inputSchema).toBe(calculateBudgetTool.input);
  expect(() => createBusinessToolProvider(catalog, [{ ...discovery[0], name: "unknown" }], execute)).toThrow("Chưa kết nối");
  expect(() => createBusinessToolProvider(catalog, [{ ...discovery[0], inputSchema: { type: "object" } }], execute)).toThrow("Chưa kết nối");
  expect(() => createBusinessToolProvider(catalog, [], execute)).toThrow("Chưa kết nối");
  expect(() => createBusinessToolProvider(catalog, [...discovery, ...discovery], execute)).toThrow("Chưa kết nối");
});
it.each([{ isError: true, content: [{ type: "text", text: "secret" }] }, { content: [] }, { structuredContent: { currency: "USD" }, content: [] }, { structuredContent: "secret", content: [] }])("rejects unvalidated MCP output before the model", (result) => {
  expect(() => decodeBusinessResult(registration, result)).toThrow("Chưa kết nối");
});
it("returns only validated structured content and rejects an oversized result", () => {
  const output = { currency: "USD", totalMinor: 2, remainingMinor: 1, overBudget: false, itemCount: 1 };
  expect(decodeBusinessResult(registration, { structuredContent: output, content: [] })).toEqual(output);
  expect(() => decodeBusinessResult(registration, { structuredContent: output, content: [{ type: "text", text: "s".repeat(32768) }] })).toThrow("Chưa kết nối");
});
it("keeps namespace stable regardless of discovery order and forwards SDK execution options", async () => {
  const second = { name: "echo", version: "1.0.0", description: "Echo", kind: "read" as const, input: z.object({ value: z.string() }), output: z.object({ value: z.string() }), async execute(input: { value: string }) { return input; } };
  const catalog = createBusinessToolCatalog([calculateBudgetTool, second], ["calculate_budget", "echo"]);
  const discovered = catalog.list().map((r) => ({ name: r.definition.name, inputSchema: r.inputJsonSchema, outputSchema: r.outputJsonSchema }));
  const execute = vi.fn().mockResolvedValue({ value: "result" });
  const forward = await createBusinessToolProvider(catalog, discovered, execute).tools();
  const reversed = await createBusinessToolProvider(catalog, discovered.toReversed(), execute).tools();
  expect(Object.keys(forward)).toEqual(Object.keys(reversed));
  const options = { toolCallId: "id", messages: [], abortSignal: new AbortController().signal };
  await reversed.business__echo.execute!({ value: "input" }, options);
  expect(execute).toHaveBeenCalledWith(catalog.get("echo"), { value: "input" }, options);
});
