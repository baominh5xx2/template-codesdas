import Link from "next/link";
import type { ReactNode } from "react";
import type { DemoState } from "@/demo/schemas";
import { getTemplateFixture } from "@/problem-templates/fixtures";
import { TemplateWorkspace } from "@/problem-templates/workspaces.client";
import { renderMarkdown } from "@/ui/markdown";
import { ArticleCard, FeatureBanner, Hero, Img, LinkList, OfferCard, PartnerCard, Section, SectionHeading, TileCard, VideoCard } from "@/ui/kit";
import { Carousel } from "@/ui/kit/client";
import { MapSection } from "@/ui/kit/MapSection";
import { ScrollExpand } from "@/ui/kit/ScrollExpand";
import { Accordion } from "@/ui/primitives/Accordion";
import { Notice } from "@/ui/primitives";
import type { ParsedSection } from "./schema";

type Of<T extends ParsedSection["type"]> = Extract<ParsedSection, { type: T }>;
export type RenderContext = { demoState: DemoState };

const BUTTON = { primary: "vn-btn vn-btn--l", inverse: "vn-btn vn-btn--inverse vn-btn--l", outline: "vn-btn vn-btn--outline-inverse vn-btn--l" } as const;

/** Standard band: tone + optional heading + content. */
function Band({ section, children }: { section: ParsedSection; children: ReactNode }) {
  const tone = section.tone && section.tone !== "white" ? section.tone : undefined;
  return <Section id={section.id} tone={tone}>
    {section.heading ? <SectionHeading title={section.heading.title} subtitle={section.heading.subtitle} link={section.heading.link} /> : null}
    {children}
  </Section>;
}

function HeroSection({ section }: { section: Of<"hero"> }) {
  const actions = section.actions.length ? <>{section.actions.map(a => <Link key={a.href} href={a.href} className={BUTTON[a.style]}>{a.label}</Link>)}</> : undefined;
  return <div id={section.id}>
    <Hero image={section.image} kicker={section.kicker} title={section.title} subtitle={section.subtitle} actions={actions}
      variant={section.variant === "cover" ? "cover" : "default"} align={section.variant === "bottom" ? "bottom" : "center"}
      height={section.height ?? (section.variant === "bottom" ? "80vh" : "92vh")} />
  </div>;
}

