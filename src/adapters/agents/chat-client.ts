import type { useAgent, useCopilotKit } from "@copilotkit/react-core/v2";
import type { AgentSubscriber, Message } from "@ag-ui/client";
import type { ChatClientPort, ChatRunRequest, ChatRunSink } from "@/ui/chat/controller";
import type { JsonValue } from "@/contracts/common";
import { settleToolCalls, type BusinessToolDescriptor, type BusinessToolStatusEvent, type ChatTranscriptMessage, type ChatToolCall } from "@/contracts/chat-tools";

export type CopilotChatBindings = {
  agent: ReturnType<typeof useAgent>["agent"];
  copilotkit: ReturnType<typeof useCopilotKit>["copilotkit"];
};
export type ChatClientBinding = { port: ChatClientPort; attach(client: ChatClientPort): () => void };

function textContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.flatMap((part) => part?.type === "text" && typeof part.text === "string" ? [part.text] : []).join("");
}
function jsonData(content: string): JsonValue | undefined {
  try {
    if (new TextEncoder().encode(content).byteLength > 32768) return;
    const data = JSON.parse(content);
    if (!data || typeof data !== "object" || Array.isArray(data)) return;
    if (data.status === "stopped" && data.reason === "stop_requested") return;
    return data as JsonValue;
  } catch { return; }
}

/** Protocol data here has already passed the server's business validation boundary.
 * Descriptors come only from that server's catalog; browser records confer no authority.
 */
export function projectProtocolTranscript(
  messages: readonly Message[], scope: { threadId: string; runId: string },
  previous: readonly ChatTranscriptMessage[] = [],
  descriptors: ReadonlyMap<string, BusinessToolDescriptor> = new Map(),
  statuses: ReadonlyMap<string, BusinessToolStatusEvent> = new Map(),
): ChatTranscriptMessage[] {
  const oldCalls = new Map<string, ChatToolCall>();
  for (const m of previous) if (m.role === "assistant") for (const call of m.toolCalls ?? []) oldCalls.set(call.id, call);
  const calls = new Map<string, ChatToolCall>();
  const transcript: ChatTranscriptMessage[] = [];
  for (const m of messages) {
    if (m.role === "user") transcript.push({ id: m.id, role: "user", content: textContent(m.content) });
    else if (m.role === "assistant") {
      const toolCalls: ChatToolCall[] = [];
      for (const tool of m.toolCalls ?? []) {
        const old = oldCalls.get(tool.id);
        const descriptor = old ?? descriptors.get(tool.function.name);
        if (!descriptor || descriptor.exposedName !== tool.function.name) continue;
        const status = statuses.get(tool.id);
        const input = jsonData(tool.function.arguments);
        const call: ChatToolCall = {
          ...descriptor, id: tool.id, type: "function", function: { ...tool.function },
          threadId: old?.threadId ?? scope.threadId, runId: old?.runId ?? scope.runId,
          status: status?.status === "failed" || status?.status === "interrupted" ? status.status : old?.status === "completed" ? "completed" : status?.status === "pending" ? "pending" : "running",
          ...(input !== undefined ? { input } : {}), ...(status?.errorCode ? { errorCode: status.errorCode } : {}),
        };
        calls.set(call.id, call); toolCalls.push(call);
      }
      const content = textContent(m.content);
      if (content || toolCalls.length) transcript.push({ id: m.id, role: "assistant", content, ...(toolCalls.length ? { toolCalls } : {}) });
    } else if (m.role === "tool") {
      const call = calls.get(m.toolCallId);
      const output = jsonData(textContent(m.content));
      if (!call || call.input === undefined || m.error || output === undefined || call.status === "failed" || call.status === "interrupted") continue;
      call.status = "completed";
      transcript.push({ id: m.id, role: "tool", content: JSON.stringify(output), toolCallId: m.toolCallId, threadId: call.threadId, runId: call.runId, status: "completed", output });
    }
  }
  return transcript;
}

export function toProtocolMessages(messages: readonly ChatTranscriptMessage[]): Message[] {
  return messages.map((m): Message => {
    if (m.role === "tool") return { id: m.id, role: "tool", content: m.content, toolCallId: m.toolCallId };
    if (m.role === "user") return { id: m.id, role: "user", content: m.content };
    return { id: m.id, role: "assistant", content: m.content, ...(m.toolCalls?.length ? { toolCalls: m.toolCalls.map((call) => ({ id: call.id, type: call.type, function: call.function })) } : {}) };
  });
}

