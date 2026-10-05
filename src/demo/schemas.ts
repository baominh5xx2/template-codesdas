import { z } from "zod";
import { ClaimSchema, EvidenceSchema } from "@/contracts/evidence";
import { RunSnapshotSchema } from "@/contracts/runs";
import { SourceRefSchema } from "@/contracts/sources";
import { DatasetPageSchema } from "@/contracts/datasets";
import { ResultViewSchema } from "@/contracts/ui/result-view";

export const DemoStateSchema = z.enum(["loading", "empty", "error", "success", "partial", "unavailable"]);
export type DemoState = z.infer<typeof DemoStateSchema>;
export const DemoBundleSchema = z.object({
  label: z.string(), view: ResultViewSchema, snapshot: RunSnapshotSchema,
  sources: z.array(SourceRefSchema), evidence: z.array(EvidenceSchema), claims: z.array(ClaimSchema),
  datasets: z.record(z.string(), DatasetPageSchema),
}).superRefine((bundle, ctx) => {
  const sources = new Set(bundle.sources.map(({ id }) => id));
  const evidence = new Set(bundle.evidence.map(({ id }) => id));
  const claims = new Set(bundle.claims.map(({ id }) => id));
  const steps = new Set(bundle.snapshot.steps.map(({ id }) => id));
  const blocks = new Map(bundle.view.blocks.map(block => [block.id, block]));
  for (const [index, item] of bundle.evidence.entries()) if (!sources.has(item.sourceId)) ctx.addIssue({ code: "custom", path: ["evidence", index, "sourceId"], message: "demo_reference_source_missing" });
  for (const [index, item] of bundle.claims.entries()) for (const id of item.evidenceIds) if (!evidence.has(id)) ctx.addIssue({ code: "custom", path: ["claims", index, "evidenceIds"], message: "demo_reference_evidence_missing" });
  for (const [index, block] of bundle.view.blocks.entries()) {
    const sourceIds = block.type === "metric" || block.type === "chart" || block.type === "place" ? block.props.sourceIds : block.type === "source" ? block.props.sourceIds : [];
    for (const id of sourceIds) if (!sources.has(id)) ctx.addIssue({ code: "custom", path: ["view", "blocks", index], message: "demo_reference_source_missing" });
    const claimIds = block.type === "insight" ? block.props.claimIds : block.type === "recommendation" ? block.props.reasonClaimIds : block.type === "risk" ? block.props.factorIds : block.type === "evidence" || block.type === "verdict" ? [block.props.claimId] : [];
    for (const id of claimIds) if (!claims.has(id)) ctx.addIssue({ code: "custom", path: ["view", "blocks", index], message: "demo_reference_claim_missing" });
    if (block.type === "evidence") for (const id of block.props.evidenceIds) if (!evidence.has(id)) ctx.addIssue({ code: "custom", path: ["view", "blocks", index], message: "demo_reference_evidence_missing" });
    if (block.type === "chart" || block.type === "table") {
      const page = bundle.datasets[block.props.datasetId];
      if (!page) ctx.addIssue({ code: "custom", path: ["view", "blocks", index], message: "demo_reference_dataset_missing" });
      else {
        const columnKeys = new Set(page.columns.map(({ key }) => key));
        const referenced = block.type === "chart" ? [block.props.xKey, ...block.props.series.map(({ key }) => key)] : block.props.columns;
        for (const key of referenced) if (!columnKeys.has(key)) ctx.addIssue({ code: "custom", path: ["view", "blocks", index], message: "demo_reference_column_missing" });
      }
    }
    if (block.type === "progress") for (const id of block.props.stepIds) if (!steps.has(id)) ctx.addIssue({ code: "custom", path: ["view", "blocks", index], message: "demo_reference_step_missing" });
    if (block.type === "recommendation") for (const id of block.props.actionIds) if (blocks.get(id)?.type !== "action") ctx.addIssue({ code: "custom", path: ["view", "blocks", index], message: "demo_reference_action_missing" });
  }
});
export type DemoBundle = z.infer<typeof DemoBundleSchema>;
