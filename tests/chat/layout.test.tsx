// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { ChatShell } from "@/ui/chat/shell";
import { ConversationLayout } from "@/ui/chat/conversation-layout";

test("ChatShell and ConversationLayout render layout landmark hierarchy correctly", () => {
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
  expect(screen.getAllByRole("main")).toHaveLength(1);
});
