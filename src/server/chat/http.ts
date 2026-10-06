import "server-only";
import { RunAgentInputSchema } from "@ag-ui/core/schemas";
import { createCopilotRuntimeHandler, type AgentRunner } from "@copilotkit/runtime/v2";
import type { BusinessMcpConfig } from "@/server/mcp/config";
import { CHAT_LIMITS } from "@/contracts/chat";
import type { ChatConfigResult } from "./config";
import {
  chatFailureResponse,
  emitChatDiagnostic,
  type ChatDiagnosticSink,
} from "./errors";
import type { RunAgentInput } from "@ag-ui/client";
import { createChatModel } from "@/adapters/llm/chat-model";
import { createChatRuntime } from "@/adapters/agents/chat-runtime";

function incomingOrigin(request: Request, url: URL): string | undefined {
  if (!["http:", "https:"].includes(url.protocol)) return;
  const authority = request.headers.get("host") ?? url.host;
  // Next normalizes loopback Request.url to localhost. The native Host retains
  // the request authority; browser fetch cannot set this forbidden header.
  // Forwarded headers are intentionally not trusted as request authority.
  if (!authority || /[\s/@?#\\%]/.test(authority)) return;
  try {
    const incoming = new URL(`${url.protocol}//${authority}`);
    if (!incoming.hostname || incoming.username || incoming.password || incoming.pathname !== "/" || incoming.search || incoming.hash) return;
    return incoming.origin;
  } catch { return; }
}

export function createChatRequestHandler(
  config: ChatConfigResult,
  diagnostics: ChatDiagnosticSink,
  options: { businessMcp?: BusinessMcpConfig; runner?: AgentRunner } = {}
): (request: Request) => Promise<Response> {
  if (!config.available) {
    return async () => chatFailureResponse(503);
  }

  const model = createChatModel(config.config);
  const runtime = createChatRuntime({
    model,
    diagnostics,
    ...options,
  });

  const sdkHandler = createCopilotRuntimeHandler({
    runtime,
    basePath: "/api/copilotkit",
    hooks: {
      onError: () => chatFailureResponse(500),
    },
  });

  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();
    const isMutation = ["POST", "PATCH", "DELETE", "PUT"].includes(method);

    // Enforce Origin check on browser mutations
    if (isMutation) {
      const originHeader = request.headers.get("origin");
      if (!originHeader || originHeader !== incomingOrigin(request, url)) {
        emitChatDiagnostic(diagnostics, {
          code: "invalid_request",
          traceId: "request",
          phase: "request",
        });
        return chatFailureResponse(403);
      }
    }

    // Bounded read of body up to CHAT_LIMITS.bodyBytes (256 KiB)
    let rawBodyBuffer: Buffer | null = null;
    let rawBodyText: string | null = null;

    if (request.body && isMutation) {
      const reader = request.body.getReader();
      const chunks: Uint8Array[] = [];
      let totalBytes = 0;
      let exceeded = false;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            totalBytes += value.byteLength;
            if (totalBytes > CHAT_LIMITS.bodyBytes) {
              exceeded = true;
              await reader.cancel();
              break;
            }
            chunks.push(value);
          }
        }
      } catch {
        return chatFailureResponse(400);
      }

      if (exceeded) {
        emitChatDiagnostic(diagnostics, {
          code: "invalid_request",
          traceId: "request",
          phase: "request",
        });
        return chatFailureResponse(413);
      }

      rawBodyBuffer = Buffer.concat(chunks);
      rawBodyText = rawBodyBuffer.toString("utf-8");
    }

    // Validate run requests specifically
    let payloadString: string | undefined = undefined;
    let runIdentity: { threadId: string; runId: string } | undefined;
    const isRunRoute = method === "POST" && url.pathname.endsWith("/run");

    if (isRunRoute) {
      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(rawBodyText || "{}");
      } catch {
        emitChatDiagnostic(diagnostics, {
          code: "invalid_request",
          traceId: "request",
          phase: "request",
        });
        return chatFailureResponse(400);
      }

      const validation = RunAgentInputSchema.safeParse(parsedJson);
      if (!validation.success) {
        emitChatDiagnostic(diagnostics, {
          code: "invalid_request",
          traceId: "request",
          phase: "request",
        });
        return chatFailureResponse(400);
      }

      const data = validation.data as RunAgentInput;
      runIdentity = { threadId: data.threadId, runId: data.runId };
      if (Array.isArray(data.messages)) {
        for (const msg of data.messages) {
          if (msg && msg.role === "user") {
            let textLen = 0;
            if (typeof msg.content === "string") {
              textLen = msg.content.length;
            } else if (Array.isArray(msg.content)) {
              for (const part of msg.content) {
                if (
                  typeof part === "object" &&
                  part !== null &&
                  "text" in part &&
                  typeof (part as { text?: unknown }).text === "string"
                ) {
                  textLen += (part as { text: string }).text.length;
                }
              }
            }
            if (textLen > CHAT_LIMITS.inputChars) {
              emitChatDiagnostic(diagnostics, {
                code: "invalid_request",
                traceId: data.runId || "request",
                phase: "request",
              });
              return chatFailureResponse(400);
            }
          }
        }
      }

      // Business tools come from the trusted server provider. Preserve protocol identities.
      const sanitized = {
        ...data,
        tools: [],
        forwardedProps: {},
      };
      payloadString = JSON.stringify(sanitized);
    }

    // Sanitize headers: strip browser auth/identity/provider headers
    const sanitizedHeaders = new Headers();
    for (const [key, value] of request.headers.entries()) {
      const lower = key.toLowerCase();
      if (
        lower === "authorization" ||
        lower === "cookie" ||
        lower === "proxy-authorization" ||
        lower.startsWith("x-copilotcloud") ||
        lower === "x-api-key" ||
        lower === "x-user-id" ||
        lower === "x-tenant-id"
      ) {
        continue;
      }
      sanitizedHeaders.set(key, value);
    }

    const bodyToSend: string | undefined =
      payloadString !== undefined
        ? payloadString
        : rawBodyText !== null
        ? rawBodyText
        : undefined;

    if (bodyToSend !== undefined) {
      sanitizedHeaders.set(
        "content-length",
        String(Buffer.byteLength(bodyToSend))
      );
    }

    const replayedRequest = new Request(request.url, {
      method: request.method,
      headers: sanitizedHeaders,
      body: bodyToSend,
      signal: request.signal,
      duplex: "half",
    } as RequestInit);

    // The SDK detaches SSE on request abort while its runner keeps executing.
    // Tie request abort and consumer cancellation to the exact server run.
    let stopPromise: Promise<boolean> | undefined;
    const stop = () => {
      if (!runIdentity) return Promise.resolve(false);
      stopPromise ??= runtime.runner.stop(runIdentity).then((stopped) => stopped !== false).catch(() => false);
      return stopPromise;
    };
    const onAbort = () => { void stop(); };
    if (runIdentity) request.signal.addEventListener("abort", onAbort, { once: true });
    const detach = () => request.signal.removeEventListener("abort", onAbort);
    try {
      const response = await sdkHandler(replayedRequest);
      if (runIdentity && request.signal.aborted) {
        // Abort may have arrived before the SDK registered the agent in the runner.
        if (!(await stop())) { stopPromise = undefined; await stop(); }
      }
      if (response.status >= 400) {
        detach();
        return chatFailureResponse(response.status);
      }
      if (runIdentity && response.body) {
        const reader = response.body.getReader();
        return new Response(new ReadableStream<Uint8Array>({
          async pull(controller) {
            try {
              const { done, value } = await reader.read();
              if (done) { detach(); controller.close(); } else controller.enqueue(value);
            } catch { detach(); await stop(); controller.error(new Error("Chưa kết nối")); }
          },
          async cancel() {
            detach(); await stop();
            // The pinned SDK can leave readable cancellation waiting on its
            // detached SSE writer. Execution is stopped explicitly above; start
            // stream cancellation without making the consumer wait on that writer.
            void reader.cancel().catch(() => {});
          },
        }), { status: response.status, headers: response.headers });
      }
      detach();
      return response;
    } catch {
      detach(); await stop();
      emitChatDiagnostic(diagnostics, {
        code: "provider_failed",
        traceId: "request",
        phase: "request",
      });
      return chatFailureResponse(500);
    }
  };
}
