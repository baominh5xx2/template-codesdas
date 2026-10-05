import type { Scope } from "@/contracts/common";
import type { DatasetQuery, DatasetPage } from "@/contracts/datasets";
import type { ResultView } from "@/contracts/ui/result-view";
import type { RunSnapshot, UploadRecord } from "@/contracts/runs";
import type { SourceRef } from "@/contracts/sources";
import type { Evidence } from "@/contracts/evidence";
import type { Artifact } from "@/contracts/artifacts";
export interface CoreServices {
  createRun(scope: Scope, domainId: string, input: import("@/contracts/common").JsonValue): Promise<RunSnapshot>;
  executeRun(scope: Scope, runId: string, signal: AbortSignal): Promise<RunSnapshot>;
  getRun(scope: Scope, runId: string): Promise<RunSnapshot>;
  cancelRun(scope: Scope, runId: string): Promise<void>;
  createUpload(scope: Scope, record: UploadRecord): Promise<UploadRecord>;
  ingestUpload(scope: Scope, uploadId: string, signal: AbortSignal): Promise<import("@/contracts/sources").SourceDocument[]>;
  ingestUrl(scope: Scope, url: string, profile: import("@/contracts/sources").SourceProfile, signal: AbortSignal): Promise<import("@/contracts/sources").SourceDocument>;
  getResult(scope: Scope, runId: string): Promise<ResultView>;
  queryDataset(scope: Scope, datasetId: string, query: DatasetQuery): Promise<DatasetPage>;
  getArtifact(scope: Scope, id: string): Promise<Artifact<unknown> | null>;
}
export interface ResultInputs { sources: SourceRef[]; evidence: Evidence[] }
