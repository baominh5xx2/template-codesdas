import "server-only";
import { CHAT_NOTICE } from "@/contracts/chat";
import type { BusinessToolRegistration } from "@/server/mcp/catalog";

export const BUSINESS_TOOL_MAX_BYTES = 32 * 1024;
export class BusinessMcpFailure extends Error {
  constructor(readonly code: string) { super(CHAT_NOTICE); this.name = "BusinessMcpFailure"; }
}
export function assertBusinessBytes(value: unknown): void {
  try {
    if (Buffer.byteLength(JSON.stringify(value), "utf8") > BUSINESS_TOOL_MAX_BYTES) throw new Error();
  } catch { throw new BusinessMcpFailure("result_too_large"); }
}
/** Nothing from prose, protocol errors or unvalidated outputs enters the model. */
export function decodeBusinessResult(registration: BusinessToolRegistration, result: unknown): unknown {
  assertBusinessBytes(result);
  if (!result || typeof result !== "object" || Array.isArray(result)) throw new BusinessMcpFailure("output_invalid");
  const record = result as Record<string, unknown>;
  if (record.isError) throw new BusinessMcpFailure("tool_failed");
  if (!record.structuredContent || typeof record.structuredContent !== "object" || Array.isArray(record.structuredContent)) throw new BusinessMcpFailure("output_invalid");
  const parsed = registration.definition.output.safeParse(record.structuredContent);
  if (!parsed.success) throw new BusinessMcpFailure("output_invalid");
  return parsed.data;
}
