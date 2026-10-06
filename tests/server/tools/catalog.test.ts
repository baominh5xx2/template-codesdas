import { describe, expect, it } from "vitest";
import { z } from "zod";
import type { BusinessTool, BusinessToolContext } from "@/core/tools/definition";
import { createBusinessToolCatalog } from "@/server/mcp/catalog";
import { calculateBudgetTool } from "@/server/mcp/tools/calculate-budget/definition";

const tool: BusinessTool<{ value: string }, { value: string }> = {
  name: "echo_value", version: "1.0.0", description: "Return the supplied value.", kind: "read",
  input: z.object({ value: z.string() }), output: z.object({ value: z.string() }),
  async execute(input) { return input; },
};

describe("business tool catalog", () => {
  it("preserves prototype members and the execution receiver of class definitions", async () => {
    class ClassTool implements BusinessTool<{ value: string }, { value: string }> {
      #prefix = "class:";
      #schema = z.object({ value: z.string() });
      get name() { return "class_echo"; }
      get version() { return "1.0.0"; }
      get description() { return "Return a prefixed value with the call correlation ID."; }
      get kind() { return "read" as const; }
      get input() { return this.#schema; }
      get output() { return this.#schema; }
      async execute(input: { value: string }, context: BusinessToolContext) {
        return { value: `${this.#prefix}${input.value}:${context.toolCallId}` };
      }
    }
    const catalog = createBusinessToolCatalog([new ClassTool()], ["class_echo"]);
    const registered = catalog.get("class_echo")!;
    const execute = registered.definition.execute;
    expect(await execute({ value: "hello" }, {
      threadId: "thread", runId: "run", toolCallId: "call",
      signal: new AbortController().signal, deadline: Date.now() + 15_000,
    })).toEqual({ value: "class:hello:call" });
    expect(registered.definition).toMatchObject({
      name: "class_echo", version: "1.0.0",
      description: "Return a prefixed value with the call correlation ID.", kind: "read",
    });
    expect(registered.definition.input.parse({ value: "hello" })).toEqual({ value: "hello" });
    expect(registered.definition.output.parse({ value: "class:hello:call" })).toEqual({ value: "class:hello:call" });
  });

  it("exposes enabled definitions with stable names and object JSON schemas", () => {
    const catalog = createBusinessToolCatalog([tool, calculateBudgetTool], ["calculate_budget"]);
    expect(catalog.list().map((entry) => entry.exposedName)).toEqual(["business__calculate_budget"]);
    const entry = catalog.get("calculate_budget")!;
    expect(entry.definition.version).toBe("1.0.0");
    expect(entry.inputJsonSchema).toMatchObject({ type: "object", required: ["currency", "budgetMinor", "items"] });
    expect(entry.outputJsonSchema).toMatchObject({ type: "object", required: ["currency", "totalMinor", "remainingMinor", "overBudget", "itemCount"] });
    expect(entry.definition.input["~standard"]).toBeDefined();
    expect(catalog.get("echo_value")).toBeUndefined();
    expect(createBusinessToolCatalog([tool], []).list()).toEqual([]);
  });

  it.each([
    { name: "" }, { name: "HasUppercase" }, { name: "has-dash" }, { name: "has space" },
    { version: "" }, { version: "1" }, { description: " " }, { kind: "write" },
    { execute: undefined }, { input: {} }, { output: {} },
  ])("rejects invalid definition metadata %j", (change) => {
    expect(() => createBusinessToolCatalog([{ ...tool, ...change } as typeof tool], ["echo_value"])).toThrow();
  });

  it("rejects duplicate definitions even when disabled", () => {
    expect(() => createBusinessToolCatalog([tool, { ...tool, version: "2.0.0" }], [])).toThrow(/duplicate/);
  });

  it.each(["copilotkit_load_skill", "copilotkit_read_skill_file"])("rejects SDK reserved name %s", (name) => {
    expect(() => createBusinessToolCatalog([{ ...tool, name }], [name])).toThrow(/reserved/);
  });

  it("rejects namespace collisions with occupied model names", () => {
    expect(() => createBusinessToolCatalog([tool], ["echo_value"], ["business__echo_value"])).toThrow(/collision/);
  });

  it("rejects unknown enabled names rather than silently dropping them", () => {
    expect(() => createBusinessToolCatalog([tool], ["missing_tool"])).toThrow(/unknown/);
  });

  it("accepts 64 exposed characters and rejects 65", () => {
    const name = "a".repeat(54);
    expect(createBusinessToolCatalog([{ ...tool, name }], [name]).list()[0].exposedName).toHaveLength(64);
    expect(() => createBusinessToolCatalog([{ ...tool, name: `${name}a` }], [])).toThrow();
  });

  it("keeps names stable when discovery order changes", () => {
    const first = createBusinessToolCatalog([tool, calculateBudgetTool], ["echo_value", "calculate_budget"]);
    const second = createBusinessToolCatalog([calculateBudgetTool, tool], ["calculate_budget", "echo_value"]);
    expect(first.get("echo_value")!.exposedName).toBe(second.get("echo_value")!.exposedName);
  });

  it.each([z.date(), z.string().transform((value) => value.length), z.string()])("rejects unsupported wire schemas", (input) => {
    expect(() => createBusinessToolCatalog([{ ...tool, input } as BusinessTool<unknown, unknown>], ["echo_value"])).toThrow();
  });
});
