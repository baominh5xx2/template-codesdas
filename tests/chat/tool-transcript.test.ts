import { describe, expect, it } from "vitest";
import type { Message } from "@ag-ui/client";
import { projectProtocolTranscript, toProtocolMessages } from "@/adapters/agents/chat-client";
import { replayableTranscript, trimTranscript, type ChatTranscriptMessage } from "@/contracts/chat-tools";
import { createChatController } from "@/ui/chat/controller";
import { createControlledChatPort } from "../helpers/chat-client";

const input = { currency: "VND", budgetMinor: 500, items: [{ label: "A", amountMinor: 300 }] };
const output = { currency: "VND", totalMinor: 300, remainingMinor: 200, overBudget: false, itemCount: 1 };
const protocol: Message[] = [
  { id: "u", role: "user", content: "Calculate" },
  { id: "a", role: "assistant", toolCalls: [{ id: "call", type: "function", function: { name: "business__calculate_budget", arguments: JSON.stringify(input) } }] },
  { id: "result", role: "tool", toolCallId: "call", content: JSON.stringify(output) },
  { id: "text", role: "assistant", content: "Remaining 200" },
];
const descriptors = new Map([["business__calculate_budget", { exposedName: "business__calculate_budget", toolName: "calculate_budget", toolVersion: "1.0.0" }]]);
const scope = { threadId: "thread", runId: "run" };

describe("business protocol transcript", () => {
  it("preserves real protocol pair identity, validated data, version and scope without fake text", () => {
    const transcript = projectProtocolTranscript(protocol, scope, [], descriptors);
    const assistant = transcript.find((m) => m.id === "a");
    expect(assistant?.role === "assistant" && assistant.toolCalls?.[0]).toMatchObject({
      id: "call", toolName: "calculate_budget", toolVersion: "1.0.0", threadId: "thread", runId: "run", input, status: "completed",
    });
    const result = transcript.find((m) => m.role === "tool");
    expect(result).toMatchObject({ id: "result", toolCallId: "call", output, status: "completed" });
    expect(assistant?.content).toBe("");
    expect(toProtocolMessages(replayableTranscript(transcript))).toEqual(protocol.map((m) => m.id === "a" ? { ...m, content: "" } : m));
  });

  it("does not replay orphan, invalid, error or synthetic stopped results", () => {
    for (const content of [JSON.stringify({ status: "stopped", reason: "stop_requested" }), 'not json', 'secret raw error']) {
      const transcript = projectProtocolTranscript([protocol[0], protocol[1], { id: "result", role: "tool", toolCallId: "call", content }], scope, [], descriptors);
      const context = replayableTranscript(transcript);
      expect(context.some((m) => m.role === "tool")).toBe(false);
      expect(context.some((m) => m.role === "assistant" && m.toolCalls?.length)).toBe(false);
      expect(JSON.stringify(transcript)).not.toContain("secret raw error");
    }
    expect(replayableTranscript(projectProtocolTranscript(protocol.slice(0, 2), scope, [], descriptors))).toEqual([protocol[0]]);
  });

  it("trims call/result groups atomically when a boundary falls inside the pair", () => {
    const transcript = projectProtocolTranscript(protocol, scope, [], descriptors);
    const trimmed = trimTranscript(transcript, 2);
    expect(trimmed.map((m) => m.id)).toEqual(["text"]);
    expect(trimTranscript(transcript, 3).map((m) => m.id)).toEqual(["a", "result", "text"]);
  });

  it("retains previous-run metadata when SDK emits the full prefix again", () => {
    const old = projectProtocolTranscript(protocol, scope, [], descriptors);
    const next = projectProtocolTranscript(protocol, { ...scope, runId: "new-run" }, old, descriptors);
    const assistant = next.find((m) => m.id === "a") as Extract<ChatTranscriptMessage, { role: "assistant" }>;
    expect(assistant.toolCalls?.[0].runId).toBe("run");
  });

  it("keeps successful pairs for the next turn and excludes tool JSON from text bubbles", async () => {
    const h = createControlledChatPort(); let id = 0;
    const c = createChatController({ port: h.port, uuid: () => `id-${++id}`, available: true });
    c.setDraft("Calculate"); const first = c.send(); h.emitStarted();
    const pair = projectProtocolTranscript([{ ...protocol[0], id: h.requests[0].messages[0].id }, ...protocol.slice(1)], h.requests[0], [], descriptors);
    h.emitMessages(pair); h.finish(); await first;
    expect(c.getSnapshot().transcript).toEqual(pair);
    expect(c.getSnapshot().messages.map((m) => m.id)).toEqual([h.requests[0].messages[0].id, "text"]);
    c.setDraft("Explain remaining"); const second = c.send();
    expect(h.requests[1].messages.slice(0, -1)).toEqual(pair);
    h.finish(); await second;
  });

  it("Stop freezes the transcript immediately and Retry drops stale calls with one original user", async () => {
    const h = createControlledChatPort(); let id = 0;
    const c = createChatController({ port: h.port, uuid: () => `id-${++id}`, available: true });
    c.setDraft("Calculate"); const first = c.send(); h.emitStarted();
    const pending = projectProtocolTranscript([{ ...protocol[0], id: h.requests[0].messages[0].id }, protocol[1]], h.requests[0], [], descriptors);
    h.emitMessages(pending);
    const stopping = c.stop();
    h.emitMessages(projectProtocolTranscript(protocol, h.requests[0], [], descriptors));
    h.finish("completed"); await stopping; await first;
    expect(c.getSnapshot().status).toBe("interrupted");
    expect(c.getSnapshot().transcript.some((m) => m.role === "tool")).toBe(false);
    const call = c.getSnapshot().transcript.find((m) => m.role === "assistant");
    expect(call?.role === "assistant" && call.toolCalls?.[0].status).toBe("interrupted");
    const retry = c.retry();
    expect(h.requests[1].messages).toEqual(h.requests[0].messages);
    expect(h.requests[1].runId).not.toBe(h.requests[0].runId);
    expect(c.getSnapshot().transcript.filter((m) => m.role === "user")).toHaveLength(1);
    h.finish(); await retry;
  });

  it("controller context trimming drops the whole pair at a size boundary", async () => {
    const h = createControlledChatPort(); let id = 0;
    const c = createChatController({ port: h.port, uuid: () => `id-${++id}`, available: true, maxContextMessages: 2 });
    c.setDraft("Calculate"); const first = c.send(); h.emitStarted();
    h.emitMessages(projectProtocolTranscript(protocol, h.requests[0], [], descriptors));
    h.finish(); await first;
    c.setDraft("Next"); const next = c.send();
    expect(h.requests[1].messages.map((m) => m.id)).toEqual(["text", h.requests[1].messages.at(-1)?.id]);
    h.finish(); await next;
  });
});

