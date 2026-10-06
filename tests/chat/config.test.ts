import { describe, expect, it } from "vitest";
import { loadChatConfig, getChatReadiness } from "@/server/chat/config";
import { resolveLocalChatIdentity } from "@/server/chat/identity";
import { CHAT_NOTICE, CHAT_LIMITS } from "@/contracts/chat";

describe("loadChatConfig", () => {
  it("returns missing_config when no configuration is provided", () => {
    expect(loadChatConfig({})).toEqual({ available: false, cause: "missing_config" });
  });

  it("returns missing_config when both baseUrl and modelId are whitespace", () => {
    expect(
      loadChatConfig({ CHAT_MODEL_BASE_URL: "   ", CHAT_MODEL_ID: "   " })
    ).toEqual({ available: false, cause: "missing_config" });
  });

  it("returns missing_config when only apiKey is provided without the required pair", () => {
    expect(
      loadChatConfig({ CHAT_MODEL_API_KEY: "sk-orphan" })
    ).toEqual({ available: false, cause: "missing_config" });
  });

  it("returns invalid_config for non-http(s) baseUrl", () => {
    expect(
      loadChatConfig({ CHAT_MODEL_BASE_URL: "file:///private", CHAT_MODEL_ID: "m" })
    ).toEqual({ available: false, cause: "invalid_config" });

    expect(
      loadChatConfig({ CHAT_MODEL_BASE_URL: "ftp://127.0.0.1:4010/v1", CHAT_MODEL_ID: "m" })
    ).toEqual({ available: false, cause: "invalid_config" });
  });

  it("returns invalid_config for malformed URL string", () => {
    expect(
      loadChatConfig({ CHAT_MODEL_BASE_URL: "not-a-valid-url", CHAT_MODEL_ID: "m" })
    ).toEqual({ available: false, cause: "invalid_config" });
  });

  it("returns invalid_config when baseUrl contains userinfo credentials", () => {
    expect(
      loadChatConfig({
        CHAT_MODEL_BASE_URL: "http://user:pass@127.0.0.1:4010/v1",
        CHAT_MODEL_ID: "m",
      })
    ).toEqual({ available: false, cause: "invalid_config" });

    expect(
      loadChatConfig({
        CHAT_MODEL_BASE_URL: "http://user@127.0.0.1:4010/v1",
        CHAT_MODEL_ID: "m",
      })
    ).toEqual({ available: false, cause: "invalid_config" });
  });

  it("returns invalid_config when modelId is empty or whitespace", () => {
    expect(
      loadChatConfig({
        CHAT_MODEL_BASE_URL: "http://127.0.0.1:4010/v1",
        CHAT_MODEL_ID: "   ",
      })
    ).toEqual({ available: false, cause: "invalid_config" });
  });

  it("returns invalid_config when only baseUrl is provided", () => {
    expect(
      loadChatConfig({ CHAT_MODEL_BASE_URL: "http://127.0.0.1:4010/v1" })
    ).toEqual({ available: false, cause: "invalid_config" });
  });

  it("returns invalid_config when only modelId is provided", () => {
    expect(
      loadChatConfig({ CHAT_MODEL_ID: "gpt-4o" })
    ).toEqual({ available: false, cause: "invalid_config" });
  });

  it("loads valid configuration with trimmed baseUrl and modelId without apiKey", () => {
    expect(
      loadChatConfig({
        CHAT_MODEL_BASE_URL: "  http://127.0.0.1:4010/v1  ",
        CHAT_MODEL_ID: "  m  ",
      })
    ).toEqual({
      available: true,
      config: { baseUrl: "http://127.0.0.1:4010/v1", modelId: "m" },
    });
  });

  it("treats optional blank apiKey as absent", () => {
    expect(
      loadChatConfig({
        CHAT_MODEL_BASE_URL: "http://127.0.0.1:4010/v1",
        CHAT_MODEL_ID: "m",
        CHAT_MODEL_API_KEY: "   ",
      })
    ).toEqual({
      available: true,
      config: { baseUrl: "http://127.0.0.1:4010/v1", modelId: "m" },
    });
  });

  it("trims and includes optional apiKey when provided", () => {
    expect(
      loadChatConfig({
        CHAT_MODEL_BASE_URL: "http://127.0.0.1:4010/v1",
        CHAT_MODEL_ID: "m",
        CHAT_MODEL_API_KEY: "  sk-secret-123  ",
      })
    ).toEqual({
      available: true,
      config: {
        baseUrl: "http://127.0.0.1:4010/v1",
        modelId: "m",
        apiKey: "sk-secret-123",
      },
    });
  });
});

describe("getChatReadiness", () => {
  it("projects unavailable readiness when config is missing", () => {
    expect(getChatReadiness(loadChatConfig({}))).toEqual({
      available: false,
      agentId: "default",
    });
  });

  it("projects unavailable readiness when config is invalid", () => {
    expect(
      getChatReadiness(
        loadChatConfig({ CHAT_MODEL_BASE_URL: "file:///private", CHAT_MODEL_ID: "m" })
      )
    ).toEqual({
      available: false,
      agentId: "default",
    });
  });

  it("projects available readiness without exposing credentials or URLs", () => {
    const readiness = getChatReadiness(
      loadChatConfig({
        CHAT_MODEL_BASE_URL: "http://127.0.0.1:4010/v1",
        CHAT_MODEL_ID: "m",
        CHAT_MODEL_API_KEY: "private-secret-key",
      })
    );

    expect(readiness).toEqual({
      available: true,
      agentId: "default",
    });
    expect(JSON.stringify(readiness)).not.toContain("private-secret-key");
    expect(JSON.stringify(readiness)).not.toContain("4010");
  });
});

describe("resolveLocalChatIdentity", () => {
  it("resolves untrusted local-operator scope", () => {
    expect(resolveLocalChatIdentity()).toEqual({
      userId: "local-operator",
      workspaceId: "local-workspace",
      trustedOperator: false,
    });
  });
});

describe("Chat contracts constants", () => {
  it("maintains strict CHAT_NOTICE technical copy", () => {
    expect(CHAT_NOTICE).toBe("Chưa kết nối");
  });

  it("enforces immutable chat limits", () => {
    expect(CHAT_LIMITS).toEqual({
      inputChars: 8_000,
      bodyBytes: 262_144,
      deadlineMs: 120_000,
      outputTokens: 2_048,
      retries: 0,
      steps: 1,
      toolSteps: 4,
    });
  });
});
