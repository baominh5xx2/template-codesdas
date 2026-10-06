import { beforeEach, describe, expect, it, vi } from "vitest";

const gateway = vi.hoisted(() => ({
  available: true,
  transcribe: vi.fn(),
}));

vi.mock("@/adapters/gateway", async () => {
  const { GatewayError } = await import("@/adapters/gateway/client");
  return { getGateway: () => gateway, GatewayError };
});

import { POST } from "@/app/api/chat/transcribe/route";
import { GatewayError } from "@/adapters/gateway/client";

const HOST = "localhost:3000";
const ORIGIN = `http://${HOST}`;

async function request(
  audio: Blob | null,
  { origin = ORIGIN, filename = "voice.webm" }: { origin?: string | null; filename?: string } = {}
): Promise<Request> {
  const form = new FormData();
  if (audio) form.append("audio", audio, filename);
  const headers = new Headers({ host: HOST });
  if (origin !== null) headers.set("origin", origin);
  // Serialize once so the multipart boundary in content-type matches the body.
  const encoded = new Request(`${ORIGIN}/api/chat/transcribe`, { method: "POST", body: form });
  headers.set("content-type", encoded.headers.get("content-type") ?? "");
  const body = await encoded.arrayBuffer();
  return new Request(`${ORIGIN}/api/chat/transcribe`, { method: "POST", headers, body });
}

const webm = (bytes = 32) => new Blob([new Uint8Array(bytes).fill(1)], { type: "audio/webm;codecs=opus" });

async function expectFailure(response: Response, status: number, code: string): Promise<void> {
  expect(response.status).toBe(status);
  const body = await response.json();
  expect(body).toEqual({ error: { code, message: "Chưa kết nối" } });
}

describe("POST /api/chat/transcribe", () => {
  beforeEach(() => {
    gateway.available = true;
    gateway.transcribe.mockReset();
  });

  it("transcribes same-origin audio through the gateway in Vietnamese", async () => {
    gateway.transcribe.mockResolvedValue({ text: "  xin chào  ", model: "m", cost: null });

    const response = await POST(await request(webm(64)));

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ text: "xin chào" });
    expect(gateway.transcribe).toHaveBeenCalledTimes(1);
    const options = gateway.transcribe.mock.calls[0]?.[0];
    expect(options.language).toBe("vi");
    expect(options.audio.mimeType).toBe("audio/webm");
    expect(options.audio.bytes).toBeInstanceOf(Uint8Array);
    expect(options.audio.bytes.byteLength).toBe(64);
  });

  it("allows requests without an Origin header", async () => {
    gateway.transcribe.mockResolvedValue({ text: "ok", model: "m", cost: null });
    const response = await POST(await request(webm(), { origin: null }));
    expect(response.status).toBe(200);
  });

  it("rejects audio larger than 10 MB with 413", async () => {
    const big = new Blob([new Uint8Array(10 * 1024 * 1024 + 1)], { type: "audio/webm" });
    await expectFailure(await POST(await request(big)), 413, "payload_too_large");
    expect(gateway.transcribe).not.toHaveBeenCalled();
  });

  it("rejects non-audio files with 400", async () => {
    const text = new Blob(["hello"], { type: "text/plain" });
    await expectFailure(await POST(await request(text, { filename: "a.txt" })), 400, "invalid_request");
    expect(gateway.transcribe).not.toHaveBeenCalled();
  });

  it("rejects a missing audio field with 400", async () => {
    await expectFailure(await POST(await request(null)), 400, "invalid_request");
  });

  it("answers 503 chat_unavailable when the gateway is not configured", async () => {
    gateway.available = false;
    await expectFailure(await POST(await request(webm())), 503, "chat_unavailable");
    expect(gateway.transcribe).not.toHaveBeenCalled();
  });

  it("rejects cross-origin requests with 403", async () => {
    await expectFailure(await POST(await request(webm(), { origin: "https://evil.example" })), 403, "invalid_origin");
    expect(gateway.transcribe).not.toHaveBeenCalled();
  });

  it("hides provider failures behind the generic notice", async () => {
    gateway.transcribe.mockRejectedValue(new GatewayError("gateway_upstream", 502, "secret upstream detail"));
    const response = await POST(await request(webm()));
    expect(response.status).toBe(503);
    const raw = await response.text();
    expect(raw).not.toContain("secret");
    expect(JSON.parse(raw)).toEqual({ error: { code: "chat_unavailable", message: "Chưa kết nối" } });
  });
});
