import { expect, test } from "@playwright/test";
import { composerGeometry, drawer, notice, target44, viewports } from "./chat-assertions";

for (const viewport of viewports) test(`no configuration: white layout ${viewport.width}×${viewport.height}`, async ({ page }) => {
  await page.setViewportSize(viewport); await page.goto("/");
  await notice(page); await composerGeometry(page);
  await expect(page.getByRole("heading", { name: "Bạn muốn hỏi gì?", exact: true })).toBeVisible();
  const input = page.getByRole("textbox", { name: "Tin nhắn", exact: true });
  await input.fill("Draft không mất khi thử lại"); await input.press("Enter");
  await expect(input).toHaveValue("Draft không mất khi thử lại");
  await expect(page.locator(".chat-user-message, .chat-assistant-message")).toHaveCount(0);
  await page.getByRole("button", { name: "Thử lại", exact: true }).click();
  await notice(page); await expect(input).toHaveValue("Draft không mất khi thử lại");
  await target44(page.getByRole("button", { name: "Gửi tin nhắn", exact: true }));
  if (viewport.width < 1024) await drawer(page);
  else {
    await expect(page.locator(".chat-sidebar")).toHaveCSS("width", "280px");
    await page.getByRole("button", { name: "Thu gọn điều hướng", exact: true }).click();
    await expect(page.getByRole("button", { name: "Mở điều hướng", exact: true })).toBeFocused();
    await composerGeometry(page);
    await page.getByRole("button", { name: "Mở điều hướng", exact: true }).click();
  }
  await expect(page.getByRole("navigation", { name: "Điều hướng", exact: true }).getByRole("button")).toHaveCount(viewport.width < 1024 ? 0 : 1);
});

test("mobile emulation and visual viewport resize retain composer geometry", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: "dark" });
  const page = await context.newPage();
  await page.goto("http://localhost:3212/"); await notice(page);
  await page.getByRole("textbox", { name: "Tin nhắn", exact: true }).focus();
  await page.setViewportSize({ width: 390, height: 480 });
  expect(await page.evaluate(() => visualViewport!.height)).toBe(480);
  await composerGeometry(page); await notice(page);
  await context.close();
});
