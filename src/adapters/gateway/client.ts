import "server-only";
import type { GatewayConfig } from "./config";

export type GatewayErrorCode =
  | "gateway_unavailable"
  | "gateway_auth"
  | "gateway_bad_request"
  | "gateway_rate_limited"
  | "gateway_upstream"
  | "gateway_timeout"
  | "gateway_cancelled"
  | "gateway_invalid_response"
  | "gateway_video_failed";

/** `message` is always the code, so it is safe to log or show; `detail` is a trimmed upstream hint for server logs. */
export class GatewayError extends Error {
  constructor(
    readonly code: GatewayErrorCode,
    readonly status?: number,
    readonly detail?: string
  ) {
    super(code);
    this.name = "GatewayError";
  }

  get retryable(): boolean {
    return this.code === "gateway_rate_limited" || this.code === "gateway_upstream" || this.code === "gateway_timeout";
  }
}

export type GatewayRequestOptions = {
  method?: "GET" | "POST";
  /** JSON body. Mutually exclusive with `form`. */
  json?: unknown;
  /** multipart/form-data body (audio upload, image-to-video). */
  form?: FormData;
  signal?: AbortSignal;
  /** Per attempt. Default 120 s. */
  timeoutMs?: number;
  /**
   * `true` (default): retry 429, 5xx and network errors. `false`: retry only 429, for calls that bill
   * on creation (e.g. video start) where a 5xx may already have been charged.
   */
  idempotent?: boolean;
  /** Extra attempts after the first. Default 3. */
  retries?: number;
};

export type GatewayResult<T> = { data: T; cost: number | null; headers: Headers };

export interface GatewayClient {
  request(path: string, options?: GatewayRequestOptions): Promise<{ response: Response; cost: number | null }>;
  json<T = unknown>(path: string, options?: GatewayRequestOptions): Promise<GatewayResult<T>>;
  bytes(path: string, options?: GatewayRequestOptions): Promise<GatewayResult<Uint8Array> & { mimeType: string }>;
}

export type GatewayClientOptions = {
  fetch?: typeof fetch;
  /** Gateway allows 10 concurrent requests per key (5 for test keys); stay below it. */
  maxConcurrency?: number;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  /** Base backoff; doubled each attempt, plus jitter. */
  backoffMs?: number;
};

const RETRYABLE_STATUS = new Set([500, 502, 503, 504]);

export function createGatewayClient(config: GatewayConfig, options: GatewayClientOptions = {}): GatewayClient {
  const fetchImpl = options.fetch ?? fetch;
  const sleep = options.sleep ?? abortableSleep;
  const backoffMs = options.backoffMs ?? 1000;
  const acquire = createSemaphore(options.maxConcurrency ?? 4);

  async function attempt(path: string, opts: GatewayRequestOptions): Promise<Response> {
    const timeout = AbortSignal.timeout(opts.timeoutMs ?? 120_000);
    const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout;
    const headers: Record<string, string> = { authorization: `Bearer ${config.apiKey}` };
    let body: BodyInit | undefined;
    if (opts.form) body = opts.form;
    else if (opts.json !== undefined) {
      headers["content-type"] = "application/json";
      body = JSON.stringify(opts.json);
    }
    try {
      return await fetchImpl(`${config.baseUrl}${path}`, {
        method: opts.method ?? (body ? "POST" : "GET"),
        headers,
        body,
        signal,
        redirect: "error",
        credentials: "omit",
      });
    } catch {
      if (opts.signal?.aborted) throw new GatewayError("gateway_cancelled");
      if (timeout.aborted) throw new GatewayError("gateway_timeout");
      throw new GatewayError("gateway_upstream", undefined, "network_error");
    }
  }

  async function request(path: string, opts: GatewayRequestOptions = {}) {
    const retries = opts.retries ?? 3;
    const idempotent = opts.idempotent ?? true;
    const release = await acquire(opts.signal);
    try {
      for (let n = 0; ; n++) {
        let failure: GatewayError;
        let retryAfterMs: number | undefined;
        try {
          const response = await attempt(path, opts);
          if (response.ok) return { response, cost: parseCost(response.headers) };
          failure = await toError(response);
          retryAfterMs = parseRetryAfter(response.headers);
        } catch (error) {
          if (!(error instanceof GatewayError)) throw error;
          failure = error;
        }
        const canRetry = failure.code === "gateway_rate_limited" || (idempotent && failure.retryable);
        if (!canRetry || n >= retries) throw failure;
        await sleep(retryAfterMs ?? backoffMs * 2 ** n + Math.random() * 250, opts.signal);
      }
    } finally {
      release();
    }
  }

  return {
    request,
    async json<T>(path: string, opts?: GatewayRequestOptions) {
      const { response, cost } = await request(path, opts);
      try {
        return { data: (await response.json()) as T, cost, headers: response.headers };
      } catch {
        throw new GatewayError("gateway_invalid_response", response.status, "body_not_json");
      }
    },
    async bytes(path: string, opts?: GatewayRequestOptions) {
      const { response, cost } = await request(path, opts);
      const data = new Uint8Array(await response.arrayBuffer());
      const mimeType = response.headers.get("content-type")?.split(";")[0].trim() || "application/octet-stream";
      return { data, cost, headers: response.headers, mimeType };
    },
  };
}

