import { expect, it } from "vitest";
import { loadServerEnv } from "@/server/env";
import { GET } from "@/app/api/health/route";

it("boots a skeleton without external configuration", async () => {
  expect(loadServerEnv({}).APP_MODE).toBe("skeleton");
  expect(await GET().json()).toMatchObject({
    status: "ok",
    mode: "skeleton",
    version: "1.0.0",
  });
});