function IntroSection({ section }: { section: Of<"intro"> }) {
  return <Band section={section}>
    <div className="vn-intro">
      <div className="vn-prose-intro">
        <p className="is-lead">{section.lead}</p>
        {section.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
      </div>
      {section.image ? <Img src={section.image} alt={section.imageAlt} ratio="4/3" radius="var(--radius-card)" sizes="(max-width: 1024px) 100vw, 40vw" /> : null}
    </div>
  </Band>;
}

function CardsSection({ section }: { section: Of<"cards"> }) {
  const cards = section.items.map(item => <ArticleCard key={item.title} href={item.href} image={item.image} kicker={item.kicker} title={item.title} excerpt={item.text} />);
  return <Band section={section}>
    {section.layout === "carousel" ? <Carousel>{cards}</Carousel> : <div className="vn-grid vn-grid--3">{cards}</div>}
    {section.cta ? <div style={{ marginTop: "var(--space-7)", display: "flex", justifyContent: "center" }}><Link href={section.cta.href} className="vn-btn vn-btn--l">{section.cta.label}</Link></div> : null}
  </Band>;
}

function TilesSection({ section }: { section: Of<"tiles"> }) {
  return <Band section={section}>
    <div className="vn-grid vn-grid--tiles">{section.items.map(item => <TileCard key={item.title} href={item.href} image={item.image} title={item.title} />)}</div>
    {section.links.length ? <div style={{ marginTop: "var(--space-7)" }}><LinkList columns={2} items={section.links} /></div> : null}
  </Band>;
}

function ScrollExpandSection({ section }: { section: Of<"scrollExpand"> }) {
  return <div id={section.id}>
    <ScrollExpand useWindowScroll overlayScrim={0.75} src={section.image} alt="" title={section.title} scrollHint={section.hint}>
      {section.kicker ? <span className="vn-hero__kicker" style={{ color: "var(--vn-ice)" }}>{section.kicker}</span> : null}
      <h2>{section.revealTitle}</h2>
      {section.revealText ? <p>{section.revealText}</p> : null}
      {section.cta ? <Link href={section.cta.href} className="vn-btn vn-btn--inverse vn-btn--l">{section.cta.label}</Link> : null}
    </ScrollExpand>
  </div>;
}

function MapContentSection({ section }: { section: Of<"map"> }) {
  return <MapSection id={section.id} title={section.heading.title} subtitle={section.heading.subtitle}
    groups={section.groups.map((group, g) => ({
      title: group.title,
      items: group.items.map((item, i) => ({
        id: item.id ?? `${section.id ?? "map"}-${g}-${i}`,
        name: item.name, lat: item.lat, lng: item.lng, meta: item.meta,
        detail: item.text || item.link ? <>{item.text}{item.link ? <> <Link href={item.link.href}>{item.link.label} →</Link></> : null}</> : undefined,
      })),
    }))} />;
}

function LinkListsSection({ section }: { section: Of<"linkLists"> }) {
  return <Band section={section}>
    {section.banner ? <TileCard href={section.banner.href} image={section.banner.image} title={section.banner.title} ratio="21/9" /> : null}
    <div className="vn-grid vn-grid--3" style={{ marginTop: section.banner ? 72 : 0, alignItems: "start" }}>
      {section.columns.map((column, index) => <LinkList key={column.title ?? index} title={column.title} items={column.items} />)}
    </div>
  </Band>;
}

function StatsSection({ section }: { section: Of<"stats"> }) {
  return <Band section={{ ...section, tone: section.tone ?? "navy" }}>
    <div className="vn-stat-row">{section.items.map(item => <div key={item.label} className="vn-metric">
      <span className="vn-metric__label">{item.label}</span>
      <span className="vn-metric__value">{item.value}{item.unit ? <span className="vn-metric__unit">{item.unit}</span> : null}</span>
      {item.note ? <span className="vn-caption" style={{ color: "inherit", opacity: 0.8 }}>{item.note}</span> : null}
    </div>)}</div>
  </Band>;
}

function WorkspaceSection({ section, context }: { section: Of<"workspace">; context: RenderContext }) {
  const fixture = getTemplateFixture(section.template, context.demoState);
  return <TemplateWorkspace id={section.template} bundle={fixture.bundle} extras={fixture.extras} state={context.demoState} />;
}

/** Maps every section `type` from src/site/schema.ts to a kit component. */
export function SectionView({ section, context }: { section: ParsedSection; context: RenderContext }): ReactNode {
  switch (section.type) {
    case "hero": return <HeroSection section={section} />;
    case "intro": return <IntroSection section={section} />;
    case "cards": return <CardsSection section={section} />;
    case "tiles": return <TilesSection section={section} />;
    case "feature": return <div id={section.id}><FeatureBanner image={section.image} title={section.title} subtitle={section.text} cta={section.cta} /></div>;
    case "scrollExpand": return <ScrollExpandSection section={section} />;
    case "map": return <MapContentSection section={section} />;
    case "linkLists": return <LinkListsSection section={section} />;
    case "steps": return <Band section={section}><Carousel>{section.items.map((item, index) => <VideoCard key={item.title} image={item.image} title={item.title} description={item.text} badge={index + 1} />)}</Carousel></Band>;
    case "partners": return <Band section={section}><div className="vn-grid vn-grid--4">{section.items.map(item => <PartnerCard key={item.name} href={item.href} image={item.image} name={item.name} description={item.text} external={item.external} />)}</div></Band>;
    case "offers": return <Band section={section}><Carousel>{section.items.map(item => <OfferCard key={item.title} image={item.image} meta={item.meta} title={item.title} subtitle={item.subtitle} description={item.text}
      priceLabel={item.priceLabel} price={item.price} action={item.cta ? <Link href={item.cta.href} className="vn-btn vn-btn--s">{item.cta.label}</Link> : undefined} />)}</Carousel></Band>;
    case "notices": return <Band section={section}><div className="vn-grid vn-grid--3">{section.items.map(item => <Notice key={item.title} tone={item.tone} title={item.title}
      actions={item.link ? <Link href={item.link.href} className="vn-link-arrow" style={item.tone === "navy" ? { color: "#fff" } : undefined}>{item.link.label} →</Link> : undefined}>{item.text}</Notice>)}</div></Band>;
    case "stats": return <StatsSection section={section} />;
    case "accordion": return <Band section={section}><Accordion defaultOpen={0} items={section.items.map(item => ({ title: item.title, content: <div className="vn-prose">{renderMarkdown(item.body)}</div> }))} /></Band>;
    case "prose": return <Band section={section}><div className="vn-prose">{renderMarkdown(section.markdown)}</div></Band>;
    case "workspace": return <WorkspaceSection section={section} context={context} />;
    default: {
      const unknown: never = section;
      return unknown;
    }
  }
}
