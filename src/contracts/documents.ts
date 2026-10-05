import { z } from "zod";
import { ClaimSchema } from "./evidence";
export const AnalysisDataSchema = z.object({ summary: z.string(), claims: z.array(ClaimSchema), findings: z.array(z.object({ id: z.string(), title: z.string(), claimIds: z.array(z.string()) })) });
export type AnalysisData = z.infer<typeof AnalysisDataSchema>;
export const RecommendationDataSchema = z.object({ items: z.array(z.object({ id: z.string(), title: z.string(), reasonClaimIds: z.array(z.string()), priority: z.enum(["low", "medium", "high"]), actions: z.array(z.string()) })) });
export type RecommendationData = z.infer<typeof RecommendationDataSchema>;
export const ReportDataSchema = z.object({ title: z.string(), summary: z.string(), claimIds: z.array(z.string()), metricArtifactIds: z.array(z.string()), recommendationIds: z.array(z.string()) });
export type ReportData = z.infer<typeof ReportDataSchema>;
