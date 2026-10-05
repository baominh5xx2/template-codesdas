import type { DomainManifest } from "@/contracts/domains";
import type { Schema, JsonValue } from "@/contracts/common";
import type { UIBlock } from "@/contracts/ui/blocks";
import type { WorkflowDefinition } from "@/core/workflows/definition";
import type { ArtifactSchemaRegistry } from "@/core/capabilities/schema-registry";
import type { SourceRef } from "@/contracts/sources";
import type { Evidence } from "@/contracts/evidence";
import type { RunSnapshot } from "@/contracts/runs";
import type { Scope } from "@/contracts/common";
export interface PresentationContext { snapshot: RunSnapshot; get<T>(kind: string, schema: Schema<T>): import("@/contracts/artifacts").Artifact<T> | null; sources: SourceRef[]; evidence: Evidence[] }
export interface DomainDefinition { manifest: DomainManifest; inputSchema: Schema<JsonValue>; workflow: WorkflowDefinition; requiredArtifactKinds: string[]; systemPrompt: string; sources: string[]; present(ctx: PresentationContext): UIBlock[] }
export interface DomainValidationCatalog { sourceProfileIds: ReadonlySet<string>; toolNames: ReadonlySet<string>; artifactSchemas: ArtifactSchemaRegistry }
export type DomainScope = Scope;
