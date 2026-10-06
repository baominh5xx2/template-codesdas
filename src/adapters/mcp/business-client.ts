import "server-only";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import type { BusinessMcpConfig } from "@/server/mcp/config";
import { BUSINESS_TOOL_MAX_BYTES, BusinessMcpFailure } from "./results";

/** Read at most 32 KiB of each complete HTTP response before the SDK decodes it. */
export function createBoundedBusinessFetch(url: URL, token: string, signal: AbortSignal, fetcher: typeof fetch = fetch): typeof fetch {
  return async (input, init) => {
    try {
      const target = input instanceof Request ? input.url : String(input);
      if (target !== url.href) throw new BusinessMcpFailure("endpoint_denied");
      const headers = new Headers(init?.headers);
      headers.delete("cookie"); headers.delete("origin");
      headers.set("authorization", `Bearer ${token}`);
      const requestSignal = AbortSignal.any([signal, ...(input instanceof Request ? [input.signal] : []), ...(init?.signal ? [init.signal] : [])]);
      requestSignal.throwIfAborted();
      const response = await fetcher(input, { ...init, headers, signal: requestSignal, redirect: "error", credentials: "omit" });
      const length = Number(response.headers.get("content-length"));
      if (Number.isFinite(length) && length > BUSINESS_TOOL_MAX_BYTES) { await response.body?.cancel(); throw new BusinessMcpFailure("response_too_large"); }
      if (!response.body) return response;
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = []; let size = 0;
      const abort = () => { void reader.cancel().catch(() => {}); };
      requestSignal.addEventListener("abort", abort, { once: true });
      try {
        while (true) {
          requestSignal.throwIfAborted();
          const { done, value } = await reader.read();
          requestSignal.throwIfAborted();
          if (done) break;
          size += value.byteLength;
          if (size > BUSINESS_TOOL_MAX_BYTES) { await reader.cancel(); throw new BusinessMcpFailure("response_too_large"); }
          chunks.push(value);
        }
      } finally { requestSignal.removeEventListener("abort", abort); reader.releaseLock(); }
      const body = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
      return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
    } catch (error) {
      throw error instanceof BusinessMcpFailure ? error : new BusinessMcpFailure(signal.aborted ? "cancelled" : "transport_failed");
    }
  };
}

export function createBusinessClient(config: Extract<BusinessMcpConfig, { enabled: true }>, signal: AbortSignal, fetcher?: typeof fetch) {
  const client = new Client({ name: "business-chat", version: "1.0.0" }, { versionNegotiation: { mode: "auto", probe: { maxRetries: 0 } } });
  const transport = new StreamableHTTPClientTransport(config.url, {
    fetch: createBoundedBusinessFetch(config.url, config.token, signal, fetcher),
    requestInit: { redirect: "error", credentials: "omit", headers: { authorization: `Bearer ${config.token}` } },
  });
  return { client, transport };
}
