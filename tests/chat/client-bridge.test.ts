import { describe, expect, it, vi } from "vitest";
import { EventType } from "@ag-ui/client";
import type {
  AgentSubscriber,
  Message,
  RunAgentInput,
  RunFinishedEvent,
  RunStartedEvent,
  TextMessageContentEvent,
  BaseEvent,
} from "@ag-ui/client";
import {
  createChatClientBinding,
  createCopilotChatClient,
  type CopilotChatBindings,
} from "@/adapters/agents/chat-client";
import type { ChatRunRequest, ChatRunSink } from "@/ui/chat/controller";
import type { ChatTranscriptMessage } from "@/contracts/chat-tools";

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
  messagesHistory: ChatTranscriptMessage[][];
  terminalCalls: Array<"completed" | "failed" | "interrupted">;
} {
  const messagesHistory: ChatTranscriptMessage[][] = [];
  const terminalCalls: Array<"completed" | "failed" | "interrupted"> = [];
  let startedCalls = 0;

  return {
    started() {
      startedCalls++;
    },
    messages(msgs: ChatTranscriptMessage[]) {
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
  it("projects a new generic business tool from server descriptors and keeps its pair in the next protocol prefix", async () => {
    const sdk = createMockSdk(); const sink = createMockSink();
    const messages: Message[] = [
      { id: "u", role: "user", content: "Read" },
      { id: "a", role: "assistant", toolCalls: [{ id: "call", type: "function", function: { name: "business__read_summary", arguments: '{"key":"one"}' } }] },
      { id: "result", role: "tool", toolCallId: "call", content: '{"summary":"found"}' },
    ];
    sdk.copilotkit.runAgent.mockImplementationOnce(async () => {
      const subscriber = sdk.getSubscriber();
      const emit = (event: BaseEvent, protocol: Message[]) => subscriber?.onEvent?.({ event, messages: protocol, state: {}, agent: sdk.bindings.agent, input: {} as RunAgentInput });
      emit({ type: EventType.CUSTOM, name: "business_tool_descriptor", value: { exposedName: "business__read_summary", toolName: "read_summary", toolVersion: "2.1.0" } }, [messages[0]]);
      emit({ type: EventType.CUSTOM, name: "business_tool_status", value: { threadId: "thread", runId: "run", toolCallId: "call", exposedName: "business__read_summary", status: "running" } }, messages.slice(0, 2));
      emit({ type: EventType.CUSTOM, name: "business_tool_status", value: { threadId: "thread", runId: "run", toolCallId: "call", exposedName: "business__read_summary", status: "completed" } }, messages);
      // Duplicate running update after terminal status cannot regress a call.
      emit({ type: EventType.CUSTOM, name: "business_tool_status", value: { threadId: "thread", runId: "run", toolCallId: "call", exposedName: "business__read_summary", status: "running" } }, messages);
      sdk.agent.messages = messages;
      return { runId: "run" };
    });
    const client = createCopilotChatClient(sdk.bindings);
    await client.run({ threadId: "thread", runId: "run", messages: [messages[0] as Extract<ChatTranscriptMessage, { role: "user" }>] }, sink);
    const transcript = sink.messagesHistory.at(-1)!;
    expect(transcript[1].role === "assistant" && transcript[1].toolCalls?.[0]).toMatchObject({ toolName: "read_summary", toolVersion: "2.1.0", status: "completed", input: { key: "one" }, runId: "run" });
    expect(transcript[2]).toMatchObject({ role: "tool", output: { summary: "found" }, toolCallId: "call" });
    await client.run({ threadId: "thread", runId: "next", messages: transcript }, createMockSink());
    expect(sdk.agent.setMessages).toHaveBeenLastCalledWith(messages.map((m) => m.id === "a" ? { ...m, content: "" } : m));
  });

  it("maps synthetic stopped result/cancelled terminal to interrupted without a business result", async () => {
    const sdk = createMockSdk(); const sink = createMockSink();
    sdk.copilotkit.runAgent.mockImplementationOnce(async () => {
      const subscriber = sdk.getSubscriber();
      subscriber?.onEvent?.({ event: { type: EventType.CUSTOM, name: "business_tool_descriptor", value: { exposedName: "business__any_tool", toolName: "any_tool", toolVersion: "1.0.0" } }, messages: [], state: {}, agent: sdk.bindings.agent, input: {} as RunAgentInput });
      subscriber?.onRunFinishedEvent?.({ event: {} as RunFinishedEvent, outcome: "cancelled", messages: [
        { id: "a", role: "assistant", toolCalls: [{ id: "call", type: "function", function: { name: "business__any_tool", arguments: '{"ok":true}' } }] },
        { id: "result", role: "tool", toolCallId: "call", content: '{"status":"stopped","reason":"stop_requested"}' },
      ], state: {}, agent: sdk.bindings.agent, input: {} as RunAgentInput });
      return { runId: "run" };
    });
    await createCopilotChatClient(sdk.bindings).run({ threadId: "thread", runId: "run", messages: [] }, sink);
    expect(sink.terminalCalls).toEqual(["interrupted"]);
    const transcript = sink.messagesHistory.at(-1)!;
    expect(transcript.some((m) => m.role === "tool")).toBe(false);
    expect(transcript[0].role === "assistant" && transcript[0].toolCalls?.[0].status).toBe("interrupted");
  });
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
