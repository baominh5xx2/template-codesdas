import "server-only";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import type { ChatModelConfig } from "@/server/chat/config";
import { CHAT_NOTICE } from "@/contracts/chat";

export function createChatModel(
  config: ChatModelConfig,
  fetchImpl: typeof fetch = fetch
): LanguageModel {
  const provider = createOpenAI({
    baseURL: config.baseUrl,
    apiKey: config.apiKey ?? "local-no-auth",
    fetch: async (input, init) => {
      const request = new Request(input, init);
      if (!config.apiKey) {
        request.headers.delete("authorization");
      }
      return fetchImpl(request);
    },
  });
  const model = provider.chat(config.modelId);
  const failure = () => new Error(CHAT_NOTICE);
  return {
    specificationVersion: model.specificationVersion,
    provider: model.provider,
    modelId: model.modelId,
    supportedUrls: model.supportedUrls,
    async doGenerate(args) {
      try { return await model.doGenerate(args); }
      catch { throw failure(); }
    },
    async doStream(args) {
      try {
        const result = await model.doStream(args);
        const reader = result.stream.getReader();
        // AI SDK's default error logger receives these values before runtime
        // middleware. Sanitize here, including asynchronous stream read errors.
        const stream: typeof result.stream = new ReadableStream({
          async pull(controller) {
            try {
              const next = await reader.read();
              if (next.done) { controller.close(); return; }
              controller.enqueue(next.value.type === "error" ? { ...next.value, error: failure() } : next.value);
            } catch { controller.error(failure()); }
          },
          cancel() { return reader.cancel(); },
        });
        return { ...result, stream };
      } catch { throw failure(); }
    },
  };
}
