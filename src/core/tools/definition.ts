import type { z } from "zod";

/** Correlation IDs are server-resolved trace metadata; they grant no authority. */
export interface BusinessToolContext {
  readonly threadId: string;
  readonly runId: string;
  readonly toolCallId: string;
  readonly signal: AbortSignal;
  /** Absolute deadline as Unix epoch milliseconds, including queue time. */
  readonly deadline: number;
}

export interface BusinessTool<TInput, TOutput> {
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly input: z.ZodType<TInput>;
  readonly output: z.ZodType<TOutput>;
  readonly kind: "read" | "compute";
  execute(input: TInput, context: BusinessToolContext): Promise<TOutput>;
}
