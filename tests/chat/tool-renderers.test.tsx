// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ToolStatusView, collectTranscriptTools } from "@/ui/chat/tool-renderers";
import { ToolResultView } from "@/ui/chat/tool-result-view";
import type { ChatToolCall, ChatTranscriptMessage } from "@/contracts/chat-tools";

function call(status: ChatToolCall["status"]): ChatToolCall {
  return { id: "call-1", type: "function", function: { name: "business__calculate_budget", arguments: "PROTOCOL_INPUT" }, exposedName: "business__calculate_budget", toolName: "calculate_budget", toolVersion: "1.0.0", threadId: "thread", runId: "run", status };
}
const output = { currency: "VND", totalMinor: 1200, remainingMinor: -200, overBudget: true, itemCount: 2 };
const result: ChatTranscriptMessage = { id: "result", role: "tool", toolCallId: "call-1", threadId: "thread", runId: "run", status: "completed", output, content: "RAW_PROTOCOL_RESULT" };
const assistant = (status: ChatToolCall["status"]): ChatTranscriptMessage => ({ id: "assistant", role: "assistant", content: "", toolCalls: [call(status)] });

describe("presentation-only tool results", () => {
  afterEach(cleanup);
  it("progresses from pending to running and completed validated budget output", () => {
    const { rerender } = render(<ToolStatusView call={call("pending")} />);
    expect(screen.getByText("Đang chuẩn bị")).toBeVisible();
    rerender(<ToolStatusView call={call("running")} />);
    expect(screen.getByText("Đang xử lý")).toBeVisible();
    rerender(<ToolStatusView call={call("completed")} output={output} />);
    expect(screen.getByText("Đã tính xong")).toBeVisible();
    expect(screen.getByText("1.200 VND")).toBeVisible();
    expect(screen.getByText("-200 VND")).toBeVisible();
    expect(screen.getByText("Vượt ngân sách")).toBeVisible();
    expect(screen.queryByText("PROTOCOL_INPUT")).not.toBeInTheDocument();
  });
  it("deduplicates call IDs and cannot regress terminal status on reordered records", () => {
    const tools = collectTranscriptTools([assistant("completed"), assistant("pending"), result, result]);
    expect(tools.size).toBe(1);
    expect([...tools.values()][0]).toMatchObject({ call: { status: "completed" }, output });
    const reversed = collectTranscriptTools([assistant("running"), assistant("pending")]);
    expect([...reversed.values()][0].call.status).toBe("running");
  });
  it("accepts output only for a completed pair with matching run and thread", () => {
    for (const messages of [
      [assistant("interrupted"), result],
      [assistant("completed"), { ...result, runId: "other" }],
      [assistant("completed"), { ...result, threadId: "other" }],
    ]) expect([...collectTranscriptTools(messages).values()][0].output).toBeUndefined();
  });
  it("keeps interrupted state and partial text separate from result success", () => {
    render(<ToolStatusView call={call("interrupted")} output={output} />);
    expect(screen.getByText("Đã dừng")).toBeVisible();
    expect(screen.queryByText("Vượt ngân sách")).not.toBeInTheDocument();
  });
  it("adds no duplicate failure copy or raw protocol content", () => {
    const { container } = render(<ToolStatusView call={{ ...call("failed"), errorCode: "tool_failed" }} output={{ error: "SECRET_HEADER" }} />);
    expect(container).toBeEmptyDOMElement();
  });
  it("bounds generic text preview and escapes HTML", () => {
    const { container } = render(<ToolResultView name="other_tool" version="1.0.0" output={{ text: "<script>secret</script>" + "x".repeat(6000) }} />);
    expect(screen.getByText("Bản xem trước đã rút gọn")).toBeVisible();
    expect(container.querySelector("pre")!.textContent!.length).toBeLessThanOrEqual(1201);
    expect(container.querySelector("script")).toBeNull();
  });
  it("bounds generic preview depth and field count before serialization", () => {
    const fields = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`field${i}`, i]));
    const { rerender } = render(<ToolResultView name="other" version="1" output={fields} />);
    expect(screen.getByText("Bản xem trước đã rút gọn")).toBeVisible();
    expect(screen.queryByText(/field29/)).not.toBeInTheDocument();
    const deep = { a: { a: { a: { a: { a: { a: { a: "DEEP_VALUE" } } } } } } };
    rerender(<ToolResultView name="other" version="1" output={deep} />);
    expect(screen.getByText("Bản xem trước đã rút gọn")).toBeVisible();
    expect(screen.queryByText(/DEEP_VALUE/)).not.toBeInTheDocument();
  });
  it("uses bounded generic preview for newer budget schema versions", () => {
    render(<ToolResultView name="calculate_budget" version="2.0.0" output={{ newField: "validated" }} />);
    expect(screen.getByText(/validated/)).toBeVisible();
    expect(screen.queryByText("Tổng chi")).not.toBeInTheDocument();
  });
});
