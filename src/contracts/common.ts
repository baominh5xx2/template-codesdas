import { z } from "zod";

export const ScopeSchema = z.object({ userId: z.string().min(1), workspaceId: z.string().min(1), trustedOperator: z.boolean() });
export type Scope = z.infer<typeof ScopeSchema>;
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() => z.union([
  z.string(), z.number().finite(), z.boolean(), z.null(), z.array(JsonValueSchema),
  z.record(z.string(), JsonValueSchema),
])) as z.ZodType<JsonValue>;
export type Schema<T> = z.ZodType<T>;

export const SourceLocatorSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), start: z.number().int().nonnegative(), end: z.number().int().nonnegative() }),
  z.object({ type: z.literal("pdf"), page: z.number().int().positive(), start: z.number().int().nonnegative(), end: z.number().int().nonnegative() }),
  z.object({ type: z.literal("table"), sheet: z.string().optional(), row: z.number().int().nonnegative(), column: z.string().optional() }),
  z.object({ type: z.literal("web"), section: z.string(), start: z.number().int().nonnegative(), end: z.number().int().nonnegative() }),
]);
export type SourceLocator = z.infer<typeof SourceLocatorSchema>;
export const RunStatusSchema = z.enum(["queued", "running", "completed", "partial", "failed", "cancelled", "interrupted"]);
export type RunStatus = z.infer<typeof RunStatusSchema>;
export const StepStatusSchema = z.enum(["pending", "running", "succeeded", "skipped", "failed"]);
export type StepStatus = z.infer<typeof StepStatusSchema>;
export const StepStateSchema = z.object({ id: z.string(), status: StepStatusSchema, attempt: z.number().int().nonnegative(), artifactIds: z.array(z.string()), startedAt: z.string().nullable(), finishedAt: z.string().nullable(), errorCode: z.string().nullable() });
export type StepState = z.infer<typeof StepStateSchema>;
export const BudgetSchema = z.object({}).passthrough();
export interface Budget { consume(operation: "model" | "repair" | "fetch" | "tool"): void; remainingMs(): number }
