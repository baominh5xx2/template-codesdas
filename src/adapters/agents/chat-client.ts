import type { useAgent, useCopilotKit } from "@copilotkit/react-core/v2";
import type { AgentSubscriber, Message } from "@ag-ui/client";
import type { ChatClientPort, ChatRunRequest, ChatRunSink } from "@/ui/chat/controller";
import type { JsonValue } from "@/contracts/common";
import { settleToolCalls, type BusinessToolDescriptor, type BusinessToolStatus, type BusinessToolStatusEvent, type ChatTranscriptMessage, type ChatToolCall } from "@/contracts/chat-tools";

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

function projectedCallStatus(old: ChatToolCall | undefined, event: BusinessToolStatusEvent | undefined): BusinessToolStatus {
  if (old && (old.status === "completed" || old.status === "failed" || old.status === "interrupted")) return old.status;
  if (event?.status === "failed" || event?.status === "interrupted") return event.status;
  if (event?.status === "running") return "running";
  // A completed status alone is metadata; a matching result establishes success.
  return old?.status ?? "pending";
}

function readDescriptor(value: Record<string, unknown>): BusinessToolDescriptor | undefined {
  if (typeof value.toolName !== "string" || typeof value.exposedName !== "string" || typeof value.toolVersion !== "string") return;
  if (!/^business__[a-z][a-z0-9_]*$/.test(value.exposedName) || value.exposedName !== `business__${value.toolName}` || !/^\d+\.\d+\.\d+$/.test(value.toolVersion)) return;
  return { exposedName: value.exposedName, toolName: value.toolName, toolVersion: value.toolVersion };
}

function readToolStatus(value: Record<string, unknown>, request: ChatRunRequest, descriptors: ReadonlyMap<string, BusinessToolDescriptor>): BusinessToolStatusEvent | undefined {
  if (value.threadId !== request.threadId || value.runId !== request.runId || typeof value.toolCallId !== "string" || typeof value.exposedName !== "string" || !descriptors.has(value.exposedName)) return;
  if (value.status !== "pending" && value.status !== "running" && value.status !== "completed" && value.status !== "failed" && value.status !== "interrupted") return;
  return {
    threadId: value.threadId, runId: value.runId, toolCallId: value.toolCallId,
    exposedName: value.exposedName, status: value.status,
    ...(value.errorCode === "tool_failed" || value.errorCode === "cancelled" ? { errorCode: value.errorCode } : {}),
  };
}

function acceptToolStatus(previous: BusinessToolStatusEvent | undefined, next: BusinessToolStatusEvent): boolean {
  if (!previous || previous.status === "pending") return true;
  return previous.status === "running" && next.status !== "pending";
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
        const candidate = statuses.get(tool.id);
        const status = candidate?.exposedName === tool.function.name
          && candidate.runId === (old?.runId ?? scope.runId)
          && candidate.threadId === (old?.threadId ?? scope.threadId) ? candidate : undefined;
        const input = jsonData(tool.function.arguments);
        const call: ChatToolCall = {
          ...descriptor, id: tool.id, type: "function", function: { ...tool.function },
          threadId: old?.threadId ?? scope.threadId, runId: old?.runId ?? scope.runId,
          status: projectedCallStatus(old, status),
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
        onMessagesChanged: (p) => emitMessages(p.messages),
        onTextMessageContentEvent: (p) => emitMessages(p.messages),
        onTextMessageEndEvent: (p) => emitMessages(p.messages),
        onEvent: (p) => {
          if (terminalEmitted || userAborted) return;
          if (p.event.type === "CUSTOM") {
            const value = p.event.value && typeof p.event.value === "object" ? p.event.value as Record<string, unknown> : {};
            if (p.event.name === "business_tool_descriptor") {
              const descriptor = readDescriptor(value);
              if (descriptor) descriptors.set(descriptor.exposedName, descriptor);
            }
            if (p.event.name === "business_tool_status") {
              const next = readToolStatus(value, request, descriptors);
              if (next && acceptToolStatus(statuses.get(next.toolCallId), next)) statuses.set(next.toolCallId, next);
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
  const runningClients = new Set<ChatClientPort>();
  const port: ChatClientPort = {
    async run(request, sink) {
      if (!activeClient) throw new Error("Chat client is not attached");
      const client = activeClient;
      runningClients.add(client);
      try { await client.run(request, sink); }
      finally { runningClients.delete(client); }
    },
    stop() { activeClient?.stop(); }, reset(threadId) { activeClient?.reset(threadId); },
  };
  return { port, attach(client) {
    activeClient = client;
    return () => {
      if (runningClients.has(client)) {
        try { client.stop(); } catch { /* keep the pending run's settlement fence */ }
      }
      if (activeClient === client) activeClient = null;
    };
  } };
}
