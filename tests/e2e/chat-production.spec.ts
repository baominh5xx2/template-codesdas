import { test, expect } from "@playwright/test";
test("built production app masks unavailable chat and disables demo fixtures", async ({ page, request }) => {
  await page.goto("/"); await expect(page.getByRole("status")).toHaveText("Chưa kết nối");
  await expect(page.getByRole("button", { name: "Gửi", exact: true })).toBeDisabled();
  expect(await (await request.get("/api/chat/readiness")).json()).toEqual({ available: false, agentId: "default" });
  const info = await request.get("/api/copilotkit/info"); expect(info.status()).toBe(503);
  expect((await info.json()).message).toBe("Chưa kết nối");
  expect((await request.get("/api/demo/document-review")).status()).toBe(503);
  expect((await request.get("/api/demo/datasets/sales-quarterly/rows")).status()).toBe(503);
  expect((await request.post("/api/runs")).status()).toBe(501);
});
