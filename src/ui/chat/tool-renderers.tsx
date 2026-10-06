import { Fragment, type ReactElement } from "react";
import type { BusinessToolStatus, ChatToolCall, ChatTranscriptMessage } from "@/contracts/chat-tools";
import type { JsonValue } from "@/contracts/common";
import { WhiteAssistantMessage, WhiteUserMessage } from "./message-views";
import { ToolResultView } from "./tool-result-view";
import { StatusMark, type StatusMarkStatus } from "./status-mark";

const MARK: Record<Exclude<BusinessToolStatus, "failed">, StatusMarkStatus> = { pending: "pending", running: "running", completed: "done", interrupted: "cancelled" };

type TranscriptTool = { call: ChatToolCall; output?: JsonValue };
const isTerminal = (status: BusinessToolStatus) => status === "completed" || status === "failed" || status === "interrupted";
function toolKey(call: { threadId: string; runId: string; id: string }): string {
  return JSON.stringify([call.threadId, call.runId, call.id]);
}

/** The adapter reconciles streaming snapshots. This projection also deduplicates records
 * within a snapshot and preserves terminal states if a record is repeated out of order. */
export function collectTranscriptTools(messages: readonly ChatTranscriptMessage[]): Map<string, TranscriptTool> {
  const tools = new Map<string, TranscriptTool>();
  for (const message of messages) if (message.role === "assistant") {
    for (const call of message.toolCalls ?? []) {
      const key = toolKey(call);
      const previous = tools.get(key)?.call;
      if (!previous || (!isTerminal(previous.status) && !(previous.status === "running" && call.status === "pending"))) tools.set(key, { call });
    }
  }
  for (const message of messages) if (message.role === "tool") {
    const tool = tools.get(toolKey({ ...message, id: message.toolCallId }));
    if (tool?.call.status === "completed" && tool.output === undefined) tool.output = message.output;
  }
  return tools;
}

export function ToolStatusView({ call, output }: TranscriptTool): ReactElement | null {
  // The controller owns the one technical failure notice. No per-tool error copy.
  if (call.status === "failed") return null;
  const label = call.toolName === "calculate_budget" ? "Tính ngân sách" : call.toolName;
  const status = { pending: "Đang chuẩn bị", running: "Đang xử lý", completed: call.toolName === "calculate_budget" ? "Đã tính xong" : "Hoàn tất", interrupted: "Đã dừng" }[call.status];
  return (
    <section className="chat-tool-card" data-tool-call-id={call.id} aria-label={label}>
      <div className="chat-tool-status" role="status"><StatusMark status={MARK[call.status]} label={<strong>{label}</strong>} color="var(--chat-blue)" size={22} fontSize={15} /><span>{status}</span></div>
      {call.status === "completed" && output !== undefined && <ToolResultView name={call.toolName} version={call.toolVersion} output={output} />}
    </section>
  );
}

/** Presentation only: text goes through the existing CopilotKit message views, while
 * protocol call/result records become one inline row and never an assistant bubble. */
export function ToolTranscript({ messages }: { messages: readonly ChatTranscriptMessage[] }): ReactElement {
  const tools = collectTranscriptTools(messages);
  const rendered = new Set<string>();
  return <>{messages.map((message) => {
    if (message.role === "tool") return null;
    if (message.role === "user") return <WhiteUserMessage key={message.id} message={message} />;
    const text = { id: message.id, role: "assistant" as const, content: message.content };
    return <Fragment key={message.id}>
      {message.content && <WhiteAssistantMessage message={text} />}
      {(message.toolCalls ?? []).map((call) => {
        const key = toolKey(call);
        if (rendered.has(key)) return null;
        rendered.add(key);
        return <ToolStatusView key={key} {...tools.get(key)!} />;
      })}
    </Fragment>;
  })}</>;
}
