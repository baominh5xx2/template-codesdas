import "server-only";
import { isDeepStrictEqual } from "node:util";
import type { MCPClientProvider } from "@copilotkit/runtime/v2";
import type { BusinessToolCatalog, BusinessToolRegistration } from "@/server/mcp/catalog";
import { BusinessMcpFailure } from "./results";

export type BusinessToolExecutor = (registration: BusinessToolRegistration, input: unknown, options: { toolCallId: string; abortSignal?: AbortSignal }) => Promise<unknown>;

/** The internal connector uses registered Standard Schemas, never remote any. */
export function createBusinessToolProvider(catalog: BusinessToolCatalog, discovered: readonly { name: string; inputSchema: unknown; outputSchema?: unknown }[], execute: BusinessToolExecutor): MCPClientProvider {
  const names = new Set<string>();
  for (const tool of discovered) {
    const registration = catalog.get(tool.name);
    if (!registration || names.has(tool.name) || !isDeepStrictEqual(tool.inputSchema, registration.inputJsonSchema) || !isDeepStrictEqual(tool.outputSchema, registration.outputJsonSchema)) throw new BusinessMcpFailure("discovery_invalid");
    names.add(tool.name);
  }
  if (names.size !== catalog.list().length) throw new BusinessMcpFailure("discovery_invalid");
  const tools: Awaited<ReturnType<MCPClientProvider["tools"]>> = {};
  for (const registration of catalog.list()) {
    tools[registration.exposedName] = {
      description: registration.definition.description,
      inputSchema: registration.definition.input,
      execute: (args, options) => execute(registration, args, options),
    };
  }
  return { tools: async () => tools };
}
