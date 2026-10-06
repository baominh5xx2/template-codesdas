import { expect, test } from "@playwright/test";
import { composerGeometry, drawer, notice, viewports } from "./chat-assertions";

for (const viewport of viewports) test(`release build: one white notice ${viewport.width}×${viewport.height}`, async ({ page, request }) => {
  await page.setViewportSize(viewport); await page.goto("/");
  await notice(page); await composerGeometry(page);
  if (viewport.width < 1024) await drawer(page);
  const input = page.getByRole("textbox", { name: "Tin nhắn", exact: true }); await input.fill("Bản nháp production");
  await input.press("Enter"); await expect(input).toHaveValue("Bản nháp production");
  await expect(page.locator(".chat-user-message, .chat-assistant-message")).toHaveCount(0);
  const fixture = await request.get("/api/demo/document-review");
  expect(fixture.status()).toBe(503);
  expect(await fixture.json()).toMatchObject({ error: { code: "feature_unavailable", retryable: false } });
  await page.goto("/playground");
  await expect(page.getByRole("heading", { name: "Fixture Playground", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Fixture JSON", exact: true })).toHaveCount(0);
  await expect(page.getByText("Demo fixtures are unavailable in production.", { exact: false })).toBeVisible();
});
