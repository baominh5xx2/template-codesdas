/**
 * Default model per modality. Change one line here to switch models; every call can also pass `model`.
 * Catalog: https://docs.thucchien.ai/docs/user-guide
 */
export const GATEWAY_DEFAULTS = {
  /** Also: gemini-3.1-flash-lite (cheap), gemini-3.1-pro-preview, gpt-6-luna, deepseek-flash. */
  text: "gemini-3.5-flash",
  /** Also: nano-banana-2-lite (cheap), nano-banana-pro (best), gpt-image-2.5-flare. */
  image: "nano-banana-2",
  /** $0.05/s. Also: veo-3.1-fast-generate-001, veo-3.1-generate-001 ($0.40/s). Charged on create. */
  video: "veo-3.1-lite-generate-001",
  /** Also: gemini-3.1-flash-tts-preview, gemini-2.5-pro-preview-tts, gpt-4o-mini-tts (OpenAI voices). */
  tts: "gemini-2.5-flash-preview-tts",
  /** Gemini voices: Zephyr, Puck, Charon, Kore, Fenrir, Leda, Orus, Aoede, … */
  ttsVoice: "Kore",
  /** Used when the TTS model is an OpenAI model (gpt-*). */
  openAiTtsVoice: "alloy",
  /** Also: gpt-4o-transcribe, gpt-4o-mini-transcribe, whisper-1. */
  stt: "gemini-3.5-transcribe-preview",
  /** 3072 dims. Also: text-multilingual-embedding-002 (768), text-embedding-3-small (1536). */
  embedding: "gemini-embedding-001",
} as const;

/** Polling cadence recommended by the Veo docs. */
export const VIDEO_POLL_INTERVAL_MS = 10_000;
export const VIDEO_WAIT_TIMEOUT_MS = 10 * 60_000;
