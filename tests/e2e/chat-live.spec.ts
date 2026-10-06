import { test, expect } from "@playwright/test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { answer, captureRequests, observe, openChat, scenario, send } from "../helpers/chat-browser";

test.beforeEach(async ({ request }) => { await scenario(request, "success"); });

test("smoke CLI validates successful terminal and masks provider rejection", async ({ baseURL, request }) => {
  const run = () => promisify(execFile)("bun", ["run", "chat:smoke"], { env: { ...process.env, CHAT_SMOKE_URL: baseURL } });
  const success = await run();
  expect(JSON.parse(success.stdout.trim())).toEqual({ readiness: true, result: "completed", checks: 3 });
  await scenario(request, "reject");
  const masked = await run();
  expect(JSON.parse(masked.stdout.trim())).toEqual({ readiness: true, result: "masked_failure", checks: 3 });
  expect(masked.stdout + masked.stderr).not.toContain("RAW_SECRET_ERROR");
});

test("real SDK sends two turns with stable unique IDs, history, copy and reload reset", async ({ page, request, context }) => {
  const observed = observe(page);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await openChat(page); await send(page, "First turn");
  await expect(page.locator(".chat-assistant-message")).toContainText(answer);
  await expect(page.getByRole("button", { name: "Dừng", exact: true })).toHaveCount(0);
  await send(page, "Second turn");
  await expect(page.locator(".chat-assistant-message")).toHaveCount(2);
  await expect(page.locator(".chat-assistant-message").last()).toContainText(answer);
  expect(observed.runs).toHaveLength(2);
  const users = observed.runs[1].messages.filter((msg) => msg.role === "user");
  expect(users.map((msg) => msg.content)).toEqual(["First turn", "Second turn"]);
  expect(new Set(users.map((msg) => msg.id)).size).toBe(2);
  expect(users[0].id).toBe(observed.runs[0].messages[0].id);
  const provider = await captureRequests(request);
  expect(provider).toHaveLength(2);
  expect(provider[1].body.messages.filter((msg) => msg.role !== "system")).toEqual([
    { role: "user", content: "First turn" }, { role: "assistant", content: answer }, { role: "user", content: "Second turn" },
  ]);
  await page.locator(".chat-assistant-message").last().getByRole("button", { name: "Sao chép" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(answer);
  await observed.assertMasked();
  await page.reload(); await expect(page.getByRole("heading", { name: "Bạn muốn hỏi gì?" })).toBeVisible();
  await expect(page.locator(".chat-user-message")).toHaveCount(0);
});

test("Stop and New chat fence delayed provider data and Retry reuses the user checkpoint", async ({ page, request }) => {
  await scenario(request, "slow", { text: "Partial pending answer" });
  const observed = observe(page);
  await openChat(page); await send(page, "One user turn");
  await expect(page.locator(".chat-assistant-message")).toContainText("Partial pending answer");
  await page.getByRole("button", { name: "Dừng", exact: true }).click();
  await expect(page.getByRole("button", { name: "Thử lại", exact: true })).toBeVisible();
  await request.post("http://127.0.0.1:4310/test/finish");
  await scenario(request, "success");
  await page.getByRole("button", { name: "Thử lại", exact: true }).click();
  await expect(page.locator(".chat-assistant-message")).toContainText(answer);
  await expect(page.locator(".chat-user-message")).toHaveCount(1);
  expect(observed.runs[1].messages).toEqual(observed.runs[0].messages);
  await scenario(request, "slow", { text: "Old conversation delta" });
  await send(page, "Reset during stream");
  await expect(page.locator(".chat-assistant-message").last()).toContainText("Old conversation delta");
  await page.getByRole("button", { name: "Cuộc trò chuyện mới", exact: true }).click();
  await request.post("http://127.0.0.1:4310/test/finish");
  await expect(page.locator(".chat-user-message")).toHaveCount(0);
  await expect(page.locator(".chat-assistant-message")).toHaveCount(0);
  await scenario(request, "success"); await send(page, "Fresh session");
  await expect(page.locator(".chat-assistant-message")).toContainText(answer);
  expect(observed.runs[3].threadId).not.toBe(observed.runs[2].threadId);
  expect(observed.runs[3].messages).toHaveLength(1);
});

test("Enter sends, Shift+Enter and IME composition keep drafts", async ({ page }) => {
  const observed = observe(page); await openChat(page);
  const input = page.getByRole("textbox", { name: "Tin nhắn" });
  await input.fill("Line one"); await input.press("Shift+Enter"); await input.press("x");
  await expect(input).toHaveValue("Line one\nx"); expect(observed.runs).toHaveLength(0);
  await input.dispatchEvent("compositionstart"); await input.press("Enter");
  expect(observed.runs).toHaveLength(0);
  await input.dispatchEvent("compositionend"); await input.press("Enter");
  await expect(page.locator(".chat-assistant-message")).toContainText(answer); expect(observed.runs).toHaveLength(1);
});

for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }, { width: 1920, height: 1080 }]) {
  test(`responsive white SDK layout ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport); await page.emulateMedia({ colorScheme: "dark" });
    await openChat(page); await send(page, "https://example.com/" + "long-url".repeat(120));
    await expect(page.locator(".chat-assistant-message")).toContainText(answer);
    await expect(page.locator(".chat-shell")).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await expect(page.locator(".chat-shell")).toHaveCSS("color", "rgb(23, 23, 23)");
    await expect(page.locator(".chat-composer-card")).toHaveCSS("background-color", "rgb(244, 244, 244)");
    await expect(page.locator(".chat-user-message")).toHaveCSS("background-color", "rgb(241, 241, 241)");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const composer = await page.locator(".chat-composer-card").boundingBox();
    expect(composer).not.toBeNull(); expect(composer!.y + composer!.height).toBeLessThanOrEqual(viewport.height);
    if (viewport.width < 1024) {
      const toggle = page.getByRole("button", { name: "Mở điều hướng", exact: true });
      await toggle.click(); const drawer = page.getByRole("dialog", { name: "Điều hướng hội thoại" });
      await expect(drawer).toBeVisible();
      for (let i = 0; i < 5; i++) { await page.keyboard.press("Tab"); expect(await drawer.evaluate((el) => el.contains(document.activeElement))).toBe(true); }
      await page.keyboard.press("Escape"); await expect(drawer).not.toBeVisible(); await expect(toggle).toBeFocused();
    } else { await expect(page.locator("aside.chat-sidebar")).toBeVisible(); }
  });
}

test("long code stream preserves scroll position and focus until returning to the bottom", async ({ page, request }) => {
  const text = Array.from({ length: 100 }, (_, i) => `Paragraph ${i}: ${"Readable text ".repeat(10)}\n\n`).join("") + "```js\n" + "long_identifier".repeat(100) + "\n```";
  await scenario(request, "success", { text, chunkDelay: 20 }); await openChat(page); await send(page, "Long answer");
  const scroll = page.locator(".chat-transcript").locator("div").filter({ has: page.locator(".chat-column") });
  const scrollSelector = await scroll.evaluateAll((els) => {
    const el = els.find((item) => getComputedStyle(item).overflowY === "auto");
    if (el) el.setAttribute("data-test-scroll", "true");
    return Boolean(el);
  });
  expect(scrollSelector).toBe(true);
  const scroller = page.locator('[data-test-scroll="true"]');
  await expect.poll(() => scroller.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeGreaterThan(800);
  await scroller.hover();
  await page.mouse.wheel(0, -10_000);
  await expect.poll(() => scroller.evaluate((el) => el.scrollTop)).toBeLessThan(200);
  await page.getByRole("textbox", { name: "Tin nhắn" }).focus();
  await expect(page.getByRole("button", { name: "Dừng" })).toHaveCount(0);
  expect(await scroller.evaluate((el) => el.scrollTop)).toBeLessThan(200);
  await expect(page.getByRole("textbox", { name: "Tin nhắn" })).toBeFocused();
  await page.getByRole("button", { name: "Về cuối cuộc trò chuyện" }).click();
  await expect.poll(() => scroller.evaluate((el) => el.scrollHeight - el.clientHeight - el.scrollTop)).toBeLessThan(10);
  // Chromium page zoom is simulated by the equivalent smaller CSS viewport (200% at 1440x900).
  await page.setViewportSize({ width: 720, height: 450 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const composer = await page.locator(".chat-composer-card").boundingBox();
  expect(composer!.y + composer!.height).toBeLessThanOrEqual(450);
});

test("two browser contexts enforce one active run and recover the second", async ({ browser, request }) => {
  await scenario(request, "slow", { text: "First context streaming" });
  const first = await browser.newContext({ baseURL: "http://127.0.0.1:3101" });
  const second = await browser.newContext({ baseURL: "http://127.0.0.1:3101" });
  try {
    const a = await first.newPage(); const b = await second.newPage();
    await openChat(a); await openChat(b); await send(a, "First concurrent run");
    await expect(a.locator(".chat-assistant-message")).toContainText("First context streaming");
    await send(b, "Second concurrent run"); await expect(b.getByRole("status")).toHaveText("Chưa kết nối");
    await expect(b.getByRole("button", { name: "Dừng" })).toHaveCount(0);
    await request.post("http://127.0.0.1:4310/test/finish"); await expect(a.getByRole("button", { name: "Dừng" })).toHaveCount(0);
    await expect(a.getByRole("status")).toHaveCount(0);
    expect(await captureRequests(request)).toHaveLength(1);
  } finally { await first.close(); await second.close(); }
});
