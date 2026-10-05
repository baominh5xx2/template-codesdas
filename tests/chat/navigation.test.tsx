// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SidebarShell } from "@/ui/chat/sidebar-shell";
import { ChatHeader } from "@/ui/chat/header";
import { useDesktopViewport } from "@/ui/chat/use-desktop-viewport";

type MatchMediaHelper = {
  setMatches: (matches: boolean) => void;
};

function setupMatchMedia(initialMatches: boolean): MatchMediaHelper {
  const events = new EventTarget();
  let currentMatches = initialMatches;

  const mql: MediaQueryList = {
    get matches() {
      return currentMatches;
    },
    media: "(min-width: 1024px)",
    onchange: null,
    addListener: (cb) => events.addEventListener("change", cb as EventListener),
    removeListener: (cb) => events.removeEventListener("change", cb as EventListener),
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
    dispatchEvent: events.dispatchEvent.bind(events),
  };

  const matchMediaMock = vi.fn<(query: string) => MediaQueryList>().mockImplementation(() => mql);

  vi.stubGlobal("matchMedia", matchMediaMock);

  return {
    setMatches(nextMatches: boolean) {
      currentMatches = nextMatches;
      events.dispatchEvent(Object.assign(new Event("change"), {
        matches: nextMatches, media: mql.media,
      }));
    },
  };
}

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.open = true;
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.open = false;
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useDesktopViewport", () => {
  function ViewportProbe() {
    const isDesktop = useDesktopViewport();
    return <div data-testid="viewport">{isDesktop ? "desktop" : "mobile"}</div>;
  }

  it("reflects matchMedia state and updates on change events", () => {
    const helper = setupMatchMedia(true);
    render(<ViewportProbe />);
    expect(screen.getByTestId("viewport")).toHaveTextContent("desktop");

    act(() => {
      helper.setMatches(false);
    });
    expect(screen.getByTestId("viewport")).toHaveTextContent("mobile");
  });
});

