import { ArtifactEnvelopeSchema, type Artifact } from "@/contracts/artifacts";
import { JsonValueSchema, type JsonValue } from "@/contracts/common";
import type { DomainResultPublicationInput, DomainResultPublication } from "@/contracts/domain-results";
import { RunSnapshotSchema } from "@/contracts/runs";
import { ResultViewSchema } from "@/contracts/ui/result-view";
import { UIBlockSchema, type UIBlock } from "@/contracts/ui/blocks";
import type { DomainResultPublicationPort } from "./definition";

const OUTPUT_LIMIT = 32 * 1024;
const INPUT_LIMIT = 32 * 1024;
const ARTIFACT_DATA_LIMIT = 32 * 1024;
const VIEW_LIMIT = 64 * 1024;
const MAX_BLOCKS = 32;
const jsonBytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).byteLength;
const canonicalJson = (value: unknown): string => JSON.stringify(value, (_key, entry: unknown) => {
  if (entry && typeof entry === "object" && !Array.isArray(entry)) return Object.fromEntries(Object.entries(entry).sort(([a], [b]) => a.localeCompare(b)));
  return entry;
});
function withoutGeneratedIds(value: unknown, businessRunId: string, artifactId: string): unknown {
  if (value === businessRunId) return "$businessRunId";
  if (value === artifactId) return "$artifactId";
  if (Array.isArray(value)) return value.map(item => withoutGeneratedIds(item, businessRunId, artifactId));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, withoutGeneratedIds(item, businessRunId, artifactId)]));
  return value;
}

function validateReferences(blocks: UIBlock[], artifactId: string, provenanceInputArtifactIds: string[] = []): void {
  if (provenanceInputArtifactIds.length > 0) throw new Error("domain_result_reference_missing");
  for (const block of blocks) {
    const props = block.props as Record<string, unknown>;
    const hasUnresolvedReference = ["sourceIds", "claimIds", "evidenceIds", "reasonClaimIds", "factorIds", "actionIds", "stepIds"]
      .some(key => Array.isArray(props[key]) && props[key].length > 0) ||
      ["datasetId", "claimId"].some(key => typeof props[key] === "string") ||
      (typeof props.artifactId === "string" && props.artifactId !== artifactId);
    if (hasUnresolvedReference) throw new Error("domain_result_reference_missing");
  }
}

