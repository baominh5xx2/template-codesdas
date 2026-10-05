// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createChatController } from "@/ui/chat/controller";
import { ChatComposer } from "@/ui/chat/composer";
import { createControlledChatPort } from "../helpers/chat-client";

describe("ChatComposer", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  function setup(available = true) {
    const controlled = createControlledChatPort();
    const controller = createChatController({
      port: controlled.port,
      uuid: () => "comp-test-uuid",
      available,
    });
    return { controller, controlled };
  }

  it("handles IME composition and Enter key without sending while composing", () => {
    const { controller, controlled } = setup();

    render(<ChatComposer controller={controller} />);
    const textarea = screen.getByRole("textbox", { name: "Tin nhắn" });

    fireEvent.change(textarea, { target: { value: "Xin chào" } });
    expect(controller.getSnapshot().draft).toBe("Xin chào");

    // Start IME composition
    fireEvent.compositionStart(textarea);
    fireEvent.keyDown(textarea, { key: "Enter", isComposing: true });
    expect(controlled.requests).toHaveLength(0);

    // End IME composition
    fireEvent.compositionEnd(textarea);
    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(controlled.requests).toHaveLength(1);
    expect(controlled.requests[0]?.messages[0]?.content).toBe("Xin chào");
  });

  it("does not send on Shift+Enter and keeps draft", () => {
    const { controller, controlled } = setup();

    render(<ChatComposer controller={controller} />);
    const textarea = screen.getByRole("textbox", { name: "Tin nhắn" });

    fireEvent.change(textarea, { target: { value: "Dòng 1" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });

    expect(controlled.requests).toHaveLength(0);
    expect(controller.getSnapshot().draft).toBe("Dòng 1");
  });

  it("disables Send button when empty or when not available", () => {
    const { controller } = setup(false);

    render(<ChatComposer controller={controller} />);
    const sendBtn = screen.getByRole("button", { name: "Gửi" });
    expect(sendBtn).toBeDisabled();

    controller.setDraft("Tin nhắn");
    // Still disabled because available is false
    expect(sendBtn).toBeDisabled();
  });

  it("switches to Stop button when pending and triggers controller.stop()", () => {
    const { controller, controlled } = setup(true);

    render(<ChatComposer controller={controller} />);
    const textarea = screen.getByRole("textbox", { name: "Tin nhắn" });

    fireEvent.change(textarea, { target: { value: "Chạy tác vụ" } });
    const sendBtn = screen.getByRole("button", { name: "Gửi" });
    fireEvent.click(sendBtn);

    expect(controlled.requests).toHaveLength(1);
    expect(controller.getSnapshot().pending).toBe(true);

    const stopBtn = screen.getByRole("button", { name: "Dừng" });
    expect(stopBtn).toBeInTheDocument();

    fireEvent.click(stopBtn);
    expect(controlled.stopCount).toBe(1);
  });
});
