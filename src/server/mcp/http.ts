import "server-only";
import { timingSafeEqual } from "node:crypto";
import { createMcpHandler, readRequestBody, validateHostHeader } from "@modelcontextprotocol/server";
import type { BusinessTool } from "@/core/tools/definition";
import { createBusinessToolCatalog } from "./catalog";
import { createBusinessMcpServer } from "./business-server";
import type { BusinessMcpConfig } from "./config";
import { businessMcpHttpError, sanitizeBusinessMcpResponse } from "./errors";
import { calculateBudgetTool } from "./tools/calculate-budget/definition";

export const BUSINESS_MCP_MAX_REQUEST_BYTES = 256 * 1024;

function authenticated(request: Request, token: string): boolean {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer ([^\s]+)$/i.exec(header);
  if (!match) return false;
  const actual = Buffer.from(match[1]);
  const expected = Buffer.from(token);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Local endpoint only: no outbound fetch, redirects, or credential forwarding. */
export function createBusinessMcpHttpHandler(config: BusinessMcpConfig, definitions: readonly BusinessTool<unknown, unknown>[] = [calculateBudgetTool]) {
  return {
    async fetch(request: Request): Promise<Response> {
      if (!config.enabled) return businessMcpHttpError(503, "business_mcp_disabled");
      if (!authenticated(request, config.token)) return businessMcpHttpError(401, "business_mcp_unauthorized");
      const host = request.headers.get("host");
      // Reject URL-like Host forms the SDK's hostname parser would normalize.
      if (!host || /[\s/@?#\\]/.test(host) || !validateHostHeader(host, [...config.allowedHosts]).ok) return businessMcpHttpError(403, "business_mcp_host_denied");
      const origin = request.headers.get("origin");
      if (origin !== null && !config.allowedOrigins.includes(origin)) return businessMcpHttpError(403, "business_mcp_origin_denied");
      if (request.method !== "POST") return businessMcpHttpError(405, "business_mcp_method_denied");
      let handler: ReturnType<typeof createMcpHandler> | undefined;
      try {
        const read = await readRequestBody(request, BUSINESS_MCP_MAX_REQUEST_BYTES);
        if (read.tooLarge) return businessMcpHttpError(413, "business_mcp_request_too_large");
        const boundedRequest = new Request(request.url, { method: "POST", headers: request.headers, body: read.text, signal: request.signal });
        // This compute/read endpoint does not offer long-lived subscriptions.
        // Avoid an unbounded listen stream in the terminal-response sanitizer.
        let method: unknown;
        try { method = JSON.parse(read.text)?.method; } catch { /* Official SDK returns parse errors. */ }
        if (method === "subscriptions/listen") return businessMcpHttpError(405, "business_mcp_method_denied");
        const catalog = createBusinessToolCatalog(definitions, config.enabledTools);
        handler = createMcpHandler((context) => createBusinessMcpServer(catalog, context), { maxRequestBodySize: BUSINESS_MCP_MAX_REQUEST_BYTES });
        return await sanitizeBusinessMcpResponse(await handler.fetch(boundedRequest));
      } catch {
        return businessMcpHttpError(500, "business_mcp_protocol_error");
      } finally {
        await handler?.close();
      }
    },
  };
}
