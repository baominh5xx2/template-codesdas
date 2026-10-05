import type { SiteMenu } from "@/ui/kit/client";
import { dashboardMeta } from "./data-dashboard/manifest.client";
import { documentMeta } from "./document-analyzer/manifest.client";
import { knowledgeMeta } from "./knowledge-assistant/manifest.client";
import { plannerMeta } from "./recommendation-planner/manifest.client";
import { researchMeta } from "./research-intelligence/manifest.client";
import { riskMeta } from "./risk-analyzer/manifest.client";
import type { TemplateId, TemplateMeta } from "./types";

/** Client-safe list of problem templates, in the priority order from docs/problem-templates.md. */
export const TEMPLATES: TemplateMeta[] = [dashboardMeta, documentMeta, riskMeta, researchMeta, plannerMeta, knowledgeMeta];

export function getTemplateMeta(id: string): TemplateMeta | undefined {
  return TEMPLATES.find(template => template.id === id);
}

/** Menu content: the six templates as the staggered list, developer links underneath. */
export function siteMenu(): SiteMenu {
  return {
    items: [{ label: "Trang chủ", href: "/" }, ...TEMPLATES.map(t => ({ label: t.manifest.title, href: `/templates/${t.id}` }))],
    secondaryTitle: "Nhà phát triển",
    secondary: [{ label: "Playground", href: "/playground" }, { label: "Domains", href: "/api/domains" }, { label: "Health", href: "/api/health" }],
  };
}

export type { TemplateId, TemplateMeta };
