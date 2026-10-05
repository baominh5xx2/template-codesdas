"use client";

import { useEffect, useRef } from "react";
import { Badge, Icon } from "../primitives";
import { formatDateTime } from "../format";
import { useResult } from "./context";
import { CLAIM_KIND, describeLocator, SOURCE_KIND, SupportBadge } from "./shared";

/** Side drawer that resolves source / evidence / claim IDs into their full records. */
export function InspectorDrawer() {
  const { inspected, inspect, source, evidenceById, claim, evidence, claims, citation } = useResult();
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!inspected) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") inspect(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inspected, inspect]);
  if (!inspected) return null;

  let title = "";
  let body: React.ReactNode = null;
  if (inspected.kind === "source") {
    const item = source(inspected.id);
    title = "Nguồn";
    const items = evidence.filter(e => e.sourceId === inspected.id);
    body = item ? <>
      <div className="vn-stack vn-stack--s">
        <Badge tone="ice" icon={SOURCE_KIND[item.kind].icon}>{SOURCE_KIND[item.kind].label}</Badge>
        <h3 className="vn-h3">{item.title}</h3>
        {item.url ? <a href={item.url} target="_blank" rel="noreferrer noopener" className="vn-row" style={{ gap: 6, wordBreak: "break-all" }}>{item.url}<Icon name="external-link" size={14} /></a> : null}
        <dl className="vn-kv">
          <dt>Truy xuất</dt><dd>{formatDateTime(item.retrievedAt)}</dd>
          {item.publishedAt ? <><dt>Xuất bản</dt><dd>{formatDateTime(item.publishedAt)}</dd></> : null}
          <dt>Mã băm</dt><dd style={{ fontFamily: "var(--font-sans)", fontSize: 12, wordBreak: "break-all" }}>{item.contentHash}</dd>
        </dl>
      </div>
      <div className="vn-stack vn-stack--s">
        <h4 className="vn-h4">Đoạn trích từ nguồn này ({items.length})</h4>
        {items.length ? items.map(e => <button key={e.id} type="button" className="vn-card vn-card--hover" style={{ textAlign: "left", cursor: "pointer", font: "inherit" }} onClick={() => inspect({ kind: "evidence", id: e.id })}>
          <div className="vn-card__body"><span className="vn-caption">[{citation(e.id)}] {describeLocator(e.locator)}</span><span className="vn-small" style={{ color: "var(--text-strong)" }}>“{e.excerpt}”</span></div>
        </button>) : <p className="vn-caption">Chưa có đoạn trích nào từ nguồn này.</p>}
      </div>
    </> : <p>Nguồn “{inspected.id}” không tồn tại trong kết quả.</p>;
  } else if (inspected.kind === "evidence") {
    const item = evidenceById(inspected.id);
    title = `Bằng chứng [${citation(inspected.id)}]`;
    const related = claims.filter(c => c.evidenceIds.includes(inspected.id));
    body = item ? <>
      <blockquote className="vn-quote" style={{ fontSize: 17 }}>“{item.excerpt}”</blockquote>
      <dl className="vn-kv">
        <dt>Vị trí</dt><dd>{describeLocator(item.locator)}</dd>
        <dt>Nguồn</dt><dd><button type="button" className="vn-linkish" onClick={() => inspect({ kind: "source", id: item.sourceId })}>{source(item.sourceId)?.title ?? item.sourceId}</button></dd>
      </dl>
      {related.length ? <div className="vn-stack vn-stack--s"><h4 className="vn-h4">Hỗ trợ cho nhận định</h4>
        {related.map(c => <button key={c.id} type="button" className="vn-card vn-card--hover" style={{ textAlign: "left", cursor: "pointer", font: "inherit" }} onClick={() => inspect({ kind: "claim", id: c.id })}><div className="vn-card__body"><span className="vn-small" style={{ color: "var(--text-strong)" }}>{c.text}</span><span><SupportBadge support={c.support} /></span></div></button>)}
      </div> : null}
    </> : <p>Bằng chứng “{inspected.id}” không tồn tại trong kết quả.</p>;
  } else {
    const item = claim(inspected.id);
    title = "Nhận định";
    body = item ? <>
      <p style={{ fontSize: 19, fontWeight: 600, color: "var(--text-strong)", lineHeight: 1.4 }}>{item.text}</p>
      <div className="vn-row"><SupportBadge support={item.support} /><Badge>{CLAIM_KIND[item.kind]}</Badge></div>
      <div className="vn-stack vn-stack--s"><h4 className="vn-h4">Bằng chứng ({item.evidenceIds.length})</h4>
        {item.evidenceIds.length ? item.evidenceIds.map(id => {
          const e = evidenceById(id);
          return <button key={id} type="button" className="vn-card vn-card--hover" style={{ textAlign: "left", cursor: "pointer", font: "inherit" }} onClick={() => inspect({ kind: "evidence", id })}>
            <div className="vn-card__body"><span className="vn-caption">[{citation(id)}] {e ? `${source(e.sourceId)?.title ?? e.sourceId} · ${describeLocator(e.locator)}` : id}</span>{e ? <span className="vn-small" style={{ color: "var(--text-strong)" }}>“{e.excerpt}”</span> : null}</div>
          </button>;
        }) : <p className="vn-caption">Nhận định chưa có bằng chứng — không nên coi là đã được xác minh.</p>}
      </div>
    </> : <p>Nhận định “{inspected.id}” không tồn tại trong kết quả.</p>;
  }

  return <>
    <div className="vn-drawer-backdrop" onClick={() => inspect(null)} />
    <aside className="vn-drawer" role="dialog" aria-modal="true" aria-label={title}>
      <div className="vn-drawer__head">
        <span className="vn-overline">{title}</span>
        <button ref={closeRef} type="button" className="vn-icon-btn" onClick={() => inspect(null)} aria-label="Đóng"><Icon name="x" size={18} /></button>
      </div>
      <div className="vn-drawer__body">{body}</div>
    </aside>
  </>;
}
