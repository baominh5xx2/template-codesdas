import type {
  ChatClientPort,
  ChatRunRequest,
  ChatRunSink,
  ChatTextMessage,
} from "@/ui/chat/controller";

export interface ControlledChatPort {
  port: ChatClientPort;
  requests: ChatRunRequest[];
  readonly stopCount: number;
  resetThreads: string[];
  emitStarted(): void;
  emitMessages(messages: ChatTextMessage[]): void;
  finish(status?: "completed" | "failed" | "interrupted"): void;
  reject(error?: unknown): void;
}

export function createControlledChatPort(): ControlledChatPort {
  const requests: ChatRunRequest[] = [];
  const resetThreads: string[] = [];
  let stopCount = 0;
  let currentSink: ChatRunSink | null = null;
  let currentResolve: (() => void) | null = null;
  let currentReject: ((err: unknown) => void) | null = null;

  const port: ChatClientPort = {
    run(request: ChatRunRequest, sink: ChatRunSink): Promise<void> {
      requests.push(request);
      currentSink = sink;
      return new Promise<void>((resolve, reject) => {
        currentResolve = resolve;
        currentReject = reject;
      });
    },
    stop(): void {
      stopCount++;
    },
    reset(threadId: string): void {
      resetThreads.push(threadId);
    },
  };

  return {
    port,
    requests,
    get stopCount() {
      return stopCount;
    },
    resetThreads,
    emitStarted() {
      currentSink?.started();
    },
    emitMessages(messages: ChatTextMessage[]) {
      currentSink?.messages(messages);
    },
    finish(status: "completed" | "failed" | "interrupted" = "completed") {
      const sink = currentSink;
      const resolve = currentResolve;
      currentSink = null;
      currentResolve = null;
      currentReject = null;
      sink?.terminal(status);
      resolve?.();
    },
    reject(error: unknown = new Error("Controlled port execution failed")) {
      const reject = currentReject;
      currentSink = null;
      currentResolve = null;
      currentReject = null;
      reject?.(error);
    },
  };
}
