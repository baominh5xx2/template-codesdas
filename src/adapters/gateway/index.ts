import "server-only";
import { createGatewayClient, GatewayError, type GatewayClient, type GatewayClientOptions } from "./client";
import { loadGatewayConfig, type GatewayConfig } from "./config";
import { chat, chatJson, type ChatOptions } from "./text";
import { generateImage, type ImageOptions } from "./image";
import { downloadVideo, generateVideo, getVideo, startVideo, waitForVideo, type VideoOptions, type WaitOptions } from "./video";
import { speak, transcribe, type SpeakOptions, type TranscribeOptions } from "./audio";
import { embed, type EmbedOptions } from "./embeddings";
import { keyInfo } from "./usage";
import type { z } from "zod";

export { GatewayError } from "./client";
export type { GatewayErrorCode, GatewayClient } from "./client";
export { GATEWAY_DEFAULTS } from "./defaults";
export { cosineSimilarity } from "./embeddings";
export type { MediaBytes } from "./media";
export type { ChatMessage, ChatContentPart, ChatResult, Citation } from "./text";
export type { ImageResult } from "./image";
export type { VideoJob, VideoStatus } from "./video";
export type { SpeechResult, TranscriptionResult } from "./audio";
export type { EmbedResult } from "./embeddings";
export type { KeyInfo } from "./usage";

export type Gateway = ReturnType<typeof createGateway>;

/**
 * One object with every modality. With `config: null` the gateway reports `available: false`
 * and every call rejects with `GatewayError("gateway_unavailable")` instead of crashing at import.
 */
export function createGateway(config: GatewayConfig | null, options?: GatewayClientOptions) {
  const client: GatewayClient | null = config ? createGatewayClient(config, options) : null;
  const ready = (): GatewayClient => {
    if (!client) throw new GatewayError("gateway_unavailable");
    return client;
  };
  return {
    available: client !== null,
    chat: async (o: ChatOptions) => chat(ready(), o),
    chatJson: async <T>(o: ChatOptions & { schema: z.ZodType<T> }) => chatJson(ready(), o),
    generateImage: async (o: ImageOptions) => generateImage(ready(), o),
    startVideo: async (o: VideoOptions) => startVideo(ready(), o),
    getVideo: async (id: string, signal?: AbortSignal) => getVideo(ready(), id, signal),
    waitForVideo: async (id: string, o?: WaitOptions) => waitForVideo(ready(), id, o),
    downloadVideo: async (id: string, signal?: AbortSignal) => downloadVideo(ready(), id, signal),
    generateVideo: async (o: VideoOptions & Omit<WaitOptions, "signal">) => generateVideo(ready(), o),
    speak: async (o: SpeakOptions) => speak(ready(), o),
    transcribe: async (o: TranscribeOptions) => transcribe(ready(), o),
    embed: async (o: EmbedOptions) => embed(ready(), o),
    keyInfo: async (signal?: AbortSignal) => keyInfo(ready(), signal),
  };
}

let shared: Gateway | undefined;

/** Process-wide gateway from AI_GATEWAY_* env, so all callers share one concurrency limit. */
export function getGateway(): Gateway {
  if (!shared) {
    const result = loadGatewayConfig(process.env);
    shared = createGateway(result.available ? result.config : null);
  }
  return shared;
}
