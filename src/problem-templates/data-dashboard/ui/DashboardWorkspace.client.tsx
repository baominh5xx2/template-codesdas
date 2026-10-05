"use client";

import { useMemo, useState } from "react";
import type { DataRow } from "@/contracts/datasets";
import type { DemoBundle } from "@/demo/schemas";
import { BlockContent, BlockView, useBlocks } from "@/ui/blocks/BlockRenderer";
import { useResult } from "@/ui/blocks/context";
import { InsightNotice, MetricStats, RecommendationOffer } from "@/ui/blocks/kit-blocks";
import { ResultStatus } from "@/ui/blocks/ResultStatus";
import { Field, FileDrop, type UploadedFile } from "@/ui/forms";
import { useRunRequest } from "@/ui/hooks/useRunRequest";
import { Section, SectionHeading } from "@/ui/kit";
import { Carousel } from "@/ui/kit/client";
import { Accordion } from "@/ui/primitives/Accordion";
import { Button, Chip, Icon } from "@/ui/primitives";
import { FormPanel, IntroSection, JumpBar, RunNotice, TemplateBody, type DemoStateId } from "@/ui/shells/template";
import { COLUMN_LABELS, DashboardInputSchema, DATASET_ID, datasetPage, kpiBlocks, SEGMENTS, type DashboardInput, type Segment } from "../data";
import { dashboardMeta } from "../manifest.client";

const MEASURES = [
  { value: "visitors", label: "Lượt khách", charts: ["chart-visitors", "chart-segment"] },
  { value: "revenue", label: "Doanh thu", charts: ["chart-revenue"] },
  { value: "avgStay", label: "Số đêm lưu trú", charts: ["chart-stay"] },
] as const;
type Measure = DashboardInput["measures"][number];
const QUARTERS = ["Q1", "Q2", "Q3", "Q4"] as const;
type Quarter = (typeof QUARTERS)[number];
const OFFER_IMAGES = ["/images/traveler.jpg", "/images/pier.jpg", "/images/beach.jpg"];
const STEP_LABELS = Object.fromEntries(dashboardMeta.steps.map(step => [step.id, step.label]));

