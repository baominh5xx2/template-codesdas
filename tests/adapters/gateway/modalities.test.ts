import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createGateway } from "@/adapters/gateway";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MP3 = new Uint8Array([0x49, 0x44, 0x33, 0x04]);

/** Gateway backed by a fake fetch; `respond` sees the parsed request. */
function setup(respond: (req: { url: string; method: string; json?: Record<string, unknown>; form?: FormData }) => Response | Promise<Response>) {
  const calls: { url: string; method: string; json?: Record<string, unknown>; form?: FormData }[] = [];
  const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
    const req = {
      url: String(input).replace("https://gw.test", ""),
      method: init?.method ?? "GET",
      ...(typeof init?.body === "string" ? { json: JSON.parse(init.body) } : {}),
      ...(init?.body instanceof FormData ? { form: init.body } : {}),
    };
    calls.push(req);
    return respond(req);
  });
  return { gateway: createGateway({ baseUrl: "https://gw.test", apiKey: "k" }, { fetch, sleep: async () => {} }), calls };
}

describe("text", () => {
  it("chats with default model, maps max tokens per family and returns grounding citations", async () => {
    const { gateway, calls } = setup(() => Response.json({
      model: "gemini-3.5-flash",
      choices: [{ message: { content: "Hà Nội" } }],
      vertex_ai_grounding_metadata: [{ groundingChunks: [{ web: { uri: "https://a.vn", title: "A" } }, { web: { uri: "https://a.vn" } }] }],
    }));
    const result = await gateway.chat({ messages: [{ role: "user", content: "Thủ đô?" }], search: true, maxTokens: 500 });
    expect(result).toMatchObject({ text: "Hà Nội", citations: [{ uri: "https://a.vn", title: "A" }] });
    expect(calls[0]).toMatchObject({ url: "/chat/completions", json: { model: "gemini-3.5-flash", tools: [{ googleSearch: {} }], max_tokens: 500 } });

    await gateway.chat({ messages: [], model: "gpt-6-luna", maxTokens: 4000, reasoningEffort: "low" });
    expect(calls[1].json).toMatchObject({ max_completion_tokens: 4000, reasoning_effort: "low" });
    expect(calls[1].json).not.toHaveProperty("max_tokens");
  });

  it("parses fenced JSON replies against a schema", async () => {
    const { gateway, calls } = setup(() => Response.json({ choices: [{ message: { content: '```json\n{"score": 7}\n```' } }] }));
    const result = await gateway.chatJson({ messages: [], schema: z.object({ score: z.number() }) });
    expect(result.value).toEqual({ score: 7 });
    expect(calls[0].json?.response_format).toEqual({ type: "json_object" });
    const bad = setup(() => Response.json({ choices: [{ message: { content: '{"score":"x"}' } }] }));
    await expect(bad.gateway.chatJson({ messages: [], schema: z.object({ score: z.number() }) })).rejects.toMatchObject({ code: "gateway_invalid_response" });
  });
});

describe("image", () => {
  it("decodes b64_json and sends aspect_ratio with n=1", async () => {
    const { gateway, calls } = setup(() => Response.json({ data: [{ b64_json: Buffer.from(PNG).toString("base64") }] }));
    const image = await gateway.generateImage({ prompt: "mèo", aspectRatio: "16:9" });
    expect(image.mimeType).toBe("image/png");
    expect(Array.from(image.bytes)).toEqual(Array.from(PNG));
    expect(calls[0]).toMatchObject({ url: "/images/generations", json: { model: "nano-banana-2", prompt: "mèo", n: 1, aspect_ratio: "16:9" } });
  });
  it("fails clearly when no image comes back", async () => {
    const { gateway } = setup(() => Response.json({ data: [] }));
    await expect(gateway.generateImage({ prompt: "x" })).rejects.toMatchObject({ code: "gateway_invalid_response" });
  });
});