export async function publishDomainToolResult(input: DomainResultPublicationInput, port: DomainResultPublicationPort): Promise<{ output: unknown; publication: DomainResultPublication | null }> {
  if (!input.binding) return { output: input.output, publication: null };
  const binding = input.binding;
  const registeredBinding = input.domain.resultBindings?.find(candidate => candidate.id === input.bindingId);
  const exposedTool = input.domain.tools?.some(tool => tool.name === binding.toolName && tool.version === binding.toolVersion) ?? false;
  const exposedByManifest = input.domain.manifest.toolNames.includes(binding.toolName);
  if (binding.id !== input.bindingId || registeredBinding !== binding || !exposedTool || !exposedByManifest ||
    input.domain.manifest.id !== input.pack.id || input.domain.manifest.version !== input.pack.version) throw new Error("domain_result_binding_invalid");
  const parsedOutput = JsonValueSchema.parse(binding.outputSchema.parse(input.output));
  if (jsonBytes(parsedOutput) > OUTPUT_LIMIT) throw new Error("domain_result_output_too_large");
  const parsedRunInput = JsonValueSchema.parse(binding.inputSchema.parse(binding.toRunInput(parsedOutput)));
  if (jsonBytes(parsedRunInput) > INPUT_LIMIT) throw new Error("domain_result_input_too_large");
  const draft = binding.toArtifactDraft(parsedOutput);
  if (draft.kind !== binding.artifactKind || draft.version !== binding.artifactVersion) throw new Error("domain_result_artifact_binding_invalid");
  if (draft.sourceIds.length > 0 || draft.evidenceIds.length > 0 || draft.provenance.stepId !== undefined || (draft.provenance.inputArtifactIds?.length ?? 0) > 0) throw new Error("domain_result_reference_missing");
  const timestamp = input.clock().toISOString();
  const businessRunId = input.id("business-run");
  const artifactId = input.id("artifact");
  const rawArtifact = {
    id: artifactId, kind: draft.kind, version: draft.version, runId: businessRunId,
    workspaceId: input.scope.workspaceId, data: JsonValueSchema.parse(draft.data),
    sourceIds: draft.sourceIds, evidenceIds: draft.evidenceIds, createdAt: timestamp, provenance: draft.provenance,
  };
  const artifact = input.artifactSchemas.parse(rawArtifact) as Artifact<unknown>;
  if (artifact.kind !== binding.artifactKind || artifact.version !== binding.artifactVersion) throw new Error("domain_result_artifact_invalid");
  const typedArtifact = ArtifactEnvelopeSchema.parse(artifact) as Artifact<JsonValue>;
  if (jsonBytes(typedArtifact.data) > ARTIFACT_DATA_LIMIT) throw new Error("domain_result_artifact_too_large");
  const snapshot = RunSnapshotSchema.parse({
    id: businessRunId, workspaceId: input.scope.workspaceId, domainId: input.pack.id, domainVersion: input.pack.version,
    input: parsedRunInput, status: "completed", revision: 1, deadlineAt: null, steps: [], artifacts: [typedArtifact], warnings: [],
  });
  const blocks = input.domain.present({
    snapshot,
    get: (kind, schema) => {
      if (kind !== typedArtifact.kind) return null;
      return { ...typedArtifact, data: schema.parse(typedArtifact.data) };
    },
    sources: [], evidence: [],
  });
  if (!Array.isArray(blocks) || blocks.length > MAX_BLOCKS) throw new Error("domain_result_blocks_invalid");
  const parsedBlocks = blocks.map(block => UIBlockSchema.parse(block));
  validateReferences(parsedBlocks, artifactId, typedArtifact.provenance.inputArtifactIds ?? []);
  const resultView = ResultViewSchema.parse({ runId: businessRunId, revision: 1, title: input.domain.manifest.title, status: "completed", blocks: parsedBlocks });
  if (jsonBytes(resultView) > VIEW_LIMIT) throw new Error("domain_result_view_too_large");
  const publicationId = input.id("publication");
  const candidate = {
    key: { workspaceId: input.scope.workspaceId, userId: input.scope.userId, threadId: input.threadId, agentRunId: input.agentRunId, toolCallId: input.toolCallId, bindingId: binding.id },
    fingerprint: canonicalJson({
      pack: { id: input.pack.id, version: input.pack.version },
      bindingId: binding.id,
      tool: { name: binding.toolName, version: binding.toolVersion },
      output: parsedOutput,
      runInput: parsedRunInput,
      artifact: { kind: typedArtifact.kind, version: typedArtifact.version, data: typedArtifact.data, sourceIds: typedArtifact.sourceIds, evidenceIds: typedArtifact.evidenceIds, provenance: typedArtifact.provenance },
      view: withoutGeneratedIds({ revision: resultView.revision, title: resultView.title, status: resultView.status, blocks: resultView.blocks }, businessRunId, artifactId),
    }),
    pack: input.pack,
    packMetadata: { id: input.domain.manifest.id, version: input.domain.manifest.version, title: input.domain.manifest.title, branding: input.domain.manifest.branding },
    snapshot, artifact: typedArtifact,
    binding: { threadId: input.threadId, agentRunId: input.agentRunId, toolCallId: input.toolCallId, bindingId: binding.id, businessRunId, artifactId, packId: input.pack.id, packVersion: input.pack.version },
    resultView,
    outboxReference: { id: input.id("outbox"), publicationId, threadId: input.threadId, agentRunId: input.agentRunId, toolCallId: input.toolCallId, packId: input.pack.id, packVersion: input.pack.version, businessRunId, artifactId },
    publication: { publicationId, businessRunId, artifactId, resultView },
  };
  const stored = await port.publish(candidate);
  return { output: input.output, publication: stored };
}
