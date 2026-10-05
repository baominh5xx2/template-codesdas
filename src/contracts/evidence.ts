import { z } from "zod";
import { SourceLocatorSchema } from "./common";
export const EvidenceSchema = z.object({ id: z.string(), sourceId: z.string(), documentId: z.string().optional(), locator: SourceLocatorSchema, excerpt: z.string() });
export type Evidence = z.infer<typeof EvidenceSchema>;
export const ClaimSchema = z.object({ id: z.string(), text: z.string(), kind: z.enum(["fact", "inference", "calculation", "recommendation"]), evidenceIds: z.array(z.string()), support: z.enum(["supported", "contradicted", "insufficient", "unchecked"]) });
export type Claim = z.infer<typeof ClaimSchema>;
export const EvidenceSetDataSchema = z.object({ evidence: z.array(EvidenceSchema), claims: z.array(ClaimSchema) });
export type EvidenceSetData = z.infer<typeof EvidenceSetDataSchema>;
