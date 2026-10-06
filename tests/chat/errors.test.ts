import { describe, expect, it, vi } from "vitest";
import {
  chatFailureResponse,
  emitChatDiagnostic,
  type ChatDiagnostic,
} from "@/server/chat/errors";
import { CHAT_NOTICE } from "@/contracts/chat";

describe("chatFailureResponse", () => {
  it("produces standard chat_unavailable envelope with 503 status and no-store header", async () => {
    const response = chatFailureResponse(503);
    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");

    const payload = await response.json();
    expect(payload).toEqual({
      code: "chat_unavailable",
      message: CHAT_NOTICE,
    });
    expect(payload.message).toBe("Chưa kết nối");
  });

  it("produces standard chat_unavailable envelope with 500 status", async () => {
    const response = chatFailureResponse(500);
    expect(response.status).toBe(500);
    expect(response.headers.get("Cache-Control")).toBe("no-store");

    const payload = await response.json();
    expect(payload).toEqual({
      code: "chat_unavailable",
      message: "Chưa kết nối",
    });
  });
});

describe("emitChatDiagnostic", () => {
  it("forwards clean allowlisted fields to the diagnostic sink", () => {
    const sink = vi.fn();
    const record: ChatDiagnostic = {
      code: "missing_config",
      traceId: "trace-abc-123",
      phase: "readiness",
    };

    emitChatDiagnostic(sink, record);

    expect(sink).toHaveBeenCalledTimes(1);
    expect(sink).toHaveBeenCalledWith({
      code: "missing_config",
      traceId: "trace-abc-123",
      phase: "readiness",
    });
  });

  it("includes optional runId and durationMs when present", () => {
    const sink = vi.fn();
    const record: ChatDiagnostic = {
      code: "provider_failed",
      traceId: "trace-xyz",
      runId: "run-456",
      phase: "execution",
      durationMs: 125,
    };

    emitChatDiagnostic(sink, record);

    expect(sink).toHaveBeenCalledTimes(1);
    expect(sink).toHaveBeenCalledWith({
      code: "provider_failed",
      traceId: "trace-xyz",
      runId: "run-456",
      phase: "execution",
      durationMs: 125,
    });
  });

  it("reconstructs allowlisted fields and strips raw errors, secrets, and prototype pollution", () => {
    const sink = vi.fn();
    const pollutedInput = {
      code: "provider_failed",
      traceId: "trace-polluted",
      phase: "execution",
      runId: "run-safe",
      rawError: new Error("sensitive backend stack trace"),
      apiKey: "sk-super-secret",
      stack: "Error at line 123",
      extraMetadata: { internalIp: "10.0.0.1" },
    } as unknown as ChatDiagnostic;

    emitChatDiagnostic(sink, pollutedInput);

    expect(sink).toHaveBeenCalledTimes(1);
    const emitted = sink.mock.calls[0][0];

    expect(emitted).toEqual({
      code: "provider_failed",
      traceId: "trace-polluted",
      phase: "execution",
      runId: "run-safe",
    });

    expect(emitted).not.toHaveProperty("rawError");
    expect(emitted).not.toHaveProperty("apiKey");
    expect(emitted).not.toHaveProperty("stack");
    expect(emitted).not.toHaveProperty("extraMetadata");
    expect(JSON.stringify(emitted)).not.toContain("sk-super-secret");
    expect(JSON.stringify(emitted)).not.toContain("sensitive");
  });
});
