"use client";

import type { UIBlock } from "@/contracts/ui/blocks";
import { Badge, Button, EmptyState, Icon, Notice, type IconName } from "../primitives";
import { formatCompact, formatDateTime, formatNumber, formatPercent } from "../format";
import { renderMarkdown } from "../markdown";
import { useResult, type ActionId } from "./context";
import { ClaimLine, Citations, describeLocator, PRIORITY, SEVERITY, SOURCE_KIND, SupportBadge } from "./shared";

type Props<T extends UIBlock["type"]> = Extract<UIBlock, { type: T }>["props"];

export function MetricBlock({ props }: { props: Props<"metric"> }) {
  const { inspect } = useResult();
  const delta = props.delta;
  const direction = delta === undefined ? null : delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  return <div className="vn-metric">
    <span className="vn-metric__label">{props.label}</span>
    <span className="vn-metric__value" title={props.value === null ? undefined : `${formatNumber(props.value)}${props.unit ? ` ${props.unit}` : ""}`}>{props.value === null ? "—" : Math.abs(props.value) >= 1_000_000 ? formatCompact(props.value) : formatNumber(props.value)}{props.unit && props.value !== null ? <span className="vn-metric__unit">{props.unit}</span> : null}</span>
    <span className="vn-row" style={{ gap: 8, minHeight: 20 }}>
      {direction ? <span className={`vn-delta vn-delta--${direction}`}><Icon name={direction === "up" ? "trending-up" : direction === "down" ? "trending-down" : "minus"} size={15} />{delta! > 0 ? "+" : ""}{formatPercent(delta!)}</span> : null}
      {props.value === null ? <span className="vn-caption">Chưa có dữ liệu</span> : null}
      {props.sourceIds.length ? <button type="button" className="vn-linkish vn-caption" style={{ fontWeight: 500, color: "var(--text-muted)" }} onClick={() => inspect({ kind: "source", id: props.sourceIds[0] })}>Nguồn</button> : null}
    </span>
  </div>;
}

export function InsightBlock({ props }: { props: Props<"insight"> }) {
  const severity = SEVERITY[props.severity];
  return <div className="vn-stack vn-stack--s">
    <div className="vn-row vn-row--between" style={{ alignItems: "flex-start" }}>
      <h4 className="vn-card__title">{props.title}</h4>
      <Badge tone={severity.tone} icon={severity.icon}>{severity.label}</Badge>
    </div>
    {props.claimIds.length ? <ul className="vn-list">{props.claimIds.map(id => <li key={id}><ClaimLine claimId={id} /></li>)}</ul> : <p className="vn-caption">Không có nhận định kèm theo.</p>}
  </div>;
}

export function ActionButton({ props, size = "s", variant }: { props: Props<"action">; size?: "s" | "m"; variant?: "primary" | "secondary" }) {
  const { onAction } = useResult();
  const icon: Record<ActionId, IconName> = { "export.markdown": "download", "export.json": "download", "retry-run": "refresh-cw", "focus-artifact": "target" };
  return <Button size={size} variant={variant ?? (props.actionId === "retry-run" ? "primary" : "secondary")} iconLeft={icon[props.actionId]} onClick={() => onAction(props.actionId, props.artifactId)}>{props.label}</Button>;
}

export function RecommendationBlock({ props }: { props: Props<"recommendation"> }) {
  const { blocksById } = useResult();
  const priority = PRIORITY[props.priority];
  const actions = props.actionIds.map(id => blocksById.get(id)).filter((block): block is Extract<UIBlock, { type: "action" }> => block?.type === "action");
  return <div className="vn-stack vn-stack--s">
    <div className="vn-row vn-row--between" style={{ alignItems: "flex-start" }}>
      <h4 className="vn-card__title">{props.title}</h4>
      <Badge tone={priority.tone} dot>{priority.label}</Badge>
    </div>
    {props.reasonClaimIds.length ? <div className="vn-stack vn-stack--s">
      <span className="vn-overline" style={{ color: "var(--text-muted)" }}>Vì sao</span>
      <ul className="vn-list">{props.reasonClaimIds.map(id => <li key={id}><ClaimLine claimId={id} showSupport={false} /></li>)}</ul>
    </div> : null}
    {actions.length ? <div className="vn-row" style={{ gap: 8 }}>{actions.map(action => <ActionButton key={action.id} props={action.props} />)}</div> : null}
  </div>;
}

export function WarningBlock({ props }: { props: Props<"warning"> }) {
  const severity = SEVERITY[props.severity];
  return <Notice tone={severity.notice} title={props.title} role={props.severity === "critical" ? "alert" : "status"}>{props.message}</Notice>;
}

