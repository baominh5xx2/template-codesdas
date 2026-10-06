import "server-only";
import { createRequire } from "node:module";
import { createCopilotRuntimeHandler } from "@copilotkit/runtime/v2";
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

// Resolve from the installed runtime's dependency tree. Next/Turbopack does
// not preserve import.meta.resolve in bundled route handlers.
const packageRequire = createRequire(`${process.cwd()}/package.json`);
const runtimeRequire = createRequire(packageRequire.resolve("@copilotkit/runtime/v2"));
const { RunAgentInputSchema } = runtimeRequire("@ag-ui/core/schemas");

export function createChatRequestHandler(
  config: ChatConfigResult,
  diagnostics: ChatDiagnosticSink
): (request: Request) => Promise<Response> {
  if (!config.available) {
    return async () => chatFailureResponse(503);
  }

  const model = createChatModel(config.config);
  const runtime = createChatRuntime({
    model,
    diagnostics,
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
      if (!originHeader || originHeader !== url.origin) {
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

      // Strip client tools and forwarded model/config overrides in C01; preserve thread/run/message IDs
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

    try {
      const response = await sdkHandler(replayedRequest);
      if (response.status >= 400) {
        return chatFailureResponse(response.status);
      }
      return response;
    } catch {
      emitChatDiagnostic(diagnostics, {
        code: "provider_failed",
        traceId: "request",
        phase: "request",
      });
      return chatFailureResponse(500);
    }
  };
}
