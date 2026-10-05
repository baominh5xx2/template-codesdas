import type { DomainDefinition, DomainValidationCatalog } from "./definition";
import { validateWorkflow } from "@/core/workflows/validation";

export function validateDomain(domain: DomainDefinition, catalog: DomainValidationCatalog): void {
  if (!domain.manifest.id || domain.manifest.version < 1) throw new Error("domain_invalid");
  validateWorkflow(domain.workflow);
  if (domain.workflow.steps.some(step => !catalog.artifactSchemas.has(step.artifactKind, step.version))) throw new Error("domain_artifact_schema_unregistered");
  if (domain.sources.some(id => !catalog.sourceProfileIds.has(id))) throw new Error("domain_source_unregistered");
  if (domain.manifest.toolNames.some(name => !catalog.toolNames.has(name))) throw new Error("domain_tool_unregistered");
  if (domain.requiredArtifactKinds.some(kind => !domain.workflow.steps.some(step => step.artifactKind === kind))) throw new Error("domain_artifact_unproduced");
}
export type { DomainValidationCatalog };
