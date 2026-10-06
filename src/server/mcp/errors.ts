import "server-only";
import type { CallToolResult } from "@modelcontextprotocol/server";

const toolCodes = new Set([
  "business_mcp_tool_failed", "business_mcp_input_invalid", "business_mcp_output_invalid",
  "business_mcp_result_too_large", "business_mcp_cancelled",
]);
export function businessMcpToolError(code: string): CallToolResult {
  return { isError: true, content: [{ type: "text", text: toolCodes.has(code) ? code : "business_mcp_tool_failed" }] };
}
export function businessMcpHttpError(status: number, code: string): Response {
  return Response.json({ error: { code } }, { status, headers: {
    "cache-control": "no-store", ...(status === 401 ? { "www-authenticate": "Bearer" } : {}),
  } });
}
function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/** Keep protocol correlation and numeric codes; discard raw error text/data. */
function sanitizeMessage(value: unknown): unknown {
  if (!object(value)) return { jsonrpc: "2.0", id: null, error: { code: -32603, message: "business_mcp_protocol_error" } };
  if (object(value.error)) {
    const code = value.error.code;
    return { jsonrpc: "2.0", id: value.id ?? null, error: {
      code: typeof code === "number" && Number.isInteger(code) && code >= -32768 && code <= -32000 ? code : -32603,
      message: "business_mcp_protocol_error",
    } };
  }
  if (object(value.result) && value.result.isError === true) {
    const content = value.result.content;
    const candidate = Array.isArray(content) && content.length === 1 && object(content[0]) ? content[0].text : undefined;
    return { jsonrpc: "2.0", id: value.id ?? null, result: businessMcpToolError(typeof candidate === "string" ? candidate : "business_mcp_tool_failed") };
  }
  return value;
}

/** Sanitize JSON and legacy SSE terminal messages before any bytes leave the route. */
export async function sanitizeBusinessMcpResponse(response: Response): Promise<Response> {
  if (!response.body) return new Response(null, { status: response.status, headers: { "cache-control": "no-store" } });
  const text = await response.text();
  let payload: unknown;
  try {
    if (response.headers.get("content-type")?.includes("text/event-stream")) {
      // Business tools emit only one terminal message and no intermediate events.
      const data = text.split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim());
      payload = JSON.parse(data[data.length - 1]);
    } else payload = JSON.parse(text);
  } catch {
    return businessMcpHttpError(response.status >= 400 ? response.status : 500, "business_mcp_protocol_error");
  }
  return Response.json(sanitizeMessage(payload), { status: response.status, headers: { "cache-control": "no-store" } });
}
