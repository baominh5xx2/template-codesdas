import { expect, type APIRequestContext, type Page } from "@playwright/test";
import type { ChatProviderScenario } from "./chat-provider";

export const answer = "Xin chào! Tôi có thể giúp gì cho bạn?";
export async function scenario(request: APIRequestContext, value: ChatProviderScenario, options: { text?: string; chunkDelay?: number; rejectStatus?: number } = {}) {
  const response = await request.post("http://127.0.0.1:4310/test/scenario", { data: { scenario: value, ...options } });
  expect(response.status()).toBe(200);
}
export async function openChat(page: Page) {
  await page.goto("/");
  await expect(page.locator("[data-copilotkit]").first()).toBeAttached();
  await expect(page.getByRole("textbox", { name: "Tin nhắn" })).toBeVisible();
  await expect(page.getByRole("status")).toHaveCount(0);
}
export async function send(page: Page, text: string) {
  await page.getByRole("textbox", { name: "Tin nhắn" }).fill(text);
  await page.getByRole("button", { name: "Gửi", exact: true }).click();
}
export async function captureRequests(request: APIRequestContext): Promise<{ body: { messages: { role: string; content: string }[] } }[]> {
  return (await request.get("http://127.0.0.1:4310/test/requests")).json();
}
export function observe(page: Page) {
  const runs: { messages: { id: string; role: string; content: string }[]; threadId: string }[] = [];
  const consoleMessages: string[] = [];
  const streams: Promise<string>[] = [];
  page.on("request", (req) => { if (req.url().endsWith("/agent/default/run")) runs.push(req.postDataJSON()); });
  page.on("console", (event) => consoleMessages.push(event.text()));
  page.on("pageerror", (error) => consoleMessages.push(error.message));
  page.on("response", (res) => { if (res.url().includes("/api/copilotkit")) streams.push(res.text().catch(() => "transport_aborted")); });
  return { runs, consoleMessages, async assertMasked() {
    await expect(page.getByText("RAW_SECRET_ERROR", { exact: false })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Show Details", exact: true })).toHaveCount(0);
    await expect(page.locator(".chat-shell").getByText("Failed to fetch", { exact: true })).toHaveCount(0);
    expect(consoleMessages.join("\n")).not.toContain("RAW_SECRET_ERROR");
    expect((await Promise.all(streams)).join("\n")).not.toContain("RAW_SECRET_ERROR");
  } };
}
