import "server-only";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import type { ChatModelConfig } from "@/server/chat/config";

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
  return provider.chat(config.modelId);
}
