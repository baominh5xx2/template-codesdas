import { describe, expect, it } from "vitest";
import { createDomainCatalog } from "@/domains/catalog.server";
import { budgetSummarySchema, type BudgetSummary } from "@/domains/examples/budget-review/schemas";
import { domain as review } from "@/domains/examples/budget-review/index.server";
import { presentBudgetReview } from "@/domains/examples/budget-review/presenter";
import { domain as compact } from "@/domains/examples/budget-compact/index.server";
import type { PresentationContext } from "@/core/domains/definition";

const output = { currency: "USD", totalMinor: 12500, remainingMinor: -2500, overBudget: true, itemCount: 3 };
const context = (data: BudgetSummary) => ({
  snapshot: {} as never,
  get: () => ({ id: "budget", kind: "budget.summary", version: 1, runId: "run", workspaceId: "workspace", data, sourceIds: [], evidenceIds: [], provenance: { capabilityId: "business__calculate_budget", capabilityVersion: 1 }, createdAt: "2026-10-06T00:00:00Z" }),
  sources: [], evidence: [],
}) as unknown as PresentationContext;

describe("budget domain packs", () => {
  it("shares a strict schema that matches the calculate-budget output", () => {
    expect(budgetSummarySchema.parse(output)).toEqual(output);
    expect(budgetSummarySchema.safeParse({ ...output, extra: true }).success).toBe(false);
    expect(budgetSummarySchema.safeParse({ ...output, currency: "usd" }).success).toBe(false);
    expect(budgetSummarySchema.safeParse({ ...output, itemCount: 101 }).success).toBe(false);
  });

  it("declares two distinct packs bound to the exact calculate-budget tool version", () => {
    expect([review.manifest.id, compact.manifest.id]).toEqual(["budget-review", "budget-compact"]);
    for (const domain of [review, compact]) {
      expect(domain.tools).toEqual([{ name: "business__calculate_budget", version: "1.0.0" }]);
      expect(domain.resultBindings?.[0]).toMatchObject({ toolName: "business__calculate_budget", toolVersion: "1.0.0", artifactKind: "budget.summary", artifactVersion: 1 });
      expect(domain.resultBindings?.[0]?.outputSchema).toBe(budgetSummarySchema);
    }
    expect(review.systemPrompt).not.toBe(compact.systemPrompt);
    expect(review.present).not.toBe(compact.present);
  });

  it("presents exact budget metrics and adds a warning only when over budget", () => {
    const blocks = presentBudgetReview(context(output));
    expect(blocks.filter(block => block.type === "metric").map(block => block.props)).toEqual([
      { label: "Total", value: 125, unit: "USD", sourceIds: [] },
      { label: "Remaining", value: -25, unit: "USD", sourceIds: [] },
    ]);
    expect(blocks.some(block => block.type === "warning")).toBe(true);
    expect(blocks.some(block => block.type === "source" || block.type === "evidence")).toBe(false);
    expect(presentBudgetReview(context({ ...output, overBudget: false })).some(block => block.type === "warning")).toBe(false);
  });

  it("renders the compact pack as Markdown from validated output without evidence claims", () => {
    const blocks = compact.present(context(output));
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ type: "markdown", props: { content: expect.stringContaining("125.00 USD") } });
    expect(blocks[0]?.type === "markdown" && blocks[0].props.content).toContain("Over budget");
    expect(blocks.some(block => block.type === "source" || block.type === "evidence")).toBe(false);
  });

  it("converts VND minor amounts using its zero fraction digits", () => {
    const vnd: BudgetSummary = { currency: "VND", totalMinor: 3_500_000, remainingMinor: 1_250_000, overBudget: false, itemCount: 2 };
    const reviewMetrics = presentBudgetReview(context(vnd)).filter(block => block.type === "metric");
    expect(reviewMetrics.map(block => block.type === "metric" ? block.props.value : null)).toEqual([3_500_000, 1_250_000]);
    const markdown = compact.present(context(vnd))[0];
    expect(markdown?.type === "markdown" && markdown.props.content).toContain("3,500,000 VND");
    expect(markdown?.type === "markdown" && markdown.props.content).toContain("1,250,000 VND");
  });

  it("retains two fraction digits for USD minor amounts", () => {
    const markdown = compact.present(context(output))[0];
    expect(markdown?.type === "markdown" && markdown.props.content).toContain("125.00 USD");
    expect(markdown?.type === "markdown" && markdown.props.content).toContain("-25.00 USD");
  });

  it("composes only when the exact versioned tool is registered", () => {
    expect(createDomainCatalog(new Map([["business__calculate_budget@1.0.0", { name: "business__calculate_budget", version: "1.0.0" }]])).size).toBeGreaterThan(4);
    expect(() => createDomainCatalog(new Map())).toThrow("domain_tool_unregistered");
    expect(() => createDomainCatalog(new Map([["business__calculate_budget@2.0.0", { name: "business__calculate_budget", version: "2.0.0" }]]))).toThrow("domain_tool_unregistered");
    expect(() => createDomainCatalog(new Map([["business__calculate_budget@1.0.0", { name: "different_tool", version: "1.0.0" }]]))).toThrow("domain_tool_unregistered");
  });
});
