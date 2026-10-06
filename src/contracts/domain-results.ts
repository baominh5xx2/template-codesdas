import type { Artifact } from "@/contracts/artifacts";
import type { Scope, JsonValue } from "@/contracts/common";
import type { DomainResultBinding, DomainDefinition } from "@/core/domains/definition";
import type { ArtifactSchemaRegistry } from "@/core/capabilities/schema-registry";
import type { RunSnapshot } from "@/contracts/runs";
import type { ResultView } from "@/contracts/ui/result-view";

export interface PinnedPackReference { id: string; version: number }
export interface PublicationKey {
  workspaceId: Scope["workspaceId"];
  userId: Scope["userId"];
  threadId: string;
  agentRunId: string;
  toolCallId: string;
  bindingId: string;
}
export interface DomainResultPublication {
  publicationId: string;
  businessRunId: string;
  artifactId: string;
  resultView: ResultView;
}
export interface DomainResultPublicationInput {
  scope: Scope;
  threadId: string;
  agentRunId: string;
  toolCallId: string;
  pack: PinnedPackReference;
  bindingId: string;
  binding: DomainResultBinding | null;
  domain: DomainDefinition;
  output: unknown;
  artifactSchemas: ArtifactSchemaRegistry;
  clock: () => Date;
  id: (kind: "business-run" | "artifact" | "publication" | "outbox") => string;
}
export interface DomainResultPublicationCandidate {
  key: PublicationKey;
  fingerprint: string;
  pack: PinnedPackReference;
  packMetadata: Pick<DomainDefinition["manifest"], "id" | "version" | "title" | "branding">;
  snapshot: RunSnapshot;
  artifact: Artifact<JsonValue>;
  binding: { threadId: string; agentRunId: string; toolCallId: string; bindingId: string; businessRunId: string; artifactId: string; packId: string; packVersion: number };
  resultView: ResultView;
  outboxReference: { id: string; publicationId: string; threadId: string; agentRunId: string; toolCallId: string; packId: string; packVersion: number; businessRunId: string; artifactId: string };
  publication: DomainResultPublication;
}
