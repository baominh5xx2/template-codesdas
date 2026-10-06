import "server-only";
import { createArtifactRegistry } from "@/core/capabilities/schema-registry";
import { validateDomain } from "@/core/domains/validation";
import { createSourceCatalog } from "@/sources/catalog";
import type { DomainDefinition } from "@/core/domains/definition";
import { domain as documentReview } from "./examples/document-review/index.server";
import { domain as datasetAnalysis } from "./examples/dataset-analysis/index.server";
import { domain as researchReport } from "./examples/research-report/index.server";
import { domain as riskAnalyzer } from "./examples/risk-analyzer/index.server";
import { domain as budgetReview } from "./examples/budget-review/index.server";
import { domain as budgetCompact } from "./examples/budget-compact/index.server";
import { budgetSummarySchema } from "./examples/budget-review/schemas";
import type { DomainToolReference } from "@/core/domains/definition";

const definitions = [documentReview, datasetAnalysis, researchReport, riskAnalyzer];
function validateDefinitions(definitions: readonly DomainDefinition[], registeredTools?: ReadonlyMap<string, DomainToolReference>) {
  const artifactSchemas = createArtifactRegistry();
  artifactSchemas.register("budget.summary", 1, budgetSummarySchema);
  const validationCatalog = { sourceProfileIds: new Set(createSourceCatalog().list().map(profile => profile.id)), toolNames: new Set<string>(), registeredTools, registeredDomainIdentities: new Set<string>(), artifactSchemas };
  for (const domain of definitions) validateDomain(domain, validationCatalog);
}
validateDefinitions(definitions);
export const domains: readonly DomainDefinition[] = definitions;

export function createDomainCatalog(registeredTools: ReadonlyMap<string, DomainToolReference>): ReadonlyMap<string, DomainDefinition> {
  const allDefinitions = [...definitions, budgetReview, budgetCompact];
  validateDefinitions(allDefinitions, registeredTools);
  return new Map(allDefinitions.map(domain => [`${domain.manifest.id}@${domain.manifest.version}`, domain]));
}
