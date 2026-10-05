// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createChatController, type ChatController } from "@/ui/chat/controller";
import { ChatControllerProvider, useChatControllerRef, useChatNotice } from "@/ui/chat/controller-context";
import { WhiteAssistantMessage, WhiteUserMessage } from "@/ui/chat/message-views";
import { useChatController } from "@/ui/chat/use-controller";
import { createControlledChatPort } from "../helpers/chat-client";

// Isolated SDK boundary: the real v2 entrypoint imports CSS unsupported by the
// Node runner. Task 5 exercises Streamdown and SDK UI in the browser.
vi.mock("@copilotkit/react-core/v2", () => {
  function MarkdownRenderer({ content, controls = true }: { content: string; controls?: boolean }) {
    return <div>{content}{controls && (content.includes("```") || content.includes("|")) && <button>Download content</button>}</div>;
  }
  function AssistantMessage({ message, toolbarVisible, markdownRenderer: Renderer = MarkdownRenderer }: {
    message: { content?: string };
    toolbarVisible?: boolean;
    markdownRenderer?: React.ComponentType<{ content: string }>;
  }) {
    return <div>
      <Renderer content={message.content ?? ""} />
      {toolbarVisible !== false && <div data-testid="copilot-assistant-toolbar"><button>Regenerate</button><button>Inspector</button><button>Thumbs up</button><button>Read aloud</button></div>}
    </div>;
  }
  return {
  CopilotChatAssistantMessage: Object.assign(AssistantMessage, { MarkdownRenderer }),
  CopilotChatUserMessage: ({ message, toolbar: Toolbar }: { message: { content: string }; toolbar?: React.ComponentType }) => <div>
    <div>{message.content}</div>
    {Toolbar ? <Toolbar /> : <div data-testid="copilot-user-toolbar"><button>Edit</button></div>}
  </div>,
};
});

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function setup() {
  const controlled = createControlledChatPort();
  let id = 0;
  const controller = createChatController({ port: controlled.port, available: true, uuid: () => `id-${++id}` });
  return { controlled, controller };
}

function Transcript({ controller }: { controller: ChatController }) {
  const snapshot = useChatController(controller);
  return <>
    <input aria-label="Draft probe" value={snapshot.draft} onChange={(event) => controller.setDraft(event.target.value)} />
    {snapshot.messages.map((message) => message.role === "user"
      ? <WhiteUserMessage key={message.id} message={{ ...message, role: "user" }} onEditMessage={() => {}} />
      : <WhiteAssistantMessage key={message.id} message={{ ...message, role: "assistant" }} onRegenerate={() => {}} onReadAloud={() => {}} onThumbsUp={() => {}} onThumbsDown={() => {}} />)}
  </>;
}

describe("Controller transcript presentation", () => {
  it.each(["```ts\nconst n = 1;\n```", "| Name | Value |\n| --- | --- |\n| n | 1 |"])("keeps code/table actions inside the owned Copy action: %s", (content) => {
    const { controller } = setup();
    render(<ChatControllerProvider controller={controller}>
      <WhiteAssistantMessage message={{ id: "assistant", role: "assistant", content }} />
    </ChatControllerProvider>);
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Sao chép" })).toBeInTheDocument();
  });

  it("requires a provider with an app-owned boundary error", () => {
    expect(() => renderHook(() => useChatControllerRef())).toThrow("Chat controller provider is missing");
  });

  it("reads the current workspace notice without changing controller state", () => {
    const { controller } = setup();
    function Notice() { return <div>{useChatNotice()}</div>; }
    const initial = controller.getSnapshot();
    const view = render(<ChatControllerProvider controller={controller} notice={<p>First notice</p>}><Notice /></ChatControllerProvider>);
    view.rerender(<ChatControllerProvider controller={controller} notice={<p>Current notice</p>}><Notice /></ChatControllerProvider>);
    expect(screen.queryByText("First notice")).not.toBeInTheDocument();
    expect(screen.getByText("Current notice")).toBeInTheDocument();
    expect(controller.getSnapshot()).toBe(initial);
  });

  it("forwards literal user HTML and unchanged assistant Markdown/code with only own Copy actions", () => {
    const { controller } = setup();
    const { container } = render(<ChatControllerProvider controller={controller}>
      <WhiteUserMessage message={{ id: "user", role: "user", content: '<img src=x onerror="secret()">' }} onEditMessage={() => {}} />
      <WhiteAssistantMessage message={{ id: "assistant", role: "assistant", content: "**Câu trả lời**\n\n```ts\nconst n = 1;\n```" }} onThumbsUp={() => {}} onThumbsDown={() => {}} onRegenerate={() => {}} onReadAloud={() => {}} />
    </ChatControllerProvider>);
    expect(screen.getByText('<img src=x onerror="secret()">')).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("**Câu trả lời** ```ts const n = 1; ```", { exact: true })).toBeInTheDocument();
    expect(container.querySelector('[data-testid="copilot-user-toolbar"]')).toBeNull();
    expect(container.querySelector('[data-testid="copilot-assistant-toolbar"]')).toBeNull();
    expect(screen.getAllByRole("button", { name: "Sao chép" })).toHaveLength(2);
    expect(screen.queryByRole("button", { name: /edit|regenerate|inspector|thumb|read aloud/i })).not.toBeInTheDocument();
  });

  it("updates streaming content without duplicate messages or losing draft/copy focus", async () => {
    const { controller, controlled } = setup();
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    render(<ChatControllerProvider controller={controller}><Transcript controller={controller} /></ChatControllerProvider>);
    let run!: Promise<boolean>;
    act(() => { controller.setDraft("Xin chào"); run = controller.send(); controlled.emitStarted(); });
    act(() => controlled.emitMessages([{ id: "id-2", role: "user", content: "Xin chào" }, { id: "answer", role: "assistant", content: "Chào" }]));
    const input = screen.getByRole("textbox");
    input.focus();
    fireEvent.change(input, { target: { value: "Tiếp theo" } });
    act(() => controlled.emitMessages([{ id: "id-2", role: "user", content: "Xin chào" }, { id: "answer", role: "assistant", content: "Chào bạn" }]));
    expect(screen.getByRole("textbox")).toBe(input);
    expect(input).toHaveFocus();
    expect(input).toHaveValue("Tiếp theo");
    const copy = screen.getAllByRole("button", { name: "Sao chép" })[1];
    copy.focus();
    act(() => controlled.emitMessages([{ id: "id-2", role: "user", content: "Xin chào" }, { id: "answer", role: "assistant", content: "Chào bạn!" }]));
    expect(screen.getAllByRole("button", { name: "Sao chép" })[1]).toBe(copy);
    expect(copy).toHaveFocus();
    const beforeCopy = controller.getSnapshot();
    fireEvent.click(copy);
    await waitFor(() => expect(screen.getByText("Đã sao chép")).toBeInTheDocument());
    expect(controller.getSnapshot()).toBe(beforeCopy);
    expect(screen.getAllByRole("article")).toHaveLength(2);
    await act(async () => { controlled.finish(); await run; });
  });

  it("routes message copy failure to controller.fail without adding a message", async () => {
    const { controller } = setup();
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("RAW_SECRET_ERROR")) } });
    render(<ChatControllerProvider controller={controller}><WhiteUserMessage message={{ id: "user", role: "user", content: "Xin chào" }} /></ChatControllerProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Sao chép" }));
    await waitFor(() => expect(controller.getSnapshot().notice).toBe(true));
    expect(controller.getSnapshot().messages).toHaveLength(0);
    expect(screen.queryByText("RAW_SECRET_ERROR")).not.toBeInTheDocument();
  });
});
