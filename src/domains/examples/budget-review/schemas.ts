import { z } from "zod";

export const budgetSummarySchema = z.object({
  currency: z.string().regex(/^[A-Z]{3}$/),
  totalMinor: z.number().int().nonnegative().safe(),
  remainingMinor: z.number().int().safe(),
  overBudget: z.boolean(),
  itemCount: z.number().int().min(0).max(100),
}).strict();

export type BudgetSummary = z.infer<typeof budgetSummarySchema>;
