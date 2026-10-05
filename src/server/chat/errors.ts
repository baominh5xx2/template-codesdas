import "server-only";
import { CHAT_NOTICE } from "@/contracts/chat";

export type ChatDiagnosticCode =
  | "missing_config"
  | "invalid_config"
  | "provider_failed"
  | "stream_failed"
  | "timeout"
  | "conflict"
  | "invalid_request"
  | "render_failed";

export type ChatDiagnostic = {
  code: ChatDiagnosticCode;
  traceId: string;
  runId?: string;
  phase: "readiness" | "request" | "execution" | "render";
  durationMs?: number;
};

export type ChatDiagnosticSink = (record: ChatDiagnostic) => void;

export function chatFailureResponse(status: number): Response {
  return Response.json(
    { code: "chat_unavailable", message: CHAT_NOTICE },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

export function emitChatDiagnostic(
  sink: ChatDiagnosticSink,
  record: ChatDiagnostic
): void {
  const sanitized: ChatDiagnostic = {
    code: record.code,
    traceId: record.traceId,
    phase: record.phase,
    ...(typeof record.runId === "string" ? { runId: record.runId } : {}),
    ...(typeof record.durationMs === "number" ? { durationMs: record.durationMs } : {}),
  };
  sink(sanitized);
}
