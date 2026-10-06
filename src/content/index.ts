import type { Page } from "@/site/schema";
import site from "./site";
import home from "./pages/home";
import dataDashboard from "./pages/data-dashboard";
import documentAnalyzer from "./pages/document-analyzer";
import riskAnalyzer from "./pages/risk-analyzer";
import researchIntelligence from "./pages/research-intelligence";
import recommendationPlanner from "./pages/recommendation-planner";
import knowledgeAssistant from "./pages/knowledge-assistant";

/** Every page of the website. Add a new page file in ./pages and list it here. */
export const pages: Page[] = [home, dataDashboard, documentAnalyzer, riskAnalyzer, researchIntelligence, recommendationPlanner, knowledgeAssistant];

export { site };
