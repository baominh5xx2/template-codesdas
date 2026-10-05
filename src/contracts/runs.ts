import { z } from "zod";
import { ArtifactEnvelopeSchema } from "./artifacts";
import { JsonValueSchema, RunStatusSchema, StepStateSchema } from "./common";
export const RunSnapshotSchema = z.object({ id: z.string(), workspaceId: z.string(), domainId: z.string(), domainVersion: z.number().int().positive(), input: JsonValueSchema, status: RunStatusSchema, revision: z.number().int().nonnegative(), deadlineAt: z.string().nullable(), steps: z.array(StepStateSchema), artifacts: z.array(ArtifactEnvelopeSchema), warnings: z.array(z.string()) });
export type RunSnapshot = z.infer<typeof RunSnapshotSchema>;
export const UploadRecordSchema = z.object({ id: z.string(), sourceId: z.string(), workspaceId: z.string(), userId: z.string(), name: z.string(), mime: z.string(), size: z.number().int().nonnegative(), contentHash: z.string(), storageKey: z.string(), createdAt: z.string() });
export type UploadRecord = z.infer<typeof UploadRecordSchema>;
