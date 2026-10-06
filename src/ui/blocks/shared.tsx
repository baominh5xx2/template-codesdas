"use client";

import type { SourceLocator } from "@/contracts/common";
import type { Claim } from "@/contracts/evidence";
import type { SourceRef } from "@/contracts/sources";
import { Badge, type BadgeTone, type IconName } from "../primitives";
import { useResult } from "./context";

export const SUPPORT: Record<Claim["support"], { label: string; tone: BadgeTone; icon: IconName }> = {
  supported: { label: "Có bằng chứng", tone: "success", icon: "check-circle" },
  contradicted: { label: "Mâu thuẫn", tone: "danger", icon: "x-circle" },
  insufficient: { label: "Chưa đủ bằng chứng", tone: "warning", icon: "help-circle" },
  unchecked: { label: "Chưa kiểm tra", tone: "neutral", icon: "circle-dashed" },
};
export const SEVERITY = {
  info: { label: "Thông tin", tone: "blue", icon: "info", notice: "ice" },
  warning: { label: "Cảnh báo", tone: "warning", icon: "alert-triangle", notice: "warning" },
  critical: { label: "Nghiêm trọng", tone: "danger", icon: "alert-octagon", notice: "critical" },
} as const;
export const PRIORITY = {
  low: { label: "Ưu tiên thấp", tone: "neutral" },
  medium: { label: "Ưu tiên vừa", tone: "warning" },
  high: { label: "Ưu tiên cao", tone: "danger" },
} as const;
export const CLAIM_KIND: Record<Claim["kind"], string> = { fact: "Dữ kiện", inference: "Suy luận", calculation: "Tính toán", recommendation: "Khuyến nghị" };
export const SOURCE_KIND: Record<SourceRef["kind"], { label: string; icon: IconName }> = {
  upload: { label: "Tệp tải lên", icon: "file-text" },
  url: { label: "Trang web", icon: "globe" },
  dataset: { label: "Bộ dữ liệu", icon: "database" },
};

export function describeLocator(locator: SourceLocator): string {
  switch (locator.type) {
    case "pdf": return `Trang ${locator.page} · ký tự ${locator.start}–${locator.end}`;
    case "text": return `Ký tự ${locator.start}–${locator.end}`;
    case "table": return [locator.sheet && `Sheet ${locator.sheet}`, `dòng ${locator.row}`, locator.column && `cột ${locator.column}`].filter(Boolean).join(" · ");
    case "web": return `Mục “${locator.section}”`;
  }
}

export function SupportBadge({ support }: { support: Claim["support"] }) {
  const meta = SUPPORT[support];
  return <Badge tone={meta.tone} icon={meta.icon}>{meta.label}</Badge>;
}

/** Inline citation markers [n] that open the evidence inspector. */
export function Citations({ evidenceIds }: { evidenceIds: string[] }) {
  const { citation, inspect, evidenceById, source } = useResult();
  if (!evidenceIds.length) return null;
  return <>{evidenceIds.map(id => {
    const item = evidenceById(id);
    const title = item ? `${source(item.sourceId)?.title ?? "Nguồn"} — ${item.excerpt}` : "Bằng chứng không tồn tại";
    return <button key={id} type="button" className="vn-cite" title={title} aria-label={`Xem bằng chứng ${citation(id)}`} onClick={() => inspect({ kind: "evidence", id })}>{citation(id) || "?"}</button>;
  })}</>;
}

/** A claim sentence with its support state and citations; missing claims render explicitly instead of disappearing. */
export function ClaimLine({ claimId, showSupport = true }: { claimId: string; showSupport?: boolean }) {
  const { claim, inspect } = useResult();
  const item = claim(claimId);
  if (!item) return <span className="vn-muted">Không tìm thấy nhận định “{claimId}”.</span>;
  return <span className="vn-stack vn-stack--s" style={{ gap: 6 }}>
    <span>
      <span style={{ color: "var(--text-strong)", fontWeight: 500 }}>{item.text}</span>
      <Citations evidenceIds={item.evidenceIds} />
    </span>
    {showSupport ? <span className="vn-row" style={{ gap: 6 }}><SupportBadge support={item.support} /><Badge>{CLAIM_KIND[item.kind]}</Badge><button type="button" className="vn-linkish vn-caption" style={{ fontWeight: 500, color: "var(--text-muted)" }} onClick={() => inspect({ kind: "claim", id: item.id })}>Chi tiết</button></span> : null}
  </span>;
}
