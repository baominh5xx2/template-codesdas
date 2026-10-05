"use client";

import type { ReactNode } from "react";
import type { UIBlock } from "@/contracts/ui/blocks";
import { Card, cx } from "../primitives";
import { ChartBlock } from "./ChartBlock";
import { useResult } from "./context";
import { MapBlock, PlaceBlock } from "./MapBlock";
import { RiskBlock } from "./RiskBlock";
import { TableBlock } from "./TableBlock";
import { ActionButton, ComparisonBlock, EvidenceBlock, InsightBlock, MarkdownBlock, MediaBlock, MetricBlock, ProgressBlock, RecommendationBlock, SourceBlock, TimelineBlock, VerdictBlock, WarningBlock } from "./basic";

/** Renders only the content of a block (no card chrome). Exhaustive over the 19 approved block types. */
export function BlockContent({ block }: { block: UIBlock }): ReactNode {
  switch (block.type) {
    case "metric": return <MetricBlock props={block.props} />;
    case "chart": return <ChartBlock props={block.props} />;
    case "table": return <TableBlock props={block.props} />;
    case "insight": return <InsightBlock props={block.props} />;
    case "recommendation": return <RecommendationBlock props={block.props} />;
    case "risk": return <RiskBlock props={block.props} />;
    case "warning": return <WarningBlock props={block.props} />;
    case "source": return <SourceBlock props={block.props} />;
    case "evidence": return <EvidenceBlock props={block.props} />;
    case "verdict": return <VerdictBlock props={block.props} />;
    case "timeline": return <TimelineBlock props={block.props} />;
    case "progress": return <ProgressBlock props={block.props} />;
    case "action": return <ActionButton props={block.props} size="m" />;
    case "map": return <MapBlock props={block.props} />;
    case "place": return <PlaceBlock props={block.props} />;
    case "comparison": return <ComparisonBlock props={block.props} />;
    case "report-section": return <ReportSection blockIds={block.props.blockIds} />;
    case "markdown": return <MarkdownBlock props={block.props} />;
    case "media": return <MediaBlock props={block.props} />;
    default: {
      const unknown: never = block;
      return <p className="vn-caption">Loại block chưa được hỗ trợ: {(unknown as { type: string }).type}</p>;
    }
  }
}

const CARD_TITLE: Partial<Record<UIBlock["type"], (block: UIBlock) => string | undefined>> = {
  chart: b => (b.type === "chart" ? b.props.title : undefined),
  table: b => (b.type === "table" ? b.props.title : undefined),
  source: () => "Nguồn tham khảo",
  evidence: () => "Bằng chứng",
  timeline: () => "Dòng thời gian",
  progress: () => "Tiến độ xử lý",
  comparison: () => "So sánh",
  map: () => "Bản đồ",
  "report-section": b => (b.type === "report-section" ? b.props.title : undefined),
};

/** Renders a block inside its default card chrome; warnings and actions render bare. */
export function BlockView({ block, title, overline, bare, className }: { block: UIBlock; title?: string; overline?: string; bare?: boolean; className?: string }) {
  const { focusedBlockId } = useResult();
  const focused = focusedBlockId === block.id;
  if (bare || block.type === "warning" || block.type === "action") {
    return <div data-block-id={block.id} className={cx(className, focused && "vn-card--focus")} style={{ borderRadius: "var(--radius-card)" }}><BlockContent block={block} /></div>;
  }
  return <div data-block-id={block.id} className={className} style={{ display: "grid" }}>
    <Card title={title ?? CARD_TITLE[block.type]?.(block)} overline={overline} className={focused ? "vn-card--focus" : undefined}>
      <BlockContent block={block} />
    </Card>
  </div>;
}

/** Renders a block by ID from the current result; missing references are explicit. */
export function Block({ id, ...rest }: { id: string; title?: string; overline?: string; bare?: boolean; className?: string }) {
  const { blocksById } = useResult();
  const block = blocksById.get(id);
  if (!block) return null;
  return <BlockView block={block} {...rest} />;
}

/** All blocks of the given types, in view order. */
export function useBlocks<T extends UIBlock["type"]>(...types: T[]): Array<Extract<UIBlock, { type: T }>> {
  const { bundle } = useResult();
  return bundle.view.blocks.filter((block): block is Extract<UIBlock, { type: T }> => (types as string[]).includes(block.type));
}

function ReportSection({ blockIds }: { blockIds: string[] }) {
  const { blocksById } = useResult();
  return <div className="vn-stack">
    {blockIds.map(id => {
      const child = blocksById.get(id);
      if (!child) return <p key={id} className="vn-caption">Thiếu block “{id}”.</p>;
      if (child.type === "report-section") return <div key={id} className="vn-stack vn-stack--s"><h4 className="vn-h4">{child.props.title}</h4><ReportSection blockIds={child.props.blockIds} /></div>;
      return <div key={id} data-block-id={`${id}`}><BlockContent block={child} /></div>;
    })}
  </div>;
}

/** Generic fallback layout: renders every block of a view in order. */
export function ResultBlocks({ exclude = [] }: { exclude?: string[] }) {
  const { bundle } = useResult();
  const metrics = bundle.view.blocks.filter(block => block.type === "metric" && !exclude.includes(block.id));
  const rest = bundle.view.blocks.filter(block => block.type !== "metric" && !exclude.includes(block.id));
  return <div className="vn-stack vn-stack--l">
    {metrics.length ? <div className="vn-grid vn-grid--kpi">{metrics.map(block => <BlockView key={block.id} block={block} />)}</div> : null}
    {rest.map(block => <BlockView key={block.id} block={block} />)}
  </div>;
}
