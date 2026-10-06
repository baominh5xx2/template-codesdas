import type { DomainManifest } from "@/contracts/domains";
import type { Schema, JsonValue } from "@/contracts/common";
import type { ArtifactDraft } from "@/contracts/artifacts";
import type { UIBlock } from "@/contracts/ui/blocks";
import type { WorkflowDefinition } from "@/core/workflows/definition";
import type { ArtifactSchemaRegistry } from "@/core/capabilities/schema-registry";
import type { SourceRef } from "@/contracts/sources";
import type { Evidence } from "@/contracts/evidence";
import type { RunSnapshot } from "@/contracts/runs";
import type { Scope } from "@/contracts/common";
export interface PresentationContext { snapshot: RunSnapshot; get<T>(kind: string, schema: Schema<T>): import("@/contracts/artifacts").Artifact<T> | null; sources: SourceRef[]; evidence: Evidence[] }
export interface DomainResultBinding {
  id: string;
  toolName: string;
  toolVersion: string;
  outputSchema: Schema<JsonValue>;
  artifactKind: string;
  artifactVersion: number;
  inputSchema: Schema<JsonValue>;
  toRunInput(output: JsonValue): JsonValue;
  toArtifactDraft(output: JsonValue): ArtifactDraft<JsonValue>;
}
export interface DomainToolReference { name: string; version: string; optional?: boolean }
export interface DomainDefinition {
  manifest: DomainManifest;
  inputSchema: Schema<JsonValue>;
  workflow?: WorkflowDefinition;
  requiredArtifactKinds: string[];
  systemPrompt: string;
  sources: string[];
  tools?: DomainToolReference[];
  resultBindings?: DomainResultBinding[];
  requirements?: string[];
  rules?: JsonValue;
  present(ctx: PresentationContext): UIBlock[];
}
export interface DomainValidationCatalog {
  sourceProfileIds: ReadonlySet<string>;
  toolNames: ReadonlySet<string>;
  registeredTools?: ReadonlyMap<string, DomainToolReference>;
  registeredDomainIdentities: Set<string>;
  artifactSchemas: ArtifactSchemaRegistry;
}
export type DomainScope = Scope;
