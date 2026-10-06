import type { DomainManifest } from "@/contracts/domains";

export const manifest: DomainManifest = {
  id: "budget-compact", version: 1, title: "Budget Compact",
  description: "Get a concise Markdown budget summary for quick sharing.",
  branding: { name: "Budget Compact", accent: "#7c3aed" }, surface: "workspace",
  inputFields: [{ name: "request", label: "Budget request", kind: "textarea", required: true }],
  examples: [{ label: "Summarize planned expenses", input: { request: "Give me a concise summary of this budget." } }],
  toolNames: ["business__calculate_budget"],
};
