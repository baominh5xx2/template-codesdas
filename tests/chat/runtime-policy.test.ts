import { describe, it, expect, vi } from "vitest";
import { Observable, Subject, throwError, of } from "rxjs";
import { createExecutionGate } from "@/adapters/agents/chat-policy";
import { createChatPolicy } from "@/adapters/agents/chat-policy";
import { CHAT_NOTICE } from "@/contracts/chat";
import type { ChatDiagnostic } from "@/server/chat/errors";

type PolicyTestEvent = {
  type: string;
  message?: string;
  delta?: string;
  rawError?: unknown;
};

type PolicyRunner = {
  run(
    input: { threadId: string; runId: string; messages: unknown[] },
    next: { run: () => Observable<unknown>; abortRun: () => void }
  ): Observable<PolicyTestEvent>;
};

describe("createExecutionGate", () => {
  it("enforces single active execution lease with exact threadId and runId matching", () => {
    const gate = createExecutionGate();

    expect(gate.acquire("t1", "r1")).toBe(true);
    expect(gate.acquire("t2", "r2")).toBe(false);

    // Stale runId release has no effect
    gate.release("t1", "stale");
    expect(gate.acquire("t2", "r2")).toBe(false);

    // Stale threadId release has no effect
    gate.release("stale", "r1");
    expect(gate.acquire("t2", "r2")).toBe(false);

    // Exact matching lease releases
    gate.release("t1", "r1");
    expect(gate.acquire("t2", "r2")).toBe(true);

    // After t2/r2 is acquired, new acquire fails
    expect(gate.acquire("t3", "r3")).toBe(false);
    gate.release("t2", "r2");
    expect(gate.acquire("t3", "r3")).toBe(true);
  });
});

