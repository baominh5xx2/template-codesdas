import { test, expect } from "@playwright/test";
test("existing integration contracts remain available", async ({ request }) => {
  const health = await request.get("/api/health");
  expect(health.status()).toBe(200);
  expect(await health.json()).toMatchObject({ status: "ok", mode: "skeleton" });
  const domains = await request.get("/api/domains");
  expect(domains.status()).toBe(200);
  expect((await domains.json()).domains).toHaveLength(4);
  const demo = await request.get("/api/demo/document-review");
  expect(demo.status()).toBe(200); expect((await demo.json()).label).toContain("Demo");
  const rows = await request.get("/api/demo/datasets/sales-quarterly/rows?offset=1&limit=2");
  expect(rows.status()).toBe(200);
  expect(await rows.json()).toMatchObject({ offset: 1, rows: [expect.anything(), expect.anything()] });
  const run = await request.post("/api/runs");
  expect(run.status()).toBe(501); expect((await run.json()).error.code).toBe("feature_unavailable");
});
