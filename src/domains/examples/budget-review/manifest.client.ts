import type { DomainManifest } from "@/contracts/domains";

export const manifest: DomainManifest = {
  id: "budget-review", version: 1, title: "Budget Review",
  description: "Review a proposed budget with clear totals and remaining funds.",
  branding: { name: "Budget Review", accent: "#0f766e" }, surface: "workspace",
  inputFields: [{ name: "request", label: "Budget request", kind: "textarea", required: true }],
  examples: [{ label: "Review a project budget", input: { request: "Review these planned costs against my budget." } }],
  toolNames: ["business__calculate_budget"],
};
