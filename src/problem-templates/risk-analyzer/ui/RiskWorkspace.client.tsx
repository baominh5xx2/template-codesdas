"use client";

import { useState, type ReactNode } from "react";
import type { DemoBundle } from "@/demo/schemas";
import { BlockContent, useBlocks } from "@/ui/blocks/BlockRenderer";
import { useResult } from "@/ui/blocks/context";
import { MetricStats, RecommendationOffer } from "@/ui/blocks/kit-blocks";
import { ResultStatus } from "@/ui/blocks/ResultStatus";
import { RiskBlock } from "@/ui/blocks/RiskBlock";
import { SupportBadge } from "@/ui/blocks/shared";
import { Field, FileDrop, Segmented, UrlList, type UploadedFile } from "@/ui/forms";
import { useRunRequest } from "@/ui/hooks/useRunRequest";
import { Section, SectionHeading } from "@/ui/kit";
import { Carousel } from "@/ui/kit/client";
import { Accordion } from "@/ui/primitives/Accordion";
import { Button, cx } from "@/ui/primitives";
import { FormPanel, IntroSection, JumpBar, RunNotice, TemplateBody, type DemoStateId } from "@/ui/shells/template";
import { MESSAGE, RiskInputSchema, type RiskInput } from "../data";
import type { RiskExtras } from "../fixtures";
import { riskMeta } from "../manifest.client";

const STEP_LABELS = Object.fromEntries(riskMeta.steps.map(step => [step.id, step.label]));
const OFFER_IMAGES = ["/images/phishing.jpg", "/images/risk-card.jpg", "/images/office.jpg"];

export function RiskWorkspace({ bundle, extras, state, basePath }: { bundle: DemoBundle; extras: RiskExtras; state: DemoStateId; basePath: string }) {
  const run = useRunRequest(riskMeta.id);
  const [mode, setMode] = useState<RiskInput["mode"]>("text");
  const [text, setText] = useState(MESSAGE);
  const [urls, setUrls] = useState<string[]>([]);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [ruleset, setRuleset] = useState<RiskInput["ruleset"]>("finance-scam");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const parsed = RiskInputSchema.safeParse({ mode, text, urls, fileName: files[0]?.name, ruleset });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Dữ liệu chưa hợp lệ"); return; }
    setError(null);
    void run.submit(parsed.data);
  };

  const form = <FormPanel title="Kiểm tra nội dung" subtitle="Dán tin nhắn, thêm đường link hoặc tải ảnh chụp màn hình. Chúng tôi không mở đường link bạn gửi.">
    <form className="vn-form" onSubmit={event => { event.preventDefault(); submit(); }} noValidate>
      <Segmented label="Loại nội dung" value={mode} onChange={setMode} options={[{ value: "text", label: "Tin nhắn" }, { value: "url", label: "Đường link" }, { value: "image", label: "Ảnh chụp" }]} />
      {mode === "text" ? <Field label="Nội dung tin nhắn" htmlFor="risk-text" error={error ?? undefined}>
        <textarea id="risk-text" className="vn-textarea" value={text} onChange={event => setText(event.target.value)} maxLength={5000} />
      </Field> : mode === "url" ? <Field label="Đường link nghi ngờ" error={error ?? undefined} hint="Chỉ phân tích chuỗi địa chỉ, không truy cập trang.">
        <UrlList value={urls} onChange={setUrls} />
      </Field> : <Field label="Ảnh chụp màn hình" error={error ?? undefined}>
        <FileDrop accept=".png,.jpg,.jpeg" label="Kéo thả ảnh chụp" hint="PNG hoặc JPG, tối đa 10 MB" files={files} onChange={setFiles} maxBytes={10 * 1_048_576} />
      </Field>}
      <Field label="Bộ quy tắc" htmlFor="risk-rules" hint="Mỗi bộ quy tắc có tín hiệu và trọng số riêng.">
        <select id="risk-rules" className="vn-select" value={ruleset} onChange={event => setRuleset(event.target.value as RiskInput["ruleset"])}>
          <option value="finance-scam">Lừa đảo tài chính, ngân hàng</option><option value="job-scam">Tuyển dụng giả</option><option value="investment-scam">Đầu tư lãi cao</option>
        </select>
      </Field>
      <Button type="submit" size="l" fullWidth iconRight="arrow-right" disabled={run.state.phase === "submitting"}>{run.state.phase === "submitting" ? "Đang gửi…" : "Kiểm tra rủi ro"}</Button>
    </form>
  </FormPanel>;

  return <TemplateBody bundle={bundle} stepLabels={STEP_LABELS} onRetry={submit} columnLabels={{ label: "Tín hiệu", weight: "Trọng số", status: "Trạng thái", points: "Điểm" }}>
    <IntroSection form={form}
      lead="Một tin nhắn báo khoá tài khoản, một đường link “xác minh” – thật hay giả? Hãy kiểm tra trước khi bấm."
      paragraphs={[
        "Mẫu này tìm các tín hiệu quen thuộc của lừa đảo, chấm điểm theo một bộ quy tắc công khai trọng số, và chỉ đúng chỗ trong nội dung làm căn cứ.",
        "Điều gì chưa kiểm tra được sẽ được ghi là chưa kiểm tra – thiếu dữ liệu không bao giờ được coi là an toàn.",
      ]} />
    <JumpBar basePath={basePath} state={state} links={[
      { label: "Kết luận", href: "#ket-luan" }, { label: "Tín hiệu trong nội dung", href: "#tin-hieu" }, { label: "Kiểm chứng", href: "#kiem-chung" },
      { label: "Kịch bản quen thuộc", href: "#kich-ban" }, { label: "Nên làm gì", href: "#khuyen-nghi" }, { label: "Báo cáo", href: "#bao-cao" },
    ]} />
    <RunNotice state={run.state} onDismiss={run.reset} />
    <ResultStatus reveal={{ image: "/images/risk-card.jpg", title: "Kết luận", lead: "Điểm rủi ro, từng tín hiệu trong nội dung và việc nên làm ngay." }} onRetry={submit} emptyIcon="shield" emptyTitle="Không có gì để chấm điểm" emptyHint="Nội dung trống sau khi chuẩn hoá (ví dụ ảnh không có chữ).">
      <RiskSections message={extras.message} tone={extras.evidenceTone} />
    </ResultStatus>
  </TemplateBody>;
}

