import type { BusinessToolContext } from "@/core/tools/definition";
import { calculateBudgetInputSchema, calculateBudgetOutputSchema, type CalculateBudgetInput, type CalculateBudgetOutput } from "./schemas";

/** Deterministic integer arithmetic; negative remaining is a successful result. */
export async function calculateBudget(input: CalculateBudgetInput, context: BusinessToolContext): Promise<CalculateBudgetOutput> {
  context.signal.throwIfAborted();
  if (Date.now() >= context.deadline) throw new Error("business_tool_deadline_exceeded");
  const validated = calculateBudgetInputSchema.parse(input);
  let totalMinor = 0;
  for (const item of validated.items) {
    totalMinor += item.amountMinor;
    if (!Number.isSafeInteger(totalMinor)) throw new Error("budget_arithmetic_unsafe");
  }
  const remainingMinor = validated.budgetMinor - totalMinor;
  if (!Number.isSafeInteger(remainingMinor)) throw new Error("budget_arithmetic_unsafe");
  return calculateBudgetOutputSchema.parse({
    currency: validated.currency, totalMinor, remainingMinor,
    overBudget: remainingMinor < 0, itemCount: validated.items.length,
  });
}
