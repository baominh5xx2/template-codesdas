// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import type { ComponentProps, ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CopilotChatView as SDKChatView } from "@copilotkit/react-core/v2";
import type { ChatController } from "@/ui/chat/controller";
import { createControlledChatPort } from "../helpers/chat-client";
import { ChatWorkspace } from "@/ui/chat/workspace";

const sdk = vi.hoisted(() => ({
  ready: true,
  crash: false,
  providerError: null as null | (() => void),
  chatError: null as null | (() => void),
  controller: null as ChatController | null,
  port: null as ReturnType<typeof createControlledChatPort> | null,
  providerMounts: 0,
}));

vi.mock("@/ui/chat/controller", async (importActual) => {
  const actual = await importActual<typeof import("@/ui/chat/controller")>();
  return { ...actual, createChatController: (...args: Parameters<typeof actual.createChatController>) => {
    sdk.controller = actual.createChatController(...args);
    return sdk.controller;
  } };
});

// The runtime handshake and agent transport are external; keep the real C01 binding/adapter/controller.
vi.mock("@copilotkit/react-core/v2", async () => {
  const { useEffect } = await import("react");
  const subscribers = new Set<Record<string, (event: unknown) => void>>();
  const agent = {
    threadId: "", messages: [] as { id: string; role: "user" | "assistant"; content: string }[],
    setMessages(messages: { id: string; role: "user" | "assistant"; content: string }[]) { agent.messages = messages; },
    subscribe(subscriber: Record<string, (event: unknown) => void>) {
      subscribers.add(subscriber); return { unsubscribe: () => subscribers.delete(subscriber) };
    },
  };
  const core = {
    runAgent({ runId }: { runId: string }) {
      return sdk.port!.port.run({ threadId: agent.threadId, runId, messages: agent.messages }, {
        started: () => subscribers.forEach((s) => s.onRunStartedEvent?.({})),
        messages: (messages) => { agent.messages = messages; subscribers.forEach((s) => s.onTextMessageContentEvent?.({ messages })); },
        terminal: (status) => subscribers.forEach((s) => status === "failed"
          ? s.onRunFailed?.({}) : s.onRunFinishedEvent?.({ outcome: status === "completed" ? "success" : "interrupt", messages: agent.messages })),
      });
    },
    stopAgent() { sdk.port!.port.stop(); },
  };
  type ViewProps = ComponentProps<typeof SDKChatView>;
  function View({ children, messages = [], messageView }: ViewProps) {
    const slots = messageView as { userMessage?: React.ComponentType<{ message: unknown }>; assistantMessage?: React.ComponentType<{ message: unknown }> };
    const rendered = <>{messages.map((message) => {
      const Message = message.role === "user" ? slots?.userMessage : slots?.assistantMessage;
      return Message ? <Message key={message.id} message={message} /> : null;
    })}</>;
    return <div className="chat-view">{typeof children === "function" ? children({ messageView: rendered } as Parameters<Exclude<ViewProps["children"], ReactNode>>[0]) : children}</div>;
  }
  function Provider({ children, onError }: { children: ReactNode; onError: () => void }) {
    sdk.providerError = onError;
    useEffect(() => { sdk.providerMounts++; }, []);
    if (sdk.crash) throw new Error("RAW_PROVIDER_ERROR");
    return children;
  }
  function ScrollView({ children, scrollToBottomButton }: ComponentProps<typeof SDKChatView.ScrollView>) {
    return <div>{children}{typeof scrollToBottomButton === "object" && <button type="button" {...scrollToBottomButton} />}</div>;
  }
  return {
    // Installed 1.77.0 compatibility export only calls public onError with a public key.
    CopilotKit: ({ children }: { children: ReactNode }) => <Provider onError={() => {}}>{children}</Provider>,
    CopilotKitProvider: Provider,
    useAgent: () => ({ agent, isReady: sdk.ready }),
    useCopilotKit: () => ({ copilotkit: core }),
    CopilotChat: ({ chatView: ChatView, onError }: { chatView: React.ComponentType<ViewProps>; onError: () => void }) => {
      sdk.chatError = onError;
      return <ChatView onSubmitMessage={() => { throw new Error("Internal SDK submit must be overridden"); }} />;
    },
    CopilotChatView: Object.assign(View, { ScrollView }),
    CopilotChatUserMessage: ({ message, toolbar: Toolbar }: { message: { content: string }; toolbar: React.ComponentType }) => <div>{message.content}<Toolbar /></div>,
    CopilotChatAssistantMessage: Object.assign(({ message, toolbar: Toolbar }: { message: { content: string }; toolbar: React.ComponentType }) => <div>{message.content}<Toolbar /></div>, {
      MarkdownRenderer: ({ content }: { content: string }) => <div>{content}</div>,
    }),
  };
});

