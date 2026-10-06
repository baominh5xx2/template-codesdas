import { CHAT_LIMITS, type ChatExecutionStatus } from "@/contracts/chat";

import { settleToolCalls, transcriptText, trimTranscript, type ChatTranscriptMessage, type ChatTextMessage } from "@/contracts/chat-tools";
export type { ChatTextMessage } from "@/contracts/chat-tools";

export type ChatSnapshot = {
  threadId: string;
  messages: ChatTextMessage[];
  transcript: ChatTranscriptMessage[];
  draft: string;
  available: boolean;
  status: ChatExecutionStatus;
  pending: boolean;
  notice: boolean;
};

export type ChatRunRequest = {
  threadId: string;
  runId: string;
  messages: ChatTranscriptMessage[];
};

export type ChatRunSink = {
  started(): void;
  messages(messages: ChatTranscriptMessage[]): void;
  terminal(status: "completed" | "failed" | "interrupted"): void;
};

export type ChatClientPort = {
  run(request: ChatRunRequest, sink: ChatRunSink): Promise<void>;
  stop(): void;
  reset(threadId: string): void;
};

export type ChatController = {
  getSnapshot(): ChatSnapshot;
  subscribe(fn: () => void): () => void;
  setDraft(value: string): void;
  setAvailable(value: boolean): void;
  fail(): void;
  send(): Promise<boolean>;
  stop(): Promise<void>;
  retry(): Promise<boolean>;
  newChat(): Promise<void>;
  dispose(): void;
};

