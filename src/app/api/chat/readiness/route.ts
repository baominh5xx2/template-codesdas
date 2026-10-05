import "server-only";
import { getChatReadiness, loadChatConfig } from "@/server/chat/config";

export function GET(): Response {
  const readiness = getChatReadiness(loadChatConfig(process.env));
  return Response.json(readiness, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
