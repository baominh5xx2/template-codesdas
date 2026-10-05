"use client";

import { useState } from "react";
import type { DemoBundle } from "@/demo/schemas";
import { BlockContent, useBlocks } from "@/ui/blocks/BlockRenderer";
import { useResult } from "@/ui/blocks/context";
import { ComparisonBlock } from "@/ui/blocks/basic";
import { InsightNotice, MetricStats, RecommendationOffer } from "@/ui/blocks/kit-blocks";
import { ResultStatus } from "@/ui/blocks/ResultStatus";
import { SupportBadge } from "@/ui/blocks/shared";
import { formatDateTime } from "@/ui/format";
import { Field, UrlList } from "@/ui/forms";
import { useRunRequest } from "@/ui/hooks/useRunRequest";
import { Img, Section, SectionHeading } from "@/ui/kit";
import { Carousel } from "@/ui/kit/client";
import { Accordion } from "@/ui/primitives/Accordion";
import { Button, Chip, Icon } from "@/ui/primitives";
import { FormPanel, IntroSection, JumpBar, RunNotice, TemplateBody, type DemoStateId } from "@/ui/shells/template";
import { ResearchInputSchema, type ResearchInput } from "../data";
import type { ResearchExtras } from "../fixtures";
import { researchMeta } from "../manifest.client";

const STEP_LABELS = Object.fromEntries(researchMeta.steps.map(step => [step.id, step.label]));
const OFFER_IMAGES = ["/images/forest.jpg", "/images/whiteboard.jpg", "/images/map-travel.jpg"];
const DOMAINS = [
  { value: "reports", label: "Báo cáo ngành" },
  { value: "news", label: "Báo chí" },
  { value: "surveys", label: "Khảo sát" },
  { value: "academic", label: "Học thuật" },
  { value: "gov", label: "Cơ quan nhà nước" },
];

