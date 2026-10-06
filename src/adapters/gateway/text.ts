import "server-only";
import type { z } from "zod";
import { GatewayError, type GatewayClient } from "./client";
import { GATEWAY_DEFAULTS } from "./defaults";

export type ChatContentPart =
  | { type: "text"; text: string }
  /** `url` may be https or a `data:image/...;base64,` URI. */
  | { type: "image_url"; image_url: { url: string } };

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string | ChatContentPart[] };

export type ChatOptions = {
  messages: ChatMessage[];
  model?: string;
  /** Google Search grounding (Gemini models only); sources come back in `citations`. */
  search?: boolean;
  /** Mapped to `max_completion_tokens` for OpenAI reasoning models, `max_tokens` otherwise. */
  maxTokens?: number;
  /** Ask for a JSON object response (`response_format: json_object`). */
  json?: boolean;
  /** OpenAI reasoning models only. */
  reasoningEffort?: "low" | "medium" | "high";
  /** Provider-specific fields merged into the body, e.g. `{ thinking: { type: "disabled" } }` for DeepSeek. */
  extra?: Record<string, unknown>;
  signal?: AbortSignal;
  timeoutMs?: number;
};

export type Citation = { title?: string; uri: string };
export type ChatResult = { text: string; citations: Citation[]; model: string; usage?: unknown; cost: number | null };

type ChatResponse = {
  model?: string;
  usage?: unknown;
  choices?: { message?: { content?: string | null } }[];
  vertex_ai_grounding_metadata?: unknown;
};

export async function chat(client: GatewayClient, options: ChatOptions): Promise<ChatResult> {
  const model = options.model ?? GATEWAY_DEFAULTS.text;
  const body: Record<string, unknown> = { model, messages: options.messages };
  if (options.search) body.tools = [{ googleSearch: {} }];
  if (options.maxTokens) body[usesCompletionTokens(model) ? "max_completion_tokens" : "max_tokens"] = options.maxTokens;
  if (options.json) body.response_format = { type: "json_object" };
  if (options.reasoningEffort) body.reasoning_effort = options.reasoningEffort;
  Object.assign(body, options.extra);

  const { data, cost } = await client.json<ChatResponse>("/chat/completions", { json: body, signal: options.signal, timeoutMs: options.timeoutMs });
  const text = data.choices?.[0]?.message?.content;
  if (typeof text !== "string") throw new GatewayError("gateway_invalid_response", undefined, "missing_message_content");
  return { text, citations: extractCitations(data.vertex_ai_grounding_metadata), model: data.model ?? model, usage: data.usage, cost };
}

/** `chat` with `json: true`, then parses the reply with `schema`. Tolerates ```json fences. */
export async function chatJson<T>(client: GatewayClient, options: ChatOptions & { schema: z.ZodType<T> }): Promise<ChatResult & { value: T }> {
  const { schema, ...rest } = options;
  const result = await chat(client, { ...rest, json: rest.json ?? !rest.search });
  const raw = result.text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new GatewayError("gateway_invalid_response", undefined, "reply_not_json");
  }
  const checked = schema.safeParse(parsed);
  if (!checked.success) throw new GatewayError("gateway_invalid_response", undefined, "reply_schema_mismatch");
  return { ...result, value: checked.data };
}

function usesCompletionTokens(model: string): boolean {
  return /^(gpt-|o\d)/.test(model);
}

function extractCitations(metadata: unknown): Citation[] {
  const entries = Array.isArray(metadata) ? metadata : metadata ? [metadata] : [];
  const seen = new Set<string>();
  const citations: Citation[] = [];
  for (const entry of entries) {
    const chunks = (entry as { groundingChunks?: unknown })?.groundingChunks;
    if (!Array.isArray(chunks)) continue;
    for (const chunk of chunks) {
      const web = (chunk as { web?: { uri?: unknown; title?: unknown } })?.web;
      if (typeof web?.uri !== "string" || seen.has(web.uri)) continue;
      seen.add(web.uri);
      citations.push({ uri: web.uri, ...(typeof web.title === "string" ? { title: web.title } : {}) });
    }
  }
  return citations;
}
