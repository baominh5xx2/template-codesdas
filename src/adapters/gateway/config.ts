import "server-only";

/** OpenAI-compatible multimodal gateway (default: AI Thực Chiến LiteLLM proxy). Separate from CHAT_MODEL_*. */
export const DEFAULT_GATEWAY_BASE_URL = "https://api.thucchien.ai";

export type GatewayConfig = { baseUrl: string; apiKey: string };

export type GatewayConfigResult =
  | { available: true; config: GatewayConfig }
  | { available: false; cause: "missing_config" | "invalid_config" };

export function loadGatewayConfig(values: Record<string, string | undefined>): GatewayConfigResult {
  const apiKey = values.AI_GATEWAY_API_KEY?.trim();
  if (!apiKey) return { available: false, cause: "missing_config" };
  if (/\s/.test(apiKey)) return { available: false, cause: "invalid_config" };
  const rawBaseUrl = values.AI_GATEWAY_BASE_URL?.trim() || DEFAULT_GATEWAY_BASE_URL;
  try {
    const url = new URL(rawBaseUrl);
    if ((url.protocol !== "https:" && url.protocol !== "http:") || url.username || url.password || url.search || url.hash) {
      return { available: false, cause: "invalid_config" };
    }
    return { available: true, config: { baseUrl: url.toString().replace(/\/+$/, ""), apiKey } };
  } catch {
    return { available: false, cause: "invalid_config" };
  }
}