export function ResearchWorkspace({ bundle, extras, state, basePath }: { bundle: DemoBundle; extras: ResearchExtras; state: DemoStateId; basePath: string }) {
  const run = useRunRequest(researchMeta.id);
  const [query, setQuery] = useState("Xu hướng du lịch xanh tại Việt Nam và phân khúc nào đáng đầu tư?");
  const [domains, setDomains] = useState<string[]>(["reports", "news", "surveys"]);
  const [maxSources, setMaxSources] = useState(8);
  const [timeRange, setTimeRange] = useState<ResearchInput["timeRange"]>("12m");
  const [seedUrls, setSeedUrls] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = () => {
    const parsed = ResearchInputSchema.safeParse({ query, seedUrls, domains, maxSources, timeRange });
    if (!parsed.success) { setErrors(Object.fromEntries(parsed.error.issues.map(issue => [String(issue.path[0]), issue.message]))); return; }
    setErrors({});
    void run.submit(parsed.data);
  };

  const form = <FormPanel title="Đặt câu hỏi nghiên cứu" subtitle="Chọn phạm vi nguồn; chúng tôi chỉ trích dẫn những gì thực sự tìm thấy.">
    <form className="vn-form" onSubmit={event => { event.preventDefault(); submit(); }} noValidate>
      <Field label="Câu hỏi" htmlFor="rs-query" error={errors.query}>
        <textarea id="rs-query" className="vn-textarea" style={{ minHeight: 96 }} value={query} onChange={event => setQuery(event.target.value)} />
      </Field>
      <Field label="Nhóm nguồn" error={errors.domains}>
        <div className="vn-chip-row">{DOMAINS.map(d => <Chip key={d.value} size="s" active={domains.includes(d.value)} onClick={() => setDomains(prev => prev.includes(d.value) ? prev.filter(v => v !== d.value) : [...prev, d.value])}>{d.label}</Chip>)}</div>
      </Field>
      <div className="vn-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Field label={`Tối đa ${maxSources} nguồn`} htmlFor="rs-max">
          <input id="rs-max" type="range" className="vn-range" min={3} max={20} value={maxSources} onChange={event => setMaxSources(Number(event.target.value))} />
        </Field>
        <Field label="Thời gian" htmlFor="rs-time">
          <select id="rs-time" className="vn-select" value={timeRange} onChange={event => setTimeRange(event.target.value as ResearchInput["timeRange"])}><option value="12m">12 tháng qua</option><option value="24m">2 năm qua</option><option value="all">Không giới hạn</option></select>
        </Field>
      </div>
      <Field label="Nguồn bạn muốn thêm" optional><UrlList value={seedUrls} onChange={setSeedUrls} /></Field>
      <Button type="submit" size="l" fullWidth iconRight="arrow-right" disabled={run.state.phase === "submitting"}>{run.state.phase === "submitting" ? "Đang gửi…" : "Bắt đầu nghiên cứu"}</Button>
    </form>
  </FormPanel>;

  return <TemplateBody bundle={bundle} stepLabels={STEP_LABELS} onRetry={submit}>
    <IntroSection form={form}
      lead="Mười hai tab trình duyệt, ba con số khác nhau cho cùng một câu hỏi. Quen không? Để chúng tôi đọc giúp."
      paragraphs={[
        "Mẫu này lập kế hoạch tìm kiếm, gom nguồn, loại trùng, rồi rút ra phát hiện – mỗi phát hiện đều trỏ về đúng đoạn trong nguồn gốc.",
        "Khi các nguồn không thống nhất, chúng tôi nói thẳng ra. Và nếu tìm kiếm không chạy được, báo cáo sẽ dừng lại thay vì bịa thêm nguồn.",
      ]} />
    <JumpBar basePath={basePath} state={state} links={[
      { label: "Tổng quan", href: "#tong-quan" }, { label: "Phát hiện chính", href: "#phat-hien" }, { label: "So sánh", href: "#so-sanh" },
      { label: "Chỗ chưa thống nhất", href: "#mau-thuan" }, { label: "Nguồn", href: "#nguon" }, { label: "Báo cáo", href: "#bao-cao" },
    ]} />
    <RunNotice state={run.state} onDismiss={run.reset} />
    <ResultStatus reveal={{ image: "/images/research-card.jpg", title: "Đã tổng hợp", lead: "Phát hiện có trích dẫn, so sánh phân khúc và những chỗ các nguồn chưa thống nhất." }} onRetry={submit} emptyIcon="search" emptyTitle="Không tìm thấy nguồn phù hợp" emptyHint="Thử mở rộng khoảng thời gian hoặc thêm nhóm nguồn. Chúng tôi không tạo nguồn giả để lấp chỗ trống.">
      <ResearchSections images={extras.sourceImages} />
    </ResultStatus>
  </TemplateBody>;
}

