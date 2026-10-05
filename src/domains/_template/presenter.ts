import type { UIBlock } from "@/contracts/ui/blocks";
import type { DomainDefinition } from "@/core/domains/definition";
import { JsonValueSchema, type JsonValue } from "@/contracts/common";
import { TemplateInputSchema } from "./schemas";
/** Persisted/model data is decoded as JSON before a domain presenter can use it. */
export function artifactJson(value: unknown): JsonValue { return JsonValueSchema.parse(value); }
export function presentTemplate(): UIBlock[] { return []; }
export function createTemplateDefinition(manifest: DomainDefinition["manifest"]): DomainDefinition {
  return { manifest, inputSchema: TemplateInputSchema, workflow: { steps: [], requiredArtifactKinds: [] }, requiredArtifactKinds: [], systemPrompt: "No model execution is configured.", sources: [], present: presentTemplate };
}
