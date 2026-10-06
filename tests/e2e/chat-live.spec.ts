import { expect, test } from "@playwright/test";
import { completed, composerGeometry, drawer, markdown, provider, readableCode, ready, send, target44, viewports, whiteShell } from "./chat-assertions";

for (const viewport of viewports) test(`real SDK Markdown and white theme ${viewport.width}×${viewport.height}`, async ({ page, request }) => {
  await provider(request, { content: markdown });
  await page.setViewportSize(viewport); await ready(page);
  await send(page, "https://example.com/" + "longidentifier".repeat(50));
  const assistant = page.locator(".chat-assistant-message");
  await expect(assistant.getByRole("heading", { name: "Phản hồi tiếng Việt", exact: true })).toBeVisible();
  await expect(assistant).toContainText("Đã hoàn tất."); await completed(page);
  await whiteShell(page); await composerGeometry(page);
  await expect(page.locator(".chat-user-message .copilotKitUserMessage > div").first()).toHaveCSS("background-color", "rgb(241, 241, 241)");
  await expect(assistant.locator(".copilotKitAssistantMessage")).toHaveCSS("color", "rgb(23, 23, 23)");
  await expect(assistant.locator("pre")).toHaveCSS("background-color", "rgb(244, 244, 244)");
  await expect(assistant.locator("pre code")).toHaveCSS("color", "rgb(23, 23, 23)");
  await readableCode(page);
  await expect(assistant.locator("table")).toHaveCount(1);
  for (const block of [assistant.locator("pre"), assistant.locator("table")]) {
    expect(await block.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
    expect(await block.evaluate((el) => { el.scrollLeft = 100; return el.scrollLeft; })).toBeGreaterThan(0);
  }
  // SDK Markdown/table/code controls and toolbars must not duplicate app Copy.
  await expect(assistant.getByRole("button")).toHaveCount(1);
  await expect(page.locator(".chat-user-message").getByRole("button")).toHaveCount(1);
  await target44(assistant.getByRole("button", { name: "Sao chép", exact: true }));
  const last = (await assistant.boundingBox())!, composer = (await page.locator(".chat-composer").boundingBox())!;
  expect(last.y + last.height).toBeLessThanOrEqual(composer.y);
  const requests = await (await request.get("http://127.0.0.1:4321/requests")).json();
  expect(requests).toHaveLength(1); expect(requests[0].body.model).toBe("test-model");
  expect(requests[0].authorization).toBe("Bearer test-only-key");
  if (viewport.width < 1024) await drawer(page);
});

test("keyboard Shift+Enter, composition guard, send and actual clipboard", async ({ page, request, context }) => {
  await provider(request); await ready(page);
  const input = page.getByRole("textbox", { name: "Tin nhắn", exact: true });
  await input.fill("Xin chào"); await input.press("Shift+Enter");
  await expect(input).toHaveValue("Xin chào\n");
  await input.dispatchEvent("compositionstart");
  await input.press("Enter"); await expect(page.locator(".chat-user-message")).toHaveCount(0);
  await input.dispatchEvent("compositionend"); await input.press("Enter");
  await expect(page.locator(".chat-user-message")).toHaveCount(1); await completed(page);
  await expect(input).toBeFocused();
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const copy = page.locator(".chat-assistant-message").getByRole("button", { name: "Sao chép", exact: true });
  await copy.focus(); await page.keyboard.press("Enter");
  await expect(page.locator(".chat-assistant-message").getByRole("status")).toHaveText("Đã sao chép");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("Xin chào! Tôi có thể giúp gì cho bạn?");
  await page.getByRole("button", { name: "Cuộc trò chuyện mới", exact: true }).click();
  await expect(page.locator(".chat-user-message, .chat-assistant-message")).toHaveCount(0);
  await expect(input).toHaveValue("");
});

test("textarea caps height and input length without page overflow", async ({ page, request }) => {
  await provider(request); await ready(page);
  const input = page.getByRole("textbox", { name: "Tin nhắn", exact: true });
  await input.fill("Dòng dài\n".repeat(100));
  await expect(input).toHaveCSS("height", "200px");
  expect(await input.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
  await input.fill("x".repeat(8_000)); await input.press("End"); await input.press("x");
  await expect(input).toHaveValue("x".repeat(8_000));
  await whiteShell(page); await composerGeometry(page);
  await expect(page.getByRole("button", { name: "Gửi tin nhắn", exact: true })).toBeEnabled();
});

test("stream follows bottom, detaches on scroll up, restores via 44px action without focus movement", async ({ page, request }) => {
  const content = Array.from({ length: 48 }, (_, n) => `Đoạn ${n + 1}: ` + "Nội dung tiếng Việt để kiểm tra vị trí cuộn. ".repeat(5)).join("\n\n");
  // Leave time for SDK smooth pinning to settle between genuine streamed chunks.
  await provider(request, { content, chunkSize: 800, delayMs: 1_000 });
  await ready(page); await send(page);
  const input = page.getByRole("textbox", { name: "Tin nhắn", exact: true }); await input.focus();
  // use-stick-to-bottom 1.1.6 puts the scroll ref on the content wrapper's parent.
  const scroll = page.locator('[data-chat-scroll] [class~="cpk:overflow-y-auto"]').locator("..");
  await expect.poll(() => scroll.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeGreaterThan(1_000);
  await expect.poll(() => scroll.evaluate((el) => el.scrollHeight - el.clientHeight - el.scrollTop)).toBeLessThan(10);
  await scroll.hover(); await page.mouse.wheel(0, -10_000);
  const bottom = page.getByRole("button", { name: "Về cuối cuộc trò chuyện", exact: true });
  await expect(bottom).toBeVisible(); await target44(bottom);
  const detached = await scroll.evaluate((el) => el.scrollTop);
  await expect(page.getByRole("button", { name: "Dừng trả lời", exact: true })).toBeVisible();
  const before = await page.locator(".chat-assistant-message").innerText();
  await expect.poll(() => page.locator(".chat-assistant-message").innerText()).not.toBe(before);
  expect(Math.abs(await scroll.evaluate((el) => el.scrollTop) - detached)).toBeLessThan(10);
  await expect(input).toBeFocused();
  await bottom.click(); await completed(page);
  await expect.poll(() => scroll.evaluate((el) => el.scrollHeight - el.clientHeight - el.scrollTop)).toBeLessThan(10);
  const last = (await page.locator(".chat-assistant-message").boundingBox())!, composer = (await page.locator(".chat-composer").boundingBox())!;
  expect(last.y + last.height).toBeLessThanOrEqual(composer.y);
});
