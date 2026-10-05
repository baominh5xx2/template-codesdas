import { z } from "zod";

const id = z.string().min(1);
const sourceIds = z.array(id);
export const MetricPropsSchema = z.object({ label: z.string(), value: z.number().finite().nullable(), unit: z.string().optional(), delta: z.number().finite().optional(), sourceIds });
export const ChartPropsSchema = z.object({ title: z.string(), kind: z.enum(["bar", "line", "area", "pie", "scatter"]), datasetId: id, xKey: id, series: z.array(z.object({ key: id, label: z.string(), unit: z.string().optional() })), aggregation: z.enum(["none", "sum", "mean", "count"]), sourceIds });
export const TablePropsSchema = z.object({ title: z.string(), datasetId: id, columns: z.array(id), pageSize: z.number().int().positive() });
export const InsightPropsSchema = z.object({ title: z.string(), claimIds: z.array(id), severity: z.enum(["info", "warning", "critical"]) });
export const RecommendationPropsSchema = z.object({ title: z.string(), reasonClaimIds: z.array(id), priority: z.enum(["low", "medium", "high"]), actionIds: z.array(id) });
export const RiskPropsSchema = z.object({ score: z.number().finite().nullable(), min: z.number().finite(), max: z.number().finite(), direction: z.enum(["higher-is-worse", "higher-is-better"]), level: z.enum(["low", "medium", "high", "unknown"]), factorIds: z.array(id), method: z.string(), completeness: z.number().finite().min(0).max(1) }).refine(p => p.max > p.min && (p.score === null || (p.score >= p.min && p.score <= p.max)), "risk_score_out_of_range");
export const WarningPropsSchema = z.object({ title: z.string(), message: z.string(), severity: z.enum(["info", "warning", "critical"]) });
export const SourcePropsSchema = z.object({ sourceIds });
export const EvidencePropsSchema = z.object({ claimId: id, evidenceIds: z.array(id) });
export const VerdictPropsSchema = z.object({ claimId: id, support: z.enum(["supported", "contradicted", "insufficient", "unchecked"]), reason: z.string() });
export const TimelinePropsSchema = z.object({ items: z.array(z.object({ id, title: z.string(), description: z.string().optional(), at: z.string().optional() })) });
export const ProgressPropsSchema = z.object({ stepIds: z.array(id) });
export const ActionPropsSchema = z.object({ label: z.string(), actionId: z.enum(["export.markdown", "export.json", "retry-run", "focus-artifact"]), artifactId: id.optional() });
export const MapPropsSchema = z.object({ places: z.array(z.object({ id, name: z.string(), lat: z.number().finite().min(-90).max(90), lng: z.number().finite().min(-180).max(180) })), available: z.boolean(), reason: z.string().optional() });
export const PlacePropsSchema = z.object({ name: z.string(), lat: z.number().finite().min(-90).max(90), lng: z.number().finite().min(-180).max(180), description: z.string().optional(), sourceIds });
export const ComparisonPropsSchema = z.object({ criteria: z.array(z.object({ key: id, label: z.string(), unit: z.string().optional() })), options: z.array(z.object({ id, label: z.string(), values: z.record(id, z.union([z.string(), z.number().finite(), z.null()])) })) });
export const ReportSectionPropsSchema = z.object({ title: z.string(), blockIds: z.array(id) });
export const MarkdownPropsSchema = z.object({ content: z.string() });
export const MediaPropsSchema = z.object({ kind: z.enum(["image", "audio", "video"]), storageKey: z.string().min(1).optional(), url: z.string().url().optional(), alt: z.string() }).refine(p => Number(Boolean(p.storageKey)) + Number(Boolean(p.url)) === 1, "media_source_invalid");

export const UIBlockSchema = z.discriminatedUnion("type", [
  z.object({ id, type: z.literal("metric"), props: MetricPropsSchema }), z.object({ id, type: z.literal("chart"), props: ChartPropsSchema }),
  z.object({ id, type: z.literal("table"), props: TablePropsSchema }), z.object({ id, type: z.literal("insight"), props: InsightPropsSchema }),
  z.object({ id, type: z.literal("recommendation"), props: RecommendationPropsSchema }), z.object({ id, type: z.literal("risk"), props: RiskPropsSchema }),
  z.object({ id, type: z.literal("warning"), props: WarningPropsSchema }), z.object({ id, type: z.literal("source"), props: SourcePropsSchema }),
  z.object({ id, type: z.literal("evidence"), props: EvidencePropsSchema }), z.object({ id, type: z.literal("verdict"), props: VerdictPropsSchema }),
  z.object({ id, type: z.literal("timeline"), props: TimelinePropsSchema }), z.object({ id, type: z.literal("progress"), props: ProgressPropsSchema }),
  z.object({ id, type: z.literal("action"), props: ActionPropsSchema }), z.object({ id, type: z.literal("map"), props: MapPropsSchema }),
  z.object({ id, type: z.literal("place"), props: PlacePropsSchema }), z.object({ id, type: z.literal("comparison"), props: ComparisonPropsSchema }),
  z.object({ id, type: z.literal("report-section"), props: ReportSectionPropsSchema }), z.object({ id, type: z.literal("markdown"), props: MarkdownPropsSchema }),
  z.object({ id, type: z.literal("media"), props: MediaPropsSchema }),
]);
export type UIBlock = z.infer<typeof UIBlockSchema>;
