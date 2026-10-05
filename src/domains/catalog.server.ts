import "server-only";
import { createArtifactRegistry } from "@/core/capabilities/schema-registry";
import { validateDomain } from "@/core/domains/validation";
import { createSourceCatalog } from "@/sources/catalog";
import type { DomainDefinition } from "@/core/domains/definition";
import { domain as documentReview } from "./examples/document-review/index.server";
import { domain as datasetAnalysis } from "./examples/dataset-analysis/index.server";
import { domain as researchReport } from "./examples/research-report/index.server";
import { domain as riskAnalyzer } from "./examples/risk-analyzer/index.server";

const definitions = [documentReview, datasetAnalysis, researchReport, riskAnalyzer];
const validationCatalog = { sourceProfileIds: new Set(createSourceCatalog().list().map(profile => profile.id)), toolNames: new Set<string>(), registeredDomainIdentities: new Set<string>(), artifactSchemas: createArtifactRegistry() };
for (const domain of definitions) validateDomain(domain, validationCatalog);
export const domains: readonly DomainDefinition[] = definitions;
