import { afterEach, expect, it } from "vitest";
import { GET as getDomains } from "@/app/api/domains/route";
import { GET as getDemo } from "@/app/api/demo/[domainId]/route";
import { GET as getRows } from "@/app/api/demo/datasets/[datasetId]/rows/route";
import { POST as postRun } from "@/app/api/runs/route";

const originalMode = process.env.NODE_ENV;
afterEach(() => { if (originalMode === undefined) Reflect.deleteProperty(process.env, "NODE_ENV"); else Reflect.set(process.env, "NODE_ENV", originalMode); });

it("serves domain manifests and validated synthetic bundles in development", async () => {
  Reflect.set(process.env, "NODE_ENV", "development");
  const domains = await getDomains();
  expect(domains.status).toBe(200);
  expect((await domains.json()).domains).toHaveLength(4);
  const demo = await getDemo(new Request("http://localhost/api/demo/document-review"), { params: Promise.resolve({ domainId: "document-review" }) });
  expect(demo.status).toBe(200);
  expect((await demo.json()).label).toContain("Demo");
});

it("returns typed errors for unknown domain and invalid state", async () => {
  Reflect.set(process.env, "NODE_ENV", "development");
  const unknown = await getDemo(new Request("http://localhost/api/demo/nope"), { params: Promise.resolve({ domainId: "nope" }) });
  expect(unknown.status).toBe(404);
  const invalid = await getDemo(new Request("http://localhost/api/demo/dataset-analysis?state=bogus"), { params: Promise.resolve({ domainId: "dataset-analysis" }) });
  expect(invalid.status).toBe(400);
  expect((await invalid.json()).error.code).toBe("invalid_request");
});

it("validates pagination and returns rows with the preserved total", async () => {
  Reflect.set(process.env, "NODE_ENV", "development");
  const response = await getRows(new Request("http://localhost/api/demo/datasets/sales-quarterly/rows?offset=1&limit=2"), { params: Promise.resolve({ datasetId: "sales-quarterly" }) });
  expect(response.status).toBe(200);
  const page = await response.json();
  expect(page.rows).toHaveLength(2);
  expect(page.offset).toBe(1);
  expect(page.total).toBeGreaterThan(2);
});

it("disables fixtures in production and leaves run execution unavailable", async () => {
  Reflect.set(process.env, "NODE_ENV", "production");
  const demo = await getDemo(new Request("http://localhost/api/demo/document-review"), { params: Promise.resolve({ domainId: "document-review" }) });
  expect(demo.status).toBe(503);
  const run = await postRun();
  expect(run.status).toBe(501);
  expect((await run.json()).error.code).toBe("feature_unavailable");
});
