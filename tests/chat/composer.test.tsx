// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  it("renders Thử lại button and calls controller.retry() when status is interrupted and notice is false", async () => {
    const { controller, controlled } = setup(true);
    const retrySpy = vi.spyOn(controller, "retry");

    render(<ChatComposer controller={controller} />);
    const textarea = screen.getByRole("textbox", { name: "Tin nhắn" });

    // Send a message
    fireEvent.change(textarea, { target: { value: "Tin nhắn bị dừng" } });
    const sendPromise = controller.send();
    expect(controlled.requests).toHaveLength(1);

    // Controlled port signals started and then finishes as interrupted
    controlled.emitStarted();
    controlled.finish("interrupted");
    await sendPromise;

    await waitFor(() => {
      expect(controller.getSnapshot().status).toBe("interrupted");
      expect(controller.getSnapshot().pending).toBe(false);
    });
    expect(controller.getSnapshot().notice).toBe(false);

    // "Thử lại" button should now be visible in composer
    const retryBtn = screen.getByRole("button", { name: "Thử lại" });
    expect(retryBtn).toBeInTheDocument();

    // Clicking "Thử lại" triggers controller.retry()
    fireEvent.click(retryBtn);
    expect(retrySpy).toHaveBeenCalledTimes(1);
    expect(controlled.requests).toHaveLength(2);
  });

  describe("voice input", () => {
    function installRecorderStubs() {
      const track = { stop: vi.fn() };
      const stream = { getTracks: () => [track] };
      class FakeMediaRecorder {
        static isTypeSupported(type: string): boolean {
          return type === "audio/webm";
        }
        mimeType = "audio/webm";
        state: "inactive" | "recording" = "inactive";
        ondataavailable: ((event: { data: Blob }) => void) | null = null;
        onstop: (() => void) | null = null;
        onerror: (() => void) | null = null;
        start(): void {
          this.state = "recording";
        }
        stop(): void {
          this.state = "inactive";
          this.ondataavailable?.({ data: new Blob([new Uint8Array(16).fill(7)], { type: "audio/webm" }) });
          this.onstop?.();
        }
      }
      class FakeAudioContext {
        state = "running";
        createMediaStreamSource() {
          return { connect: () => {} };
        }
        createAnalyser() {
          return { fftSize: 0, getByteTimeDomainData: () => {} };
        }
        close() {
          return Promise.resolve();
        }
      }
      vi.stubGlobal("MediaRecorder", FakeMediaRecorder);
      vi.stubGlobal("AudioContext", FakeAudioContext);
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
      });
      vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    }

    afterEach(() => {
      vi.unstubAllGlobals();
      Reflect.deleteProperty(navigator, "mediaDevices");
    });

    it("hides the mic when the browser cannot record", () => {
      const { controller } = setup();
      render(<ChatComposer controller={controller} />);
      expect(screen.queryByRole("button", { name: "Nói để nhập" })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Gửi" })).toBeInTheDocument();
    });

    it("records with CopilotKit's recorder and appends the transcript to the draft without sending", async () => {
      installRecorderStubs();
      const fetchMock = vi.fn().mockResolvedValue(Response.json({ text: "thời tiết hôm nay" }));
      vi.stubGlobal("fetch", fetchMock);
      const { controller, controlled } = setup();
      controller.setDraft("Cho tôi hỏi");

      render(<ChatComposer controller={controller} />);
      fireEvent.click(screen.getByRole("button", { name: "Nói để nhập" }));

      const finish = await screen.findByRole("button", { name: "Xong ghi âm" });
      await waitFor(() => expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled());
      // Let the recorder commit its "recording" state before finishing.
      await new Promise((resolve) => setTimeout(resolve, 0));
      fireEvent.click(finish);

      await waitFor(() => expect(controller.getSnapshot().draft).toBe("Cho tôi hỏi thời tiết hôm nay"));
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("/api/chat/transcribe");
      expect(init.method).toBe("POST");
      expect((init.body as FormData).get("audio")).toBeInstanceOf(Blob);
      expect(controlled.requests).toHaveLength(0);
      expect(await screen.findByRole("textbox", { name: "Tin nhắn" })).toHaveValue("Cho tôi hỏi thời tiết hôm nay");
    });

    it("keeps the draft and shows only the generic notice when transcription fails", async () => {
      installRecorderStubs();
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(Response.json({ error: { code: "chat_unavailable", message: "Chưa kết nối" } }, { status: 503 }))
      );
      const { controller } = setup();
      controller.setDraft("Nháp");

      render(<ChatComposer controller={controller} />);
      fireEvent.click(screen.getByRole("button", { name: "Nói để nhập" }));
      const finish = await screen.findByRole("button", { name: "Xong ghi âm" });
      await waitFor(() => expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled());
      await new Promise((resolve) => setTimeout(resolve, 0));
      fireEvent.click(finish);

      expect(await screen.findByRole("status")).toHaveTextContent("Chưa kết nối");
      expect(controller.getSnapshot().draft).toBe("Nháp");
      // Not locked: the draft can still be sent.
      expect(controller.getSnapshot().notice).toBe(false);
      expect(screen.getByRole("button", { name: "Gửi" })).toBeEnabled();
    });
  });
});
