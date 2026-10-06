import "server-only";
import { GatewayError, type GatewayClient } from "./client";
import { GATEWAY_DEFAULTS } from "./defaults";
import { decodeBase64, sniffMimeType, type MediaBytes } from "./media";

export type ImageOptions = {
  prompt: string;
  model?: string;
  /** Gemini (nano-banana*) models. */
  aspectRatio?: "1:1" | "3:4" | "4:3" | "16:9" | "9:16";
  /** OpenAI gpt-image-* models: 1024x1024 | 1536x1024 | 1024x1536. Ignored by Gemini. */
  size?: string;
  /** OpenAI gpt-image-* models. */
  quality?: "low" | "medium" | "high";
  signal?: AbortSignal;
  timeoutMs?: number;
};

export type ImageResult = MediaBytes & { model: string; cost: number | null };

/** One image per call (the gateway only supports n=1). */
export async function generateImage(client: GatewayClient, options: ImageOptions): Promise<ImageResult> {
  const model = options.model ?? GATEWAY_DEFAULTS.image;
  const body: Record<string, unknown> = { model, prompt: options.prompt, n: 1 };
  if (options.aspectRatio) body.aspect_ratio = options.aspectRatio;
  if (options.size) body.size = options.size;
  if (options.quality) body.quality = options.quality;

  const { data, cost } = await client.json<{ data?: { b64_json?: string; url?: string }[] }>("/images/generations", {
    json: body,
    signal: options.signal,
    timeoutMs: options.timeoutMs ?? 180_000,
  });
  const first = data.data?.[0];
  const encoded = first?.b64_json ?? (first?.url?.startsWith("data:") ? first.url : undefined);
  if (!encoded) throw new GatewayError("gateway_invalid_response", undefined, "missing_image_data");
  const bytes = decodeBase64(encoded);
  return { bytes, mimeType: sniffMimeType(bytes, "image/png"), model, cost };
}
