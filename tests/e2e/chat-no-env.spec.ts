import { test, expect } from "@playwright/test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
test("no configuration keeps an editable draft and never starts a run", async ({ page, request }) => {
  const runs: string[] = [];
  page.on("request", (req) => { if (req.url().endsWith("/agent/default/run")) runs.push(req.url()); });
  await page.emulateMedia({ colorScheme: "dark" }); await page.goto("/");
  await expect(page.getByRole("status")).toHaveText("Chưa kết nối");
  const input = page.getByRole("textbox", { name: "Tin nhắn" });
  await input.fill("Draft remains editable"); await input.press("Enter");
  await expect(input).toHaveValue("Draft remains editable");
  await expect(page.getByRole("button", { name: "Gửi", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Thử lại" }).click();
  await expect(page.getByRole("status")).toHaveCount(1); expect(runs).toHaveLength(0);
  await expect(page.getByText("RAW_SECRET_ERROR")).toHaveCount(0);
  await expect(page.locator(".chat-shell")).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(page.locator(".chat-shell")).toHaveCSS("color", "rgb(23, 23, 23)");
  await expect(page.locator(".chat-composer-card")).toHaveCSS("background-color", "rgb(244, 244, 244)");
  expect(await (await request.get("/api/chat/readiness")).json()).toEqual({ available: false, agentId: "default" });
  const info = await request.get("/api/copilotkit/info"); expect(info.status()).toBe(503);
  expect((await info.json()).message).toBe("Chưa kết nối");
});

test("smoke CLI verifies unavailable contract without printing model/config data", async ({ baseURL }) => {
  const result = await promisify(execFile)("bun", ["run", "chat:smoke"], { env: { ...process.env, CHAT_SMOKE_URL: baseURL } });
  expect(JSON.parse(result.stdout.trim())).toEqual({ readiness: false, result: "unavailable_contract_pass", checks: 3 });
});
