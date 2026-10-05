import { manifest as documentReview } from "./examples/document-review/manifest.client";
import { manifest as datasetAnalysis } from "./examples/dataset-analysis/manifest.client";
import { manifest as researchReport } from "./examples/research-report/manifest.client";
import { manifest as riskAnalyzer } from "./examples/risk-analyzer/manifest.client";
export const domainManifests = [documentReview, datasetAnalysis, researchReport, riskAnalyzer] as const;
export type { DomainManifest } from "@/contracts/domains";
