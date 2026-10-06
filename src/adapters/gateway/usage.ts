import "server-only";
import type { GatewayClient } from "./client";

export type KeyInfo = {
  spend?: number;
  /** null when the budget is set at team level. */
  max_budget?: number | null;
  team_id?: string;
  model_spend?: Record<string, number>;
  [field: string]: unknown;
};

/** Spend and limits for the configured key (`GET /key/info`). Team totals: `/team/info?team_id=…`. */
export async function keyInfo(client: GatewayClient, signal?: AbortSignal): Promise<KeyInfo> {
  const { data } = await client.json<{ info?: KeyInfo } & KeyInfo>("/key/info", { signal, timeoutMs: 30_000 });
  return data.info ?? data;
}
