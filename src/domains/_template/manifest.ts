import type { DomainManifest } from "@/contracts/domains";
export const templateManifest: DomainManifest = {
  id: "example-domain", version: 1, title: "Example Domain", description: "A starter template with no engine or external calls.",
  branding: { name: "Example Domain", accent: "#475569" }, surface: "workspace",
  inputFields: [{ name: "request", label: "Request", kind: "textarea", required: true }],
  examples: [{ label: "Example request", input: { request: "Describe the intended task" } }], toolNames: [],
};
