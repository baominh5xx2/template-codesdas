import "server-only";
import { GatewayError, abortableSleep, type GatewayClient } from "./client";
import { GATEWAY_DEFAULTS, VIDEO_POLL_INTERVAL_MS, VIDEO_WAIT_TIMEOUT_MS } from "./defaults";
import { toBlob, type MediaBytes } from "./media";

export type VideoStatus = "queued" | "processing" | "completed" | "failed";

const KNOWN_STATUSES = new Set<VideoStatus>(["queued", "processing", "completed", "failed"]);

export type VideoJob ={ id: string; status: VideoStatus; model?: string; error?: unknown };

export type VideoOptions = {
  prompt: string;
  model?: string;
  /** Default "8". */
  seconds?: 4 | 6 | 8;
  /** 16:9 → "1280x720" | "1920x1080"; 9:16 → "720x1280" | "1080x1920". Default 1280x720. */
  size?: "1280x720" | "1920x1080" | "720x1280" | "1080x1920";
  /** Image-to-video: the first frame. Sent as multipart/form-data. */
  inputReference?: MediaBytes & { filename?: string };
  signal?: AbortSignal;
};

/**
 * Starts a Veo job. The gateway bills per second as soon as the job is created,
 * so this call is never retried on 5xx (only on 429, which means "not accepted").
 */
export async function startVideo(client: GatewayClient, options: VideoOptions): Promise<VideoJob> {
  const fields: Record<string, string> = { model: options.model ?? GATEWAY_DEFAULTS.video, prompt: options.prompt };
  if (options.seconds) fields.seconds = String(options.seconds);
  if (options.size) fields.size = options.size;

  let request: { json?: unknown; form?: FormData };
  if (options.inputReference) {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) form.set(key, value);
    form.set("input_reference", toBlob(options.inputReference), options.inputReference.filename ?? defaultFilename(options.inputReference.mimeType));
    request = { form };
  } else request = { json: fields };

  const { data } = await client.json<unknown>("/v1/videos", { ...request, signal: options.signal, idempotent: false, timeoutMs: 60_000 });
  return parseJob(data);
}

export async function getVideo(client: GatewayClient, id: string, signal?: AbortSignal): Promise<VideoJob> {
  const { data } = await client.json<unknown>(`/v1/videos/${encodeURIComponent(id)}`, { signal, timeoutMs: 30_000 });
  return parseJob(data);
}

export async function downloadVideo(client: GatewayClient, id: string, signal?: AbortSignal): Promise<MediaBytes> {
  const { data, mimeType } = await client.bytes(`/v1/videos/${encodeURIComponent(id)}/content`, { signal, timeoutMs: 300_000 });
  if (data.byteLength === 0) throw new GatewayError("gateway_invalid_response", undefined, "empty_video");
  return { bytes: data, mimeType: mimeType.startsWith("video/") ? mimeType : "video/mp4" };
}

export type WaitOptions = {
  pollIntervalMs?: number;
  timeoutMs?: number;
  onStatus?: (job: VideoJob) => void;
  signal?: AbortSignal;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
};

/** Polls until the job completes; throws `gateway_video_failed` or `gateway_timeout`. */
export async function waitForVideo(client: GatewayClient, id: string, options: WaitOptions = {}): Promise<VideoJob> {
  const sleep = options.sleep ?? abortableSleep;
  const deadline = Date.now() + (options.timeoutMs ?? VIDEO_WAIT_TIMEOUT_MS);
  for (;;) {
    const job = await getVideo(client, id, options.signal);
    options.onStatus?.(job);
    if (job.status === "completed") return job;
    if (job.status === "failed") throw new GatewayError("gateway_video_failed", undefined, describe(job.error));
    if (Date.now() >= deadline) throw new GatewayError("gateway_timeout", undefined, `video ${id} still ${job.status}`);
    await sleep(options.pollIntervalMs ?? VIDEO_POLL_INTERVAL_MS, options.signal);
  }
}

/** start → poll → download in one call. Keep `id` from `onStatus` if you need to resume after a timeout. */
export async function generateVideo(client: GatewayClient, options: VideoOptions & Omit<WaitOptions, "signal">): Promise<MediaBytes & { id: string }> {
  const job = await startVideo(client, options);
  options.onStatus?.(job);
  await waitForVideo(client, job.id, { ...options, signal: options.signal });
  return { id: job.id, ...(await downloadVideo(client, job.id, options.signal)) };
}

function parseJob(data: unknown): VideoJob {
  const job = data as { id?: unknown; status?: unknown; model?: unknown; error?: unknown };
  if (typeof job?.id !== "string" || !job.id) throw new GatewayError("gateway_invalid_response", undefined, "missing_video_id");
  // Unknown states (e.g. OpenAI's "in_progress") are treated as still processing.
  const status: VideoStatus = KNOWN_STATUSES.has(job.status as VideoStatus) ? (job.status as VideoStatus) : "processing";
  return {
    id: job.id,
    status,
    ...(typeof job.model === "string" ? { model: job.model } : {}),
    ...(job.error ? { error: job.error } : {}),
  };
}

function describe(error: unknown): string | undefined {
  if (!error) return undefined;
  if (typeof error === "string") return error.slice(0, 300);
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" ? message.slice(0, 300) : JSON.stringify(error).slice(0, 300);
}

function defaultFilename(mimeType: string): string {
  return `reference.${mimeType.split("/")[1]?.replace("jpeg", "jpg") ?? "png"}`;
}
