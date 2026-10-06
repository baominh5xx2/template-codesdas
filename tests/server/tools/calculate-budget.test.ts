import { describe, expect, it } from "vitest";
import type { BusinessToolContext } from "@/core/tools/definition";
import { calculateBudget } from "@/server/mcp/tools/calculate-budget/handler";
import { calculateBudgetInputSchema, calculateBudgetOutputSchema } from "@/server/mcp/tools/calculate-budget/schemas";
import { calculateBudgetTool } from "@/server/mcp/tools/calculate-budget/definition";

const context: BusinessToolContext = {
  threadId: "thread", runId: "run", toolCallId: "call", signal: new AbortController().signal,
  deadline: Date.now() + 120_000,
};
const input = { currency: "VND", budgetMinor: 5_000_000, items: [
  { label: "Di chuyển", amountMinor: 2_000_000 },
  { label: "Lưu trú", amountMinor: 1_000_000 },
  { label: "Ăn uống", amountMinor: 500_000 },
] };

describe("calculate_budget", () => {
  it("calculates the documented sample through its business definition", async () => {
    const result = await calculateBudgetTool.execute(input, context);
    expect(result).toEqual({ currency: "VND", totalMinor: 3_500_000, remainingMinor: 1_500_000, overBudget: false, itemCount: 3 });
    expect(calculateBudgetOutputSchema.safeParse(result).success).toBe(true);
  });

  it("returns an over-budget business result successfully", async () => {
    expect(await calculateBudget({ currency: "USD", budgetMinor: 100, items: [{ label: "Travel", amountMinor: 150 }] }, context))
      .toEqual({ currency: "USD", totalMinor: 150, remainingMinor: -50, overBudget: true, itemCount: 1 });
  });

  it.each([{ items: [] }, { items: [{ label: "Free", amountMinor: 0 }] }])("accepts zero values and empty item lists", async ({ items }) => {
    expect(await calculateBudget({ currency: "EUR", budgetMinor: 0, items }, context))
      .toEqual({ currency: "EUR", totalMinor: 0, remainingMinor: 0, overBudget: false, itemCount: items.length });
  });

  it("accepts 100 items at the money and label limits", async () => {
    const result = await calculateBudget({ currency: "USD", budgetMinor: 1_000_000_000_000,
      items: Array.from({ length: 100 }, () => ({ label: "x".repeat(120), amountMinor: 1_000_000_000_000 })) }, context);
    expect(result).toEqual({ currency: "USD", totalMinor: 100_000_000_000_000, remainingMinor: -99_000_000_000_000, overBudget: true, itemCount: 100 });
    expect(calculateBudgetOutputSchema.safeParse(result).success).toBe(true);
  });

  it.each(["usd", "US", "USDD", "U1D", " USD", "ĐNG"])("rejects invalid currency %s", (currency) => {
    expect(calculateBudgetInputSchema.safeParse({ ...input, currency }).success).toBe(false);
  });

  it.each([-1, 0.5, 1_000_000_000_001, Number.MAX_SAFE_INTEGER + 1, Infinity, NaN])("rejects invalid money %s", (amount) => {
    expect(calculateBudgetInputSchema.safeParse({ ...input, budgetMinor: amount }).success).toBe(false);
    expect(calculateBudgetInputSchema.safeParse({ ...input, items: [{ label: "Item", amountMinor: amount }] }).success).toBe(false);
  });

  it.each(["", "x".repeat(121)])("rejects labels outside the bounds", (label) => {
    expect(calculateBudgetInputSchema.safeParse({ ...input, items: [{ label, amountMinor: 0 }] }).success).toBe(false);
  });

  it("rejects 101 items", () => {
    expect(calculateBudgetInputSchema.safeParse({ ...input, items: Array.from({ length: 101 }, () => ({ label: "Item", amountMinor: 0 })) }).success).toBe(false);
  });

  it("rejects identity and unexpected model arguments", () => {
    expect(calculateBudgetInputSchema.safeParse({ ...input, threadId: "authority" }).success).toBe(false);
  });

  it("rejects unsafe arithmetic even when the typed handler is called directly", async () => {
    await expect(calculateBudget({ ...input, items: [{ label: "A", amountMinor: Number.MAX_SAFE_INTEGER }, { label: "B", amountMinor: 1 }] }, context)).rejects.toThrow();
  });

  it.each([
    { totalMinor: Number.MAX_SAFE_INTEGER + 1 }, { remainingMinor: Number.MIN_SAFE_INTEGER - 1 },
    { itemCount: 101 }, { currency: "usd" }, { totalMinor: -1 },
  ])("rejects invalid business output %j", (change) => {
    expect(calculateBudgetOutputSchema.safeParse({ currency: "USD", totalMinor: 0, remainingMinor: 0, overBudget: false, itemCount: 0, ...change }).success).toBe(false);
  });
});