describe("SidebarShell - Desktop", () => {
  beforeEach(() => {
    setupMatchMedia(true);
  });

  it("renders desktop sidebar with navigation landmark and new chat button", () => {
    const onNewChat = vi.fn();
    const onClose = vi.fn();

    render(
      <SidebarShell open={true} onClose={onClose} onNewChat={onNewChat} pending={true} />
    );

    const nav = screen.getByRole("navigation", { name: "Điều hướng" });
    expect(nav).toBeInTheDocument();

    const newChatBtn = screen.getByRole("button", { name: "Cuộc trò chuyện mới" });
    expect(newChatBtn).toBeInTheDocument();
    expect(newChatBtn).toBeEnabled();

    fireEvent.click(newChatBtn);
    expect(onNewChat).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();

    expect(screen.queryByText("Projects")).not.toBeInTheDocument();
    expect(screen.queryByText("Library")).not.toBeInTheDocument();
  });

  it("provides collapse button with label 'Thu gọn điều hướng'", () => {
    const onClose = vi.fn();

    render(
      <SidebarShell open={true} onClose={onClose} onNewChat={vi.fn()} pending={false} />
    );

    const collapseBtn = screen.getByRole("button", { name: "Thu gọn điều hướng" });
    expect(collapseBtn).toBeInTheDocument();

    fireEvent.click(collapseBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("hides desktop aside when open=false without leaving tabbable controls", () => {
    const { container } = render(
      <SidebarShell open={false} onClose={vi.fn()} onNewChat={vi.fn()} pending={false} />
    );

    const aside = container.querySelector("aside.chat-sidebar");
    expect(aside).toHaveAttribute("hidden");
    expect(screen.queryByRole("button", { name: "Cuộc trò chuyện mới" })).not.toBeInTheDocument();
  });
});

describe("SidebarShell - Mobile", () => {
  beforeEach(() => {
    setupMatchMedia(false);
  });

  it("renders native dialog landmark without duplicating navigation", () => {
    const onNewChat = vi.fn();
    const onClose = vi.fn();

    render(
      <SidebarShell open={true} onClose={onClose} onNewChat={onNewChat} pending={false} />
    );

    const dialog = screen.getByRole("dialog", { name: "Điều hướng hội thoại" });
    expect(dialog).toBeInTheDocument();

    const navigations = screen.getAllByRole("navigation", { name: "Điều hướng" });
    expect(navigations).toHaveLength(1);

    expect(document.querySelector("aside.chat-sidebar")).not.toBeInTheDocument();

    const closeBtn = screen.getByRole("button", { name: "Đóng điều hướng" });
    expect(closeBtn).toBeInTheDocument();

    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("triggers both onNewChat and onClose when new chat is clicked on mobile", () => {
    const onNewChat = vi.fn();
    const onClose = vi.fn();

    render(
      <SidebarShell open={true} onClose={onClose} onNewChat={onNewChat} pending={false} />
    );

    const newChatBtn = screen.getByRole("button", { name: "Cuộc trò chuyện mới" });
    fireEvent.click(newChatBtn);

    expect(onNewChat).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("handles dialog backdrop clicks to trigger onClose", () => {
    const onClose = vi.fn();

    render(
      <SidebarShell open={true} onClose={onClose} onNewChat={vi.fn()} pending={false} />
    );

    const dialog = screen.getByRole("dialog", { name: "Điều hướng hội thoại" });
    vi.spyOn(dialog, "getBoundingClientRect").mockReturnValue({
      top: 0,
      left: 0,
      bottom: 800,
      right: 280,
      width: 280,
      height: 800,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    // Click outside dialog bounding box
    fireEvent.click(dialog, { clientX: 320, clientY: 200 });
    expect(onClose).toHaveBeenCalledTimes(1);

    // Click inside dialog bounding box
    fireEvent.click(dialog, { clientX: 100, clientY: 200 });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("handles cancel event (Escape) to call onClose", () => {
    const onClose = vi.fn();

    render(
      <SidebarShell open={true} onClose={onClose} onNewChat={vi.fn()} pending={false} />
    );

    const dialog = screen.getByRole("dialog", { name: "Điều hướng hội thoại" });
    fireEvent(dialog, new Event("cancel", { bubbles: false, cancelable: true }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes native drawer when switching to desktop without collapsing desktop navigation", () => {
    const helper = setupMatchMedia(false);
    const onClose = vi.fn();

    render(
      <SidebarShell open={true} onClose={onClose} onNewChat={vi.fn()} pending={false} />
    );

    act(() => {
      helper.setMatches(true);
    });

    expect(HTMLDialogElement.prototype.close).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getAllByRole("navigation")).toHaveLength(1);
  });

  it("requests a closed drawer when moving from expanded desktop to mobile", () => {
    const helper = setupMatchMedia(true);
    const onClose = vi.fn();
    render(<SidebarShell open={true} onClose={onClose} onNewChat={vi.fn()} pending={false} />);
    act(() => helper.setMatches(false));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(HTMLDialogElement.prototype.showModal).not.toHaveBeenCalled();
  });

  it("closes native dialog when controlled open becomes false", () => {
    const props = { onClose: vi.fn(), onNewChat: vi.fn(), pending: false };
    const { rerender } = render(<SidebarShell {...props} open={true} />);
    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalledTimes(1);
    rerender(<SidebarShell {...props} open={false} />);
    expect(HTMLDialogElement.prototype.close).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("ChatHeader", () => {
  it("renders branding title and sidebar toggle button when enabled", () => {
    const onOpenSidebar = vi.fn();

    render(
      <ChatHeader showSidebarToggle={true} onOpenSidebar={onOpenSidebar} />
    );

    expect(screen.getByRole("heading", { name: "Hackathon Starter Kit" })).toBeInTheDocument();

    const toggleBtn = screen.getByRole("button", { name: "Mở điều hướng" });
    expect(toggleBtn).toBeInTheDocument();

    fireEvent.click(toggleBtn);
    expect(onOpenSidebar).toHaveBeenCalledTimes(1);
  });

  it("omits sidebar toggle button when showSidebarToggle is false", () => {
    render(
      <ChatHeader showSidebarToggle={false} onOpenSidebar={vi.fn()} />
    );

    expect(screen.getByRole("heading", { name: "Hackathon Starter Kit" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mở điều hướng" })).not.toBeInTheDocument();
  });
});
