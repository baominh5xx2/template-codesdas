import { describe, expect, it, vi } from "vitest";
import type {
  AgentSubscriber,
  Message,
  RunAgentInput,
  RunFinishedEvent,
  RunStartedEvent,
  TextMessageContentEvent,
} from "@ag-ui/client";
import {
  createChatClientBinding,
  createCopilotChatClient,
  type CopilotChatBindings,
} from "@/adapters/agents/chat-client";
import { createChatController, type ChatRunRequest, type ChatRunSink, type ChatTextMessage } from "@/ui/chat/controller";

function createMockSdk() {
  let currentSubscriber: AgentSubscriber | null = null;
  const unsubscribeSpy = vi.fn();

  const agent = {
    threadId: "initial-thread",
    messages: [] as Message[],
    setMessages: vi.fn((msgs: Message[]) => {
      agent.messages = [...msgs];
    }),
    addMessage: vi.fn((msg: Message) => {
      agent.messages.push(msg);
    }),
    subscribe: vi.fn((subscriber: AgentSubscriber) => {
      currentSubscriber = subscriber;
      return {
        unsubscribe: () => {
          unsubscribeSpy();
          if (currentSubscriber === subscriber) {
            currentSubscriber = null;
          }
        },
      };
    }),
  };

  const copilotkit = {
    runAgent: vi.fn(async () => {
      return { runId: "mock-run-result" };
    }),
    stopAgent: vi.fn(),
  };

  return {
    bindings: {
      agent: agent as unknown as CopilotChatBindings["agent"],
      copilotkit: copilotkit as unknown as CopilotChatBindings["copilotkit"],
    },
    agent,
    copilotkit,
    unsubscribeSpy,
    getSubscriber: () => currentSubscriber,
  };
}

function createMockSink(): ChatRunSink & {
  startedCalls: number;
  messagesHistory: ChatTextMessage[][];
  terminalCalls: Array<"completed" | "failed" | "interrupted">;
} {
  const messagesHistory: ChatTextMessage[][] = [];
  const terminalCalls: Array<"completed" | "failed" | "interrupted"> = [];
  let startedCalls = 0;

  return {
    started() {
      startedCalls++;
    },
    messages(msgs: ChatTextMessage[]) {
      messagesHistory.push(msgs);
    },
    terminal(status: "completed" | "failed" | "interrupted") {
      terminalCalls.push(status);
    },
    get startedCalls() {
      return startedCalls;
    },
    messagesHistory,
    terminalCalls,
  };
}

