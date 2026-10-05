// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ChatShell } from "@/ui/chat/shell";
import { ConversationLayout } from "@/ui/chat/conversation-layout";

afterEach(() => {
  cleanup();
});

describe("Chat layout and landmarks", () => {
  it("renders chat shell with header, sidebar, and conversation layout inside main landmark", () => {
    render(
      <ChatShell
        sidebar={<nav aria-label="Điều hướng">Menu</nav>}
        header={<h1>Hackathon Starter Kit</h1>}
      >
        <ConversationLayout
          transcript={<p>Câu trả lời</p>}
          composer={<textarea aria-label="Tin nhắn" />}
        />
      </ChatShell>
    );

    expect(screen.getByRole("main").contains(screen.getByRole("textbox"))).toBe(true);
    expect(
      screen.getByRole("navigation", { name: "Điều hướng" }).contains(screen.getByRole("textbox"))
    ).toBe(false);
    expect(screen.getByRole("heading", { name: "Hackathon Starter Kit" })).toBeVisible();
  });

  it("ensures exactly one main landmark exists", () => {
    render(
      <ChatShell
        sidebar={<nav aria-label="Điều hướng">Menu</nav>}
        header={<div>Header</div>}
      >
        <ConversationLayout
          transcript={<div>Transcript</div>}
          composer={<div>Composer</div>}
        />
      </ChatShell>
    );

    const mains = screen.getAllByRole("main");
    expect(mains).toHaveLength(1);
  });

  it("attaches data-chat-theme light and shell class to root element", () => {
    const { container } = render(
      <ChatShell
        sidebar={<nav aria-label="Điều hướng">Menu</nav>}
        header={<div>Header</div>}
      >
        <ConversationLayout
          transcript={<div>Transcript</div>}
          composer={<div>Composer</div>}
        />
      </ChatShell>
    );

    const shell = container.firstChild as HTMLElement;
    expect(shell).toHaveClass("chat-shell");
    expect(shell).toHaveAttribute("data-chat-theme", "light");
  });

  it("renders conversation layout with transcript and composer structure", () => {
    const { container } = render(
      <ConversationLayout
        transcript={<div data-testid="test-transcript">Transcript Content</div>}
        composer={<div data-testid="test-composer">Composer Content</div>}
      />
    );

    const conversation = container.firstElementChild as HTMLElement;
    expect(conversation).toHaveClass("chat-conversation");
    expect(conversation.querySelector(".chat-transcript")).not.toBeNull();
    expect(conversation.querySelector(".chat-composer-row")).not.toBeNull();
    expect(screen.getByTestId("test-transcript")).toBeInTheDocument();
    expect(screen.getByTestId("test-composer")).toBeInTheDocument();
  });
});
