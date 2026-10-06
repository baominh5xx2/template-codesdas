import type { useAgent, useCopilotKit } from "@copilotkit/react-core/v2";
import type {
  AgentSubscriber,
  AssistantMessage,
  Message,
  UserMessage,
} from "@ag-ui/client";
import type {
  ChatClientPort,
  ChatRunRequest,
  ChatRunSink,
  ChatTextMessage,
} from "@/ui/chat/controller";

export type CopilotChatBindings = {
  agent: ReturnType<typeof useAgent>["agent"];
  copilotkit: ReturnType<typeof useCopilotKit>["copilotkit"];
};

export type ChatClientBinding = {
  port: ChatClientPort;
  attach(client: ChatClientPort): () => void;
};

function projectTextMessage(msg: Message): ChatTextMessage | null {
  if (msg.role === "user" || msg.role === "assistant") {
    let content = "";
    if (typeof msg.content === "string") {
      content = msg.content;
    } else if (Array.isArray(msg.content)) {
      content = msg.content
        .filter(
          (part) =>
            part.type === "text" &&
            "text" in part &&
            typeof (part as { text: unknown }).text === "string"
        )
        .map((part) => (part as { text: string }).text)
        .join("");
    }
    return {
      id: msg.id,
      role: msg.role,
      content,
    };
  }
  return null;
}

function projectTextMessages(msgs: readonly Message[]): ChatTextMessage[] {
  const result: ChatTextMessage[] = [];
  for (const msg of msgs) {
    const projected = projectTextMessage(msg);
    if (projected) {
      result.push(projected);
    }
  }
  return result;
}

export function createCopilotChatClient(
  bindings: CopilotChatBindings
): ChatClientPort {
  let userAborted = false;

  return {
    async run(request: ChatRunRequest, sink: ChatRunSink): Promise<void> {
      userAborted = false;
      bindings.agent.threadId = request.threadId;

      const aguiMessages: Message[] = request.messages.map((m) => {
        if (m.role === "user") {
          const userMsg: UserMessage = {
            id: m.id,
            role: "user",
            content: m.content,
          };
          return userMsg;
        }
        const assistantMsg: AssistantMessage = {
          id: m.id,
          role: "assistant",
          content: m.content,
        };
        return assistantMsg;
      });

      // Synchronously set full prefix before starting run; never call addMessage second time
      bindings.agent.setMessages(aguiMessages);

      let terminalEmitted = false;

      const emitMessages = (msgs: readonly Message[]): void => {
        if (!terminalEmitted) {
          sink.messages(projectTextMessages(msgs));
        }
      };

      const subscriber: AgentSubscriber = {
        onMessagesChanged: (params) => {
          emitMessages(params.messages);
        },
        onRunStartedEvent: () => {
          if (!terminalEmitted) {
            sink.started();
          }
        },
        onTextMessageContentEvent: (params) => {
          emitMessages(params.messages);
        },
        onTextMessageEndEvent: (params) => {
          emitMessages(params.messages);
        },
        onEvent: (params) => {
          emitMessages(params.messages);
        },
        onRunFinishedEvent: (params) => {
          if (terminalEmitted) return;
          terminalEmitted = true;
          if (params.outcome === "success") {
            sink.messages(projectTextMessages(params.messages));
            sink.terminal("completed");
          } else if (
            params.outcome === "interrupt" ||
            params.outcome === "cancelled"
          ) {
            sink.messages(projectTextMessages(params.messages));
            sink.terminal("interrupted");
          } else {
            sink.terminal("failed");
          }
        },
        onRunFailed: () => {
          if (terminalEmitted) return;
          terminalEmitted = true;
          sink.terminal("failed");
        },
        onRunErrorEvent: () => {
          if (terminalEmitted) return;
          terminalEmitted = true;
          sink.terminal("failed");
        },
      };

      const subscription = bindings.agent.subscribe(subscriber);

      try {
        await bindings.copilotkit.runAgent({
          agent: bindings.agent,
          runId: request.runId,
        });
        if (!terminalEmitted) {
          terminalEmitted = true;
          emitMessages(bindings.agent.messages);
          sink.terminal(userAborted ? "interrupted" : "completed");
        }
      } catch (error) {
        if (!terminalEmitted) {
          terminalEmitted = true;
          const isAbort =
            userAborted ||
            (error instanceof Error && error.name === "AbortError");
          sink.terminal(isAbort ? "interrupted" : "failed");
        }
      } finally {
        subscription.unsubscribe();
      }
    },

    stop(): void {
      userAborted = true;
      bindings.copilotkit.stopAgent({ agent: bindings.agent });
    },

    reset(threadId: string): void {
      bindings.agent.threadId = threadId;
      bindings.agent.setMessages([]);
    },
  };
}

export function createChatClientBinding(): ChatClientBinding {
  let activeClient: ChatClientPort | null = null;
  const runningClients = new Set<ChatClientPort>();

  const port: ChatClientPort = {
    async run(request: ChatRunRequest, sink: ChatRunSink): Promise<void> {
      if (!activeClient) {
        throw new Error("Chat client is not attached");
      }
      const client = activeClient;
      runningClients.add(client);
      try { await client.run(request, sink); }
      finally { runningClients.delete(client); }
    },
    stop(): void {
      activeClient?.stop();
    },
    reset(threadId: string): void {
      activeClient?.reset(threadId);
    },
  };

  return {
    port,
    attach(client: ChatClientPort): () => void {
      activeClient = client;
      return () => {
        // Cancel this attachment's run before removing it. The original run
        // promise remains the controller's pending fence until SDK teardown settles.
        if (runningClients.has(client)) {
          try { client.stop(); } catch { /* retain the pending run's settlement fence */ }
        }
        if (activeClient === client) {
          activeClient = null;
        }
      };
    },
  };
}
