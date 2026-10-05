import { z } from "zod";
import { JsonValueSchema } from "./common";

export const ArtifactProvenanceSchema = z.object({ capabilityId: z.string().min(1), capabilityVersion: z.number().int().positive(), stepId: z.string().optional(), inputArtifactIds: z.array(z.string()).optional() });
export const ArtifactEnvelopeSchema = z.object({
  id: z.string().min(1), kind: z.string().min(1), version: z.number().int().positive(), runId: z.string().min(1),
  workspaceId: z.string().min(1), data: JsonValueSchema, sourceIds: z.array(z.string()), evidenceIds: z.array(z.string()),
  createdAt: z.string().datetime(), provenance: ArtifactProvenanceSchema,
});
export type Artifact<T> = Omit<z.infer<typeof ArtifactEnvelopeSchema>, "data"> & { data: T };
export type ArtifactDraft<T> = Pick<Artifact<T>, "kind" | "version" | "data" | "sourceIds" | "evidenceIds" | "provenance">;
