import { DemoBundleSchema, type DemoState } from "@/demo/schemas";
import { dashboardFixture } from "./data-dashboard/fixtures";
import { documentFixture } from "./document-analyzer/fixtures";
import { knowledgeFixture } from "./knowledge-assistant/fixtures";
import { plannerFixture } from "./recommendation-planner/fixtures";
import { researchFixture } from "./research-intelligence/fixtures";
import { riskFixture } from "./risk-analyzer/fixtures";
import type { TemplateFixture, TemplateId } from "./types";

const BUILDERS: Record<TemplateId, (state: DemoState) => TemplateFixture<unknown>> = {
  "data-dashboard": dashboardFixture,
  "document-analyzer": documentFixture,
  "risk-analyzer": riskFixture,
  "research-intelligence": researchFixture,
  "recommendation-planner": plannerFixture,
  "knowledge-assistant": knowledgeFixture,
};

/** Builds a template fixture and validates its bundle (schemas + cross-references) before it is served. */
export function getTemplateFixture(id: TemplateId, state: DemoState): TemplateFixture<unknown> {
  const fixture = BUILDERS[id](state);
  return { bundle: DemoBundleSchema.parse(fixture.bundle), extras: fixture.extras };
}
