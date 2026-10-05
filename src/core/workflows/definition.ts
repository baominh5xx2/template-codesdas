import type { Artifact, ArtifactDraft } from "@/contracts/artifacts";
import type { JsonValue, Schema } from "@/contracts/common";
import type { Capability } from "@/core/capabilities/definition";
export interface StepBindingContext { input: JsonValue; get<T>(stepId: string, kind: string, schema: Schema<T>): Artifact<T> }
export interface Step<I = unknown, O = unknown> {
  id: string; capability: Capability<I, O>; bind(context: StepBindingContext): I;
  run(ctx: import("@/core/ports/definition").RunContext, input: I): Promise<ArtifactDraft<O>>;
  dependsOn: string[];
  timeoutMs: number; retry: number; required: boolean; artifactKind: string; version: number;
}
export interface WorkflowDefinition { steps: Step[]; requiredArtifactKinds: string[] }