async function toError(response: Response): Promise<GatewayError> {
  const detail = await readDetail(response);
  const status = response.status;
  if (status === 401 || status === 403) return new GatewayError("gateway_auth", status, detail);
  if (status === 429) return new GatewayError("gateway_rate_limited", status, detail);
  if (status === 408 || status === 504) return new GatewayError("gateway_timeout", status, detail);
  if (RETRYABLE_STATUS.has(status)) return new GatewayError("gateway_upstream", status, detail);
  return new GatewayError(status >= 500 ? "gateway_upstream" : "gateway_bad_request", status, detail);
}

async function readDetail(response: Response): Promise<string | undefined> {
  try {
    const text = await response.text();
    try {
      const parsed = JSON.parse(text) as { error?: { message?: unknown } | string; detail?: unknown };
      const message = typeof parsed.error === "string" ? parsed.error : parsed.error?.message ?? parsed.detail;
      if (typeof message === "string") return message.slice(0, 300);
    } catch { /* not JSON */ }
    return text.slice(0, 300) || undefined;
  } catch {
    return undefined;
  }
}

function parseCost(headers: Headers): number | null {
  const value = Number(headers.get("x-litellm-response-cost"));
  return headers.has("x-litellm-response-cost") && Number.isFinite(value) ? value : null;
}

function parseRetryAfter(headers: Headers): number | undefined {
  const value = Number(headers.get("retry-after"));
  return headers.has("retry-after") && Number.isFinite(value) && value >= 0 ? Math.min(value * 1000, 30_000) : undefined;
}

export function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new GatewayError("gateway_cancelled"));
    const timer = setTimeout(() => { signal?.removeEventListener("abort", onAbort); resolve(); }, ms);
    const onAbort = () => { clearTimeout(timer); reject(new GatewayError("gateway_cancelled")); };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function createSemaphore(limit: number) {
  let active = 0;
  const waiting: Array<() => void> = [];
  return async function acquire(signal?: AbortSignal): Promise<() => void> {
    if (signal?.aborted) throw new GatewayError("gateway_cancelled");
    if (active < limit) active++;
    else {
      // A releasing caller hands its slot straight to the next waiter, so `active` stays accurate.
      await new Promise<void>((resolve, reject) => {
        const start = () => { signal?.removeEventListener("abort", onAbort); resolve(); };
        const onAbort = () => {
          const index = waiting.indexOf(start);
          if (index >= 0) waiting.splice(index, 1);
          reject(new GatewayError("gateway_cancelled"));
        };
        waiting.push(start);
        signal?.addEventListener("abort", onAbort, { once: true });
      });
    }
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const next = waiting.shift();
      if (next) next();
      else active--;
    };
  };
}
