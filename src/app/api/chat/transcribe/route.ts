import { createTranscribeHandler } from "@/server/chat/transcribe";

export const runtime = "nodejs";

const handleRequest = createTranscribeHandler();

export async function POST(request: Request): Promise<Response> {
  return handleRequest(request);
}
