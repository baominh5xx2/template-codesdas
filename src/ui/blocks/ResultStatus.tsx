"use client";

import type { ReactNode } from "react";
import { Section, SectionHeading } from "../kit";
import { ScrollExpand } from "../kit/ScrollExpand";
import { Button, EmptyState, Notice, Skeleton, type IconName } from "../primitives";
import { useResult } from "./context";
import { BlockContent } from "./BlockRenderer";
import { ProgressBlock } from "./basic";

/**
 * Chooses what the result area shows for the run status: loading, failure, unavailable, empty,
 * a partial banner followed by the sections, or the full result sections.
 */
export function ResultStatus({ children, emptyIcon = "layers", emptyTitle = "Chưa có kết quả", emptyHint, onRetry, reveal }: { children: ReactNode; emptyIcon?: IconName; emptyTitle?: string; emptyHint?: ReactNode; onRetry?: () => void; reveal?: { image: string; title: string; lead: ReactNode } }) {
  const { bundle } = useResult();
  const { status, blocks } = bundle.view;
  const warnings = blocks.filter(block => block.type === "warning");
  const progress = blocks.find(block => block.type === "progress");
  const progressView = progress?.type === "progress" ? <ProgressBlock props={progress.props} /> : null;

  if (status === "queued" || status === "running") {
    return <Section tone="subtle" id="ket-qua">
      <SectionHeading title="Đang phân tích…" subtitle="Kết quả sẽ hiện khi các bước hoàn tất. Bạn có thể rời trang và quay lại sau." />
      <div className="vn-intro">
        <div>{progressView}</div>
        <div className="vn-stack"><Skeleton height={220} /><Skeleton height={18} width="70%" /><Skeleton height={18} width="45%" /></div>
      </div>
    </Section>;
  }
  if (status === "failed" || status === "cancelled") {
    return <Section tone="subtle" id="ket-qua">
      <SectionHeading title={status === "failed" ? "Phân tích chưa thành công" : "Lượt chạy đã huỷ"} subtitle="Không có kết quả nào được coi là thành công khi một bước bắt buộc thất bại." />
      <div className="vn-intro">
        <div>{progressView}</div>
        <div className="vn-stack">
          {warnings.map(block => <BlockContent key={block.id} block={block} />)}
          {onRetry ? <div><Button iconLeft="refresh-cw" onClick={onRetry}>Thử lại</Button></div> : null}
        </div>
      </div>
    </Section>;
  }
  if (status === "interrupted") {
    return <Section tone="ice" id="ket-qua">
      <SectionHeading title="Sắp ra mắt" subtitle="Năng lực xử lý cho mẫu này chưa được bật trên nền tảng. Giao diện không tự tạo kết quả thay thế." />
      <div className="vn-grid--2 vn-grid">{warnings.map(block => <BlockContent key={block.id} block={block} />)}</div>
    </Section>;
  }
  if (!blocks.length) {
    return <Section id="ket-qua"><EmptyState icon={emptyIcon} title={emptyTitle}>{emptyHint ?? "Lượt chạy hoàn tất nhưng không tạo ra nội dung nào."}</EmptyState></Section>;
  }
  return <>
    {reveal ? <ScrollExpand useWindowScroll overlayScrim={0.85} src={reveal.image} title={reveal.title} scrollHint="Cuộn để xem kết quả" id="ket-qua">
      <span className="vn-hero__kicker" style={{ color: "var(--vn-ice)" }}>{status === "partial" ? "Kết quả một phần" : "Kết quả"} · dữ liệu demo</span>
      <h2>{bundle.view.title}</h2>
      <p>{reveal.lead}</p>
    </ScrollExpand> : null}
    {status === "partial" ? <Section tight flushTop>
      <div className="vn-grid vn-grid--2">{warnings.map(block => <BlockContent key={block.id} block={block} />)}<Notice title="Kết quả một phần">Những phần còn thiếu được đánh dấu rõ, không được suy diễn hay lấp bằng dữ liệu khác.</Notice></div>
    </Section> : null}
    {children}
  </>;
}
