// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CopilotKit } from "@copilotkit/react-core/v2";
import { createChatClientBinding } from "@/adapters/agents/chat-client";
import { createChatController } from "@/ui/chat/controller";
import { ChatControllerProvider } from "@/ui/chat/controller-context";
import { ChatPanel } from "@/ui/chat/chat-panel";

describe("ChatPanel", () => {
  beforeEach(() => {
    global.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders ChatPanel with WhiteChatView and composer under CopilotKit provider", () => {
    const binding = createChatClientBinding();
    const controller = createChatController({
      port: binding.port,
      uuid: () => "panel-test-uuid",
      available: true,
    });

    render(
      <CopilotKit runtimeUrl="http://localhost:3000/api/copilotkit">
        <ChatControllerProvider controller={controller} binding={binding}>
          <ChatPanel controller={controller} />
        </ChatControllerProvider>
      </CopilotKit>
    );

    // Initial state: welcome heading rendered
    expect(screen.getByRole("heading", { name: "Bạn muốn hỏi gì?" })).toBeVisible();

    // Composer textarea is rendered
    const textarea = screen.getByRole("textbox", { name: "Tin nhắn" });
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveAttribute("placeholder", "Nhập tin nhắn…");

    // Send button is rendered
    expect(screen.getByRole("button", { name: "Gửi" })).toBeInTheDocument();
    expect(controller.getSnapshot().available).toBe(false);
  });
});
