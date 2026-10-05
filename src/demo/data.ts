import type { DomainManifest } from "@/contracts/domains";
import type { UIBlock } from "@/contracts/ui/blocks";
import type { DemoBundle } from "./schemas";
import { manifest as documentReview } from "@/domains/examples/document-review/manifest.client";
import { manifest as datasetAnalysis } from "@/domains/examples/dataset-analysis/manifest.client";
import { manifest as researchReport } from "@/domains/examples/research-report/manifest.client";
import { manifest as riskAnalyzer } from "@/domains/examples/risk-analyzer/manifest.client";

export const DEMO_DOMAINS: DomainManifest[] = [documentReview, datasetAnalysis, researchReport, riskAnalyzer];

const now = "2026-10-05T00:00:00.000Z";
const source = { id: "source-demo", kind: "dataset" as const, title: "Synthetic sample data", retrievedAt: now, contentHash: "sha256:synthetic-demo-fixture" };
const columns = [
  { key: "quarter", type: "string" as const, nullable: false },
  { key: "revenue", type: "number" as const, nullable: false, unit: "USD" },
  { key: "orders", type: "number" as const, nullable: false },
];
const rows = [
  { id: "row-q1", values: { quarter: "Q1", revenue: 12000, orders: 80 } },
  { id: "row-q2", values: { quarter: "Q2", revenue: 15000, orders: 96 } },
  { id: "row-q3", values: { quarter: "Q3", revenue: 13900, orders: 91 } },
  { id: "row-q4", values: { quarter: "Q4", revenue: 18000, orders: 112 } },
];
export const DEMO_DATASETS: DemoBundle["datasets"] = {
  "sales-quarterly": { datasetId: "sales-quarterly", columns, rows, total: rows.length, offset: 0, limit: rows.length },
};
export const DEMO_SOURCES = [source] satisfies DemoBundle["sources"];
export const DEMO_EVIDENCE = [{ id: "evidence-demo", sourceId: source.id, locator: { type: "table" as const, sheet: "Summary", row: 1, column: "revenue" }, excerpt: "Synthetic example: Q2 revenue is $15,000." }] satisfies DemoBundle["evidence"];
export const DEMO_CLAIMS = [{ id: "claim-demo", text: "Synthetic sample revenue rises from Q1 to Q2.", kind: "calculation" as const, evidenceIds: ["evidence-demo"], support: "supported" as const }] satisfies DemoBundle["claims"];

const ids = { source: source.id, claim: "claim-demo", evidence: "evidence-demo", dataset: "sales-quarterly" };
const demoBlocks: UIBlock[] = [
  { id: "metric-revenue", type: "metric", props: { label: "Q4 revenue", value: 18000, unit: "USD", delta: 0.2, sourceIds: [ids.source] } },
  { id: "chart-revenue", type: "chart", props: { title: "Revenue by quarter", kind: "bar", datasetId: ids.dataset, xKey: "quarter", series: [{ key: "revenue", label: "Revenue", unit: "USD" }], aggregation: "none", sourceIds: [ids.source] } },
  { id: "table-sales", type: "table", props: { title: "Quarterly rows", datasetId: ids.dataset, columns: ["quarter", "revenue", "orders"], pageSize: 4 } },
  { id: "insight-growth", type: "insight", props: { title: "Revenue grew in Q2", claimIds: [ids.claim], severity: "info" } },
  { id: "recommendation-review", type: "recommendation", props: { title: "Review Q3 dip", reasonClaimIds: [ids.claim], priority: "medium", actionIds: ["action-export"] } },
  { id: "risk-score", type: "risk", props: { score: 0.32, min: 0, max: 1, direction: "higher-is-worse", level: "low", factorIds: [ids.claim], method: "Synthetic fixture", completeness: 1 } },
  { id: "warning-synthetic", type: "warning", props: { title: "Example data", message: "This result uses synthetic fixture data.", severity: "info" } },
  { id: "source-list", type: "source", props: { sourceIds: [ids.source] } },
  { id: "evidence-link", type: "evidence", props: { claimId: ids.claim, evidenceIds: [ids.evidence] } },
  { id: "verdict-claim", type: "verdict", props: { claimId: ids.claim, support: "supported", reason: "Linked to synthetic table evidence." } },
  { id: "timeline-review", type: "timeline", props: { items: [{ id: "step-review", title: "Review sample", at: now }] } },
  { id: "progress-review", type: "progress", props: { stepIds: ["step-review"] } },
  { id: "action-export", type: "action", props: { label: "Export JSON", actionId: "export.json" } },
  { id: "map-sample", type: "map", props: { places: [{ id: "place-hanoi", name: "Hanoi", lat: 21.0285, lng: 105.8542 }], available: true } },
  { id: "place-hanoi", type: "place", props: { name: "Hanoi", lat: 21.0285, lng: 105.8542, sourceIds: [ids.source] } },
  { id: "comparison-options", type: "comparison", props: { criteria: [{ key: "revenue", label: "Revenue", unit: "USD" }], options: [{ id: "q1", label: "Q1", values: { revenue: 12000 } }, { id: "q4", label: "Q4", values: { revenue: 18000 } }] } },
  { id: "report-summary", type: "report-section", props: { title: "Summary", blockIds: ["metric-revenue", "insight-growth"] } },
  { id: "markdown-notes", type: "markdown", props: { content: "Synthetic fixture only.\n\nNo external services were called." } },
  { id: "media-sample", type: "media", props: { kind: "image", storageKey: "demo/synthetic-summary.png", alt: "Synthetic summary placeholder" } },
] ;

export function createFixtureBundle(domainId: string, state: DemoBundle["view"]["status"] | "loading" | "empty" | "error" | "unavailable"): DemoBundle {
  const status = state === "loading" ? "running" : state === "empty" ? "completed" : state === "error" ? "failed" : state === "unavailable" ? "interrupted" : state;
  const blocks: UIBlock[] = state === "empty" ? [] : demoBlocks.map(block => ({ ...block }));
  if (state === "error" || state === "partial" || state === "unavailable") {
    blocks.push({ id: "state-message", type: "warning", props: { title: state === "error" ? "Fixture error" : state === "partial" ? "Partial result" : "Unavailable", message: state === "error" ? "Synthetic example error state." : state === "partial" ? "Some synthetic steps did not complete." : "This capability is unavailable in the starter.", severity: "warning" } });
  }
  const manifest = DEMO_DOMAINS.find(item => item.id === domainId)!;
  return {
    label: `${manifest.title} Demo`,
    view: { runId: `demo-${domainId}`, revision: 1, title: manifest.title, status, blocks },
    snapshot: { id: `demo-${domainId}`, workspaceId: "workspace-demo", domainId, domainVersion: 1, input: { request: "Synthetic demo input" }, status, revision: 1, deadlineAt: null, steps: state === "empty" ? [] : [{ id: "step-review", status: state === "loading" ? "running" : state === "error" || state === "partial" ? "failed" : state === "unavailable" ? "skipped" : "succeeded", attempt: 1, artifactIds: [], startedAt: now, finishedAt: state === "loading" ? null : now, errorCode: state === "error" ? "demo_error" : state === "partial" ? "demo_partial" : null }], artifacts: [], warnings: ["Synthetic fixture data; no engine was run."] },
    sources: state === "empty" ? [] : DEMO_SOURCES, evidence: state === "empty" ? [] : DEMO_EVIDENCE, claims: state === "empty" ? [] : DEMO_CLAIMS, datasets: state === "empty" ? {} : structuredClone(DEMO_DATASETS),
  } as DemoBundle;
}
