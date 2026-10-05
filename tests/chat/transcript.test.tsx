// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CopilotKit } from "@copilotkit/react-core/v2";
import { ChatControllerProvider } from "@/ui/chat/controller-context";
import { WhiteAssistantMessage, WhiteUserMessage } from "@/ui/chat/message-views";
import { createControlledChatPort } from "../helpers/chat-client";
import { createChatController } from "@/ui/chat/controller";

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
});