export function DashboardWorkspace({ bundle, state, basePath }: { bundle: DemoBundle; state: DemoStateId; basePath: string }) {
  const run = useRunRequest(dashboardMeta.id);
  const [files, setFiles] = useState<UploadedFile[]>([{ name: "du-lich-2025.xlsx", size: 48_213, type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }]);
  const [measures, setMeasures] = useState<Measure[]>(["visitors", "revenue", "avgStay"]);
  const [question, setQuestion] = useState("Mùa nào thấp điểm và nên làm gì?");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [segment, setSegment] = useState<Segment | "all">("all");
  const [quarter, setQuarter] = useState<Quarter | "all">("all");

  const filtered = useMemo(() => {
    const page = bundle.datasets[DATASET_ID];
    if (!page) return undefined;
    const rows = page.rows.filter(row => (segment === "all" || row.values.segment === segment) && (quarter === "all" || row.values.quarter === quarter));
    return { ...bundle.datasets, [DATASET_ID]: datasetPage(rows) };
  }, [bundle.datasets, segment, quarter]);

  const submit = () => {
    const parsed = DashboardInputSchema.safeParse({ fileName: files[0]?.name ?? "", measures, question: question || undefined });
    if (!parsed.success) { setErrors(Object.fromEntries(parsed.error.issues.map(issue => [String(issue.path[0]), issue.message]))); return; }
    setErrors({});
    void run.submit(parsed.data);
  };

  const form = <FormPanel title="Tải dữ liệu của bạn" subtitle="CSV hoặc XLSX, dòng đầu là tên cột. Số liệu được tính trực tiếp, không qua mô hình ngôn ngữ.">
    <form className="vn-form" onSubmit={event => { event.preventDefault(); submit(); }} noValidate>
      <Field label="Tệp dữ liệu" error={errors.fileName}>
        <FileDrop accept=".csv,.xlsx" label="Kéo thả hoặc chọn tệp" hint="Tối đa 20 MB" files={files} onChange={setFiles} />
      </Field>
      <Field label="Chỉ số cần phân tích" error={errors.measures}>
        <div className="vn-chip-row">{MEASURES.map(m => <Chip key={m.value} active={measures.includes(m.value)} onClick={() => setMeasures(prev => prev.includes(m.value) ? prev.filter(v => v !== m.value) : [...prev, m.value])}>{m.label}</Chip>)}</div>
      </Field>
      <Field label="Bạn muốn biết điều gì?" optional htmlFor="dash-question">
        <textarea id="dash-question" className="vn-textarea" style={{ minHeight: 88 }} value={question} onChange={event => setQuestion(event.target.value)} maxLength={500} />
      </Field>
      <Button type="submit" size="l" fullWidth iconRight="arrow-right" disabled={run.state.phase === "submitting"}>{run.state.phase === "submitting" ? "Đang gửi…" : "Phân tích dữ liệu"}</Button>
    </form>
  </FormPanel>;

  return <TemplateBody bundle={bundle} datasets={filtered} columnLabels={COLUMN_LABELS} stepLabels={STEP_LABELS} onRetry={submit}>
    <IntroSection form={form}
      lead="Một bảng tính đầy số liệu – và câu chuyện ẩn sau nó. Tải dữ liệu lên, chúng tôi lo phần tính toán."
      paragraphs={[
        "Mẫu này đọc tệp CSV hoặc XLSX, nhận diện cột, tính KPI và xu hướng một cách tất định – cùng một dữ liệu luôn cho cùng một con số.",
        "Mỗi nhận định đều trỏ về đúng dòng dữ liệu gốc, nên bạn có thể bấm vào và tự kiểm chứng (và nên làm thế!).",
      ]} />
    <JumpBar basePath={basePath} state={state} links={[
      { label: "Chỉ số chính", href: "#chi-so" }, { label: "Biểu đồ", href: "#bieu-do" }, { label: "Nhận định", href: "#nhan-dinh" },
      { label: "Khuyến nghị", href: "#khuyen-nghi" }, { label: "Dữ liệu chi tiết", href: "#du-lieu" }, { label: "Báo cáo và nguồn", href: "#bao-cao" },
    ]} />
    <RunNotice state={run.state} onDismiss={run.reset} />
    <ResultStatus reveal={{ image: "/images/saigon.jpg", title: "Bảng điều khiển", lead: "Bốn con số, bốn biểu đồ và những nhận định có trích dẫn – tính trực tiếp từ dữ liệu của bạn." }} onRetry={submit} emptyIcon="file-spreadsheet" emptyTitle="Tệp không có dòng dữ liệu" emptyHint="Tệp được đọc thành công nhưng không có dòng nào sau tiêu đề. Kiểm tra lại sheet đầu tiên.">
      <DashboardSections measures={measures} filteredRows={filtered?.[DATASET_ID]?.rows} segment={segment} quarter={quarter} onSegment={setSegment} onQuarter={setQuarter} />
    </ResultStatus>
  </TemplateBody>;
}