function RiskSections({ message, tone }: { message: string | null; tone: RiskExtras["evidenceTone"] }) {
  const { blocksById, evidence, inspect, claim } = useResult();
  const risk = useBlocks("risk")[0];
  const warnings = useBlocks("warning").filter(block => block.id === "warning-link");
  const metrics = useBlocks("metric");
  const verdicts = useBlocks("verdict");
  const timeline = useBlocks("timeline")[0];
  const recommendations = useBlocks("recommendation");
  const actions = useBlocks("action");
  const report = blocksById.get("report"), sources = blocksById.get("sources"), progress = blocksById.get("progress"), table = blocksById.get("table-signals");

  return <>
    {risk ? <Section id="ket-luan">
      <SectionHeading title={risk.props.level === "high" ? "Kết luận: rủi ro cao" : risk.props.level === "medium" ? "Kết luận: cần thận trọng" : risk.props.level === "low" ? "Kết luận: rủi ro thấp" : "Chưa đủ dữ liệu để kết luận"} subtitle="Điểm càng cao càng nguy hiểm. Bấm vào số trích dẫn để xem đúng đoạn làm căn cứ." />
      <div className="vn-intro">
        <div data-block-id={risk.id}><RiskBlock props={risk.props} /></div>
        <div className="vn-stack">
          {warnings.map(block => <BlockContent key={block.id} block={block} />)}
          <MetricStats blocks={metrics} />
        </div>
      </div>
    </Section> : null}

    {message ? <Section tone="subtle" id="tin-hieu">
      <SectionHeading title="Tín hiệu trong nội dung" subtitle="Màu đỏ là tín hiệu nặng, màu cam là tín hiệu hỗ trợ. Bấm vào đoạn tô màu để xem lý do." />
      <div className="vn-stack vn-stack--l">
        <div className="vn-doc" style={{ fontSize: 20, maxWidth: 900, lineHeight: 1.8 }}><div className="vn-doc__page" style={{ marginBottom: 12 }}>Tin nhắn SMS</div><HighlightedText text={message} marks={evidence.filter(e => e.sourceId !== "source-rules" && e.locator.type === "text").map(e => ({ id: e.id, start: (e.locator as { start: number }).start, end: (e.locator as { end: number }).end }))} tone={tone} onPick={id => inspect({ kind: "evidence", id })} /></div>
        {table ? <div className="vn-stack vn-stack--s"><h3 className="vn-linklist__title">Bảng tín hiệu và trọng số</h3><BlockContent block={table} /></div> : null}
      </div>
    </Section> : null}

    {verdicts.length ? <Section id="kiem-chung">
      <SectionHeading title="Kiểm chứng" subtitle="Những điều đã đối chiếu được – và những điều chưa." />
      <Accordion defaultOpen={0} items={verdicts.map(block => ({
        title: <span className="vn-row" style={{ gap: 12 }}><span>{claim(block.props.claimId)?.text ?? block.props.claimId}</span><SupportBadge support={block.props.support} /></span>,
        content: <p>{block.props.reason}</p>,
      }))} />
    </Section> : null}

    {timeline ? <Section tone="navy" id="kich-ban">
      <SectionHeading title="Kịch bản quen thuộc" subtitle="Tin nhắn này khớp với bước đầu tiên của một kịch bản lừa đảo rất phổ biến." />
      <div className="vn-grid vn-grid--4">{timeline.props.items.map((item, index) => <div key={item.id} className="vn-stack vn-stack--s">
        <span style={{ font: "var(--fw-black) 56px/1 var(--font-display)", color: index === 0 ? "#fff" : "var(--vn-ice)" }}>{String(index + 1).padStart(2, "0")}</span>
        <h3 className="vn-h4" style={{ color: "#fff" }}>{item.title}</h3>
        {item.description ? <p style={{ color: "var(--vn-ice-200)", fontSize: 15 }}>{item.description}</p> : null}
      </div>)}</div>
    </Section> : null}

    {recommendations.length ? <Section tone="ice" id="khuyen-nghi">
      <SectionHeading title="Nên làm gì ngay bây giờ?" subtitle="Ba việc đơn giản giúp bạn an toàn – xếp theo mức ưu tiên." />
      <Carousel>{recommendations.map((block, index) => <RecommendationOffer key={block.id} block={block} image={OFFER_IMAGES[index % OFFER_IMAGES.length]} />)}</Carousel>
    </Section> : null}

    <Section id="bao-cao">
      <SectionHeading title="Báo cáo và nguồn" subtitle="Gửi cho người thân để cùng cảnh giác." />
      <Accordion defaultOpen={0} items={[
        ...(report ? [{ title: "Báo cáo", content: <BlockContent block={report} /> }] : []),
        ...(sources ? [{ title: "Nguồn và bộ quy tắc", content: <BlockContent block={sources} /> }] : []),
        ...(progress ? [{ title: "Các bước đã chạy", content: <BlockContent block={progress} /> }] : []),
        ...(actions.length ? [{ title: "Xuất kết quả", content: <div className="vn-row">{actions.map(block => <BlockContent key={block.id} block={block} />)}</div> }] : []),
      ]} />
    </Section>
  </>;
}

/** Text with non-overlapping highlighted ranges. */
export function HighlightedText({ text, marks, tone, onPick }: { text: string; marks: Array<{ id: string; start: number; end: number }>; tone: Record<string, string>; onPick: (id: string) => void }) {
  const parts: ReactNode[] = [];
  let cursor = 0;
  for (const mark of [...marks].sort((a, b) => a.start - b.start)) {
    if (mark.start < cursor) continue;
    parts.push(text.slice(cursor, mark.start));
    parts.push(<mark key={mark.id} className={cx("vn-mark", tone[mark.id] && `vn-mark--${tone[mark.id]}`)} onClick={() => onPick(mark.id)} title="Mở bằng chứng">{text.slice(mark.start, mark.end)}</mark>);
    cursor = mark.end;
  }
  parts.push(text.slice(cursor));
  return <p style={{ wordBreak: "break-word" }}>{parts}</p>;
}
