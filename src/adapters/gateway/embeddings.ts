import "server-only";
import { GatewayError, type GatewayClient } from "./client";
import { GATEWAY_DEFAULTS } from "./defaults";

/** Models for which the gateway returns only one vector per request. */
const SINGLE_INPUT_MODELS = new Set(["gemini-embedding-2"]);

export type EmbedOptions = { input: string | string[]; model?: string; signal?: AbortSignal };
export type EmbedResult = { vectors: number[][]; model: string; cost: number | null };

/** Index and query with the same model: vectors from different models are not comparable. */
export async function embed(client: GatewayClient, options: EmbedOptions): Promise<EmbedResult> {
  const model = options.model ?? GATEWAY_DEFAULTS.embedding;
  const inputs = Array.isArray(options.input) ? options.input : [options.input];
  if (inputs.length === 0) return { vectors: [], model, cost: 0 };
  const batches = SINGLE_INPUT_MODELS.has(model) ? inputs.map((text) => [text]) : [inputs];

  const vectors: number[][] = [];
  let cost: number | null = 0;
  for (const batch of batches) {
    const { data, cost: batchCost } = await client.json<{ data?: { index?: number; embedding?: unknown }[] }>("/embeddings", {
      json: { model, input: batch.length === 1 ? batch[0] : batch },
      signal: options.signal,
    });
    const rows = [...(data.data ?? [])].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    if (rows.length !== batch.length || rows.some((row) => !isVector(row.embedding))) {
      throw new GatewayError("gateway_invalid_response", undefined, "embedding_count_mismatch");
    }
    for (const row of rows) vectors.push(row.embedding as number[]);
    cost = cost === null || batchCost === null ? null : cost + batchCost;
  }
  return { vectors, model, cost };
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return normA && normB ? dot / Math.sqrt(normA * normB) : 0;
}

function isVector(value: unknown): value is number[] {
  return Array.isArray(value) && value.length > 0 && typeof value[0] === "number";
}
