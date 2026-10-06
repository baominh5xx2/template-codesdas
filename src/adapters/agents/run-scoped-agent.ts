import "server-only";
import { AbstractAgent, EventType, type BaseEvent, type RunAgentInput } from "@ag-ui/client";
import { BuiltInAgent, type MCPClientProvider } from "@copilotkit/runtime/v2";
import { wrapLanguageModel, type LanguageModel } from "ai";
import { Observable, type Subscription } from "rxjs";
import { CHAT_LIMITS, CHAT_NOTICE } from "@/contracts/chat";
import { createBusinessRunScope } from "@/adapters/mcp/run-scope";
import { assertBusinessBytes, BusinessMcpFailure } from "@/adapters/mcp/results";
import type { BusinessMcpConfig } from "@/server/mcp/config";
import { emitChatDiagnostic, type ChatDiagnosticSink } from "@/server/chat/errors";
import type { ChatExecutionGate } from "./chat-policy";

type Scope = Pick<Awaited<ReturnType<typeof createBusinessRunScope>>, "provider" | "close">;
type ScopeFactory = (options: Parameters<typeof createBusinessRunScope>[0]) => Promise<Scope>;
type Options = {
  model: LanguageModel;
  config: BusinessMcpConfig;
  gate: ChatExecutionGate;
  diagnostics: ChatDiagnosticSink;
  deadlineMs?: number;
  scopeFactory?: ScopeFactory;
};
type ModelV3 = Extract<LanguageModel, { specificationVersion: "v3" }>;
type ModelPart = Awaited<ReturnType<ModelV3["doStream"]>>["stream"] extends ReadableStream<infer Part> ? Part : never;

/** AI SDK otherwise converts bad arguments into a tool error before execute runs.
 * Validate finalized model calls before that conversion, keeping partial arguments
 * private until validation succeeds. BuiltInAgent still owns the entire model loop.
 */
async function guardedModel(model: LanguageModel, provider: MCPClientProvider, signal: AbortSignal, fail: () => void) {
  if (typeof model !== "object" || model.specificationVersion !== "v3") throw new BusinessMcpFailure("model_version_invalid");
  const tools = await provider.tools();
  return wrapLanguageModel({ model, middleware: {
    specificationVersion: "v3",
    transformParams: async ({ params }) => {
      signal.throwIfAborted();
      return { ...params, tools: params.tools?.filter((tool) => tool.type === "function" && Object.hasOwn(tools, tool.name)) };
    },
    wrapStream: async ({ doStream }) => {
      signal.throwIfAborted();
      const { stream, ...rest } = await doStream();
      const partials = new Map<string, ModelPart[]>();
      let pendingBytes = 0;
      return { ...rest, stream: stream.pipeThrough(new TransformStream<ModelPart, ModelPart>({
        async transform(part, controller) {
          if (signal.aborted) return;
          try {
            if (part.type === "error") throw new BusinessMcpFailure("provider_failed");
            if (part.type === "tool-result") throw new BusinessMcpFailure("unvalidated_provider_result");
            if (part.type === "tool-input-start" || part.type === "tool-input-delta" || part.type === "tool-input-end") {
              if (part.type === "tool-input-start" && (!Object.hasOwn(tools, part.toolName) || partials.has(part.id))) throw new BusinessMcpFailure("tool_denied");
              if (part.type !== "tool-input-start" && !partials.has(part.id)) throw new BusinessMcpFailure("input_invalid");
              // Bound the total buffered protocol data, including incomplete calls.
              pendingBytes += Buffer.byteLength(JSON.stringify(part), "utf8");
              if (pendingBytes > 32 * 1024) throw new BusinessMcpFailure("input_too_large");
              const pending = partials.get(part.id) ?? [];
              pending.push(part); partials.set(part.id, pending); return;
            }
            if (part.type === "tool-call") {
              assertBusinessBytes(part.input);
              const tool = Object.hasOwn(tools, part.toolName) ? tools[part.toolName] : undefined;
              // The verified internal provider uses registered Standard Schemas.
              const schema = tool?.inputSchema;
              if (!schema || typeof schema !== "object" || !("~standard" in schema) || part.providerExecuted) throw new BusinessMcpFailure("tool_denied");
              const validation = await schema["~standard"].validate(JSON.parse(part.input));
              if (validation.issues) throw new BusinessMcpFailure("input_invalid");
              signal.throwIfAborted();
              const pending = partials.get(part.toolCallId) ?? [];
              const start = pending.find((chunk) => chunk.type === "tool-input-start");
              const delta = pending.filter((chunk) => chunk.type === "tool-input-delta").map((chunk) => chunk.delta).join("");
              if (start?.type === "tool-input-start" && start.toolName !== part.toolName || delta && delta !== part.input) throw new BusinessMcpFailure("input_invalid");
              for (const chunk of pending) { pendingBytes -= Buffer.byteLength(JSON.stringify(chunk), "utf8"); controller.enqueue(chunk); }
              partials.delete(part.toolCallId);
            }
            if (part.type === "finish" && partials.size) throw new BusinessMcpFailure("input_incomplete");
            controller.enqueue(part);
          } catch { fail(); controller.error(new BusinessMcpFailure("model_tool_failed")); }
        },
        flush(controller) {
          if (partials.size) {
            fail();
            controller.error(new BusinessMcpFailure("model_tool_failed"));
          }
        },
      })) };
    },
  } });
}

