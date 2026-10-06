import { JsonValueSchema } from "@/contracts/common";
import type { DomainDefinition, DomainResultBinding } from "@/core/domains/definition";
import { manifest } from "./manifest.client";
import { presentBudgetReview } from "./presenter";
import { budgetSummarySchema } from "./schemas";

const resultBinding: DomainResultBinding = {
  id: "calculate-budget-result", toolName: "business__calculate_budget", toolVersion: "1.0.0",
  outputSchema: budgetSummarySchema, artifactKind: "budget.summary", artifactVersion: 1,
  inputSchema: JsonValueSchema,
  toRunInput: output => output,
  toArtifactDraft: output => ({ kind: "budget.summary", version: 1, data: output, sourceIds: [], evidenceIds: [], provenance: { capabilityId: "business__calculate_budget", capabilityVersion: 1 } }),
};

export const domain: DomainDefinition = {
  manifest, inputSchema: JsonValueSchema, requiredArtifactKinds: ["budget.summary"],
  systemPrompt: "Calculate the requested budget using business__calculate_budget. Present the returned totals and remaining amount faithfully. Do not invent sources or evidence.",
  sources: [], tools: [{ name: "business__calculate_budget", version: "1.0.0" }], resultBindings: [resultBinding], present: presentBudgetReview,
};
