"use client";

import type { UIBlock } from "@/contracts/ui/blocks";
import { OfferCard } from "../kit";
import { Notice, type NoticeTone } from "../primitives";
import { useResult } from "./context";
import { ActionButton, MetricBlock } from "./basic";
import { Citations, PRIORITY, SEVERITY } from "./shared";

type Block<T extends UIBlock["type"]> = Extract<UIBlock, { type: T }>;

/** Claim sentences with inline citations, compact enough for notices and offer cards. */
export function ClaimSentences({ claimIds }: { claimIds: string[] }) {
  const { claim } = useResult();
  return <>{claimIds.map(id => {
    const item = claim(id);
    if (!item) return <p key={id} className="vn-caption">Thiếu nhận định “{id}”.</p>;
    return <p key={id} style={{ margin: 0 }}>{item.text}<Citations evidenceIds={item.evidenceIds} />{item.support !== "supported" ? <em className="vn-caption" style={{ color: "inherit", opacity: 0.8 }}> — {item.support === "insufficient" ? "chưa đủ bằng chứng" : item.support === "contradicted" ? "bị mâu thuẫn" : "chưa kiểm tra"}</em> : null}</p>;
  })}</>;
}

/** Insight rendered as a destination-page Notice (ice / navy callout). */
export function InsightNotice({ block, tone }: { block: Block<"insight">; tone?: NoticeTone }) {
  const severity = SEVERITY[block.props.severity];
  const resolved: NoticeTone = tone ?? (block.props.severity === "critical" ? "navy" : "ice");
  return <div data-block-id={block.id} style={{ display: "grid" }}>
    <Notice tone={resolved} icon={severity.icon} title={block.props.title}>
      <div className="vn-stack vn-stack--s" style={{ gap: 8 }}><ClaimSentences claimIds={block.props.claimIds} /></div>
    </Notice>
  </div>;
}

/** Recommendation rendered as an OfferCard: overline meta, title, reasons, action in the footer. */
export function RecommendationOffer({ block, image }: { block: Block<"recommendation">; image: string }) {
  const { blocksById, claim } = useResult();
  const actions = block.props.actionIds.map(id => blocksById.get(id)).filter((b): b is Block<"action"> => b?.type === "action");
  const [first, ...rest] = block.props.reasonClaimIds;
  return <div data-block-id={block.id} style={{ height: "100%" }}>
    <OfferCard image={image}
      meta={`${PRIORITY[block.props.priority].label} ・ ${block.props.reasonClaimIds.length} căn cứ`}
      title={block.props.title}
      subtitle={first ? <>{claim(first)?.text ?? first}<Citations evidenceIds={claim(first)?.evidenceIds ?? []} /></> : undefined}
      description={rest.length ? <div className="vn-stack vn-stack--s" style={{ gap: 6 }}><ClaimSentences claimIds={rest} /></div> : undefined}
      priceLabel="Mức ưu tiên" price={block.props.priority === "high" ? "Cao" : block.props.priority === "medium" ? "Vừa" : "Thấp"}
      action={actions[0] ? <ActionButton props={actions[0].props} variant="primary" /> : undefined} />
  </div>;
}

/** KPI row with hairline dividers, as on the brand's stat bands. */
export function MetricStats({ blocks }: { blocks: Array<Block<"metric">> }) {
  return <div className="vn-stat-row">{blocks.map(block => <div key={block.id} data-block-id={block.id}><MetricBlock props={block.props} /></div>)}</div>;
}
