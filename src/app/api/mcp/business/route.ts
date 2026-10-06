import { loadBusinessMcpConfig } from "@/server/mcp/config";
import { businessMcpHttpError } from "@/server/mcp/errors";
import { createBusinessMcpHttpHandler } from "@/server/mcp/http";

export const runtime = "nodejs";

async function handle(request: Request): Promise<Response> {
  try {
    return await createBusinessMcpHttpHandler(loadBusinessMcpConfig(process.env)).fetch(request);
  } catch {
    return businessMcpHttpError(503, "business_mcp_config_invalid");
  }
}

export const POST = handle;
export const GET = handle;
export const DELETE = handle;
export const OPTIONS = handle;
