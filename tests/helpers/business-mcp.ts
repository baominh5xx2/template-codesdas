import http from "node:http";
import { z } from "zod";
import { vi } from "vitest";
import { POST } from "@/app/api/mcp/business/route";
import type { BusinessTool } from "@/core/tools/definition";
import type { BusinessMcpConfig } from "@/server/mcp/config";
import { createBusinessMcpHttpHandler } from "@/server/mcp/http";

/** Test-only independently registered tool. It is never a production fallback. */
export const multiplyValueTool: BusinessTool<{ value: number; factor: number }, { product: number }> = {
  name: "multiply_value", version: "1.0.0", description: "Multiply two bounded integers", kind: "compute",
  input: z.object({ value: z.number().int().min(0).max(100), factor: z.number().int().min(0).max(100) }),
  output: z.object({ product: z.number().int().min(0).max(10_000) }).strict(),
  async execute({ value, factor }) { return { product: value * factor }; },
};

/** Real TCP requests to the same Node route handler, with explicit fixture-owned
 * socket → Request.signal forwarding. This does not verify Next's socket adapter. */
export async function createBusinessHttpFixture(options: {
  definitions?: readonly BusinessTool<unknown, unknown>[];
  enabledTools?: readonly string[];
  transform?: (response: Response, method: string) => Promise<Response>;
} = {}) {
  const methods: string[] = [];
  const responses: Array<{ method: string; status: number; body: string }> = [];
  const server = http.createServer(async (req, res) => {
    const abort = new AbortController();
    res.on("close", () => { if (!res.writableEnded) abort.abort(); });
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const body = Buffer.concat(chunks);
      const method = body.length ? JSON.parse(body.toString()).method as string : "";
      methods.push(method);
      const request = new Request(`${config.url.origin}${req.url}`, {
        method: req.method, headers: new Headers(req.headers as Record<string, string>),
        signal: abort.signal, ...(body.length ? { body } : {}),
      });
      let response = options.definitions
        ? await createBusinessMcpHttpHandler(config, options.definitions).fetch(request)
        : await POST(request);
      if (options.transform) response = await options.transform(response, method);
      const output = Buffer.from(await response.arrayBuffer());
      responses.push({ method, status: response.status, body: output.toString() });
      if (!res.destroyed) { res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(output); }
    } catch {
      if (!res.destroyed) { res.writeHead(500); res.end("fixture_http_error"); }
    }
  });
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("fixture_no_port");
  const config: Extract<BusinessMcpConfig, { enabled: true }> = { enabled: true, url: new URL(`http://127.0.0.1:${address.port}/api/mcp/business`), token: "acceptance-business-only-token", enabledTools: options.enabledTools ?? ["calculate_budget"], allowedHosts: ["127.0.0.1"], allowedOrigins: [] };
  if (!options.definitions) {
    for (const [key, value] of Object.entries({ BUSINESS_MCP_ENABLED: "true", BUSINESS_MCP_URL: config.url.href, BUSINESS_MCP_TOKEN: config.token, BUSINESS_MCP_TOOLS: config.enabledTools.join(","), BUSINESS_MCP_ALLOWED_HOSTS: "127.0.0.1", BUSINESS_MCP_ALLOWED_ORIGINS: "http://localhost:3000" })) vi.stubEnv(key, value);
  }
  return { config, methods, responses, async close() { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); } };
}
