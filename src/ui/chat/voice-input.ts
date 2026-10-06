/** Client side of `/api/chat/transcribe`. Technical details never reach the UI. */

export const VOICE_LIMITS = {
  audioBytes: 10 * 1024 * 1024,
} as const;

const TRANSCRIBE_URL = "/api/chat/transcribe";

/** CopilotKit's recorder needs getUserMedia, MediaRecorder and AudioContext. */
export function isVoiceInputSupported(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  return (
    typeof window.MediaRecorder === "function" &&
    typeof window.AudioContext === "function" &&
    typeof navigator.mediaDevices?.getUserMedia === "function"
  );
}

function extension(mimeType: string): string {
  const base = mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (base === "audio/mp4" || base === "audio/x-m4a") return "m4a";
  if (base === "audio/ogg") return "ogg";
  if (base === "audio/mpeg") return "mp3";
  if (base === "audio/wav" || base === "audio/x-wav") return "wav";
  return "webm";
}

/** Uploads the recording and returns the transcript; rejects on any failure. */
export async function requestTranscript(audio: Blob, signal?: AbortSignal): Promise<string> {
  if (audio.size === 0 || audio.size > VOICE_LIMITS.audioBytes) throw new Error("invalid_audio");
  const form = new FormData();
  form.append("audio", audio, `voice.${extension(audio.type)}`);
  const response = await fetch(TRANSCRIBE_URL, {
    method: "POST",
    body: form,
    credentials: "same-origin",
    signal,
  });
  if (!response.ok) throw new Error("transcribe_failed");
  const body: unknown = await response.json();
  const text = body && typeof body === "object" ? (body as { text?: unknown }).text : undefined;
  if (typeof text !== "string") throw new Error("transcribe_failed");
  return text.trim();
}

/** Appends a transcript to the existing draft with a single separating space. */
export function appendTranscript(draft: string, transcript: string, maxChars: number): string {
  const text = transcript.trim();
  if (!text) return draft;
  const head = draft.replace(/\s+$/, "");
  const next = head ? `${head} ${text}` : text;
  return next.slice(0, maxChars);
}
