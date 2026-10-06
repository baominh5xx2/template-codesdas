import "server-only";
import { GatewayError, type GatewayClient } from "./client";
import { GATEWAY_DEFAULTS } from "./defaults";
import { sniffMimeType, toBlob, type MediaBytes } from "./media";

export type SpeakOptions = {
  text: string;
  model?: string;
  /** Gemini voices (Kore, Puck, Zephyr, …) or OpenAI voices (alloy, …) for gpt-4o-mini-tts. */
  voice?: string;
  /** OpenAI TTS style prompt, e.g. "Nói chậm, giọng ấm". */
  instructions?: string;
  /** Provider-specific fields, e.g. `{ speed: 1.1, response_format: "wav" }`. */
  extra?: Record<string, unknown>;
  signal?: AbortSignal;
  timeoutMs?: number;
};

export type SpeechResult = MediaBytes & { model: string; voice: string; cost: number | null };

/** Text → audio bytes (MP3 by default). */
export async function speak(client: GatewayClient, options: SpeakOptions): Promise<SpeechResult> {
  const model = options.model ?? GATEWAY_DEFAULTS.tts;
  const voice = options.voice ?? (model.startsWith("gpt-") ? GATEWAY_DEFAULTS.openAiTtsVoice : GATEWAY_DEFAULTS.ttsVoice);
  const body: Record<string, unknown> = { model, input: options.text, voice };
  if (options.instructions) body.instructions = options.instructions;
  Object.assign(body, options.extra);

  const { data, mimeType, cost } = await client.bytes("/audio/speech", { json: body, signal: options.signal, timeoutMs: options.timeoutMs ?? 180_000 });
  if (data.byteLength === 0) throw new GatewayError("gateway_invalid_response", undefined, "empty_audio");
  return { bytes: data, mimeType: mimeType.startsWith("audio/") ? mimeType : sniffMimeType(data, "audio/mpeg"), model, voice, cost };
}

export type TranscribeOptions = {
  audio: MediaBytes & { filename?: string };
  model?: string;
  /** ISO-639-1 hint, e.g. "vi". Honoured by OpenAI models. */
  language?: string;
  /** Vocabulary/context hint. */
  prompt?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
};

export type TranscriptionResult = { text: string; model: string; usage?: unknown; cost: number | null };

/** Audio bytes → text. Vietnamese is supported. */
export async function transcribe(client: GatewayClient, options: TranscribeOptions): Promise<TranscriptionResult> {
  const model = options.model ?? GATEWAY_DEFAULTS.stt;
  const form = new FormData();
  form.set("model", model);
  form.set("file", toBlob(options.audio), options.audio.filename ?? `audio.${extension(options.audio.mimeType)}`);
  // gpt-transcribe requires json; it is also the default shape for every other model.
  form.set("response_format", "json");
  if (options.language) form.set("language", options.language);
  if (options.prompt) form.set("prompt", options.prompt);

  const { data, cost } = await client.json<{ text?: unknown; usage?: unknown }>("/audio/transcriptions", {
    form,
    signal: options.signal,
    timeoutMs: options.timeoutMs ?? 300_000,
  });
  if (typeof data.text !== "string") throw new GatewayError("gateway_invalid_response", undefined, "missing_transcript");
  return { text: data.text, model, usage: data.usage, cost };
}

function extension(mimeType: string): string {
  const map: Record<string, string> = { "audio/mpeg": "mp3", "audio/mp3": "mp3", "audio/wav": "wav", "audio/x-wav": "wav", "audio/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "m4a", "audio/x-m4a": "m4a", "audio/flac": "flac" };
  return map[mimeType] ?? "mp3";
}
