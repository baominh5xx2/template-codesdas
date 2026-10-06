import { expect, test } from "@playwright/test";

test("existing playground and fixture contracts remain available in development", async ({ page, request }) => {
  await page.goto("/playground");
  await expect(page.getByRole("heading", { name: "Fixture Playground", exact: true })).toBeVisible();
  await expect(page.locator("[data-chat-theme]")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Fixture JSON", exact: true })).toHaveCount(4);
  await expect(page.locator("html")).toHaveCSS("background-color", "rgb(246, 247, 242)");
  await expect(page.locator("html")).toHaveCSS("font-family", '"Segoe UI", Arial, sans-serif');
  expect(await (await request.get("/api/health")).json()).toEqual({ status: "ok", mode: "skeleton", version: "1.0.0" });
  const domains = await (await request.get("/api/domains")).json(); expect(domains.domains).toHaveLength(4);
  for (const link of await page.getByRole("link", { name: "Fixture JSON", exact: true }).all()) {
    const response = await request.get((await link.getAttribute("href"))!);
    expect(response.ok()).toBe(true); expect(response.headers()["content-type"]).toContain("application/json");
  }
});
