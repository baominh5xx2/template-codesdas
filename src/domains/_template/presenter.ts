import type { UIBlock } from "@/contracts/ui/blocks";
import type { DomainDefinition } from "@/core/domains/definition";
import { JsonValueSchema, type JsonValue } from "@/contracts/common";
import type { DomainResultBinding } from "@/core/domains/definition";
import { TemplateInputSchema } from "./schemas";
/** Persisted/model data is decoded as JSON before a domain presenter can use it. */
export function artifactJson(value: unknown): JsonValue { return JsonValueSchema.parse(value); }
export function presentTemplate(): UIBlock[] { return []; }
/** Example declaration only; the application must register this tool and schema before use. */
export const templateResultBinding: DomainResultBinding = {
  id: "example-result",
  toolName: "business__example",
  toolVersion: 1,
  outputSchema: JsonValueSchema,
  artifactKind: "example.result",
  artifactVersion: 1,
  inputSchema: TemplateInputSchema,
  toRunInput: output => output,
  toArtifactDraft: output => ({
    kind: "example.result", version: 1, data: output, sourceIds: [], evidenceIds: [],
    provenance: { capabilityId: "business__example", capabilityVersion: 1 },
  }),
};
export function createTemplateDefinition(manifest: DomainDefinition["manifest"]): DomainDefinition {
  return { manifest, inputSchema: TemplateInputSchema, requiredArtifactKinds: [], systemPrompt: "No model execution is configured.", sources: [], present: presentTemplate };
}