export function createChatController(options: {
  port: ChatClientPort;
  uuid: () => string;
  available: boolean;
  maxContextMessages?: number;
}): ChatController {
  let threadId = options.uuid();
  let messages: ChatTranscriptMessage[] = [];
  let draft = "";
  let available = options.available;
  let status: ChatExecutionStatus = "idle";
  let pending = false;
  let notice = false;
  let stopping = false;
  let failed = false;

  let activeGeneration = 0;
  let activeRunPromise: Promise<void> | null = null;
  let retryCheckpoint: {
    preTurnMessages: ChatTranscriptMessage[];
    userMessage: Extract<ChatTranscriptMessage, { role: "user" }>;
  } | null = null;

  const subscribers = new Set<() => void>();

  let snapshot: ChatSnapshot = {
    threadId,
    messages: transcriptText(messages),
    transcript: messages,
    draft,
    available,
    status,
    pending,
    notice,
  };

  function notify(): void {
    snapshot = {
      threadId,
      messages: transcriptText(messages),
      transcript: messages,
      draft,
      available,
      status,
      pending,
      notice,
    };
    for (const sub of subscribers) {
      try {
        sub();
      } catch {
        // Ignore subscriber execution error to avoid corrupting controller state
      }
    }
  }

  function getSnapshot(): ChatSnapshot {
    return snapshot;
  }

  function subscribe(fn: () => void): () => void {
    subscribers.add(fn);
    return () => {
      subscribers.delete(fn);
    };
  }

  function setDraft(value: string): void {
    if (draft === value) return;
    draft = value;
    notify();
  }

  function setAvailable(value: boolean): void {
    if (available === value && (!value || !failed)) return;
    available = value;
    if (value) {
      failed = false;
      notice = false;
    }
    notify();
  }

  function fail(): void {
    failed = true;
    notice = true;
    status = "failed";
    notify();
  }

  async function send(): Promise<boolean> {
    const trimmed = draft.trim();
    if (
      pending ||
      !available ||
      failed ||
      trimmed.length === 0 ||
      draft.length > CHAT_LIMITS.inputChars
    ) {
      return false;
    }

    // Synchronous pending fence before any await
    pending = true;
    stopping = false;
    status = "running";
    notice = false;

    const userMessage: Extract<ChatTranscriptMessage, { role: "user" }> = {
      id: options.uuid(),
      role: "user",
      content: draft,
    };

    const preTurnMessages = messages;
    messages = [...messages, userMessage];
    draft = "";
    retryCheckpoint = null; // old retry invalidated on sending

    activeGeneration++;
    const generation = activeGeneration;
    let accepted = false;
    let terminalSeen = false;
    let terminalStatus: "completed" | "failed" | "interrupted" | null = null;

    function acceptMessages(nextMsgs: ChatTranscriptMessage[]): void {
      messages = nextMsgs;
      notify();
    }

    function acceptTerminal(termStatus: "completed" | "failed" | "interrupted"): void {
      // Renderer/discovery failure stays visible after cancellation settles.
      if (failed) termStatus = "failed";
      terminalStatus = termStatus;
      status = termStatus;
      if (termStatus !== "completed") messages = settleToolCalls(messages, termStatus);
      if (termStatus === "failed") {
        notice = true;
        if (accepted) {
          retryCheckpoint = { preTurnMessages, userMessage };
        } else {
          // Pre-start failure: rollback optimistic append and restore draft
          messages = preTurnMessages;
          draft = userMessage.content;
        }
      } else if (termStatus === "completed") {
        notice = false;
        retryCheckpoint = null;
      } else if (termStatus === "interrupted") {
        notice = false;
        if (accepted) {
          retryCheckpoint = { preTurnMessages, userMessage };
        }
      }
      notify();
    }

    const sink: ChatRunSink = {
      started: () => {
        if (generation === activeGeneration && !terminalSeen) {
          accepted = true;
        }
      },
      messages: (msgs) => {
        if (generation === activeGeneration && !terminalSeen && !stopping) {
          acceptMessages(msgs);
        }
      },
      terminal: (termStatus) => {
        if (generation === activeGeneration && !terminalSeen) {
          terminalSeen = true;
          acceptTerminal(stopping ? "interrupted" : termStatus);
        }
      },
    };

    const request: ChatRunRequest = {
      threadId,
      runId: options.uuid(),
      messages: [...trimTranscript(preTurnMessages, options.maxContextMessages ?? Number.MAX_SAFE_INTEGER), userMessage],
    };

    notify();

    const runPromise = options.port.run(request, sink);
    activeRunPromise = runPromise;

    try {
      await runPromise;
      if (generation === activeGeneration && !terminalSeen) {
        terminalSeen = true;
        acceptTerminal(stopping ? "interrupted" : "completed");
      }
    } catch {
      if (generation === activeGeneration && !terminalSeen) {
        terminalSeen = true;
        acceptTerminal(stopping ? "interrupted" : "failed");
      }
    } finally {
      if (generation === activeGeneration) {
        pending = false;
        stopping = false;
        activeRunPromise = null;
        notify();
      }
    }

    return terminalStatus === "completed";
  }

  async function retry(): Promise<boolean> {
    if (pending || !available || failed || !retryCheckpoint) {
      return false;
    }

    pending = true;
    stopping = false;
    status = "running";
    notice = false;

    const { preTurnMessages, userMessage } = retryCheckpoint;
    // Discard failed partial answer from model input and messages
    messages = [...preTurnMessages, userMessage];

    activeGeneration++;
    const generation = activeGeneration;
    let terminalSeen = false;
    let retryTerminalStatus: "completed" | "failed" | "interrupted" | null = null;

    function acceptMessages(nextMsgs: ChatTranscriptMessage[]): void {
      messages = nextMsgs;
      notify();
    }

    function acceptTerminal(termStatus: "completed" | "failed" | "interrupted"): void {
      if (failed) termStatus = "failed";
      retryTerminalStatus = termStatus;
      status = termStatus;
      if (termStatus !== "completed") messages = settleToolCalls(messages, termStatus);
      if (termStatus === "failed") {
        notice = true;
      } else if (termStatus === "completed") {
        notice = false;
        retryCheckpoint = null;
      } else if (termStatus === "interrupted") {
        notice = false;
      }
      notify();
    }

    const sink: ChatRunSink = {
      started: () => {},
      messages: (msgs) => {
        if (generation === activeGeneration && !terminalSeen && !stopping) {
          acceptMessages(msgs);
        }
      },
      terminal: (termStatus) => {
        if (generation === activeGeneration && !terminalSeen) {
          terminalSeen = true;
          acceptTerminal(stopping ? "interrupted" : termStatus);
        }
      },
    };

    const request: ChatRunRequest = {
      threadId,
      runId: options.uuid(),
      messages: [...trimTranscript(preTurnMessages, options.maxContextMessages ?? Number.MAX_SAFE_INTEGER), userMessage],
    };

    notify();

    const runPromise = options.port.run(request, sink);
    activeRunPromise = runPromise;

    try {
      await runPromise;
      if (generation === activeGeneration && !terminalSeen) {
        terminalSeen = true;
        acceptTerminal(stopping ? "interrupted" : "completed");
      }
    } catch {
      if (generation === activeGeneration && !terminalSeen) {
        terminalSeen = true;
        acceptTerminal(stopping ? "interrupted" : "failed");
      }
    } finally {
      if (generation === activeGeneration) {
        pending = false;
        stopping = false;
        activeRunPromise = null;
        notify();
      }
    }

    return retryTerminalStatus === "completed";
  }

  async function stop(): Promise<void> {
    if (!pending || !activeRunPromise) {
      return;
    }
    stopping = true;
    messages = settleToolCalls(messages, "interrupted");
    notify();
    options.port.stop();
    try {
      await activeRunPromise;
    } catch {
      // Swallowed: teardown handled by run promise finally block
    }
  }

  async function newChat(): Promise<void> {
    if (pending && activeRunPromise) {
      stopping = true;
      options.port.stop();
      try {
        await activeRunPromise;
      } catch {
        // Swallowed
      }
    }
    activeGeneration++;
    retryCheckpoint = null;
    failed = false;
    stopping = false;
    threadId = options.uuid();
    messages = [];
    status = "idle";
    pending = false;
    notice = false;
    options.port.reset(threadId);
    notify();
  }

  function dispose(): void {
    activeGeneration++;
    if (pending) {
      stopping = true;
      options.port.stop();
    }
    subscribers.clear();
  }

  return {
    getSnapshot,
    subscribe,
    setDraft,
    setAvailable,
    fail,
    send,
    stop,
    retry,
    newChat,
    dispose,
  };
}
