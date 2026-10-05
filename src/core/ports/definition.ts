import type { Artifact } from "@/contracts/artifacts";
import type { ColumnSpec, DataRow, DatasetPage, DatasetQuery, DatasetRef } from "@/contracts/datasets";
import type { Scope, SourceLocator } from "@/contracts/common";
import type { Evidence } from "@/contracts/evidence";
import type { NormalizedDocument, SearchHit, SourceDocument, SourceProfile, SourceRef } from "@/contracts/sources";
import type { RunSnapshot, UploadRecord } from "@/contracts/runs";

export interface RunRepository {
  create(scope: Scope, domainId: string, domainVersion: number, input: import("@/contracts/common").JsonValue, steps?: import("@/contracts/common").StepState[]): Promise<RunSnapshot>;
  startStep(scope: Scope, runId: string, stepId: string): Promise<void>;
  finishStep(scope: Scope, runId: string, stepId: string, status: "failed" | "skipped", errorCode?: string): Promise<void>;
  claim(scope: Scope, runId: string, deadlineAt: string): Promise<boolean>;
  commitStep(scope: Scope, runId: string, stepId: string, artifact: Artifact<unknown>): Promise<void>;
  finish(scope: Scope, runId: string, status: RunSnapshot["status"], warnings: string[]): Promise<void>;
  get(scope: Scope, runId: string): Promise<RunSnapshot | null>; cancel(scope: Scope, runId: string): Promise<void>;
}
export interface ArtifactRepository { get(scope: Scope, artifactId: string): Promise<Artifact<unknown> | null>; list(scope: Scope, runId: string): Promise<Artifact<unknown>[]> }
export interface UploadRepository { put(scope: Scope, record: UploadRecord): Promise<void>; get(scope: Scope, id: string): Promise<UploadRecord | null> }
export interface DatasetRepository { import(scope: Scope, source: SourceRef, columns: ColumnSpec[], rows: DataRow[]): Promise<DatasetRef>; read(scope: Scope, id: string, query: DatasetQuery): Promise<DatasetPage> }
export interface StoragePort { write(key: string, bytes: Uint8Array): Promise<void>; read(key: string): Promise<Uint8Array>; remove(key: string): Promise<void> }
export interface GatewayFeatures { protocol: "openai-chat" | "unsupported"; streaming: boolean; structuredJson: boolean; nativeTools: boolean; vision: boolean; embeddings: boolean; audio: boolean }
export interface LlmRequest { system: string; messages: { role: "user" | "assistant"; content: string }[]; responseSchema?: import("@/contracts/common").JsonValue; maxOutputTokens: number }
export interface LlmPort { complete(request: LlmRequest, signal: AbortSignal): Promise<string>; features(): GatewayFeatures }
export interface SourcePort { fetch(url: string, profile: SourceProfile, signal: AbortSignal): Promise<SourceDocument>; search(query: string, profile: SourceProfile, signal: AbortSignal): Promise<SearchHit[]> }
export interface ParserPort { parse(file: Uint8Array, mime: string): Promise<NormalizedDocument[]> }
export interface RuntimePorts { runs: RunRepository; artifacts: ArtifactRepository; uploads: UploadRepository; datasets: DatasetRepository; storage: StoragePort; llm: LlmPort; sources: SourcePort; parsers: ParserPort }
export interface RunContext { scope: Scope; runId: string; stepId: string; signal: AbortSignal; deadlineAt: number; budget: import("@/contracts/common").Budget; ports: RuntimePorts; expectedArtifact: { kind: string; version: number }; artifactSchemas: import("@/core/capabilities/schema-registry").ArtifactSchemaRegistry }
export type { Evidence, SourceLocator };
