import "server-only";
import { z } from "zod";
import type { ChatReadiness } from "@/contracts/chat";

export type ChatModelConfig = {
  baseUrl: string;
  modelId: string;
  apiKey?: string;
};

export type ChatConfigResult =
  | { available: true; config: ChatModelConfig }
  | { available: false; cause: "missing_config" | "invalid_config" };

const chatModelConfigSchema = z.object({
  baseUrl: z
    .string()
    .trim()
    .refine(
      (val) => {
        try {
          const url = new URL(val);
          return (
            (url.protocol === "http:" || url.protocol === "https:") &&
            !url.username &&
            !url.password
          );
        } catch {
          return false;
        }
      },
      { message: "Invalid chat model base URL" }
    ),
  modelId: z.string().trim().min(1, { message: "Model ID cannot be empty" }),
  apiKey: z.string().trim().min(1).optional(),
});

export function loadChatConfig(
  values: Record<string, string | undefined>
): ChatConfigResult {
  const rawBaseUrl = values.CHAT_MODEL_BASE_URL?.trim();
  const rawModelId = values.CHAT_MODEL_ID?.trim();
  const rawApiKey = values.CHAT_MODEL_API_KEY?.trim();

  // If the required pair is missing, report missing_config
  if (!rawBaseUrl && !rawModelId) {
    return { available: false, cause: "missing_config" };
  }

  const apiKey = rawApiKey && rawApiKey.length > 0 ? rawApiKey : undefined;

  const parsed = chatModelConfigSchema.safeParse({
    baseUrl: rawBaseUrl,
    modelId: rawModelId,
    apiKey,
  });

  if (!parsed.success) {
    return { available: false, cause: "invalid_config" };
  }

  const config: ChatModelConfig = {
    baseUrl: parsed.data.baseUrl,
    modelId: parsed.data.modelId,
    ...(parsed.data.apiKey ? { apiKey: parsed.data.apiKey } : {}),
  };

  return { available: true, config };
}

export function getChatReadiness(result: ChatConfigResult): ChatReadiness {
  return { available: result.available, agentId: "default" };
}
