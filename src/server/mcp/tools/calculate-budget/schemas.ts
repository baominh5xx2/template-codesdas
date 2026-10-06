import { z } from "zod";

const currencySchema = z.string().regex(/^[A-Z]{3}$/);
const moneySchema = z.number().int().nonnegative().max(1_000_000_000_000);

export const calculateBudgetInputSchema = z.strictObject({
  currency: currencySchema,
  budgetMinor: moneySchema,
  items: z.array(z.strictObject({ label: z.string().min(1).max(120), amountMinor: moneySchema })).max(100),
});

export const calculateBudgetOutputSchema = z.strictObject({
  currency: currencySchema,
  totalMinor: z.number().int().nonnegative(),
  remainingMinor: z.number().int(),
  overBudget: z.boolean(),
  itemCount: z.number().int().min(0).max(100),
});

export type CalculateBudgetInput = z.infer<typeof calculateBudgetInputSchema>;
export type CalculateBudgetOutput = z.infer<typeof calculateBudgetOutputSchema>;