export function SourceBlock({ props }: { props: Props<"source"> }) {
  const { source, inspect, evidence } = useResult();
  if (!props.sourceIds.length) return <EmptyState icon="book" title="Chưa có nguồn">Kết quả này không trích dẫn nguồn nào.</EmptyState>;
  return <ul className="vn-list">{props.sourceIds.map(id => {
    const item = source(id);
    if (!item) return <li key={id} className="vn-muted">Nguồn “{id}” không tồn tại.</li>;
    const kind = SOURCE_KIND[item.kind];
    const count = evidence.filter(e => e.sourceId === id).length;
    return <li key={id} className="vn-source">
      <span className="vn-source__icon"><Icon name={kind.icon} size={18} /></span>
      <div className="vn-stack vn-stack--s" style={{ gap: 4, minWidth: 0 }}>
        <button type="button" className="vn-linkish vn-source__title" style={{ textDecoration: "none", color: "var(--text-strong)" }} onClick={() => inspect({ kind: "source", id })}>{item.title}</button>
        <span className="vn-caption">{kind.label} · truy xuất {formatDateTime(item.retrievedAt)}{item.publishedAt ? ` · xuất bản ${formatDateTime(item.publishedAt)}` : ""}{count ? ` · ${count} trích dẫn` : ""}</span>
        {item.url ? <a href={item.url} target="_blank" rel="noreferrer noopener" className="vn-caption" style={{ wordBreak: "break-all" }}>{item.url}</a> : null}
      </div>
    </li>;
  })}</ul>;
}

export function EvidenceBlock({ props }: { props: Props<"evidence"> }) {
  const { evidenceById, source, inspect, citation } = useResult();
  return <div className="vn-stack vn-stack--s">
    <ClaimLine claimId={props.claimId} />
    {props.evidenceIds.length ? props.evidenceIds.map(id => {
      const item = evidenceById(id);
      if (!item) return <p key={id} className="vn-caption">Bằng chứng “{id}” không tồn tại.</p>;
      return <figure key={id} style={{ margin: 0, display: "grid", gap: 6 }}>
        <blockquote className="vn-quote">“{item.excerpt}”</blockquote>
        <figcaption className="vn-caption vn-row" style={{ gap: 6 }}>
          <span className="vn-cite" aria-hidden>{citation(id)}</span>
          <button type="button" className="vn-linkish" style={{ fontWeight: 500 }} onClick={() => inspect({ kind: "source", id: item.sourceId })}>{source(item.sourceId)?.title ?? item.sourceId}</button>
          <span>· {describeLocator(item.locator)}</span>
        </figcaption>
      </figure>;
    }) : <Notice tone="warning" title="Chưa có bằng chứng">Nhận định này chưa được liên kết với đoạn trích nào.</Notice>}
  </div>;
}

export function VerdictBlock({ props }: { props: Props<"verdict"> }) {
  const { claim } = useResult();
  const item = claim(props.claimId);
  return <div className="vn-stack vn-stack--s">
    <div className="vn-row vn-row--between" style={{ alignItems: "flex-start" }}>
      <strong className="vn-strong" style={{ fontWeight: 600, maxWidth: "60ch" }}>{item?.text ?? props.claimId}{item ? <Citations evidenceIds={item.evidenceIds} /> : null}</strong>
      <SupportBadge support={props.support} />
    </div>
    <p className="vn-small vn-muted">{props.reason}</p>
  </div>;
}

export function TimelineBlock({ props }: { props: Props<"timeline"> }) {
  if (!props.items.length) return <EmptyState icon="calendar" title="Chưa có mốc thời gian" />;
  return <ol className="vn-timeline">{props.items.map(item => <li key={item.id} className="vn-timeline__item">
    <span className="vn-timeline__dot" aria-hidden />
    <div className="vn-stack vn-stack--s" style={{ gap: 4 }}>
      {item.at ? <span className="vn-timeline__at">{/^\d{4}-\d{2}-\d{2}/.test(item.at) ? formatDateTime(item.at) : item.at}</span> : null}
      <strong className="vn-strong">{item.title}</strong>
      {item.description ? <p className="vn-small vn-muted">{item.description}</p> : null}
    </div>
  </li>)}</ol>;
}

const STEP_STATUS = {
  pending: { label: "Đang chờ", icon: "clock", tone: "neutral" },
  running: { label: "Đang chạy", icon: "loader", tone: "blue" },
  succeeded: { label: "Hoàn tất", icon: "check", tone: "success" },
  skipped: { label: "Bỏ qua", icon: "minus", tone: "neutral" },
  failed: { label: "Lỗi", icon: "x", tone: "danger" },
} as const;

