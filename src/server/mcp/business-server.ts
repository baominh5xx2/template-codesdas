import "server-only";
import { randomUUID } from "node:crypto";
import { McpServer, type McpRequestContext, type ServerContext, type CallToolResult } from "@modelcontextprotocol/server";
import { BUSINESS_MCP_CORRELATION_META_KEY } from "@/contracts/business-mcp";
import type { BusinessToolCatalog } from "./catalog";
import { businessMcpToolError, BUSINESS_MCP_MAX_RESPONSE_BYTES } from "./errors";

// Keep domain output small enough that MCP's duplicate text/structured result
// representations and JSON-RPC envelope fit comfortably under the wire cap.
export const BUSINESS_MCP_MAX_RESULT_BYTES = 4 * 1024;

/** Measure compact JSON without first serializing an unbounded handler result. */
function boundedJsonByteLength(value: unknown, maxBytes: number): number | undefined {
  let bytes = 0;
  const ancestors = new WeakSet<object>();
  const add = (count: number) => { bytes += count; return bytes <= maxBytes; };
  const measure = (current: unknown, depth: number): boolean => {
    if (depth > 32) return false;
    if (current === null) return add(4);
    if (typeof current === "boolean") return add(current ? 4 : 5);
    if (typeof current === "number") return Number.isFinite(current) && add(Buffer.byteLength(JSON.stringify(current), "utf8"));
    if (typeof current === "string") {
      if (current.length > maxBytes) return false;
      const encoded = JSON.stringify(current);
      return add(Buffer.byteLength(encoded, "utf8"));
    }
    if (typeof current !== "object") return false;
    if (ancestors.has(current)) return false;
    ancestors.add(current);
    try {
      if (Array.isArray(current)) {
        if (!add(2)) return false;
        for (let index = 0; index < current.length; index += 1) {
          if (index && !add(1)) return false;
          if (!measure(index in current ? current[index] : null, depth + 1)) return false;
        }
        return add(0);
      }
      const prototype = Object.getPrototypeOf(current);
      if (prototype !== Object.prototype && prototype !== null) return false;
      if (!add(2)) return false;
      let count = 0;
      for (const key in current) {
        if (!Object.prototype.hasOwnProperty.call(current, key)) continue;
        if (key.length > maxBytes) return false;
        const descriptor = Object.getOwnPropertyDescriptor(current, key);
        if (!descriptor || !("value" in descriptor)) return false;
        if (count && !add(1)) return false;
        count += 1;
        const encodedKey = JSON.stringify(key);
        if (!add(Buffer.byteLength(encodedKey, "utf8") + 1) || !measure(descriptor.value, depth + 1)) return false;
      }
      return true;
    } catch {
      return false;
    } finally {
      ancestors.delete(current);
    }
  };
  return measure(value, 0) ? bytes : undefined;
}

function correlation(context: ServerContext, fallback: { threadId: string; runId: string; toolCallId: string }) {
  const request = context.mcpReq as typeof context.mcpReq & { _meta?: Record<string, unknown> };
  const candidate = request._meta?.[BUSINESS_MCP_CORRELATION_META_KEY];
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return fallback;
  const record = candidate as Record<string, unknown>;
  const valid = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 128 && !/[\u0000-\u001f\u007f]/.test(value);
  if (!valid(record.threadId) || !valid(record.runId) || !valid(record.toolCallId)) return fallback;
  return { threadId: record.threadId, runId: record.runId, toolCallId: record.toolCallId };
}

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
        const ids = correlation(context, { threadId, runId, toolCallId: randomUUID() });
        const result = await definition.execute(input.data, { ...ids, signal, deadline });
        signal.throwIfAborted();
        if (boundedJsonByteLength(result, BUSINESS_MCP_MAX_RESULT_BYTES) === undefined) return businessMcpToolError("business_mcp_result_too_large");
        const output = definition.output.safeParse(result);
        if (!output.success) return businessMcpToolError("business_mcp_output_invalid");
        if (boundedJsonByteLength(output.data, BUSINESS_MCP_MAX_RESULT_BYTES) === undefined) return businessMcpToolError("business_mcp_result_too_large");
        const structuredContent = output.data as Record<string, unknown>;
        const serializedOutput = JSON.stringify(structuredContent);
        const response: CallToolResult = { resultType: "complete", structuredContent, content: [{ type: "text", text: serializedOutput }] };
        if (Buffer.byteLength(JSON.stringify(response), "utf8") > BUSINESS_MCP_MAX_RESPONSE_BYTES) return businessMcpToolError("business_mcp_result_too_large");
        return response;
      } catch {
        return businessMcpToolError(signal.aborted ? "business_mcp_cancelled" : "business_mcp_tool_failed");
      }
    });
  }
  return server;
}