function DashboardSections({ measures, filteredRows, segment, quarter, onSegment, onQuarter }: { measures: Measure[]; filteredRows?: DataRow[]; segment: Segment | "all"; quarter: Quarter | "all"; onSegment: (s: Segment | "all") => void; onQuarter: (q: Quarter | "all") => void }) {
  const { blocksById } = useResult();
  const isFiltered = segment !== "all" || quarter !== "all";
  const fixtureMetrics = useBlocks("metric");
  const metrics = filteredRows && isFiltered ? kpiBlocks(filteredRows, false).filter((b): b is Extract<typeof b, { type: "metric" }> => b.type === "metric") : fixtureMetrics;
  const charts = useBlocks("chart").filter(chart => MEASURES.some(m => measures.includes(m.value) && (m.charts as readonly string[]).includes(chart.id)));
  const insights = useBlocks("insight");
  const recommendations = useBlocks("recommendation");
  const report = blocksById.get("report");
  const sources = blocksById.get("sources");
  const progress = blocksById.get("progress");
  const actions = useBlocks("action");

  return <>
    <Section tone="navy" id="chi-so">
      <SectionHeading title={isFiltered ? "Kết quả theo bộ lọc" : "2025 trong bốn con số"} subtitle={isFiltered ? "Tính lại trực tiếp từ những dòng đang chọn – không so sánh cùng kỳ." : "So với cùng kỳ năm trước. Lọc theo phân khúc hoặc theo quý để xem kỹ hơn."} />
      <div className="vn-stack" style={{ gap: 12, marginBottom: 40 }}>
        <div className="vn-chip-row" role="group" aria-label="Phân khúc">
          <Chip tone="dark" active={segment === "all"} onClick={() => onSegment("all")}>Mọi phân khúc</Chip>
          {SEGMENTS.map(s => <Chip key={s} tone="dark" active={segment === s} onClick={() => onSegment(s)}>{s}</Chip>)}
        </div>
        <div className="vn-chip-row" role="group" aria-label="Quý">
          <Chip tone="dark" active={quarter === "all"} onClick={() => onQuarter("all")}>Cả năm</Chip>
          {QUARTERS.map(q => <Chip key={q} tone="dark" active={quarter === q} onClick={() => onQuarter(q)}>{q}</Chip>)}
        </div>
      </div>
      <MetricStats blocks={metrics} />
    </Section>

    {charts.length ? <Section id="bieu-do">
      <SectionHeading title="Theo dòng thời gian" subtitle="Rê chuột lên biểu đồ để xem số liệu từng tháng; bấm chú giải để ẩn bớt chuỗi." />
      <div className="vn-grid vn-grid--2">{charts.map(block => <BlockView key={block.id} block={block} />)}</div>
    </Section> : null}

    {insights.length ? <Section tight id="nhan-dinh" flushTop={!charts.length ? false : true}>
      <SectionHeading size="m" title="Điều dữ liệu đang nói" subtitle="Bấm vào số trích dẫn để mở đúng dòng dữ liệu làm căn cứ." />
      <div className="vn-grid vn-grid--3">{insights.map((block, index) => <InsightNotice key={block.id} block={block} tone={index === insights.length - 1 && block.props.claimIds.length === 1 ? "navy" : undefined} />)}</div>
    </Section> : null}

    {recommendations.length ? <Section tone="ice" id="khuyen-nghi">
      <SectionHeading title="Nên làm gì tiếp theo?" subtitle="Khuyến nghị đi kèm lý do – và lý do đi kèm bằng chứng." />
      <Carousel>{recommendations.map((block, index) => <RecommendationOffer key={block.id} block={block} image={OFFER_IMAGES[index % OFFER_IMAGES.length]} />)}</Carousel>
    </Section> : null}

    {blocksById.get("table-rows") ? <Section id="du-lieu">
      <SectionHeading title="Dữ liệu chi tiết" subtitle="Bấm tiêu đề cột để sắp xếp. Bảng dùng cùng bộ lọc với các chỉ số ở trên." />
      <BlockContent block={blocksById.get("table-rows")!} />
    </Section> : null}

    <Section tone="subtle" id="bao-cao">
      <SectionHeading title="Báo cáo và nguồn" subtitle="Mọi thứ bạn cần để chia sẻ kết quả – kèm nguồn gốc của từng con số." />
      <Accordion defaultOpen={0} items={[
        ...(report ? [{ title: "Tóm tắt báo cáo", content: <BlockContent block={report} /> }] : []),
        ...(sources ? [{ title: "Nguồn dữ liệu", content: <BlockContent block={sources} /> }] : []),
        ...(progress ? [{ title: "Các bước đã chạy", content: <BlockContent block={progress} /> }] : []),
        ...(actions.length ? [{ title: "Xuất kết quả", content: <div className="vn-row">{actions.map(block => <BlockContent key={block.id} block={block} />)}<span className="vn-caption vn-row" style={{ gap: 6 }}><Icon name="info" size={14} />Tệp xuất giữ nguyên mã nguồn và trích dẫn.</span></div> }] : []),
      ]} />
    </Section>
  </>;
}
