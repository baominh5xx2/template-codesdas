import type { JsonValue, Scope } from "./common";

export type ChatTextMessage = { id: string; role: "user" | "assistant"; content: string };
export type BusinessToolStatus = "pending" | "running" | "completed" | "failed" | "interrupted";
export type BusinessToolDescriptor = { exposedName: string; toolName: string; toolVersion: string };
export type BusinessToolStatusEvent = {
  threadId: string; runId: string; toolCallId: string; exposedName: string;
  status: BusinessToolStatus; errorCode?: "tool_failed" | "cancelled";
};
export type ChatToolCall = BusinessToolDescriptor & {
  id: string; type: "function"; function: { name: string; arguments: string };
  threadId: string; runId: string; status: BusinessToolStatus;
  input?: JsonValue; errorCode?: "tool_failed" | "cancelled";
};
export type ChatTranscriptMessage =
  | { id: string; role: "user"; content: string }
  | { id: string; role: "assistant"; content: string; toolCalls?: ChatToolCall[] }
  | { id: string; role: "tool"; content: string; toolCallId: string; threadId: string; runId: string; status: "completed"; output: JsonValue };

/** C02 repository handoff only. This contract introduces no durable storage. */
export type PersistedToolCallRecord = {
  scope: Scope; threadId: string; runId: string; toolCallId: string;
  connectorId: "business"; toolName: string; toolVersion: string; resultSchemaVersion: string;
  input: JsonValue; startedAt: string; finishedAt: string | null;
} & (
  | { status: "completed"; output: JsonValue; errorCode?: never }
  | { status: "pending" | "running" | "interrupted"; output?: never; errorCode?: "cancelled" }
  | { status: "failed"; output?: never; errorCode: "tool_failed" }
);

export function transcriptText(messages: readonly ChatTranscriptMessage[]): ChatTextMessage[] {
  return messages.flatMap((m) => m.role !== "tool" && m.content ? [{ id: m.id, role: m.role, content: m.content }] : []);
}

/** Historical tool messages are conversational data, never business authority. */
export function replayableTranscript(messages: readonly ChatTranscriptMessage[]): ChatTranscriptMessage[] {
  const calls = new Map<string, ChatToolCall>();
  for (const message of messages) if (message.role === "assistant") {
    for (const call of message.toolCalls ?? []) if (call.status === "completed" && call.input !== undefined) calls.set(call.id, call);
  }
  const complete = new Set(messages.flatMap((m) => m.role === "tool" && calls.has(m.toolCallId) && calls.get(m.toolCallId)?.runId === m.runId && calls.get(m.toolCallId)?.threadId === m.threadId ? [m.toolCallId] : []));
  return messages.flatMap((m): ChatTranscriptMessage[] => {
    if (m.role === "tool") return complete.has(m.toolCallId) ? [m] : [];
    if (m.role === "user") return [m];
    const toolCalls = m.toolCalls?.filter((call) => complete.has(call.id));
    if (toolCalls?.length) return [{ ...m, toolCalls }];
    return m.content ? [{ id: m.id, role: "assistant", content: m.content }] : [];
  });
}

/** A cut through an assistant's tool-call group drops the whole group. */
export function trimTranscript(messages: readonly ChatTranscriptMessage[], maxMessages: number): ChatTranscriptMessage[] {
  const context = replayableTranscript(messages);
  let start = Math.max(0, context.length - Math.max(0, maxMessages));
  const positions = new Map<string, number>();
  context.forEach((m, index) => { if (m.role === "tool") positions.set(m.toolCallId, index); });
  for (let index = 0; index < start; index++) {
    const m = context[index];
    if (m.role === "assistant") for (const call of m.toolCalls ?? []) start = Math.max(start, (positions.get(call.id) ?? -1) + 1);
  }
  return context.slice(start);
}

export function settleToolCalls(messages: readonly ChatTranscriptMessage[], status: "failed" | "interrupted"): ChatTranscriptMessage[] {
  return messages.map((m) => m.role === "assistant" && m.toolCalls ? {
    ...m, toolCalls: m.toolCalls.map((call) => call.status === "running" || call.status === "pending" ? { ...call, status, errorCode: status === "failed" ? "tool_failed" : "cancelled" } : call),
  } : m);
}
