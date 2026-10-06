import { createReadStream } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { getMediaStorage, isValidMediaKey, mediaTypeForKey } from "@/adapters/storage/local-file-storage";

export const runtime = "nodejs";

/**
 * Serves generated media saved with `getMediaStorage().saveMedia(...)`.
 * Supports single byte ranges so <video>/<audio> can seek (Safari requires it).
 */
export async function GET(request: Request, context: { params: Promise<{ key: string }> }): Promise<Response> {
  const { key } = await context.params;
  const storage = getMediaStorage();
  if (!isValidMediaKey(key)) return notFound();
  const size = await storage.size(key);
  if (size === null) return notFound();

  const headers = new Headers({
    "content-type": mediaTypeForKey(key),
    "accept-ranges": "bytes",
    "cache-control": "private, max-age=3600",
    "x-content-type-options": "nosniff",
    "content-security-policy": "default-src 'none'; sandbox",
  });
  const file = path.join(storage.root, key);

  const range = parseRange(request.headers.get("range"), size);
  if (range === "invalid") {
    headers.set("content-range", `bytes */${size}`);
    return new Response(null, { status: 416, headers });
  }
  if (range) {
    headers.set("content-range", `bytes ${range.start}-${range.end}/${size}`);
    headers.set("content-length", String(range.end - range.start + 1));
    return new Response(stream(file, range), { status: 206, headers });
  }
  headers.set("content-length", String(size));
  return new Response(size === 0 ? null : stream(file), { status: 200, headers });
}

function stream(file: string, range?: { start: number; end: number }): ReadableStream<Uint8Array> {
  return Readable.toWeb(createReadStream(file, range)) as ReadableStream<Uint8Array>;
}

function parseRange(header: string | null, size: number): { start: number; end: number } | "invalid" | null {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (!match[1] && !match[2])) return null;
  let start: number, end: number;
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (suffix === 0) return "invalid";
    start = Math.max(size - suffix, 0);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  }
  return start > end || start >= size ? "invalid" : { start, end };
}

function notFound(): Response {
  return Response.json({ error: { code: "not_found", message: "Media not found.", retryable: false, traceId: "media" } }, { status: 404 });
}
