import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/chat/readiness/route";

describe("GET /api/chat/readiness", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.CHAT_MODEL_BASE_URL;
    delete process.env.CHAT_MODEL_ID;
    delete process.env.CHAT_MODEL_API_KEY;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("returns unavailable readiness when no chat environment variables are set", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const response = GET();

    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toEqual({
      available: false,
      agentId: "default",
    });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns available readiness when valid chat environment variables are set without leaking secrets", async () => {
    process.env.CHAT_MODEL_BASE_URL = "http://127.0.0.1:4010/v1";
    process.env.CHAT_MODEL_ID = "gpt-4o-mini";
    process.env.CHAT_MODEL_API_KEY = "test-sk-supersecret-token";

    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const response = GET();

    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toEqual({
      available: true,
      agentId: "default",
    });

    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("test-sk-supersecret-token");
    expect(serialized).not.toContain("http://127.0.0.1:4010/v1");
    expect(serialized).not.toContain("gpt-4o-mini");

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns unavailable readiness when chat environment variables are invalid", async () => {
    process.env.CHAT_MODEL_BASE_URL = "file:///private";
    process.env.CHAT_MODEL_ID = "m";

    const response = GET();
    expect(response.headers.get("Cache-Control")).toBe("no-store");

    const body = await response.json();
    expect(body).toEqual({
      available: false,
      agentId: "default",
    });
  });
});
