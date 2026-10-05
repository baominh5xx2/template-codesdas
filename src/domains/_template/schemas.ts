import { z } from "zod";
import { JsonValueSchema, type JsonValue } from "@/contracts/common";
export const TemplateInputSchema = z.object({ request: z.string().min(1) });
export const TemplateArtifactSchema = z.object({ summary: z.string(), payload: JsonValueSchema });
export function validateTemplateArtifact(value: unknown): JsonValue { return JsonValueSchema.parse(value); }