describe("createCopilotChatClient bridge", () => {
  it("sets full message prefix, uses explicit runId, and does NOT call addMessage second time", async () => {
    const { bindings, agent, copilotkit } = createMockSdk();
    const client = createCopilotChatClient(bindings);
    const sink = createMockSink();

    const request: ChatRunRequest = {
      threadId: "test-thread-1",
      runId: "run-explicit-42",
      messages: [
        { id: "u1", role: "user", content: "First question" },
        { id: "a1", role: "assistant", content: "First answer" },
        { id: "u2", role: "user", content: "Second question" },
      ],
    };

    await client.run(request, sink);

    expect(agent.threadId).toBe("test-thread-1");
    expect(agent.setMessages).toHaveBeenCalledTimes(1);
    expect(agent.setMessages).toHaveBeenCalledWith([
      { id: "u1", role: "user", content: "First question" },
      { id: "a1", role: "assistant", content: "First answer" },
      { id: "u2", role: "user", content: "Second question" },
    ]);
    expect(agent.addMessage).not.toHaveBeenCalled();

    expect(copilotkit.runAgent).toHaveBeenCalledTimes(1);
    expect(copilotkit.runAgent).toHaveBeenCalledWith({
      agent: bindings.agent,
      runId: "run-explicit-42",
    });

    expect(sink.terminalCalls).toEqual(["completed"]);
  });

  it("calls copilotkit.stopAgent when client.stop is called", () => {
    const { bindings, copilotkit } = createMockSdk();
    const client = createCopilotChatClient(bindings);

    client.stop();

    expect(copilotkit.stopAgent).toHaveBeenCalledTimes(1);
    expect(copilotkit.stopAgent).toHaveBeenCalledWith({ agent: bindings.agent });
  });

  it("resets agent threadId and clears messages on reset", () => {
    const { bindings, agent } = createMockSdk();
    const client = createCopilotChatClient(bindings);

    agent.messages = [{ id: "m1", role: "user", content: "old" }];
    client.reset("new-thread-99");

    expect(agent.threadId).toBe("new-thread-99");
    expect(agent.setMessages).toHaveBeenCalledWith([]);
    expect(agent.messages).toHaveLength(0);
  });

  it("cleans up subscription in finally after run completes or fails", async () => {
    const { bindings, unsubscribeSpy } = createMockSdk();
    const client = createCopilotChatClient(bindings);
    const sink = createMockSink();

    const request: ChatRunRequest = {
      threadId: "thread-sub",
      runId: "run-sub",
      messages: [{ id: "u1", role: "user", content: "Hello" }],
    };

    await client.run(request, sink);
    expect(unsubscribeSpy).toHaveBeenCalledTimes(1);
  });

  it("safely handles onRunFailed and onRunErrorEvent from agent subscribers", async () => {
    const { bindings, getSubscriber, copilotkit } = createMockSdk();
    copilotkit.runAgent.mockImplementationOnce(async () => {
      const sub = getSubscriber();
      sub?.onRunFailed?.({
        error: new Error("Agent crashed internally"),
        messages: [],
        state: {},
        agent: bindings.agent,
        input: {} as unknown as RunAgentInput,
      });
      return { runId: "failed-run" };
    });

    const client = createCopilotChatClient(bindings);
    const sink = createMockSink();

    await client.run(
      {
        threadId: "thread-fail",
        runId: "run-fail",
        messages: [{ id: "u1", role: "user", content: "Crash me" }],
      },
      sink
    );

    expect(sink.terminalCalls).toEqual(["failed"]);
  });

  it("safely handles error rejections from runAgent without raw logs", async () => {
    const { bindings, copilotkit } = createMockSdk();
    copilotkit.runAgent.mockRejectedValueOnce(new Error("Network timeout"));

    const client = createCopilotChatClient(bindings);
    const sink = createMockSink();

    await client.run(
      {
        threadId: "thread-err",
        runId: "run-err",
        messages: [{ id: "u1", role: "user", content: "Timeout test" }],
      },
      sink
    );

    expect(sink.terminalCalls).toEqual(["failed"]);
  });

  it("relays run started and projects only user and assistant text messages", async () => {
    const { bindings, getSubscriber, copilotkit } = createMockSdk();
    copilotkit.runAgent.mockImplementationOnce(async () => {
      const sub = getSubscriber();
      sub?.onRunStartedEvent?.({
        event: { type: "RUN_STARTED" } as unknown as RunStartedEvent,
        messages: [],
        state: {},
        agent: bindings.agent,
        input: {} as unknown as RunAgentInput,
      });

      // Emit event containing user, assistant, tool, and activity messages
      const mixedMessages: Message[] = [
        { id: "u1", role: "user", content: "User prompt" },
        { id: "t1", role: "tool", content: "ignored tool output", toolCallId: "call-1" },
        { id: "act1", role: "activity", activityType: "inspect", content: {} },
        { id: "a1", role: "assistant", content: "Streaming partial" },
      ];

      sub?.onTextMessageContentEvent?.({
        event: {} as unknown as TextMessageContentEvent,
        textMessageBuffer: "Streaming partial",
        messages: mixedMessages,
        state: {},
        agent: bindings.agent,
        input: {} as unknown as RunAgentInput,
      });

      sub?.onRunFinishedEvent?.({
        event: {} as unknown as RunFinishedEvent,
        outcome: "success",
        pendingToolCallIds: [],
        messages: [
          ...mixedMessages,
          { id: "a1", role: "assistant", content: "Streaming partial finished" },
        ],
        state: {},
        agent: bindings.agent,
        input: {} as unknown as RunAgentInput,
      });

      return { runId: "run-finish" };
    });

    const client = createCopilotChatClient(bindings);
    const sink = createMockSink();

    await client.run(
      {
        threadId: "thread-stream",
        runId: "run-stream",
        messages: [{ id: "u1", role: "user", content: "User prompt" }],
      },
      sink
    );

    expect(sink.startedCalls).toBe(1);
    expect(sink.terminalCalls).toEqual(["completed"]);

    // Verify only user and assistant messages were projected to sink
    expect(sink.messagesHistory.length).toBeGreaterThan(0);
    for (const batch of sink.messagesHistory) {
      for (const msg of batch) {
        expect(["user", "assistant"]).toContain(msg.role);
      }
    }
  });
});

