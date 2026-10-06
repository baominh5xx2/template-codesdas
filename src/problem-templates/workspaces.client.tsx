"use client";

import type { DemoBundle } from "@/demo/schemas";
import type { DemoStateId } from "@/ui/shells/template";
import { DashboardWorkspace } from "./data-dashboard/ui/DashboardWorkspace.client";
import type { DocumentExtras } from "./document-analyzer/fixtures";
import { DocumentWorkspace } from "./document-analyzer/ui/DocumentWorkspace.client";
import type { KnowledgeExtras } from "./knowledge-assistant/fixtures";
import { KnowledgeWorkspace } from "./knowledge-assistant/ui/KnowledgeWorkspace.client";
import type { PlannerExtras } from "./recommendation-planner/fixtures";
import { PlannerWorkspace } from "./recommendation-planner/ui/PlannerWorkspace.client";
import type { ResearchExtras } from "./research-intelligence/fixtures";
import { ResearchWorkspace } from "./research-intelligence/ui/ResearchWorkspace.client";
import type { RiskExtras } from "./risk-analyzer/fixtures";
import { RiskWorkspace } from "./risk-analyzer/ui/RiskWorkspace.client";
import type { TemplateId } from "./types";

/** Maps each template to its page-specific composition. */
export function TemplateWorkspace({ id, bundle, extras, state }: { id: TemplateId; bundle: DemoBundle; extras: unknown; state: DemoStateId }) {
  const basePath = `/templates/${id}`;
  switch (id) {
    case "data-dashboard": return <DashboardWorkspace bundle={bundle} state={state} basePath={basePath} />;
    case "document-analyzer": return <DocumentWorkspace bundle={bundle} extras={extras as DocumentExtras} state={state} basePath={basePath} />;
    case "risk-analyzer": return <RiskWorkspace bundle={bundle} extras={extras as RiskExtras} state={state} basePath={basePath} />;
    case "research-intelligence": return <ResearchWorkspace bundle={bundle} extras={extras as ResearchExtras} state={state} basePath={basePath} />;
    case "recommendation-planner": return <PlannerWorkspace bundle={bundle} extras={extras as PlannerExtras} state={state} basePath={basePath} />;
    case "knowledge-assistant": return <KnowledgeWorkspace bundle={bundle} extras={extras as KnowledgeExtras} state={state} basePath={basePath} />;
  }
}