describe("createChatPolicy", () => {
  it("rejects concurrent runs with typed RUN_ERROR 'Chưa kết nối' and emits diagnostic", async () => {
    const gate = createExecutionGate();
    gate.acquire("existing-t", "existing-r"); // Occupy gate

    const diagnostics: ChatDiagnostic[] = [];
    const policy = createChatPolicy({
      gate,
      diagnostics: (d) => diagnostics.push(d),
    }) as unknown as PolicyRunner;

    const nextRun = vi.fn();
    const result$ = policy.run(
      {
        threadId: "t2",
        runId: "r2",
        messages: [],
      },
      {
        run: nextRun,
        abortRun: vi.fn(),
      }
    );

    const events: PolicyTestEvent[] = [];
    await new Promise<void>((resolve, reject) => {
      result$.subscribe({
        next: (ev) => events.push(ev),
        error: reject,
        complete: resolve,
      });
    });

    expect(nextRun).not.toHaveBeenCalled();
    expect(events.length).toBe(1);
    expect(events[0].type).toBe("RUN_ERROR");
    expect(events[0].message).toBe(CHAT_NOTICE);
    expect(diagnostics.some((d) => d.code === "conflict")).toBe(true);
  });

  it("passes normal lifecycle events and sanitizes RUN_ERROR messages", async () => {
    const gate = createExecutionGate();
    const diagnostics: ChatDiagnostic[] = [];
    const policy = createChatPolicy({
      gate,
      diagnostics: (d) => diagnostics.push(d),
    }) as unknown as PolicyRunner;

    const upstream$ = of(
      { type: "RUN_STARTED", threadId: "t1", runId: "r1" },
      { type: "TEXT_DELTA", delta: "Hello" },
      {
        type: "RUN_ERROR",
        message: "RAW_SECRET_ERROR: OpenAI API key invalid or rate limited",
        rawError: { status: 401, detail: "secret-key-12345" },
      }
    );

    const result$ = policy.run(
      { threadId: "t1", runId: "r1", messages: [] },
      { run: () => upstream$, abortRun: vi.fn() }
    );

    const events: PolicyTestEvent[] = [];
    await new Promise<void>((resolve, reject) => {
      result$.subscribe({
        next: (ev) => events.push(ev),
        error: reject,
        complete: resolve,
      });
    });

    expect(events.length).toBe(3);
    expect(events[0].type).toBe("RUN_STARTED");
    expect(events[1].type).toBe("TEXT_DELTA");
    expect(events[2].type).toBe("RUN_ERROR");
    expect(events[2].message).toBe(CHAT_NOTICE);
    expect(events[2].rawError).toBeUndefined();
    expect(JSON.stringify(events[2])).not.toContain("RAW_SECRET_ERROR");
  });

  it("converts thrown exceptions into sanitized RUN_ERROR and completes", async () => {
    const gate = createExecutionGate();
    const diagnostics: ChatDiagnostic[] = [];
    const policy = createChatPolicy({
      gate,
      diagnostics: (d) => diagnostics.push(d),
    }) as unknown as PolicyRunner;

    const upstream$ = throwError(
      () => new Error("RAW_SECRET_ERROR: connection refused to http://internal:8080")
    );

    const result$ = policy.run(
      { threadId: "t1", runId: "r1", messages: [] },
      { run: () => upstream$, abortRun: vi.fn() }
    );

    const events: PolicyTestEvent[] = [];
    await new Promise<void>((resolve, reject) => {
      result$.subscribe({
        next: (ev) => events.push(ev),
        error: reject,
        complete: resolve,
      });
    });

    expect(events.length).toBe(1);
    expect(events[0].type).toBe("RUN_ERROR");
    expect(events[0].message).toBe(CHAT_NOTICE);
    expect(JSON.stringify(events[0])).not.toContain("RAW_SECRET_ERROR");
    expect(
      diagnostics.some((d) => d.code === "provider_failed" || d.code === "stream_failed")
    ).toBe(true);

    // Gate must be released
    expect(gate.acquire("t2", "r2")).toBe(true);
  });

  it("aborts and emits sanitized RUN_ERROR when deadline expires", async () => {
    vi.useFakeTimers();
    try {
      const gate = createExecutionGate();
      const diagnostics: ChatDiagnostic[] = [];
      const abortRunMock = vi.fn();

      const policy = createChatPolicy({
        gate,
        diagnostics: (d) => diagnostics.push(d),
        deadlineMs: 500, // Short deadline for fake timers
      }) as unknown as PolicyRunner;

      // Upstream that hangs indefinitely
      const upstream$ = new Observable<unknown>(() => {
        // never emits or completes
      });

      const result$ = policy.run(
        { threadId: "t1", runId: "r1", messages: [] },
        { run: () => upstream$, abortRun: abortRunMock }
      );

      const events: PolicyTestEvent[] = [];
      let completed = false;
      result$.subscribe({
        next: (ev) => events.push(ev),
        complete: () => {
          completed = true;
        },
      });

      // Advance past deadline
      vi.advanceTimersByTime(500);

      expect(abortRunMock).toHaveBeenCalled();
      expect(completed).toBe(true);
      expect(events.length).toBe(1);
      expect(events[0].type).toBe("RUN_ERROR");
      expect(events[0].message).toBe(CHAT_NOTICE);
      expect(diagnostics.some((d) => d.code === "timeout")).toBe(true);

      // Gate must be released after timeout
      expect(gate.acquire("t2", "r2")).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("fences late emissions after terminal/abort before gate release", async () => {
    const gate = createExecutionGate();
    const policy = createChatPolicy({
      gate,
      diagnostics: () => {},
    }) as unknown as PolicyRunner;

    const subject = new Subject<PolicyTestEvent>();
    const result$ = policy.run(
      { threadId: "t1", runId: "r1", messages: [] },
      { run: () => subject.asObservable(), abortRun: vi.fn() }
    );

    const events: PolicyTestEvent[] = [];
    result$.subscribe({
      next: (ev) => events.push(ev),
    });

    subject.next({ type: "TEXT_DELTA", delta: "Hello" });
    subject.next({ type: "RUN_ERROR", message: "Initial failure" });

    // Late emission after error
    subject.next({ type: "TEXT_DELTA", delta: "Late delta that should be ignored" });

    expect(events.length).toBe(2);
    expect(events[0].delta).toBe("Hello");
    expect(events[1].type).toBe("RUN_ERROR");
  });
});