describe("video", () => {
  it("starts, polls until completed and downloads the mp4", async () => {
    let polls = 0;
    const onStatus = vi.fn();
    const { gateway, calls } = setup((req) => {
      if (req.url === "/v1/videos") return Response.json({ id: "vid_1", status: "queued" });
      if (req.url === "/v1/videos/vid_1") return Response.json({ id: "vid_1", status: ++polls < 3 ? "processing" : "completed" });
      return new Response(new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70]), { headers: { "content-type": "video/mp4" } });
    });
    const video = await gateway.generateVideo({ prompt: "sóng biển", seconds: 4, size: "720x1280", onStatus, sleep: async () => {} });
    expect(video).toMatchObject({ id: "vid_1", mimeType: "video/mp4" });
    expect(calls[0].json).toEqual({ model: "veo-3.1-lite-generate-001", prompt: "sóng biển", seconds: "4", size: "720x1280" });
    expect(calls.at(-1)?.url).toBe("/v1/videos/vid_1/content");
    expect(onStatus.mock.calls.map(([job]) => job.status)).toEqual(["queued", "processing", "processing", "completed"]);
  });

  it("uses multipart for image-to-video and surfaces failed jobs", async () => {
    const { gateway, calls } = setup((req) => req.url === "/v1/videos"
      ? Response.json({ id: "vid_2", status: "processing" })
      : Response.json({ id: "vid_2", status: "failed", error: { message: "safety filter" } }));
    const error = await gateway.generateVideo({ prompt: "x", inputReference: { bytes: PNG, mimeType: "image/png" }, sleep: async () => {} }).catch((e) => e);
    expect(error).toMatchObject({ code: "gateway_video_failed", detail: "safety filter" });
    const form = calls[0].form!;
    expect(form.get("prompt")).toBe("x");
    expect((form.get("input_reference") as File).name).toBe("reference.png");
  });

  it("does not retry a 5xx on create, because Veo bills on creation", async () => {
    const { gateway, calls } = setup(() => new Response("", { status: 502 }));
    await expect(gateway.startVideo({ prompt: "x" })).rejects.toMatchObject({ code: "gateway_upstream" });
    expect(calls).toHaveLength(1);
  });
});

describe("audio", () => {
  it("speaks with a Gemini voice by default and an OpenAI voice for gpt models", async () => {
    const { gateway, calls } = setup(() => new Response(MP3, { headers: { "content-type": "audio/mpeg" } }));
    const speech = await gateway.speak({ text: "Xin chào" });
    expect(speech).toMatchObject({ mimeType: "audio/mpeg", voice: "Kore", model: "gemini-2.5-flash-preview-tts" });
    expect(calls[0]).toMatchObject({ url: "/audio/speech", json: { input: "Xin chào", voice: "Kore" } });
    await gateway.speak({ text: "hi", model: "gpt-4o-mini-tts" });
    expect(calls[1].json?.voice).toBe("alloy");
  });

  it("transcribes via multipart with response_format=json", async () => {
    const { gateway, calls } = setup(() => Response.json({ text: "xin chào", usage: { total_tokens: 3 } }));
    const result = await gateway.transcribe({ audio: { bytes: MP3, mimeType: "audio/webm" }, language: "vi" });
    expect(result.text).toBe("xin chào");
    const form = calls[0].form!;
    expect(calls[0].url).toBe("/audio/transcriptions");
    expect(form.get("model")).toBe("gemini-3.5-transcribe-preview");
    expect(form.get("response_format")).toBe("json");
    expect(form.get("language")).toBe("vi");
    expect((form.get("file") as File).name).toBe("audio.webm");
  });
});

describe("embeddings", () => {
  it("orders vectors by index and splits requests for single-input models", async () => {
    const { gateway, calls } = setup((req) => {
      const input = req.json?.input;
      const items = Array.isArray(input) ? input : [input];
      return Response.json({ data: items.map((_, i) => ({ index: items.length - 1 - i, embedding: [items.length - 1 - i] })).reverse() });
    });
    expect((await gateway.embed({ input: ["a", "b", "c"] })).vectors).toEqual([[0], [1], [2]]);
    expect(calls).toHaveLength(1);
    await gateway.embed({ input: ["a", "b"], model: "gemini-embedding-2" });
    expect(calls.slice(1).map((c) => c.json?.input)).toEqual(["a", "b"]);
  });
});
