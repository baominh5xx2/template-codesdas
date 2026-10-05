import { z } from "zod";
import { RunStatusSchema } from "../common";
import { UIBlockSchema } from "./blocks";

export const ResultViewSchema = z.object({ runId: z.string(), revision: z.number().int().nonnegative(), title: z.string(), status: RunStatusSchema, blocks: z.array(UIBlockSchema) }).superRefine((view, ctx) => {
  const ids = new Set<string>();
  for (const [index, block] of view.blocks.entries()) {
    if (ids.has(block.id)) ctx.addIssue({ code: "custom", path: ["blocks", index, "id"], message: "block_id_duplicate" });
    ids.add(block.id);
  }
  const refs = new Map(view.blocks.filter(b => b.type === "report-section").map(b => [b.id, b.props.blockIds]));
  const visiting = new Set<string>(); const visited = new Set<string>();
  const visit = (node: string): void => {
    if (visiting.has(node)) throw new Error("report_cycle");
    if (visited.has(node)) return;
    visiting.add(node);
    for (const child of refs.get(node) ?? []) {
      if (!ids.has(child)) throw new Error("report_reference_missing");
      if (refs.has(child)) visit(child);
    }
    visiting.delete(node); visited.add(node);
  };
  for (const node of refs.keys()) {
    try { visit(node); } catch (error) { ctx.addIssue({ code: "custom", path: ["blocks"], message: error instanceof Error ? error.message : "report_reference_invalid" }); return; }
  }
});
export type ResultView = z.infer<typeof ResultViewSchema>;
export const PresentationContextSchema = z.object({ snapshot: z.unknown(), sources: z.array(z.unknown()), evidence: z.array(z.unknown()) });
