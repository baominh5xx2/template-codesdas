import "server-only";

export type BusinessMcpConfig = { readonly enabled: false } | {
  readonly enabled: true;
  readonly url: URL;
  readonly token: string;
  readonly enabledTools: readonly string[];
  /** Hostnames only, matching the SDK's port-agnostic Host policy. */
  readonly allowedHosts: readonly string[];
  /** Exact serialized origins, including scheme and port. */
  readonly allowedOrigins: readonly string[];
};

function required(values: Record<string, string | undefined>, key: string): string {
  const value = values[key]?.trim();
  if (!value) throw new Error("business_mcp_config_invalid");
  return value;
}
function list(values: Record<string, string | undefined>, key: string): string[] {
  const entries = required(values, key).split(",").map((entry) => entry.trim());
  if (entries.some((entry) => !entry || entry.includes("*"))) throw new Error("business_mcp_config_invalid");
  return [...new Set(entries)];
}
function httpUrl(value: string): URL {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.hash || url.search) throw new Error("business_mcp_config_invalid");
  return url;
}

/** Parse only the dedicated Business MCP settings; disabled requires no secrets. */
export function loadBusinessMcpConfig(values: Record<string, string | undefined>): BusinessMcpConfig {
  if (values.BUSINESS_MCP_ENABLED === undefined || values.BUSINESS_MCP_ENABLED === "false") return { enabled: false };
  try {
    if (values.BUSINESS_MCP_ENABLED !== "true") throw new Error();
    const url = httpUrl(required(values, "BUSINESS_MCP_URL"));
    const token = required(values, "BUSINESS_MCP_TOKEN");
    if (/\s/.test(token)) throw new Error();
    const enabledTools = list(values, "BUSINESS_MCP_TOOLS");
    if (enabledTools.some((name) => !/^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/.test(name))) throw new Error();
    const allowedHosts = list(values, "BUSINESS_MCP_ALLOWED_HOSTS").map((host) => {
      const parsed = new URL(`http://${host}`);
      if (parsed.host !== host || parsed.hostname !== host || parsed.pathname !== "/" || parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error();
      return parsed.hostname;
    });
    const allowedOrigins = list(values, "BUSINESS_MCP_ALLOWED_ORIGINS").map((origin) => {
      const parsed = httpUrl(origin);
      if (parsed.origin !== origin) throw new Error();
      return parsed.origin;
    });
    return { enabled: true, url, token, enabledTools, allowedHosts, allowedOrigins };
  } catch {
    // URL/Zod/native exceptions can contain environment values. Never expose them.
    throw new Error("business_mcp_config_invalid");
  }
}
