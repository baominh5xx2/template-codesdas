import { describe, expect, it, vi } from "vitest";
import { CHAT_LIMITS, CHAT_NOTICE } from "@/contracts/chat";
import { createChatController } from "@/ui/chat/controller";
import { createControlledChatPort } from "../helpers/chat-client";

describe("createChatController", () => {
  it("executes the deterministic core send and retry flow with checkpointing", async () => {
    const h = createControlledChatPort();
    let n = 0;
    const c = createChatController({
      port: h.port,
      uuid: () => `id-${++n}`,
      available: true,
    });

    c.setDraft("Xin chào");
    const first = c.send();
    expect(await c.send()).toBe(false);
    expect(h.requests).toHaveLength(1);

    h.emitStarted();
    h.emitMessages([
      { id: h.requests[0].messages[0].id, role: "user", content: "Xin chào" },
      { id: "a1", role: "assistant", content: "partial" },
    ]);
    h.finish("failed");
    await first;

    expect(c.getSnapshot().status).toBe("failed");
    expect(c.getSnapshot().notice).toBe(true);

    const retry = c.retry();
    expect(h.requests).toHaveLength(2);
    expect(h.requests[1].messages).toEqual(h.requests[0].messages);
    expect(h.requests[1].runId).not.toBe(h.requests[0].runId);
    expect(c.getSnapshot().messages.filter((m) => m.role === "user")).toHaveLength(1);

    h.finish("completed");
    await retry;

    expect(c.getSnapshot().status).toBe("completed");
    expect(c.getSnapshot().notice).toBe(false);
  });

  describe("validation and draft preservation", () => {
    it("does not dispatch and preserves draft when unavailable", async () => {
      const h = createControlledChatPort();
      let n = 0;
      const c = createChatController({
        port: h.port,
        uuid: () => `id-${++n}`,
        available: false,
      });

      c.setDraft("Draft content");
      const dispatched = await c.send();

      expect(dispatched).toBe(false);
      expect(h.requests).toHaveLength(0);
      expect(c.getSnapshot().draft).toBe("Draft content");
      expect(c.getSnapshot().messages).toHaveLength(0);
    });

    it("does not dispatch and preserves draft when blank", async () => {
      const h = createControlledChatPort();
      let n = 0;
      const c = createChatController({
        port: h.port,
        uuid: () => `id-${++n}`,
        available: true,
      });

      c.setDraft("   \n\t  ");
      const dispatched = await c.send();

      expect(dispatched).toBe(false);
      expect(h.requests).toHaveLength(0);
      expect(c.getSnapshot().draft).toBe("   \n\t  ");
      expect(c.getSnapshot().messages).toHaveLength(0);
    });

    it("does not dispatch and preserves draft when exceeding 8,000 characters limit", async () => {
      const h = createControlledChatPort();
      let n = 0;
      const c = createChatController({
        port: h.port,
        uuid: () => `id-${++n}`,
        available: true,
      });

      const oversizedDraft = "a".repeat(CHAT_LIMITS.inputChars + 1);
      c.setDraft(oversizedDraft);
      const dispatched = await c.send();

      expect(dispatched).toBe(false);
      expect(h.requests).toHaveLength(0);
      expect(c.getSnapshot().draft).toBe(oversizedDraft);
      expect(c.getSnapshot().messages).toHaveLength(0);
    });

    it("dispatches draft with exactly 8,000 characters", async () => {
      const h = createControlledChatPort();
      let n = 0;
      const c = createChatController({
        port: h.port,
        uuid: () => `id-${++n}`,
        available: true,
      });

      const maxDraft = "x".repeat(CHAT_LIMITS.inputChars);
      c.setDraft(maxDraft);
      const sendPromise = c.send();

      expect(h.requests).toHaveLength(1);
      expect(h.requests[0].messages[0].content).toBe(maxDraft);
      expect(c.getSnapshot().draft).toBe("");

      h.emitStarted();
      h.finish("completed");
      await sendPromise;
    });
  });

  describe("failure and rollback policies", () => {
    it("rolls back optimistic user message and restores draft on pre-start rejection", async () => {
      const h = createControlledChatPort();
      let n = 0;
      const c = createChatController({
        port: h.port,
        uuid: () => `id-${++n}`,
        available: true,
      });

      c.setDraft("Message before crash");
      const sendPromise = c.send();

      expect(c.getSnapshot().messages).toHaveLength(1);
      expect(c.getSnapshot().draft).toBe("");

      h.reject(new Error("Pre-start failure"));
      const result = await sendPromise;

      expect(result).toBe(false);
      expect(c.getSnapshot().messages).toHaveLength(0);
      expect(c.getSnapshot().draft).toBe("Message before crash");
      expect(c.getSnapshot().status).toBe("failed");
      expect(c.getSnapshot().notice).toBe(true);

      expect(await c.retry()).toBe(false);
    });

    it("retains accepted user ID and pre-turn checkpoint for retry on failure after started", async () => {
      const h = createControlledChatPort();
      let n = 0;
      const c = createChatController({
        port: h.port,
        uuid: () => `id-${++n}`,
        available: true,
      });

      c.setDraft("Accepted prompt");
      const sendPromise = c.send();

      h.emitStarted();
      const userMessageId = h.requests[0].messages[0].id;
      h.emitMessages([
        { id: userMessageId, role: "user", content: "Accepted prompt" },
        { id: "partial-ast", role: "assistant", content: "Broken generation..." },
      ]);
      h.finish("failed");
      await sendPromise;

      expect(c.getSnapshot().status).toBe("failed");
      expect(c.getSnapshot().notice).toBe(true);
      expect(c.getSnapshot().messages.some((m) => m.id === userMessageId)).toBe(true);

      const retryPromise = c.retry();
      expect(h.requests).toHaveLength(2);
      expect(h.requests[1].messages).toEqual([
        { id: userMessageId, role: "user", content: "Accepted prompt" },
      ]);
      expect(h.requests[1].runId).not.toBe(h.requests[0].runId);

      h.emitStarted();
      h.emitMessages([
        { id: userMessageId, role: "user", content: "Accepted prompt" },
        { id: "final-ast", role: "assistant", content: "Complete answer" },
      ]);
      h.finish("completed");
      await retryPromise;

      expect(c.getSnapshot().status).toBe("completed");
      expect(c.getSnapshot().notice).toBe(false);
      expect(c.getSnapshot().messages).toEqual([
        { id: userMessageId, role: "user", content: "Accepted prompt" },
        { id: "final-ast", role: "assistant", content: "Complete answer" },
      ]);
    });
  });

  describe("stop operation", () => {
    it("preserves partial assistant text, marks interrupted, clears notice, and holds pending until settled", async () => {
      const h = createControlledChatPort();
      let n = 0;
      const c = createChatController({
        port: h.port,
        uuid: () => `id-${++n}`,
        available: true,
      });

      c.setDraft("Explain quantum physics");
      const sendPromise = c.send();

      h.emitStarted();
      h.emitMessages([
        { id: h.requests[0].messages[0].id, role: "user", content: "Explain quantum physics" },
        { id: "partial-1", role: "assistant", content: "Quantum physics is" },
      ]);

      const stopPromise = c.stop();

      expect(c.getSnapshot().pending).toBe(true);
      expect(h.stopCount).toBe(1);

      h.finish("interrupted");
      await stopPromise;
      await sendPromise;

      const snap = c.getSnapshot();
      expect(snap.status).toBe("interrupted");
      expect(snap.pending).toBe(false);
      expect(snap.notice).toBe(false);
      expect(snap.messages).toHaveLength(2);
      expect(snap.messages[1]).toEqual({
        id: "partial-1",
        role: "assistant",
        content: "Quantum physics is",
      });
    });

    it("normalizes errors to interrupted when stop flag was set", async () => {
      const h = createControlledChatPort();
      let n = 0;
      const c = createChatController({
        port: h.port,
        uuid: () => `id-${++n}`,
        available: true,
      });

      c.setDraft("Test prompt");
      const sendPromise = c.send();

      h.emitStarted();
      const stopPromise = c.stop();

      h.reject(new Error("AbortError: Operation aborted"));
      await stopPromise;
      await sendPromise;

      expect(c.getSnapshot().status).toBe("interrupted");
      expect(c.getSnapshot().notice).toBe(false);
      expect(c.getSnapshot().pending).toBe(false);
    });
  });

  describe("newChat operation", () => {
    it("awaits active run finalization, resets port, and creates fresh thread with clean messages", async () => {
      const h = createControlledChatPort();
      let n = 0;
      const c = createChatController({
        port: h.port,
        uuid: () => `id-${++n}`,
        available: true,
      });

      const initialThreadId = c.getSnapshot().threadId;

      c.setDraft("Prompt 1");
      const sendPromise = c.send();
      h.emitStarted();

      const newChatPromise = c.newChat();
      expect(c.getSnapshot().pending).toBe(true);
      expect(h.stopCount).toBe(1);

      h.finish("interrupted");
      await newChatPromise;
      await sendPromise;

      const snap = c.getSnapshot();
      expect(snap.pending).toBe(false);
      expect(snap.threadId).not.toBe(initialThreadId);
      expect(snap.messages).toEqual([]);
      expect(snap.status).toBe("idle");
      expect(snap.notice).toBe(false);
      expect(h.resetThreads).toContain(snap.threadId);
    });

    it("invalidates old retry checkpoint on newChat", async () => {
      const h = createControlledChatPort();
      let n = 0;
      const c = createChatController({
        port: h.port,
        uuid: () => `id-${++n}`,
        available: true,
      });

      c.setDraft("Failed prompt");
      const first = c.send();
      h.emitStarted();
      h.finish("failed");
      await first;

      expect(c.getSnapshot().status).toBe("failed");

      await c.newChat();

      expect(await c.retry()).toBe(false);
      expect(h.requests).toHaveLength(1);
    });

    it("invalidates old retry checkpoint on sending new message", async () => {
      const h = createControlledChatPort();
      let n = 0;
      const c = createChatController({
        port: h.port,
        uuid: () => `id-${++n}`,
        available: true,
      });

      c.setDraft("Prompt 1");
      const first = c.send();
      h.emitStarted();
      h.finish("failed");
      await first;

      c.setAvailable(true);
      c.setDraft("Prompt 2");
      const second = c.send();
      h.emitStarted();
      h.finish("completed");
      await second;

      expect(await c.retry()).toBe(false);
    });
  });

  describe("fail() and notice policy", () => {
    it("sets notice, fails status, blocks send, but does not release pending run before teardown", async () => {
      const h = createControlledChatPort();
      let n = 0;
      const c = createChatController({
        port: h.port,
        uuid: () => `id-${++n}`,
        available: true,
      });

      c.setDraft("In-flight");
      const sendPromise = c.send();

      h.emitStarted();

      c.fail();

      expect(c.getSnapshot().notice).toBe(true);
      expect(c.getSnapshot().status).toBe("failed");
      expect(c.getSnapshot().pending).toBe(true);

      c.setDraft("Attempt during failed pending");
      expect(await c.send()).toBe(false);

      h.finish("failed");
      await sendPromise;

      expect(c.getSnapshot().pending).toBe(false);
      expect(c.getSnapshot().notice).toBe(true);
      expect(await c.send()).toBe(false);
    });

    it("never stores CHAT_NOTICE in messages", async () => {
      const h = createControlledChatPort();
      let n = 0;
      const c = createChatController({
        port: h.port,
        uuid: () => `id-${++n}`,
        available: true,
      });

      c.setDraft("Hello");
      const sendPromise = c.send();
      h.emitStarted();
      h.finish("failed");
      await sendPromise;

      c.fail();

      const messages = c.getSnapshot().messages;
      for (const msg of messages) {
        expect(msg.content).not.toContain(CHAT_NOTICE);
      }
      expect(c.getSnapshot().notice).toBe(true);
    });

    it("clears failed state and notice when setAvailable(true) is invoked", async () => {
      const h = createControlledChatPort();
      let n = 0;
      const c = createChatController({
        port: h.port,
        uuid: () => `id-${++n}`,
        available: true,
      });

      c.fail();
      expect(c.getSnapshot().notice).toBe(true);

      c.setDraft("After recovery");
      expect(await c.send()).toBe(false);

      c.setAvailable(true);
      expect(c.getSnapshot().notice).toBe(false);

      const sendPromise = c.send();
      expect(h.requests).toHaveLength(1);
      h.emitStarted();
      h.finish("completed");
      await sendPromise;
    });
  });

  describe("isolation against late events and subscription lifecycle", () => {
    it("ignores late sink events after terminal or reset", async () => {
      const h = createControlledChatPort();
      let n = 0;
      const c = createChatController({
        port: h.port,
        uuid: () => `id-${++n}`,
        available: true,
      });

      c.setDraft("Hello");
      const sendPromise = c.send();
      h.emitStarted();
      h.emitMessages([
        { id: h.requests[0].messages[0].id, role: "user", content: "Hello" },
        { id: "a1", role: "assistant", content: "Official answer" },
      ]);
      h.finish("completed");
      await sendPromise;

      const initialSnapshot = c.getSnapshot();

      h.emitMessages([
        { id: "a1", role: "assistant", content: "Zombie late content" },
      ]);
      h.finish("failed");

      expect(c.getSnapshot()).toBe(initialSnapshot);
      expect(c.getSnapshot().messages).toEqual(initialSnapshot.messages);
      expect(c.getSnapshot().status).toBe("completed");
    });

    it("provides immutable snapshot reference stability for useSyncExternalStore", () => {
      const h = createControlledChatPort();
      let n = 0;
      const c = createChatController({
        port: h.port,
        uuid: () => `id-${++n}`,
        available: true,
      });

      const snap1 = c.getSnapshot();
      const snap2 = c.getSnapshot();
      expect(snap1).toBe(snap2);

      c.setDraft("Changed");
      const snap3 = c.getSnapshot();
      expect(snap3).not.toBe(snap1);
      expect(snap3.draft).toBe("Changed");

      const snap4 = c.getSnapshot();
      expect(snap4).toBe(snap3);
    });

    it("notifies subscribers and honors unsubscribe and dispose", async () => {
      const h = createControlledChatPort();
      let n = 0;
      const c = createChatController({
        port: h.port,
        uuid: () => `id-${++n}`,
        available: true,
      });

      const subscriber = vi.fn();
      const unsubscribe = c.subscribe(subscriber);

      c.setDraft("Update 1");
      expect(subscriber).toHaveBeenCalledTimes(1);

      unsubscribe();
      c.setDraft("Update 2");
      expect(subscriber).toHaveBeenCalledTimes(1);

      c.setDraft("Dispose test");
      const sendPromise = c.send();
      c.dispose();

      expect(h.stopCount).toBe(1);
      h.finish("interrupted");
      await sendPromise;
    });
  });
});
