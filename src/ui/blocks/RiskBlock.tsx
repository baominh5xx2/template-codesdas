"use client";

import type { UIBlock } from "@/contracts/ui/blocks";
import { Badge, Notice } from "../primitives";
import { formatNumber, formatPercent } from "../format";
import { ClaimLine } from "./shared";

type RiskProps = Extract<UIBlock, { type: "risk" }>["props"];

export const RISK_LEVEL = {
  low: { label: "Rủi ro thấp", color: "var(--vn-aurora)", tone: "success" },
  medium: { label: "Rủi ro trung bình", color: "var(--vn-autumn)", tone: "warning" },
  high: { label: "Rủi ro cao", color: "var(--vn-flag-red)", tone: "danger" },
  unknown: { label: "Chưa xác định", color: "var(--vn-grey-400)", tone: "neutral" },
} as const;

/** Semicircle gauge. A null score is shown as "not enough data", never as low risk. */
export function RiskGauge({ props }: { props: RiskProps }) {
  const level = RISK_LEVEL[props.level];
  const ratio = props.score === null ? 0 : (props.score - props.min) / (props.max - props.min);
  const danger = props.direction === "higher-is-worse" ? ratio : 1 - ratio;
  const r = 80, cx = 100, cy = 100, len = Math.PI * r;
  return <svg className="vn-gauge" viewBox="0 0 200 128" role="img" aria-label={props.score === null ? "Chưa đủ dữ liệu để chấm điểm" : `Điểm ${props.score} trên thang ${props.min}–${props.max}, ${level.label}`}>
    <path d={`M${cx - r},${cy} A${r},${r} 0 0 1 ${cx + r},${cy}`} fill="none" stroke="var(--vn-grey-100)" strokeWidth={16} strokeLinecap="round" />
    {props.score !== null ? <path d={`M${cx - r},${cy} A${r},${r} 0 0 1 ${cx + r},${cy}`} fill="none" stroke={level.color} strokeWidth={16} strokeLinecap="round" strokeDasharray={`${Math.max(0.001, ratio) * len} ${len}`} /> : null}
    <text className="vn-gauge__value" x={cx} y={cy - 8} textAnchor="middle">{props.score === null ? "?" : formatNumber(props.score)}</text>
    <text className="vn-gauge__label" x={cx} y={cy + 20} textAnchor="middle">{props.score === null ? "Chưa đủ dữ liệu" : `thang ${formatNumber(props.min)}–${formatNumber(props.max)}`}</text>
    <title>{`${props.direction === "higher-is-worse" ? "Điểm càng cao càng rủi ro" : "Điểm càng cao càng an toàn"} · mức nguy hiểm ${formatPercent(danger)}`}</title>
  </svg>;
}

export function RiskBlock({ props }: { props: RiskProps }) {
  const level = RISK_LEVEL[props.level];
  return <div className="vn-stack">
    <div className="vn-risk">
      <RiskGauge props={props} />
      <div className="vn-stack vn-stack--s">
        <div className="vn-row"><Badge tone={level.tone} dot>{level.label}</Badge><Badge>{props.direction === "higher-is-worse" ? "Điểm cao = nguy hiểm hơn" : "Điểm cao = an toàn hơn"}</Badge></div>
        <dl className="vn-kv">
          <dt>Phương pháp</dt><dd>{props.method}</dd>
          <dt>Độ đầy đủ dữ liệu</dt><dd>{formatPercent(props.completeness)}</dd>
        </dl>
        <div className="vn-meter" aria-label={`Độ đầy đủ ${formatPercent(props.completeness)}`}><div className="vn-meter__fill" style={{ width: `${props.completeness * 100}%`, background: props.completeness < 0.7 ? "var(--vn-autumn)" : undefined }} /></div>
      </div>
    </div>
    {props.completeness < 1 ? <Notice tone="warning" title="Dữ liệu chưa đầy đủ">Điểm được tính trên {formatPercent(props.completeness)} tín hiệu cần thiết. Phần còn thiếu không được coi là an toàn.</Notice> : null}
    {props.factorIds.length ? <div className="vn-stack vn-stack--s">
      <h4 className="vn-h4" style={{ fontSize: 17 }}>Các yếu tố đóng góp</h4>
      <ul className="vn-list">{props.factorIds.map(id => <li key={id}><ClaimLine claimId={id} /></li>)}</ul>
    </div> : null}
  </div>;
}