describe("createChatClientBinding forwarding port", () => {
  it("cancels the specific detached running client and keeps controller pending until it settles", async () => {
    const binding = createChatClientBinding();
    let settle!: () => void;
    const stop = vi.fn();
    const detach = binding.attach({ run: () => new Promise<void>((resolve) => { settle = resolve; }), stop, reset: vi.fn() });
    const controller = createChatController({ port: binding.port, uuid: () => "test-id", available: true });
    controller.setDraft("Active render");
    const sending = controller.send();
    controller.fail();
    detach();
    expect(stop).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot().pending).toBe(true);
    expect(controller.getSnapshot().notice).toBe(true);
    expect(await controller.retry()).toBe(false);
    settle(); await sending;
    expect(controller.getSnapshot().pending).toBe(false);
    expect(controller.getSnapshot().notice).toBe(true);
    expect(controller.getSnapshot().status).toBe("failed");
  });

  it("cancels an old detached run without stopping a replacement client", async () => {
    const binding = createChatClientBinding();
    let settle!: () => void;
    const oldStop = vi.fn(); const newStop = vi.fn();
    const detach = binding.attach({ run: () => new Promise<void>((resolve) => { settle = resolve; }), stop: oldStop, reset: vi.fn() });
    const running = binding.port.run({ threadId: "t", runId: "r", messages: [] }, createMockSink());
    binding.attach({ run: vi.fn(), stop: newStop, reset: vi.fn() });
    detach();
    expect(oldStop).toHaveBeenCalledTimes(1);
    expect(newStop).not.toHaveBeenCalled();
    settle(); await running;
  });

  it("rejects run with an app-safe error when unattached", async () => {
    const binding = createChatClientBinding();
    const sink = createMockSink();

    const request: ChatRunRequest = {
      threadId: "t-unattached",
      runId: "r-unattached",
      messages: [{ id: "u1", role: "user", content: "Will fail" }],
    };

    await expect(binding.port.run(request, sink)).rejects.toThrow(
      /not attached/i
    );
  });

  it("forwards run, stop, and reset to attached client", async () => {
    const binding = createChatClientBinding();
    const runSpy = vi.fn(async () => {});
    const stopSpy = vi.fn();
    const resetSpy = vi.fn();

    const mockPort = {
      run: runSpy,
      stop: stopSpy,
      reset: resetSpy,
    };

    const detach = binding.attach(mockPort);

    const request: ChatRunRequest = {
      threadId: "t-forward",
      runId: "r-forward",
      messages: [{ id: "u1", role: "user", content: "Forward me" }],
    };
    const sink = createMockSink();

    await binding.port.run(request, sink);
    expect(runSpy).toHaveBeenCalledWith(request, sink);

    binding.port.stop();
    expect(stopSpy).toHaveBeenCalledTimes(1);

    binding.port.reset("thread-reset");
    expect(resetSpy).toHaveBeenCalledWith("thread-reset");

    detach();
    await expect(binding.port.run(request, sink)).rejects.toThrow(/not attached/i);
  });

  it("only detaches when the cleanup function matches the currently attached instance", async () => {
    const binding = createChatClientBinding();
    const portA = { run: vi.fn(), stop: vi.fn(), reset: vi.fn() };
    const portB = { run: vi.fn(), stop: vi.fn(), reset: vi.fn() };

    const detachA = binding.attach(portA);
    const detachB = binding.attach(portB);

    // Detaching A should NOT detach B
    detachA();

    binding.port.stop();
    expect(portB.stop).toHaveBeenCalledTimes(1);
    expect(portA.stop).not.toHaveBeenCalled();

    detachB();
    const sink = createMockSink();
    await expect(
      binding.port.run(
        { threadId: "t", runId: "r", messages: [] },
        sink
      )
    ).rejects.toThrow(/not attached/i);
  });
});
