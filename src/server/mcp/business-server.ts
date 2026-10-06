import "server-only";
import { randomUUID } from "node:crypto";
import { McpServer, type McpRequestContext, type CallToolResult } from "@modelcontextprotocol/server";
import type { BusinessToolCatalog } from "./catalog";
import { businessMcpToolError, BUSINESS_MCP_MAX_RESPONSE_BYTES } from "./errors";

// Early rejection avoids encoding obviously oversized tool results; the HTTP
// sanitizer applies the authoritative cap to the complete SDK-encoded body.
export const BUSINESS_MCP_MAX_RESULT_BYTES = BUSINESS_MCP_MAX_RESPONSE_BYTES;

/** Fresh official server instance for each HTTP exchange; domain tools own no transport. */
export function createBusinessMcpServer(catalog: BusinessToolCatalog, requestContext: McpRequestContext): McpServer {
  const server = new McpServer({ name: "business-mcp", version: "1.0.0" });
  const threadId = randomUUID();
  const runId = randomUUID();
  const deadline = Date.now() + 15_000;
  for (const { definition } of catalog.list()) {
    server.registerTool(definition.name, {
      description: definition.description, inputSchema: definition.input, outputSchema: definition.output,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, async (args, context) => {
      const signal = requestContext.requestInfo
        ? AbortSignal.any([requestContext.requestInfo.signal, context.mcpReq.signal])
        : context.mcpReq.signal;
      try {
        signal.throwIfAborted();
        const input = definition.input.safeParse(args);
        if (!input.success) return businessMcpToolError("business_mcp_input_invalid");
        const result = await definition.execute(input.data, { threadId, runId, toolCallId: randomUUID(), signal, deadline });
        signal.throwIfAborted();
        const output = definition.output.safeParse(result);
        if (!output.success) return businessMcpToolError("business_mcp_output_invalid");
        const structuredContent = output.data as Record<string, unknown>;
        const response: CallToolResult = { structuredContent, content: [{ type: "text", text: JSON.stringify(structuredContent) }] };
        if (Buffer.byteLength(JSON.stringify(response), "utf8") > BUSINESS_MCP_MAX_RESULT_BYTES) return businessMcpToolError("business_mcp_result_too_large");
        return response;
      } catch {
        return businessMcpToolError(signal.aborted ? "business_mcp_cancelled" : "business_mcp_tool_failed");
      }
    });
  }
  return server;
}
