import { loadChatConfig } from "@/server/chat/config";
import { createChatRequestHandler } from "@/server/chat/http";
import { loadBusinessMcpConfig } from "@/server/mcp/config";

export const runtime = "nodejs";

const configResult = loadChatConfig(process.env);
const handleRequest = createChatRequestHandler(configResult, () => {}, { businessMcp: loadBusinessMcpConfig(process.env) });

export async function GET(request: Request): Promise<Response> {
  return handleRequest(request);
}

export async function POST(request: Request): Promise<Response> {
  return handleRequest(request);
}

export async function PATCH(request: Request): Promise<Response> {
  return handleRequest(request);
}

export async function DELETE(request: Request): Promise<Response> {
  return handleRequest(request);
}