function ResearchSections({ images }: { images: Record<string, string> }) {
  const { blocksById, sources, evidence, inspect, claim } = useResult();
  const metrics = useBlocks("metric");
  const insights = useBlocks("insight");
  const verdicts = useBlocks("verdict");
  const recommendations = useBlocks("recommendation");
  const actions = useBlocks("action");
  const comparison = blocksById.get("comparison");
  const report = blocksById.get("report"), progress = blocksById.get("progress"), timeline = blocksById.get("timeline-sources");

  return <>
    <Section tone="navy" id="tong-quan">
      <SectionHeading title="Nghiên cứu trong bốn con số" subtitle="Từ 12 kết quả tìm kiếm còn lại 4 nguồn độc lập sau khi loại trùng và lọc theo thời gian." />
      <MetricStats blocks={metrics} />
    </Section>

    {insights.length ? <Section id="phat-hien">
      <SectionHeading title="Phát hiện chính" subtitle="Bấm số trích dẫn để đọc đúng đoạn trong nguồn gốc." />
      <div className="vn-grid vn-grid--3">{insights.map(block => <InsightNotice key={block.id} block={block} tone={block.props.severity === "warning" ? "navy" : "ice"} />)}</div>
    </Section> : null}

    {comparison?.type === "comparison" ? <Section tone="subtle" id="so-sanh">
      <SectionHeading title="So sánh phân khúc" subtitle="Ô gạch ngang nghĩa là không nguồn nào cung cấp số liệu – không phải bằng 0." />
      <ComparisonBlock props={comparison.props} highlightId="homestay" better={{ price: "lower", growth: "higher", mentions: "higher" }} />
    </Section> : null}

    {verdicts.length ? <Section id="mau-thuan">
      <SectionHeading title="Chỗ các nguồn chưa thống nhất" subtitle="Những điều cần đối chiếu thêm trước khi trích dẫn trong bài thuyết trình." />
      <Accordion defaultOpen={0} items={verdicts.map(block => ({
        title: <span className="vn-row" style={{ gap: 12 }}><span>{claim(block.props.claimId)?.text ?? block.props.claimId}</span><SupportBadge support={block.props.support} /></span>,
        content: <div className="vn-stack vn-stack--s"><p>{block.props.reason}</p>{(claim(block.props.claimId)?.evidenceIds ?? []).map(id => { const item = evidence.find(e => e.id === id); return item ? <blockquote key={id} className="vn-quote">“{item.excerpt}” <span className="vn-caption">— {sources.find(s => s.id === item.sourceId)?.title}</span></blockquote> : null; })}</div>,
      }))} />
    </Section> : null}

    {sources.length ? <Section tone="ice" id="nguon">
      <SectionHeading title="Nguồn đã dùng" subtitle="Mỗi nguồn kèm ngày xuất bản và số đoạn được trích. Bấm để xem các đoạn trích." />
      <div className="vn-grid vn-grid--4">{sources.map(source => <button key={source.id} type="button" className="vn-partner vn-zoom" style={{ all: "unset", cursor: "pointer", display: "flex", flexDirection: "column", gap: 12 }} onClick={() => inspect({ kind: "source", id: source.id })}>
        <Img src={images[source.id]} ratio="3/2" radius="var(--radius-card)" sizes="300px" />
        <span className="vn-partner__name">{source.title}<Icon name="arrow-right" size={16} /></span>
        <span className="vn-caption">{source.url ? new URL(source.url).hostname : "Tệp tải lên"}{source.publishedAt ? ` · ${formatDateTime(source.publishedAt)}` : ""} · {evidence.filter(e => e.sourceId === source.id).length} trích dẫn</span>
      </button>)}</div>
    </Section> : null}

    {recommendations.length ? <Section id="khuyen-nghi">
      <SectionHeading title="Gợi ý cho bước tiếp theo" subtitle="Từ phát hiện đến hành động – kèm mức độ chắc chắn." />
      <Carousel>{recommendations.map((block, index) => <RecommendationOffer key={block.id} block={block} image={OFFER_IMAGES[index % OFFER_IMAGES.length]} />)}</Carousel>
    </Section> : null}

    <Section tone="subtle" id="bao-cao">
      <SectionHeading title="Báo cáo nghiên cứu" subtitle="Bản tổng hợp sẵn sàng chia sẻ, giữ nguyên trích dẫn." />
      <Accordion defaultOpen={0} items={[
        ...(report ? [{ title: "Báo cáo", content: <BlockContent block={report} /> }] : []),
        ...(timeline ? [{ title: "Dòng thời gian nguồn", content: <BlockContent block={timeline} /> }] : []),
        ...(progress ? [{ title: "Các bước đã chạy", content: <BlockContent block={progress} /> }] : []),
        ...(actions.length ? [{ title: "Xuất kết quả", content: <div className="vn-row">{actions.map(block => <BlockContent key={block.id} block={block} />)}</div> }] : []),
      ]} />
    </Section>
  </>;
}
