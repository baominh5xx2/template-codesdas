import { z } from "zod";
import type { BusinessTool } from "@/core/tools/definition";

// CopilotKit 1.77.0: runtime/dist/agent/learned-skills.mjs reserves these names.
const reservedNames = new Set(["copilotkit_load_skill", "copilotkit_read_skill_file"]);
const metadataSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  description: z.string().refine((value) => value.trim().length > 0),
  kind: z.enum(["read", "compute"]),
});

export interface BusinessToolRegistration {
  readonly definition: BusinessTool<unknown, unknown>;
  readonly exposedName: string;
  readonly inputJsonSchema: z.core.JSONSchema.JSONSchema;
  readonly outputJsonSchema: z.core.JSONSchema.JSONSchema;
}

export interface BusinessToolCatalog {
  list(): readonly BusinessToolRegistration[];
  /** Lookup uses the original MCP tool name; disabled tools are absent. */
  get(name: string): BusinessToolRegistration | undefined;
}

/** Validate the entire local catalog before enabling any of its tools. */
export function createBusinessToolCatalog(
  definitions: readonly BusinessTool<unknown, unknown>[],
  enabledNames: readonly string[],
  occupiedNames: readonly string[] = [],
): BusinessToolCatalog {
  const registrations = new Map<string, BusinessToolRegistration>();
  const exposedNames = new Set<string>();
  const occupied = new Set(occupiedNames);
  for (const definition of definitions) {
    metadataSchema.parse(definition);
    if (typeof definition.execute !== "function" || !(definition.input instanceof z.ZodType) || !(definition.output instanceof z.ZodType)) {
      throw new Error("business_tool_definition_invalid");
    }
    const exposedName = `business__${definition.name}`;
    if (exposedName.length > 64) throw new Error("business_tool_namespace_invalid");
    if (reservedNames.has(definition.name) || reservedNames.has(exposedName)) throw new Error("business_tool_name_reserved");
    if (registrations.has(definition.name)) throw new Error("business_tool_name_duplicate");
    if (exposedNames.has(exposedName) || occupied.has(exposedName)) throw new Error("business_tool_namespace_collision");
    // Preserve structural Zod Standard Schema for AI SDK consumers. JSON Schema
    // is for MCP discovery only; unsupported Zod constructs throw at registration.
    const inputJsonSchema = z.toJSONSchema(definition.input);
    const outputJsonSchema = z.toJSONSchema(definition.output);
    if (inputJsonSchema.type !== "object" || outputJsonSchema.type !== "object") throw new Error("business_tool_object_schema_required");
    exposedNames.add(exposedName);
    // Interface members may be prototype methods/getters on class instances.
    // Snapshot them explicitly and retain the original execution receiver.
    const storedDefinition: BusinessTool<unknown, unknown> = Object.freeze({
      name: definition.name,
      version: definition.version,
      description: definition.description,
      kind: definition.kind,
      input: definition.input,
      output: definition.output,
      execute: definition.execute.bind(definition),
    });
    registrations.set(definition.name, Object.freeze({ definition: storedDefinition, exposedName, inputJsonSchema, outputJsonSchema }));
  }
  const enabled = new Map<string, BusinessToolRegistration>();
  for (const name of enabledNames) {
    const registration = registrations.get(name);
    if (!registration) throw new Error("business_tool_enabled_name_unknown");
    enabled.set(name, registration);
  }
  const entries = Object.freeze([...enabled.values()]);
  return { list: () => entries, get: (name) => enabled.get(name) };
}
