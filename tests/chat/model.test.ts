import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createChatModel } from "@/adapters/llm/chat-model";
import { CHAT_NOTICE } from "@/contracts/chat";
import { createChatProviderFixture, type ChatProviderFixture } from "../helpers/chat-provider";

type StreamingModel = {
  modelId: string;
  doStream(args: {
    inputFormat: string;
    mode: { type: string };
    prompt: Array<{ role: string; content: Array<{ type: string; text: string }> }>;
  }): Promise<{ stream: ReadableStream<unknown> }>;
};

describe("createChatModel", () => {
  let fixture: ChatProviderFixture;
  const originalEnvApiKey = process.env.OPENAI_API_KEY;

  beforeEach(async () => {
    fixture = await createChatProviderFixture();
  });

  afterEach(async () => {
    if (originalEnvApiKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalEnvApiKey;
    }
    await fixture.close();
  });

  it("sends configured apiKey in Authorization header to /chat/completions", async () => {
    const model = createChatModel({
      baseUrl: fixture.baseUrl,
      modelId: "test-model-4o",
      apiKey: "custom-configured-key-123",
    });

    const streamable = model as unknown as StreamingModel;
    expect(model).toBeDefined();
    expect(streamable.modelId).toBe("test-model-4o");

    // Invoke stream on model
    const stream = await streamable.doStream({
      inputFormat: "messages",
      mode: { type: "regular" },
      prompt: [
        {
          role: "user",
          content: [{ type: "text", text: "Xin chào" }],
        },
      ],
    });

    // Drain the stream
    const reader = stream.stream.getReader();
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }

    expect(fixture.requests.length).toBeGreaterThan(0);
    const req = fixture.requests[0];
    expect(req.authorization).toBe("Bearer custom-configured-key-123");
    expect((req.body as Record<string, unknown> | null)?.model).toBe("test-model-4o");
  });

  it("strips Authorization header when no apiKey is configured even if ambient OPENAI_API_KEY is set", async () => {
    process.env.OPENAI_API_KEY = "RAW_SECRET_LEAKED_KEY";

    const model = createChatModel({
      baseUrl: fixture.baseUrl,
      modelId: "local-llama-3",
    });

    const streamable = model as unknown as StreamingModel;
    expect(model).toBeDefined();

    const stream = await streamable.doStream({
      inputFormat: "messages",
      mode: { type: "regular" },
      prompt: [
        {
          role: "user",
          content: [{ type: "text", text: "Xin chào local" }],
        },
      ],
    });

    const reader = stream.stream.getReader();
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }

    expect(fixture.requests.length).toBeGreaterThan(0);
    const req = fixture.requests[0];
    expect(req.authorization).toBeNull();
  });

  it("uses custom fetchImpl if provided", async () => {
    let customFetchCalled = false;
    const customFetch: typeof fetch = async (input, init) => {
      customFetchCalled = true;
      return fetch(input, init);
    };

    const model = createChatModel(
      {
        baseUrl: fixture.baseUrl,
        modelId: "test-model",
      },
      customFetch
    );

    const streamable = model as unknown as StreamingModel;
    const stream = await streamable.doStream({
      inputFormat: "messages",
      mode: { type: "regular" },
      prompt: [
        {
          role: "user",
          content: [{ type: "text", text: "Test custom fetch" }],
        },
      ],
    });

    const reader = stream.stream.getReader();
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }

    expect(customFetchCalled).toBe(true);
  });

  it("removes provider metadata from thrown model errors before SDK diagnostics", async () => {
    fixture.setScenario("reject");
    const model = createChatModel({ baseUrl: fixture.baseUrl, modelId: "test-model", apiKey: "RAW_SECRET_KEY" }) as unknown as StreamingModel;
    const error = await model.doStream({ inputFormat: "messages", mode: { type: "regular" }, prompt: [{ role: "user", content: [{ type: "text", text: "PRIVATE_PROMPT" }] }] }).catch((failure: unknown) => failure);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe(CHAT_NOTICE);
    expect(Object.getOwnPropertyNames(error)).not.toContain("requestBodyValues");
    expect(Object.getOwnPropertyNames(error)).not.toContain("cause");
    expect(String(error)).not.toContain("RAW_SECRET");
  });

  it("sanitizes failures encountered while reading a partial provider stream", async () => {
    fixture.setScenario("partial-fail");
    const model = createChatModel({ baseUrl: fixture.baseUrl, modelId: "test-model" }) as unknown as StreamingModel;
    const stream = await model.doStream({ inputFormat: "messages", mode: { type: "regular" }, prompt: [{ role: "user", content: [{ type: "text", text: "partial" }] }] });
    const reader = stream.stream.getReader();
    const errors: unknown[] = [];
    try {
      while (true) {
        const next = await reader.read(); if (next.done) break;
        const chunk = next.value as { type: string; error?: unknown };
        if (chunk.type === "error") errors.push(chunk.error);
      }
    } catch (error) { errors.push(error); }
    expect(errors.length).toBeGreaterThan(0);
    for (const error of errors) {
      expect(String(error)).toBe(`Error: ${CHAT_NOTICE}`);
      expect(Object.getOwnPropertyNames(error)).not.toContain("cause");
    }
  });
});
