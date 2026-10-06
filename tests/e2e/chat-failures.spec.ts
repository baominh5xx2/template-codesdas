import { expect, test } from "@playwright/test";
import { completed, notice, provider, ready, send, target44, whiteShell } from "./chat-assertions";

for (const status of [401, 429, 500] as const) test(`provider rejection ${status} is one safe notice; keyboard Retry recovers`, async ({ page, request }) => {
  await provider(request, { scenario: "reject", status }); await ready(page); await send(page);
  await notice(page); await expect(page.locator(".chat-user-message")).toHaveCount(1);
  await expect(page.locator(".chat-assistant-message")).toHaveCount(0);
  await provider(request);
  await page.getByRole("button", { name: "Thử lại", exact: true }).focus(); await page.keyboard.press("Enter");
  await completed(page); await expect(page.locator(".chat-user-message")).toHaveCount(1);
});

test("abrupt partial stream failure keeps safe text and one notice", async ({ page, request }) => {
  await provider(request, { scenario: "partial-fail" }); await ready(page); await send(page);
  await notice(page);
  await expect(page.locator(".chat-assistant-message")).toContainText("Một phần phản hồi");
});

test("Stop is keyboard accessible, white, and returns to the normal composer", async ({ page, request }) => {
  await provider(request, { content: "Một phần phản hồi. ".repeat(50), chunkSize: 20, delayMs: 300 });
  await ready(page); await send(page);
  const stop = page.getByRole("button", { name: "Dừng trả lời", exact: true });
  await expect(stop).toBeVisible(); await target44(stop);
  await expect(stop).toHaveCSS("background-color", "rgb(23, 23, 23)");
  await expect(stop).toHaveCSS("color", "rgb(255, 255, 255)");
  await expect(page.locator(".chat-assistant-message")).toContainText("Một phần");
  await stop.focus(); await page.keyboard.press("Enter");
  await expect(stop).toHaveCount(0); await expect(page.locator(".chat-connection-notice")).toHaveCount(0);
  await expect(page.locator(".chat-assistant-message")).toContainText("Một phần"); await whiteShell(page);
});

test("SDK discovery failure remains one notice and Retry remounts the real provider", async ({ page, request }) => {
  await provider(request);
  // Inject a technical HTTP failure, not a successful SDK transcript.
  await page.route("**/api/copilotkit/info", (route) => route.fulfill({ status: 503, json: { code: "chat_unavailable", message: "Chưa kết nối" } }));
  await page.goto("/"); await notice(page);
  await page.getByRole("textbox", { name: "Tin nhắn", exact: true }).fill("Bản nháp qua discovery");
  await page.unroute("**/api/copilotkit/info");
  await page.getByRole("button", { name: "Thử lại", exact: true }).click();
  await expect(page.locator(".chat-connection-notice")).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "Tin nhắn", exact: true })).toHaveValue("Bản nháp qua discovery");
  await send(page); await completed(page);
});

test("SDK commit failure renders the white error boundary and Retry preserves the draft", async ({ page, request }) => {
  await provider(request);
  // Inject one browser API failure in the real SDK scroll ref's commit path.
  // This does not replace a successful response or add a product test route.
  await page.addInitScript(() => {
    const observe = ResizeObserver.prototype.observe;
    let injected = false;
    ResizeObserver.prototype.observe = function (target, options) {
      if (!injected && target.closest("[data-chat-scroll]")) {
        injected = true;
        throw new Error("RAW_SECRET_ERROR SDK scroll observer");
      }
      return observe.call(this, target, options);
    };
  });
  await page.goto("/");
  await expect(page.locator(".chat-fallback-scroll")).toBeVisible(); await notice(page);
  const input = page.getByRole("textbox", { name: "Tin nhắn", exact: true });
  await input.fill("Bản nháp qua boundary");
  await page.getByRole("button", { name: "Thử lại", exact: true }).click();
  await expect(page.locator("[data-chat-scroll]")).toBeVisible();
  await expect(input).toHaveValue("Bản nháp qua boundary");
  await send(page); await completed(page);
});

test("clipboard failure uses the same safe notice", async ({ page, request }) => {
  await provider(request); await ready(page); await send(page); await completed(page);
  await page.evaluate(() => Object.defineProperty(navigator.clipboard, "writeText", { value: () => Promise.reject(new Error("RAW_SECRET_ERROR clipboard")) }));
  await page.locator(".chat-assistant-message").getByRole("button", { name: "Sao chép", exact: true }).click();
  await notice(page);
});
