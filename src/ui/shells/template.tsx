"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { DatasetPage } from "@/contracts/datasets";
import { ResultProvider, type ResultBundle } from "../blocks/context";
import { InspectorDrawer } from "../blocks/InspectorDrawer";
import type { RunRequestState } from "../hooks/useRunRequest";
import { Section } from "../kit";
import { Button, Chip, Icon, Notice } from "../primitives";

export const DEMO_STATES = [
  { id: "success", label: "Thành công" },
  { id: "loading", label: "Đang chạy" },
  { id: "partial", label: "Một phần" },
  { id: "empty", label: "Rỗng" },
  { id: "error", label: "Lỗi" },
  { id: "unavailable", label: "Không khả dụng" },
] as const;
export type DemoStateId = (typeof DEMO_STATES)[number]["id"];

/** Wraps a template page body with the result context and the source/evidence drawer. */
export function TemplateBody({ bundle, datasets, columnLabels, stepLabels, onRetry, children }: { bundle: ResultBundle; datasets?: Record<string, DatasetPage>; columnLabels?: Record<string, string>; stepLabels?: Record<string, string>; onRetry?: () => void; children: ReactNode }) {
  return <ResultProvider bundle={bundle} datasets={datasets} columnLabels={columnLabels} stepLabels={stepLabels} onRetry={onRetry}>
    {children}
    <InspectorDrawer />
  </ResultProvider>;
}

/** Destination-style intro: lead + prose on the left, the template's input form on the right. */
export function IntroSection({ lead, paragraphs, form, id = "bat-dau" }: { lead: ReactNode; paragraphs: ReactNode[]; form: ReactNode; id?: string }) {
  return <Section tight id={id}>
    <div className="vn-intro">
      <div className="vn-prose-intro">
        <p className="is-lead">{lead}</p>
        {paragraphs.map((text, index) => <p key={index}>{text}</p>)}
      </div>
      <div>{form}</div>
    </div>
  </Section>;
}

/** "Find inspiration below, or go directly to:" chips, plus the demo-state chips. */
export function JumpBar({ links, basePath, state }: { links: Array<{ label: string; href: string }>; basePath: string; state: DemoStateId }) {
  return <Section tight flushTop>
    <div className="vn-stack" style={{ gap: 28 }}>
      {links.length ? <div className="vn-jump">
        <span className="vn-jump__label">Xem kết quả bên dưới, hoặc đi thẳng tới:</span>
        <div className="vn-chip-row">{links.map(link => <Chip key={link.href} href={link.href}>{link.label}</Chip>)}</div>
      </div> : null}
      <div className="vn-jump">
        <span className="vn-jump__label vn-row" style={{ gap: 8 }}><Icon name="database" size={18} />Dữ liệu demo — xem giao diện ở từng trạng thái của lượt chạy:</span>
        <div className="vn-chip-row">{DEMO_STATES.map(item => <Chip key={item.id} size="s" href={item.id === "success" ? basePath : `${basePath}?state=${item.id}`} active={state === item.id}>{item.label}</Chip>)}</div>
      </div>
    </div>
  </Section>;
}

/** White form panel used in the intro column. */
export function FormPanel({ title, subtitle, children }: { title: ReactNode; subtitle?: ReactNode; children: ReactNode }) {
  return <div className="vn-card" style={{ boxShadow: "var(--shadow-2)" }}>
    <div className="vn-card__body vn-card__body--l">
      <div className="vn-stack vn-stack--s" style={{ gap: 6 }}>
        <span className="vn-overline">Bắt đầu</span>
        <h2 className="vn-h3">{title}</h2>
        {subtitle ? <p className="vn-small vn-muted">{subtitle}</p> : null}
      </div>
      {children}
    </div>
  </div>;
}

/** Explains what happened to a submitted run request. */
export function RunNotice({ state, onDismiss }: { state: RunRequestState; onDismiss: () => void }) {
  if (state.phase === "idle" || state.phase === "submitting") return null;
  let notice: ReactNode;
  if (state.phase === "unavailable") {
    notice = <Notice tone="navy" title="Engine chưa được bật" actions={<Button size="s" variant="outline-inverse" onClick={onDismiss}>Đã hiểu</Button>}>
      Yêu cầu hợp lệ đã gửi tới <code>/api/runs</code> và nhận về <strong style={{ color: "#fff" }}>{state.code}</strong>. Kết quả bên dưới là dữ liệu demo tổng hợp, chưa phải phân tích đầu vào của bạn.
    </Notice>;
  } else if (state.phase === "accepted") {
    notice = <Notice tone="success" title="Đã tạo lượt chạy">Mã lượt chạy: {state.runId}</Notice>;
  } else {
    notice = <Notice tone="critical" title="Không gửi được yêu cầu" actions={<Button size="s" variant="outline-inverse" onClick={onDismiss}>Đóng</Button>}>{state.message}</Notice>;
  }
  return <Section tight flushTop><div role="status">{notice}</div></Section>;
}

export function SeeAllLink({ href, label }: { href: string; label: string }) {
  return <Link href={href} className="vn-link-arrow">{label}<Icon name="arrow-right" size={18} /></Link>;
}