export function ProgressBlock({ props }: { props: Props<"progress"> }) {
  const { snapshot, stepLabel } = useResult();
  const steps = new Map(snapshot.steps.map(step => [step.id, step]));
  const done = props.stepIds.filter(id => steps.get(id)?.status === "succeeded").length;
  return <div className="vn-stack vn-stack--s">
    <div className="vn-row vn-row--between"><span className="vn-caption">{done}/{props.stepIds.length} bước hoàn tất</span></div>
    <div className="vn-meter"><div className="vn-meter__fill" style={{ width: `${props.stepIds.length ? (done / props.stepIds.length) * 100 : 0}%` }} /></div>
    <ol className="vn-steps">{props.stepIds.map(id => {
      const step = steps.get(id);
      const status = STEP_STATUS[step?.status ?? "pending"];
      return <li key={id} className={`vn-step vn-step--${step?.status ?? "pending"}`}>
        <span className="vn-step__icon"><Icon name={status.icon} size={16} className={step?.status === "running" ? "vn-spin" : undefined} /></span>
        <span className="vn-stack" style={{ gap: 2 }}>
          <span className="vn-step__name">{stepLabel(id)}</span>
          {step?.errorCode ? <span className="vn-caption">Mã lỗi: {step.errorCode}</span> : step?.attempt && step.attempt > 1 ? <span className="vn-caption">Lần thử {step.attempt}</span> : null}
        </span>
        <Badge tone={status.tone}>{status.label}</Badge>
      </li>;
    })}</ol>
  </div>;
}

export function ComparisonBlock({ props, highlightId, better }: { props: Props<"comparison">; highlightId?: string; better?: Record<string, "higher" | "lower"> }) {
  const best = new Map<string, string>();
  for (const criterion of props.criteria) {
    const rule = better?.[criterion.key];
    if (!rule) continue;
    const numeric = props.options.filter(o => typeof o.values[criterion.key] === "number");
    if (numeric.length < 2) continue;
    const winner = numeric.reduce((a, b) => ((a.values[criterion.key] as number) >= (b.values[criterion.key] as number)) === (rule === "higher") ? a : b);
    best.set(criterion.key, winner.id);
  }
  return <div className="vn-table-wrap">
    <table className="vn-table vn-compare">
      <thead><tr><th scope="col">Tiêu chí</th>{props.options.map(option => <th key={option.id} scope="col">{option.label}{highlightId === option.id ? <> <Badge tone="blue">Đề xuất</Badge></> : null}</th>)}</tr></thead>
      <tbody>{props.criteria.map(criterion => <tr key={criterion.key}>
        <th scope="row" style={{ position: "static", background: "#fff", fontWeight: 600 }}>{criterion.label}{criterion.unit ? <span className="vn-muted" style={{ fontWeight: 500 }}> ({criterion.unit})</span> : null}</th>
        {props.options.map(option => {
          const value = option.values[criterion.key];
          return <td key={option.id} className={[typeof value === "number" ? "is-num" : "", best.get(criterion.key) === option.id ? "is-best" : ""].join(" ")} style={highlightId === option.id ? { background: "var(--vn-ice-50)" } : undefined}>
            {value === null || value === undefined ? <span className="vn-muted" title="Không có dữ liệu">—</span> : typeof value === "number" ? formatNumber(value) : value}
          </td>;
        })}
      </tr>)}</tbody>
    </table>
  </div>;
}

export function MarkdownBlock({ props }: { props: Props<"markdown"> }) {
  return <div className="vn-prose">{renderMarkdown(props.content)}</div>;
}

export function MediaBlock({ props }: { props: Props<"media"> }) {
  if (!props.url) {
    return <div className="vn-media vn-scene vn-scene--fjord">
      <div style={{ position: "relative", zIndex: 1, display: "grid", gap: 8, justifyItems: "center", padding: 24 }}>
        <span className="vn-play" style={{ background: "rgba(255,255,255,.9)" }}><Icon name={props.kind === "image" ? "image" : "play"} size={22} /></span>
        <strong>{props.alt}</strong>
        <span className="vn-small" style={{ color: "var(--vn-ice-200)" }}>Tệp lưu trữ “{props.storageKey}” — chưa cấu hình storage nên chưa thể tải.</span>
      </div>
    </div>;
  }
  if (props.kind === "image") {
    return <div className="vn-media">
      {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary validated http(s) URLs cannot go through next/image without remotePatterns */}
      <img src={props.url} alt={props.alt} referrerPolicy="no-referrer" loading="lazy" />
    </div>;
  }
  if (props.kind === "video") return <div className="vn-media"><video src={props.url} controls aria-label={props.alt} /></div>;
  return <audio src={props.url} controls aria-label={props.alt} style={{ width: "100%" }} />;
}

