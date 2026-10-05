// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { createChatController } from "@/ui/chat/controller";
import { ChatComposer } from "@/ui/chat/composer";
import { createControlledChatPort } from "../helpers/chat-client";

afterEach(cleanup);
function setup(available = true) {
  const port = createControlledChatPort();
  const controller = createChatController({ port: port.port, uuid: () => crypto.randomUUID(), available });
  render(<ChatComposer controller={controller} />);
  return { controller, port, input: screen.getByRole("textbox", { name: "Tin nhắn" }) };
}

describe("ChatComposer", () => {
  it("holds IME Enter, then submits once after composition ends", async () => {
    const { input, port } = setup();
    fireEvent.change(input, { target: { value: "Xin chào" } });
    fireEvent.compositionStart(input);
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    expect(port.requests).toHaveLength(0);
    fireEvent.compositionEnd(input);
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    expect(port.requests).toHaveLength(0);
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(port.requests).toHaveLength(1);
    expect(port.requests[0].messages[0].content).toBe("Xin chào");
    await act(async () => port.finish());
  });

  it("lets Shift+Enter insert a newline without submitting", () => {
    const { input, port } = setup();
    fireEvent.change(input, { target: { value: "Dòng một" } });
    expect(fireEvent.keyDown(input, { key: "Enter", shiftKey: true })).toBe(true);
    fireEvent.change(input, { target: { value: "Dòng một\nDòng hai" } });
    expect(input).toHaveValue("Dòng một\nDòng hai");
    expect(port.requests).toHaveLength(0);
  });

  it.each(["   \n", "x".repeat(8001)])("blocks invalid input without clearing the draft", (draft) => {
    const { input, port } = setup();
    fireEvent.change(input, { target: { value: draft } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByRole("button", { name: "Gửi tin nhắn" })).toBeDisabled();
    expect(port.requests).toHaveLength(0);
    expect(input).toHaveValue(draft);
    expect(input).toHaveAttribute("maxlength", "8000");
  });

  it("allows offline typing while Send stays disabled", () => {
    const { input, port } = setup(false);
    fireEvent.change(input, { target: { value: "Bản nháp" } });
    fireEvent.click(screen.getByRole("button", { name: "Gửi tin nhắn" }));
    expect(input).toHaveValue("Bản nháp");
    expect(port.requests).toHaveLength(0);
  });

  it("keeps textarea focus and the next draft while Stop waits for teardown", async () => {
    const { input, controller, port } = setup();
    input.focus();
    fireEvent.change(input, { target: { value: "Xin chào" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.change(input, { target: { value: "Tiếp theo" } });
    expect(screen.getByRole("textbox", { name: "Tin nhắn" })).toBe(input);
    expect(input).toHaveFocus();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(port.requests).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Dừng trả lời" }));
    fireEvent.click(screen.getByRole("button", { name: "Dừng trả lời" }));
    expect(port.stopCount).toBe(1);
    expect(screen.getByRole("button", { name: "Dừng trả lời" })).toBeDisabled();
    await act(async () => port.finish());
    expect(input).toHaveValue("Tiếp theo");
    expect(controller.getSnapshot().status).toBe("interrupted");
    expect(screen.queryByRole("button", { name: "Thử lại" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gửi tin nhắn" })).toBeEnabled();
  });

  it("uses only the supplied notice retry for a failed attempt", async () => {
    const port = createControlledChatPort();
    const controller = createChatController({ port: port.port, uuid: () => crypto.randomUUID(), available: true });
    render(<ChatComposer controller={controller} notice={<section><p role="status">Chưa kết nối</p><button>Thử lại</button></section>} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Xin chào" } });
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
    await act(async () => port.finish("failed"));
    expect(screen.getAllByRole("button", { name: "Thử lại" })).toHaveLength(1);
  });

  it("clamps autosizing from 48 to 200 pixels", () => {
    const { input } = setup();
    expect(input.style.height).toBe("48px");
    Object.defineProperty(input, "scrollHeight", { configurable: true, value: 260 });
    fireEvent.change(input, { target: { value: "Long text" } });
    expect(input.style.height).toBe("200px");
    Object.defineProperty(input, "scrollHeight", { configurable: true, value: 20 });
    fireEvent.change(input, { target: { value: "Short" } });
    expect(input.style.height).toBe("48px");
  });
});
