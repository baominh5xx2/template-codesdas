import type { ArtifactDraft } from "@/contracts/artifacts";
import type { Schema } from "@/contracts/common";
import type { RunContext } from "@/core/ports/definition";
export interface Capability<I, O> { id: string; version: number; input: Schema<I>; output: Schema<O>; run(ctx: RunContext, input: I): Promise<ArtifactDraft<O>> }
