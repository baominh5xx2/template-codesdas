import { expect, it } from "vitest";
import { loadServerEnv } from "@/server/env";
import { toPublicError } from "@/contracts/errors";

it("loads a skeleton environment without backend configuration", () => {
  expect(loadServerEnv({})).toMatchObject({ APP_MODE: "skeleton" });
});

it("keeps backend configuration optional and masks internal credentials", () => {
  expect(loadServerEnv({
    DATABASE_URL: "postgres://local/test",
    SESSION_SECRET: "a".repeat(32),
  })).toMatchObject({
    APP_MODE: "skeleton",
    DATABASE_URL: "postgres://local/test",
  });
  const error = toPublicError(new Error("token=private-value"), "trace-1");
  expect(JSON.stringify(error)).not.toContain("private-value");
  expect(error).toMatchObject({
    code: "internal_error",
    retryable: false,
    traceId: "trace-1",
  });
  expect(error.traceId).toBe("trace-1");
});

it("rejects malformed optional backend configuration", () => {
  expect(() => loadServerEnv({ SESSION_SECRET: "too-short" })).toThrow();
});

it("keeps Business MCP disabled in the parsed backend environment", () => {
  expect(loadServerEnv({ MCP_AUTH_TOKEN: "pgedge-only-secret" })).toMatchObject({ businessMcp: { enabled: false } });
});

it("requires dedicated Business MCP credentials when enabled", () => {
  expect(() => loadServerEnv({ BUSINESS_MCP_ENABLED: "true", MCP_AUTH_TOKEN: "pgedge-only-secret" })).toThrow("business_mcp_config_invalid");
});
