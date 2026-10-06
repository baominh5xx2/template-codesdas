import "server-only";
import { Observable } from "rxjs";
import { FunctionMiddleware, type Middleware, EventType, type BaseEvent } from "@ag-ui/client";
import { CHAT_NOTICE, CHAT_LIMITS } from "@/contracts/chat";
import { emitChatDiagnostic, type ChatDiagnosticSink } from "@/server/chat/errors";

export type ChatExecutionGate = {
  acquire(threadId: string, runId: string): boolean;
  release(threadId: string, runId: string): void;
};

export function createExecutionGate(): ChatExecutionGate {
  let currentLease: { threadId: string; runId: string } | null = null;

  return {
    acquire(threadId: string, runId: string): boolean {
      if (currentLease !== null) {
        return false;
      }
      currentLease = { threadId, runId };
      return true;
    },
    release(threadId: string, runId: string): void {
      if (
        currentLease !== null &&
        currentLease.threadId === threadId &&
        currentLease.runId === runId
      ) {
        currentLease = null;
      }
    },
  };
}

export function createChatPolicy(options: {
  gate: ChatExecutionGate;
  diagnostics: ChatDiagnosticSink;
  deadlineMs?: number;
}): Middleware {
  return new FunctionMiddleware((input, next) => {
    return new Observable<BaseEvent>((subscriber) => {
      const threadId = input.threadId;
      const runId = input.runId;

      if (!options.gate.acquire(threadId, runId)) {
        emitChatDiagnostic(options.diagnostics, {
          code: "conflict",
          traceId: runId || threadId || "chat",
          runId,
          phase: "execution",
        });
        subscriber.next({
          type: EventType.RUN_ERROR,
          message: CHAT_NOTICE,
        });
        subscriber.complete();
        return;
      }

      let isTerminated = false;
      const startTime = Date.now();
      const deadline = options.deadlineMs ?? CHAT_LIMITS.deadlineMs;

      const timer = setTimeout(() => {
        if (isTerminated) return;
        isTerminated = true;

        try {
          const abortable = next as { abortRun?: () => void };
          if (typeof abortable.abortRun === "function") {
            abortable.abortRun();
          }
        } catch {}

        emitChatDiagnostic(options.diagnostics, {
          code: "timeout",
          traceId: runId || "chat",
          runId,
          phase: "execution",
          durationMs: Date.now() - startTime,
        });

        subscriber.next({
          type: EventType.RUN_ERROR,
          message: CHAT_NOTICE,
        });
        subscriber.complete();
      }, deadline);

      const cleanup = () => {
        clearTimeout(timer);
        isTerminated = true;
        options.gate.release(threadId, runId);
      };

      const subscription = next.run(input).subscribe({
        next: (event: BaseEvent) => {
          if (isTerminated) {
            return;
          }

          if (event.type === EventType.RUN_ERROR) {
            isTerminated = true;
            clearTimeout(timer);

            emitChatDiagnostic(options.diagnostics, {
              code: "provider_failed",
              traceId: runId || "chat",
              runId,
              phase: "execution",
              durationMs: Date.now() - startTime,
            });

            subscriber.next({
              type: EventType.RUN_ERROR,
              message: CHAT_NOTICE,
            });
            subscriber.complete();
            return;
          }

          if (event.type === EventType.RUN_FINISHED) {
            clearTimeout(timer);
          }

          subscriber.next(event);
        },
        error: () => {
          if (isTerminated) return;
          isTerminated = true;
          clearTimeout(timer);

          emitChatDiagnostic(options.diagnostics, {
            code: "provider_failed",
            traceId: runId || "chat",
            runId,
            phase: "execution",
            durationMs: Date.now() - startTime,
          });

          subscriber.next({
            type: EventType.RUN_ERROR,
            message: CHAT_NOTICE,
          });
          subscriber.complete();
        },
        complete: () => {
          if (isTerminated) return;
          clearTimeout(timer);
          subscriber.complete();
        },
      });

      return () => {
        subscription.unsubscribe();
        cleanup();
      };
    });
  });
}
