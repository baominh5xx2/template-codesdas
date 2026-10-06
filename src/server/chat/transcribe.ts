import "server-only";
import { CHAT_NOTICE } from "@/contracts/chat";
import { getGateway, GatewayError, type Gateway } from "@/adapters/gateway";
import { incomingOrigin } from "./origin";

export const TRANSCRIBE_LIMITS = {
  /** Largest accepted audio file. */
  audioBytes: 10 * 1024 * 1024,
  /** Multipart framing allowance on top of the file itself. */
  bodyOverheadBytes: 64 * 1024,
  timeoutMs: 60_000,
} as const;

const AUDIO_TYPES = new Set([
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/x-m4a",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
]);

type TranscribeErrorCode = "invalid_origin" | "invalid_request" | "payload_too_large" | "chat_unavailable";

function failure(status: number, code: TranscribeErrorCode): Response {
  return Response.json(
    { error: { code, message: CHAT_NOTICE } },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

/** Reads at most `limit` bytes; `null` means the body was larger. */
async function readBounded(body: ReadableStream<Uint8Array>, limit: number): Promise<Uint8Array | null> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

/**
 * POST multipart `audio` (File) → `{ text }`. Every failure answers with the generic notice only;
 * provider details never leave the server.
 */
export function createTranscribeHandler(
  gateway: () => Gateway = getGateway
): (request: Request) => Promise<Response> {
  return async (request) => {
    const origin = request.headers.get("origin");
    if (origin !== null && origin !== incomingOrigin(request)) return failure(403, "invalid_origin");

    const client = gateway();
    if (!client.available) return failure(503, "chat_unavailable");

    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().startsWith("multipart/form-data") || !request.body) {
      return failure(400, "invalid_request");
    }
    const bodyLimit = TRANSCRIBE_LIMITS.audioBytes + TRANSCRIBE_LIMITS.bodyOverheadBytes;
    const declared = Number(request.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > bodyLimit) return failure(413, "payload_too_large");

    let form: FormData;
    try {
      const raw = await readBounded(request.body, bodyLimit);
      if (!raw) return failure(413, "payload_too_large");
      form = await new Response(raw as Uint8Array<ArrayBuffer>, { headers: { "content-type": contentType } }).formData();
    } catch {
      return failure(400, "invalid_request");
    }

    const audio = form.get("audio");
    if (!(audio instanceof Blob) || audio.size === 0) return failure(400, "invalid_request");
    if (audio.size > TRANSCRIBE_LIMITS.audioBytes) return failure(413, "payload_too_large");
    const mimeType = (audio.type.split(";")[0] ?? "").trim().toLowerCase();
    if (!AUDIO_TYPES.has(mimeType)) return failure(400, "invalid_request");

    try {
      const result = await client.transcribe({
        audio: { bytes: new Uint8Array(await audio.arrayBuffer()), mimeType },
        language: "vi",
        signal: request.signal,
        timeoutMs: TRANSCRIBE_LIMITS.timeoutMs,
      });
      return Response.json({ text: result.text.trim() }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      if (error instanceof GatewayError && error.code === "gateway_bad_request") return failure(400, "invalid_request");
      return failure(503, "chat_unavailable");
    }
  };
}
