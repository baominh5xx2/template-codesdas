import type { UIBlock } from "@/contracts/ui/blocks";
import type { PresentationContext } from "@/core/domains/definition";
import { budgetSummarySchema } from "./schemas";

export function presentBudgetReview(ctx: PresentationContext): UIBlock[] {
  const artifact = ctx.get("budget.summary", budgetSummarySchema);
  if (!artifact) return [];
  const budget = budgetSummarySchema.parse(artifact.data);
  const blocks: UIBlock[] = [
    { id: "budget-total", type: "metric", props: { label: "Total", value: budget.totalMinor / 100, unit: budget.currency, sourceIds: [] } },
    { id: "budget-remaining", type: "metric", props: { label: "Remaining", value: budget.remainingMinor / 100, unit: budget.currency, sourceIds: [] } },
  ];
  if (budget.overBudget) blocks.push({ id: "budget-warning", type: "warning", props: { title: "Over budget", message: "The calculated total exceeds the available budget.", severity: "warning" } });
  return blocks;
}
