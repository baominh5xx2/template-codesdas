import { createArtifactRegistry } from "../src/core/capabilities/schema-registry";
import { validateDomain } from "../src/core/domains/validation";
import { createSourceCatalog } from "../src/sources/catalog";
import { domain as documentReview } from "../src/domains/examples/document-review/index.server";
import { domain as datasetAnalysis } from "../src/domains/examples/dataset-analysis/index.server";
import { domain as researchReport } from "../src/domains/examples/research-report/index.server";
import { domain as riskAnalyzer } from "../src/domains/examples/risk-analyzer/index.server";

const catalog = { sourceProfileIds: new Set(createSourceCatalog().list().map(profile => profile.id)), toolNames: new Set<string>(), registeredDomainIdentities: new Set<string>(), artifactSchemas: createArtifactRegistry() };
const ids = new Set<string>();
const domains = [documentReview, datasetAnalysis, researchReport, riskAnalyzer];
for (const domain of domains) {
  if (ids.has(domain.manifest.id)) throw new Error(`duplicate_domain:${domain.manifest.id}`);
  ids.add(domain.manifest.id);
  validateDomain(domain, catalog);
}
console.log(`Validated ${domains.length} domain definitions.`);