export function createCopilotChatClient(bindings: CopilotChatBindings): ChatClientPort {
  let userAborted = false;
  return {
    async run(request: ChatRunRequest, sink: ChatRunSink): Promise<void> {
      userAborted = false;
      bindings.agent.threadId = request.threadId;
      bindings.agent.setMessages(toProtocolMessages(request.messages));
      let terminalEmitted = false;
      let projected = request.messages;
      const descriptors = new Map<string, BusinessToolDescriptor>();
      const statuses = new Map<string, BusinessToolStatusEvent>();
      const emitMessages = (messages: readonly Message[]): void => {
        if (terminalEmitted || userAborted) return;
        projected = projectProtocolTranscript(messages, request, projected, descriptors, statuses);
        sink.messages(projected);
      };
      const finish = (status: "completed" | "failed" | "interrupted", messages?: readonly Message[]) => {
        if (terminalEmitted) return;
        if (messages && !userAborted) emitMessages(messages);
        terminalEmitted = true;
        const outcome = userAborted ? "interrupted" : status;
        if (outcome !== "completed") sink.messages(settleToolCalls(projected, outcome));
        sink.terminal(outcome);
      };
      const subscriber: AgentSubscriber = {
        onRunStartedEvent: () => { if (!terminalEmitted && !userAborted) sink.started(); },
        onTextMessageContentEvent: (p) => emitMessages(p.messages),
        onTextMessageEndEvent: (p) => emitMessages(p.messages),
        onEvent: (p) => {
          if (terminalEmitted || userAborted) return;
          if (p.event.type === "CUSTOM") {
            const value = p.event.value && typeof p.event.value === "object" ? p.event.value as Record<string, unknown> : {};
            if (p.event.name === "business_tool_descriptor" && typeof value.toolName === "string" && typeof value.exposedName === "string" && /^business__[a-z][a-z0-9_]*$/.test(value.exposedName) && value.exposedName === `business__${value.toolName}` && typeof value.toolVersion === "string" && /^\d+\.\d+\.\d+$/.test(value.toolVersion)) {
              descriptors.set(value.exposedName, { exposedName: value.exposedName, toolName: value.toolName, toolVersion: value.toolVersion });
            }
            if (p.event.name === "business_tool_status" && value.threadId === request.threadId && value.runId === request.runId && typeof value.toolCallId === "string" && typeof value.exposedName === "string" && descriptors.has(value.exposedName) && (value.status === "pending" || value.status === "running" || value.status === "completed" || value.status === "failed" || value.status === "interrupted")) {
              const old = statuses.get(value.toolCallId);
              if (!old || old.status === "pending" || old.status === "running" && value.status !== "pending") statuses.set(value.toolCallId, { threadId: value.threadId, runId: value.runId, toolCallId: value.toolCallId, exposedName: value.exposedName, status: value.status, ...(value.errorCode === "tool_failed" || value.errorCode === "cancelled" ? { errorCode: value.errorCode } : {}) });
            }
          }
          emitMessages(p.messages);
        },
        onRunFinishedEvent: (p) => finish(p.outcome === "success" ? "completed" : p.outcome === "interrupt" || p.outcome === "cancelled" ? "interrupted" : "failed", p.messages),
        onRunFailed: () => finish("failed"),
        onRunErrorEvent: () => finish("failed"),
      };
      const subscription = bindings.agent.subscribe(subscriber);
      try {
        await bindings.copilotkit.runAgent({ agent: bindings.agent, runId: request.runId });
        finish("completed", bindings.agent.messages);
      } catch (error) {
        finish(userAborted || error instanceof Error && error.name === "AbortError" ? "interrupted" : "failed");
      } finally { subscription.unsubscribe(); }
    },
    stop(): void { userAborted = true; bindings.copilotkit.stopAgent({ agent: bindings.agent }); },
    reset(threadId: string): void { bindings.agent.threadId = threadId; bindings.agent.setMessages([]); },
  };
}

export function createChatClientBinding(): ChatClientBinding {
  let activeClient: ChatClientPort | null = null;
  const port: ChatClientPort = {
    async run(request, sink) { if (!activeClient) throw new Error("Chat client is not attached"); return activeClient.run(request, sink); },
    stop() { activeClient?.stop(); }, reset(threadId) { activeClient?.reset(threadId); },
  };
  return { port, attach(client) { activeClient = client; return () => { if (activeClient === client) activeClient = null; }; } };
}
