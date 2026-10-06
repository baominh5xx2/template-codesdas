// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SidebarShell } from "@/ui/chat/sidebar-shell";
import { ChatHeader } from "@/ui/chat/header";

describe("Sidebar and Navigation", () => {
  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.open = true;
    });
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.open = false;
    });
  });

  afterEach(() => {
    cleanup();
    window.matchMedia = originalMatchMedia;
    vi.restoreAllMocks();
  });

  function setupDesktop(matches: boolean) {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  }

  it("handles New chat button click and prevents fake controls on desktop", () => {
    setupDesktop(true);
    const onNewChat = vi.fn();
    const onClose = vi.fn();

    render(
      <SidebarShell
        open={true}
        onClose={onClose}
        onNewChat={onNewChat}
        pending={true}
      />
    );

    const newChatBtn = screen.getByRole("button", { name: "Cuộc trò chuyện mới" });
    expect(newChatBtn).toBeInTheDocument();
    expect(newChatBtn).not.toBeDisabled();

    fireEvent.click(newChatBtn);
    expect(onNewChat).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();

    expect(screen.queryByText("Projects")).not.toBeInTheDocument();
    expect(screen.queryByText("Library")).not.toBeInTheDocument();
  });

  it("renders mobile drawer dialog and calls onClose on mobile when clicking New chat or close", () => {
    setupDesktop(false);
    const onNewChat = vi.fn();
    const onClose = vi.fn();

    render(
      <SidebarShell
        open={true}
        onClose={onClose}
        onNewChat={onNewChat}
        pending={false}
      />
    );

    expect(screen.getByRole("dialog", { name: "Điều hướng hội thoại" })).toBeInTheDocument();

    const closeBtn = screen.getByRole("button", { name: "Đóng điều hướng" });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);

    const newChatBtn = screen.getByRole("button", { name: "Cuộc trò chuyện mới" });
    fireEvent.click(newChatBtn);
    expect(onNewChat).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("renders ChatHeader with branding and toggle button", () => {
    setupDesktop(true);
    const onOpenSidebar = vi.fn();

    render(
      <ChatHeader
        showSidebarToggle={true}
        onOpenSidebar={onOpenSidebar}
        sidebarOpen={true}
      />
    );

    expect(screen.getByRole("heading", { name: "AI Thực chiến × TriplePeek" })).toBeVisible();

    const toggleBtn = screen.getByRole("button", { name: "Thu gọn điều hướng" });
    fireEvent.click(toggleBtn);
    expect(onOpenSidebar).toHaveBeenCalledTimes(1);
  });

  it("renders ChatHeader with mobile toggle label when on mobile", () => {
    setupDesktop(false);
    const onOpenSidebar = vi.fn();

    render(
      <ChatHeader
        showSidebarToggle={true}
        onOpenSidebar={onOpenSidebar}
      />
    );

    const toggleBtn = screen.getByRole("button", { name: "Mở điều hướng" });
    fireEvent.click(toggleBtn);
    expect(onOpenSidebar).toHaveBeenCalledTimes(1);
  });
});