function readiness(available: boolean) { return Promise.resolve({ ok: true, json: async () => ({ available, agentId: "default" }) }); }
let viewport: boolean;
let mediaEvents: EventTarget;
beforeEach(() => {
  sdk.ready = true; sdk.crash = false; sdk.providerMounts = 0;
  sdk.port = createControlledChatPort(); sdk.controller = null; sdk.providerError = null; sdk.chatError = null;
  viewport = true; mediaEvents = new EventTarget();
  vi.stubGlobal("matchMedia", () => ({ matches: viewport, addEventListener: (_: string, cb: EventListener) => mediaEvents.addEventListener("change", cb), removeEventListener: (_: string, cb: EventListener) => mediaEvents.removeEventListener("change", cb) }));
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("ChatWorkspace", () => {
  it("keeps an offline draft editable and readiness Retry never runs the model", async () => {
    const fetch = vi.fn().mockImplementation(() => readiness(false));
    vi.stubGlobal("fetch", fetch);
    render(<ChatWorkspace />);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Chưa kết nối"));
    fireEvent.change(screen.getByRole("textbox", { name: "Tin nhắn" }), { target: { value: "Bản nháp" } });
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(sdk.port!.requests).toHaveLength(0);
    expect(sdk.providerMounts).toBe(0);
    expect(screen.getByRole("textbox")).toHaveValue("Bản nháp");
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status").textContent).toBe("Chưa kết nối");
  });

  it("waits for discovery before enabling Send and uses the C01 port once", async () => {
    vi.stubGlobal("fetch", () => readiness(true)); sdk.ready = false;
    const view = render(<ChatWorkspace />);
    await waitFor(() => expect(sdk.providerMounts).toBe(1));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Xin chào" } });
    expect(screen.getByRole("button", { name: "Gửi tin nhắn" })).toBeDisabled();
    sdk.ready = true; view.rerender(<ChatWorkspace />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Gửi tin nhắn" })).toBeEnabled());
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
    expect(sdk.port!.requests).toHaveLength(1);
    await act(async () => sdk.port!.finish());
    expect(screen.getByText("Xin chào")).toBeInTheDocument();
    expect(screen.queryByText("Chưa kết nối")).not.toBeInTheDocument();
  });

  it("coalesces provider and chat failures into one notice and retries the accepted turn", async () => {
    vi.stubGlobal("fetch", () => readiness(true)); render(<ChatWorkspace />);
    await waitFor(() => expect(sdk.controller?.getSnapshot().available).toBe(true));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Xin chào" } });
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
    act(() => sdk.port!.emitStarted());
    act(() => { sdk.providerError?.(); sdk.chatError?.(); sdk.providerError?.(); });
    await act(async () => sdk.port!.finish("failed"));
    expect(screen.getAllByRole("status").filter((node) => node.textContent === "Chưa kết nối")).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Thử lại" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(sdk.port!.requests).toHaveLength(2);
    expect(sdk.port!.requests[1].messages).toEqual(sdk.port!.requests[0].messages);
    await act(async () => sdk.port!.finish());
    expect(screen.queryByText("Chưa kết nối")).not.toBeInTheDocument();
  });

  it("routes provider-only discovery errors without a public license key", async () => {
    vi.stubGlobal("fetch", () => readiness(true)); sdk.ready = false;
    render(<ChatWorkspace />);
    await waitFor(() => expect(sdk.providerMounts).toBe(1));
    act(() => sdk.providerError?.());
    expect(sdk.controller!.getSnapshot().notice).toBe(true);
    expect(sdk.controller!.getSnapshot().status).toBe("failed");
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(sdk.port!.requests).toHaveLength(0);
  });

  it("passes an owned 44px minimum touch target to the SDK scroll action", async () => {
    vi.stubGlobal("fetch", () => readiness(true)); render(<ChatWorkspace />);
    await waitFor(() => expect(sdk.controller?.getSnapshot().available).toBe(true));
    const button = screen.getByRole("button", { name: "Về cuối cuộc trò chuyện" });
    expect(button).toHaveClass("chat-scroll-bottom-button");
    expect(button).toHaveStyle({ minWidth: "44px", minHeight: "44px" });
  });

  it("New chat aborts then waits before resetting, and fences repeated clicks", async () => {
    vi.stubGlobal("fetch", () => readiness(true)); render(<ChatWorkspace />);
    await waitFor(() => expect(sdk.controller?.getSnapshot().available).toBe(true));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Xin chào" } });
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
    const oldThread = sdk.controller!.getSnapshot().threadId;
    fireEvent.click(screen.getByRole("button", { name: "Cuộc trò chuyện mới" }));
    fireEvent.click(screen.getByRole("button", { name: "Cuộc trò chuyện mới" }));
    expect(sdk.port!.stopCount).toBe(1);
    expect(sdk.controller!.getSnapshot().threadId).toBe(oldThread);
    await act(async () => sdk.port!.finish());
    expect(sdk.controller!.getSnapshot().threadId).not.toBe(oldThread);
    expect(sdk.controller!.getSnapshot().messages).toEqual([]);
    expect(screen.getByText("Bạn muốn hỏi gì?")).toBeInTheDocument();
  });

  it("aborts superseded readiness and ignores a late available response", async () => {
    const calls: { signal: AbortSignal; resolve: (value: unknown) => void }[] = [];
    vi.stubGlobal("fetch", (_: string, { signal }: { signal: AbortSignal }) => new Promise((resolve) => calls.push({ signal, resolve })));
    const view = render(<ChatWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(calls[0].signal.aborted).toBe(true);
    await act(async () => calls[1].resolve(await readiness(false)));
    await act(async () => calls[0].resolve(await readiness(true)));
    expect(sdk.providerMounts).toBe(0);
    expect(screen.getByRole("status")).toHaveTextContent("Chưa kết nối");
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    view.unmount();
    expect(calls[2].signal.aborted).toBe(true);
  });

  it("retains desktop collapse separately and closes the mobile drawer across breakpoints", async () => {
    vi.stubGlobal("fetch", () => readiness(false)); render(<ChatWorkspace />);
    await waitFor(() => expect(screen.getByRole("status")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Thu gọn điều hướng" }));
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    act(() => { viewport = false; mediaEvents.dispatchEvent(new Event("change")); });
    fireEvent.click(screen.getByRole("button", { name: "Mở điều hướng" }));
    expect(screen.getByRole("dialog")).toHaveAttribute("open");
    act(() => { viewport = true; mediaEvents.dispatchEvent(new Event("change")); });
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    act(() => { viewport = false; mediaEvents.dispatchEvent(new Event("change")); });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders a provider boundary failure through the same editable fallback and notice", async () => {
    vi.stubGlobal("fetch", () => readiness(true)); sdk.crash = true;
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<ChatWorkspace />);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Chưa kết nối"));
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.queryByText("RAW_PROVIDER_ERROR")).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Bản nháp" } });
    sdk.crash = false;
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    await waitFor(() => expect(sdk.controller!.getSnapshot().available).toBe(true));
    expect(screen.getByRole("textbox")).toHaveValue("Bản nháp");
  });

  it("stops the attached active run on boundary failure and gates recovery until teardown", async () => {
    const fetch = vi.fn().mockImplementation(() => readiness(true));
    vi.stubGlobal("fetch", fetch);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const view = render(<ChatWorkspace />);
    await waitFor(() => expect(sdk.controller?.getSnapshot().available).toBe(true));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Xin chào" } });
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
    act(() => sdk.port!.emitStarted());
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Bản nháp tiếp theo" } });
    sdk.crash = true;
    view.rerender(<ChatWorkspace />);
    expect(sdk.port!.stopCount).toBe(1);
    expect(sdk.controller!.getSnapshot().pending).toBe(true);
    expect(sdk.controller!.getSnapshot().available).toBe(false);
    expect(screen.getByRole("textbox")).toHaveValue("Bản nháp tiếp theo");
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(sdk.port!.requests).toHaveLength(1);
    await act(async () => sdk.port!.finish());
    expect(sdk.controller!.getSnapshot().pending).toBe(false);
    expect(sdk.controller!.getSnapshot().status).toBe("interrupted");
    sdk.crash = false;
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    await waitFor(() => expect(sdk.controller!.getSnapshot().available).toBe(true));
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("button", { name: "Gửi tin nhắn" })).toBeEnabled();
    expect(screen.getByRole("textbox")).toHaveValue("Bản nháp tiếp theo");
  });
});
