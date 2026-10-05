import type { DomainManifest } from "@/contracts/domains";
import type { DemoBundle, DemoState } from "@/demo/schemas";
import type { IconName } from "@/ui/primitives";

export type TemplateId = "data-dashboard" | "document-analyzer" | "risk-analyzer" | "research-intelligence" | "recommendation-planner" | "knowledge-assistant";

/** Client-safe presentation metadata for a problem template. */
export type TemplateMeta = {
  id: TemplateId;
  manifest: DomainManifest;
  kicker: string;
  headline: string;
  tagline: string;
  sampleTopic: string;
  /** Short uppercase hero title, e.g. "Bảng điều khiển". */
  heroTitle: string;
  /** Photography under public/images. */
  images: { hero: string; card: string };
  icon: IconName;
  /** Ordered workflow step IDs with human labels; mirrors the planned capability chain. */
  steps: Array<{ id: string; label: string }>;
  capabilities: string[];
};

/** A template's fixture: the shared DemoBundle plus template-specific, contract-typed extras. */
export type TemplateFixture<Extras = undefined> = { bundle: DemoBundle; extras: Extras };
export type FixtureBuilder<Extras = undefined> = (state: DemoState) => TemplateFixture<Extras>;