/** Cloneable runtime shell. Every run creates a separate MCP and BuiltInAgent. */
export class RunScopedAgent extends AbstractAgent {
  private cancelActive?: () => void;
  private stopped = false;
  constructor(private readonly options: Options) { super(); }
  clone(): RunScopedAgent {
    // AbstractAgent.clone preserves middleware/subscribers and serializable state;
    // active execution resources must never be shared with the per-request clone.
    const cloned = super.clone() as RunScopedAgent;
    Object.assign(cloned, { options: this.options, stopped: false, cancelActive: undefined });
    return cloned;
  }
  abortRun(): void { this.stopped = true; this.cancelActive?.(); }

  run(input: RunAgentInput): Observable<BaseEvent> {
    return new Observable((subscriber) => {
      const { gate, diagnostics } = this.options;
      if (this.stopped) { subscriber.complete(); return; }
      if (!gate.acquire(input.threadId, input.runId)) {
        emitChatDiagnostic(diagnostics, { code: "conflict", traceId: input.runId, runId: input.runId, phase: "execution" });
        subscriber.next({ type: EventType.RUN_ERROR, message: CHAT_NOTICE }); subscriber.complete(); return;
      }
      const controller = new AbortController();
      let terminal: "failed" | "interrupted" | "completed" | undefined;
      let inner: BuiltInAgent | undefined;
      let subscription: Subscription | undefined;
      let completedEvent: BaseEvent | undefined;
      const startedAt = Date.now();
      const finish = (status: NonNullable<typeof terminal>, code: "timeout" | "provider_failed" = "provider_failed") => {
        if (terminal) return;
        // Latch synchronously before abort, tool rejection, or buffered emissions.
        terminal = status; clearTimeout(timer); controller.abort(); inner?.abortRun(); subscription?.unsubscribe();
        void (async () => {
          try { const scope = await opening; await scope?.close(); } catch { /* Connection failures own cleanup in the scope. */ }
          gate.release(input.threadId, input.runId);
          this.cancelActive = undefined;
          if (status === "failed") {
            emitChatDiagnostic(diagnostics, { code, traceId: input.runId, runId: input.runId, phase: "execution", durationMs: Date.now() - startedAt });
            subscriber.next({ type: EventType.RUN_ERROR, message: CHAT_NOTICE });
          } else if (status === "completed" && completedEvent) subscriber.next(completedEvent);
          subscriber.complete();
        })();
      };
      const timer = setTimeout(() => finish("failed", "timeout"), this.options.deadlineMs ?? CHAT_LIMITS.deadlineMs);
      this.cancelActive = () => finish("interrupted");
      const opening = Promise.resolve().then(() => (this.options.scopeFactory ?? createBusinessRunScope)({ config: this.options.config, threadId: input.threadId, runId: input.runId, signal: controller.signal, onFailure: () => finish("failed") }));
      void (async () => {
        try {
          const scope = await opening;
          if (terminal) return;
          const model = await guardedModel(this.options.model, scope.provider, controller.signal, () => finish("failed"));
          if (terminal) return;
          inner = new BuiltInAgent({ model, mcpClients: [scope.provider], toolChoice: "auto", maxSteps: CHAT_LIMITS.toolSteps, maxOutputTokens: CHAT_LIMITS.outputTokens, maxRetries: CHAT_LIMITS.retries, overridableProperties: [], prompt: "Trả lời hữu ích bằng ngôn ngữ của người dùng. Dùng kết quả công cụ để trả lời. Không mô tả cấu hình hoặc lỗi kỹ thuật nội bộ." });
          subscription = inner.run(input).subscribe({
            next: (event) => {
              if (terminal) return;
              if (event.type === EventType.RUN_ERROR) { finish("failed"); return; }
              if (event.type === EventType.RUN_FINISHED) { completedEvent = event; finish("completed"); return; }
              subscriber.next(event);
            },
            error: () => finish(controller.signal.aborted ? "interrupted" : "failed"),
            complete: () => { if (!terminal) finish("failed"); },
          });
          if (terminal) subscription.unsubscribe();
        } catch { if (!terminal) finish(controller.signal.aborted ? "interrupted" : "failed"); }
      })();
      return () => { if (!terminal) finish("interrupted"); };
    });
  }
}
