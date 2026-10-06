import { JsonValueSchema } from "@/contracts/common";
import type { UIBlock } from "@/contracts/ui/blocks";
import type { DomainDefinition, DomainResultBinding, PresentationContext } from "@/core/domains/definition";
import { manifest } from "./manifest.client";
import { budgetSummarySchema } from "../budget-review/schemas";
import { formatMinorAmount } from "../budget-review/currency";

const resultBinding: DomainResultBinding = {
  id: "calculate-budget-result", toolName: "business__calculate_budget", toolVersion: "1.0.0",
  outputSchema: budgetSummarySchema, artifactKind: "budget.summary", artifactVersion: 1,
  inputSchema: JsonValueSchema,
  toRunInput: output => output,
  toArtifactDraft: output => ({ kind: "budget.summary", version: 1, data: output, sourceIds: [], evidenceIds: [], provenance: { capabilityId: "business__calculate_budget", capabilityVersion: 1 } }),
};
function presentCompact(ctx: PresentationContext): UIBlock[] {
  const artifact = ctx.get("budget.summary", budgetSummarySchema);
  if (!artifact) return [];
  const budget = budgetSummarySchema.parse(artifact.data);
  return [{ id: "budget-summary", type: "markdown", props: { content: `**Total:** ${formatMinorAmount(budget.totalMinor, budget.currency)}\n\n**Remaining:** ${formatMinorAmount(budget.remainingMinor, budget.currency)}\n\n**Items:** ${budget.itemCount}${budget.overBudget ? "\n\n⚠️ Over budget" : ""}` } }];
}

export const domain: DomainDefinition = {
  manifest, inputSchema: JsonValueSchema, requiredArtifactKinds: ["budget.summary"],
  systemPrompt: "Use business__calculate_budget and return a concise Markdown summary of the actual totals, remaining amount, and item count. Do not add unsupported evidence.",
  sources: [], tools: [{ name: "business__calculate_budget", version: "1.0.0" }], resultBindings: [resultBinding], present: presentCompact,
};
