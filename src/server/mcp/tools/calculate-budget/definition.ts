import type { BusinessTool } from "@/core/tools/definition";
import { calculateBudget } from "./handler";
import { calculateBudgetInputSchema, calculateBudgetOutputSchema, type CalculateBudgetInput, type CalculateBudgetOutput } from "./schemas";

export const calculateBudgetTool: BusinessTool<CalculateBudgetInput, CalculateBudgetOutput> = {
  name: "calculate_budget",
  version: "1.0.0",
  description: "Calculate item totals and remaining budget in integer minor units for one currency; an over-budget total is returned as a successful calculation.",
  input: calculateBudgetInputSchema,
  output: calculateBudgetOutputSchema,
  kind: "compute",
  execute: calculateBudget,
};
