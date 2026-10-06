// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CopilotKit } from "@copilotkit/react-core/v2";
import { ChatControllerProvider } from "@/ui/chat/controller-context";
import { WhiteAssistantMessage, WhiteUserMessage } from "@/ui/chat/message-views";
import { createControlledChatPort } from "../helpers/chat-client";
import { createChatController } from "@/ui/chat/controller";
import { ToolTranscript } from "@/ui/chat/tool-renderers";
import type { ChatTranscriptMessage } from "@/contracts/chat-tools";
import { WhiteChatView } from "@/ui/chat/white-chat-view";

describe("Message Views and Transcript", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  function setupController() {
    const controlled = createControlledChatPort();
    const controller = createChatController({
      port: controlled.port,
      uuid: () => "test-uuid",
      available: true,
    });
    return { controller, controlled };
  }

  it("renders WhiteAssistantMessage with copy action and masks copy errors via controller.fail", async () => {
    const { controller } = setupController();
    const failSpy = vi.spyOn(controller, "fail");

    const writeText = vi.fn().mockRejectedValue(new Error("RAW_SECRET_ERROR"));
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    render(
      <CopilotKit runtimeUrl="http://localhost:3000/api/copilotkit">
        <ChatControllerProvider controller={controller}>
          <WhiteAssistantMessage
            message={{
              id: "msg-assistant",
              role: "assistant",
              content: "Câu trả lời từ trợ lý",
            }}
          />
        </ChatControllerProvider>
      </CopilotKit>
    );

    const copyBtn = screen.getByRole("button", { name: "Sao chép" });
    expect(copyBtn).toBeInTheDocument();

    fireEvent.click(copyBtn);
    await waitFor(() => {
      expect(failSpy).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByText("RAW_SECRET_ERROR")).not.toBeInTheDocument();
  });

  it("renders WhiteUserMessage with copy action and copies successfully", async () => {
    const { controller } = setupController();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    render(
      <CopilotKit runtimeUrl="http://localhost:3000/api/copilotkit">
        <ChatControllerProvider controller={controller}>
          <WhiteUserMessage
            message={{
              id: "msg-user",
              role: "user",
              content: "Câu hỏi của người dùng",
            }}
          />
        </ChatControllerProvider>
      </CopilotKit>
    );

    const copyBtn = screen.getByRole("button", { name: "Sao chép" });
    fireEvent.click(copyBtn);

    expect(writeText).toHaveBeenCalledWith("Câu hỏi của người dùng");
    await waitFor(() => {
      expect(screen.getByText("Đã sao chép")).toBeInTheDocument();
    });
  });

  it("copies only conversational text while inline tools use validated output, never protocol JSON", () => {
    const { controller } = setupController();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const messages: ChatTranscriptMessage[] = [
      { id: "user", role: "user", content: "Tính ngân sách" },
      { id: "assistant", role: "assistant", content: "Mình đang tính.", toolCalls: [{ id: "call", type: "function", function: { name: "business__calculate_budget", arguments: "RAW_ARGUMENTS" }, exposedName: "business__calculate_budget", toolName: "calculate_budget", toolVersion: "1.0.0", threadId: "thread", runId: "run", status: "completed" }] },
      { id: "result", role: "tool", content: "RAW_PROTOCOL_JSON", toolCallId: "call", threadId: "thread", runId: "run", status: "completed", output: { currency: "USD", totalMinor: 100, remainingMinor: 200, overBudget: false, itemCount: 1 } },
      { id: "answer", role: "assistant", content: "Bạn còn ngân sách." },
    ];
    render(<CopilotKit runtimeUrl="http://localhost:3000/api/copilotkit"><ChatControllerProvider controller={controller}><ToolTranscript messages={messages} /></ChatControllerProvider></CopilotKit>);
    expect(screen.getByText("100 USD")).toBeVisible();
    expect(screen.queryByText("RAW_ARGUMENTS")).not.toBeInTheDocument();
    expect(screen.queryByText("RAW_PROTOCOL_JSON")).not.toBeInTheDocument();
    const buttons = screen.getAllByRole("button", { name: "Sao chép" });
    expect(buttons).toHaveLength(3);
    buttons.forEach((button) => fireEvent.click(button));
    expect(writeText.mock.calls).toEqual([["Tính ngân sách"], ["Mình đang tính."], ["Bạn còn ngân sách."]]);
  });

  it("preserves partial assistant text alongside interrupted calls with no success or technical notice", () => {
    const { controller } = setupController();
    const messages: ChatTranscriptMessage[] = [{ id: "partial", role: "assistant", content: "Đã nhận câu hỏi.", toolCalls: [{ id: "call", type: "function", function: { name: "business__calculate_budget", arguments: "UNVALIDATED_PARTIAL_ARGS" }, exposedName: "business__calculate_budget", toolName: "calculate_budget", toolVersion: "1.0.0", threadId: "thread", runId: "run", status: "interrupted" }] }];
    render(<CopilotKit runtimeUrl="http://localhost:3000/api/copilotkit"><ChatControllerProvider controller={controller}><ToolTranscript messages={messages} /></ChatControllerProvider></CopilotKit>);
    expect(screen.getByText("Đã nhận câu hỏi.")).toBeVisible();
    expect(screen.getByText("Đã dừng")).toBeVisible();
    expect(screen.queryByText("Chưa kết nối")).not.toBeInTheDocument();
    expect(screen.queryByText("UNVALIDATED_PARTIAL_ARGS")).not.toBeInTheDocument();
  });

  it("renders the controller transcript in the real white chat view, including tool-only assistant turns", async () => {
    global.ResizeObserver = class ResizeObserver { observe() {} unobserve() {} disconnect() {} };
    const { controller, controlled } = setupController();
    render(<CopilotKit runtimeUrl="http://localhost:3000/api/copilotkit"><ChatControllerProvider controller={controller}><WhiteChatView /></ChatControllerProvider></CopilotKit>);
    let sent!: Promise<boolean>;
    act(() => { controller.setDraft("Tính giúp mình"); sent = controller.send(); controlled.emitStarted(); });
    expect(screen.getByLabelText("Đang trả lời")).toBeInTheDocument();
    act(() => controlled.emitMessages([
      { id: "user", role: "user", content: "Tính giúp mình" },
      { id: "tool-only", role: "assistant", content: "", toolCalls: [{ id: "call", type: "function", function: { name: "business__calculate_budget", arguments: "RAW_ARGS" }, exposedName: "business__calculate_budget", toolName: "calculate_budget", toolVersion: "1.0.0", threadId: "thread", runId: "run", status: "completed" }] },
      { id: "result", role: "tool", content: "RAW_RESULT", toolCallId: "call", threadId: "thread", runId: "run", status: "completed", output: { currency: "USD", totalMinor: 300, remainingMinor: 0, overBudget: false, itemCount: 3 } },
    ]));
    expect(screen.getByText("300 USD")).toBeVisible();
    expect(screen.getAllByRole("button", { name: "Sao chép" })).toHaveLength(1);
    expect(screen.queryByText("RAW_RESULT")).not.toBeInTheDocument();
    await act(async () => { controlled.finish(); await sent; });
    expect(screen.queryByLabelText("Đang trả lời")).not.toBeInTheDocument();
  });
});
