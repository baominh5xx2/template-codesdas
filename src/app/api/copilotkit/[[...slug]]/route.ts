import { loadChatConfig } from "@/server/chat/config";
import { createChatRequestHandler } from "@/server/chat/http";

export const runtime = "nodejs";

const configResult = loadChatConfig(process.env);
const handleRequest = createChatRequestHandler(configResult, () => {});

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
