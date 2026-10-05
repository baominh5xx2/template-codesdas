// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChatWorkspace } from "@/ui/chat/workspace";

describe("ChatWorkspace", () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.open = true;
    });
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.open = false;
    });
    global.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  afterEach(() => {
    cleanup();
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("renders disconnected state with single notice banner when readiness is false", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ available: false, agentId: "default" }),
    });

    render(<ChatWorkspace />);

    expect(screen.getByRole("heading", { name: "Hackathon Starter Kit" })).toBeVisible();
    expect(screen.getByText("Bạn muốn hỏi gì?")).toBeVisible();

    await waitFor(() => {
      expect(screen.getByText("Chưa kết nối")).toBeInTheDocument();
    });

    const retryBtn = screen.getByRole("button", { name: "Thử lại" });
    expect(retryBtn).toBeInTheDocument();

    const sendBtn = screen.getByRole("button", { name: "Gửi" });
    expect(sendBtn).toBeDisabled();
  });

  it("retries readiness check when clicking Thử lại in notice", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ available: false, agentId: "default" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ available: true, agentId: "default" }),
      });
    global.fetch = fetchMock;

    render(<ChatWorkspace />);

    await waitFor(() => {
      expect(screen.getByText("Chưa kết nối")).toBeInTheDocument();
    });

    const retryBtn = screen.getByRole("button", { name: "Thử lại" });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  it("renders navigation and triggers New chat without crashing", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ available: false, agentId: "default" }),
    });

    render(<ChatWorkspace />);

    const openSidebarBtn = screen.getByRole("button", { name: "Mở điều hướng" });
    fireEvent.click(openSidebarBtn);

    const newChatBtn = screen.getByRole("button", { name: "Cuộc trò chuyện mới" });
    expect(newChatBtn).toBeInTheDocument();

    fireEvent.click(newChatBtn);
    // Thread remains safe and no error thrown
    expect(screen.getByRole("textbox", { name: "Tin nhắn" })).toBeInTheDocument();
  });
});
