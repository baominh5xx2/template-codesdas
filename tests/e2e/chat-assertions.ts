import { expect, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import type { ChatProviderScenario } from "../helpers/chat-provider";

export const viewports = [{ width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }, { width: 1920, height: 1080 }];
export const markdown = [
  "## Phản hồi tiếng Việt",
  "Đọc **nội dung rõ ràng**, dùng `inline_code`, và danh sách:",
  "- Mục một\n- Mục hai",
  "```typescript\nconst greeting = 'Xin chào';\nconst longIdentifier = '" + "abcdefghij".repeat(35) + "';\n```",
  "| Tên | Giá trị |\n| --- | --- |\n| Tiếng Việt | " + "WideColumn".repeat(40) + " |",
  "Đã hoàn tất.",
].join("\n\n");

export async function provider(request: APIRequestContext, options: { scenario?: ChatProviderScenario; status?: 401 | 429 | 500; content?: string; chunkSize?: number; delayMs?: number } = {}) {
  const response = await request.post("http://127.0.0.1:4321/scenario", { data: { scenario: "success", ...options } });
  expect(response.ok()).toBe(true);
}

export async function ready(page: Page) {
  await page.goto("/");
  await expect(page.locator("[data-chat-scroll]")).toBeVisible();
  await expect(page.locator(".chat-connection-notice")).toHaveCount(0);
}

export async function send(page: Page, text = "Xin chào") {
  await page.getByRole("textbox", { name: "Tin nhắn", exact: true }).fill(text);
  const send = page.getByRole("button", { name: "Gửi tin nhắn", exact: true });
  await expect(send).toHaveCSS("background-color", "rgb(23, 23, 23)");
  await expect(send).toHaveCSS("color", "rgb(255, 255, 255)");
  await send.click();
}

export async function completed(page: Page) {
  await expect(page.getByRole("button", { name: "Dừng trả lời", exact: true })).toHaveCount(0);
  await expect(page.locator(".chat-assistant-message")).toHaveCount(1);
  await expect(page.locator(".chat-connection-notice")).toHaveCount(0);
}

export async function whiteShell(page: Page) {
  await expect(page.locator('[data-chat-theme="light"]')).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(page.locator('[data-chat-theme="light"]')).toHaveCSS("color", "rgb(23, 23, 23)");
  await expect(page.locator('[data-chat-theme="light"]')).toHaveCSS("color-scheme", "light");
  await expect(page.locator(".chat-header")).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(page.locator(".chat-composer")).toHaveCSS("background-color", "rgb(244, 244, 244)");
  await expect(page.getByRole("textbox", { name: "Tin nhắn", exact: true })).toHaveCSS("color", "rgb(23, 23, 23)");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
}

export async function target44(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
}

export async function composerGeometry(page: Page) {
  const main = (await page.locator(".chat-main").boundingBox())!;
  const column = (await page.locator(".chat-composer-row .chat-column").boundingBox())!;
  const composer = (await page.locator(".chat-composer").boundingBox())!;
  const transcript = (await page.locator(".chat-transcript").boundingBox())!;
  expect(column.width).toBeLessThanOrEqual(768);
  expect(Math.abs(column.x + column.width / 2 - main.x - main.width / 2)).toBeLessThan(1);
  expect(transcript.y + transcript.height).toBeLessThanOrEqual(composer.y);
  expect(composer.y + composer.height).toBeLessThanOrEqual(page.viewportSize()!.height - 11);
}

export async function notice(page: Page) {
  await expect(page.getByText("Chưa kết nối", { exact: true })).toHaveCount(1);
  await expect(page.locator(".chat-connection-notice")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Thử lại", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Gửi tin nhắn", exact: true })).toBeDisabled();
  await expect(page.locator("body")).not.toContainText(/RAW_SECRET_ERROR|invalid_api_key|unauthorized key|Stack trace|test-only-key|chatcmpl-test/);
  await whiteShell(page);
}

export async function drawer(page: Page) {
  const trigger = page.getByRole("button", { name: "Mở điều hướng", exact: true });
  await trigger.focus(); await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Điều hướng hội thoại", exact: true });
  await expect(dialog).toBeVisible();
  const close = dialog.getByRole("button", { name: "Đóng điều hướng", exact: true });
  const newChat = dialog.getByRole("button", { name: "Cuộc trò chuyện mới", exact: true });
  await expect(close).toBeFocused();
  await page.keyboard.press("Shift+Tab"); await expect(newChat).toBeFocused();
  await page.keyboard.press("Tab"); await expect(close).toBeFocused();
  await page.keyboard.press("Tab"); await expect(newChat).toBeFocused();
  await page.keyboard.press("Tab"); await expect(close).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible(); await expect(trigger).toBeFocused();
  await trigger.click();
  await page.mouse.click(page.viewportSize()!.width - 10, 100);
  await expect(dialog).not.toBeVisible(); await expect(trigger).toBeFocused();
}

// Read actual computed colors, including syntax-highlighted descendants.
export async function readableCode(page: Page) {
  const contrasts = await page.locator(".chat-assistant-message pre").evaluateAll((blocks) => {
    const luminance = (color: string) => {
      const values = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map((v) => {
        const s = v / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      });
      return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
    };
    return blocks.flatMap((block) => [block, ...block.querySelectorAll("code, span")].filter((el) => el.textContent?.trim()).map((el) => {
      const fg = luminance(getComputedStyle(el).color), bg = luminance(getComputedStyle(block).backgroundColor);
      return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
    }));
  });
  expect(contrasts.length).toBeGreaterThan(0);
  for (const contrast of contrasts) expect(contrast).toBeGreaterThanOrEqual(4.5);
}
