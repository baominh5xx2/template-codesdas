"use client";

import { useState, type ReactNode } from "react";
import type { Evidence } from "@/contracts/evidence";
import type { NormalizedDocument } from "@/contracts/sources";
import type { DemoBundle } from "@/demo/schemas";
import { BlockContent, useBlocks } from "@/ui/blocks/BlockRenderer";
import { useResult } from "@/ui/blocks/context";
import { InsightNotice, MetricStats, RecommendationOffer } from "@/ui/blocks/kit-blocks";
import { ResultStatus } from "@/ui/blocks/ResultStatus";
import { SupportBadge } from "@/ui/blocks/shared";
import { Field, FileDrop, type UploadedFile } from "@/ui/forms";
import { useRunRequest } from "@/ui/hooks/useRunRequest";
import { Section, SectionHeading } from "@/ui/kit";
import { Carousel } from "@/ui/kit/client";
import { Accordion } from "@/ui/primitives/Accordion";
import { Badge, Button, cx, Icon } from "@/ui/primitives";
import { FormPanel, IntroSection, JumpBar, RunNotice, TemplateBody, type DemoStateId } from "@/ui/shells/template";
import { DocumentInputSchema, FIELDS_DATASET, type DocumentInput } from "../data";
import type { DocumentExtras } from "../fixtures";
import { documentMeta } from "../manifest.client";

const STEP_LABELS = Object.fromEntries(documentMeta.steps.map(step => [step.id, step.label]));
const OFFER_IMAGES = ["/images/desk.jpg", "/images/typing.jpg", "/images/meeting.jpg"];
const CHECKS: Array<{ value: DocumentInput["checks"][number]; label: string; hint: string }> = [
  { value: "missing-clauses", label: "Điều khoản còn thiếu", hint: "So với danh mục điều khoản bắt buộc của loại tài liệu" },
  { value: "fairness", label: "Mức độ cân bằng", hint: "Quyền và nghĩa vụ có lệch về một bên không" },
  { value: "deadlines", label: "Mốc thời hạn", hint: "Liệt kê mọi hạn chót và thời hạn báo trước" },
];

export function DocumentWorkspace({ bundle, extras, state, basePath }: { bundle: DemoBundle; extras: DocumentExtras; state: DemoStateId; basePath: string }) {
  const run = useRunRequest(documentMeta.id);
  const [files, setFiles] = useState<UploadedFile[]>([{ name: "hop-dong-thue-can-ho.pdf", size: 182_400, type: "application/pdf" }]);
  const [documentType, setDocumentType] = useState<DocumentInput["documentType"]>("lease");
  const [checks, setChecks] = useState<DocumentInput["checks"]>(["missing-clauses", "fairness"]);
  const [focus, setFocus] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = () => {
    const parsed = DocumentInputSchema.safeParse({ fileName: files[0]?.name ?? "", documentType, checks, focus: focus || undefined });
    if (!parsed.success) { setErrors(Object.fromEntries(parsed.error.issues.map(issue => [String(issue.path[0]), issue.message]))); return; }
    setErrors({});
    void run.submit(parsed.data);
  };

  const form = <FormPanel title="Tải tài liệu lên" subtitle="PDF hoặc DOCX có lớp chữ. Tài liệu chỉ dùng cho lượt phân tích này.">
    <form className="vn-form" onSubmit={event => { event.preventDefault(); submit(); }} noValidate>
      <Field label="Tài liệu" error={errors.fileName}>
        <FileDrop accept=".pdf,.docx" label="Kéo thả hoặc chọn tệp" hint="Tối đa 20 MB" files={files} onChange={setFiles} />
      </Field>
      <Field label="Loại tài liệu" htmlFor="doc-type" hint="Quyết định bộ trường cần trích xuất.">
        <select id="doc-type" className="vn-select" value={documentType} onChange={event => setDocumentType(event.target.value as DocumentInput["documentType"])}>
          <option value="lease">Hợp đồng thuê nhà</option><option value="employment">Hợp đồng lao động</option><option value="invoice">Hoá đơn</option><option value="other">Khác</option>
        </select>
      </Field>
      <Field label="Cần kiểm tra">
        <div className="vn-stack vn-stack--s" style={{ gap: 8 }}>{CHECKS.map(check => <label key={check.value} className="vn-check">
          <input type="checkbox" checked={checks.includes(check.value)} onChange={() => setChecks(prev => prev.includes(check.value) ? prev.filter(v => v !== check.value) : [...prev, check.value])} />
          <span className="vn-stack" style={{ gap: 2 }}><strong className="vn-strong" style={{ fontSize: 15 }}>{check.label}</strong><span className="vn-hint">{check.hint}</span></span>
        </label>)}</div>
      </Field>
      <Field label="Bạn lo ngại điều gì?" optional htmlFor="doc-focus">
        <textarea id="doc-focus" className="vn-textarea" style={{ minHeight: 80 }} value={focus} onChange={event => setFocus(event.target.value)} placeholder="Ví dụ: tiền cọc có hợp lý không?" maxLength={500} />
      </Field>
      <Button type="submit" size="l" fullWidth iconRight="arrow-right" disabled={run.state.phase === "submitting"}>{run.state.phase === "submitting" ? "Đang gửi…" : "Phân tích tài liệu"}</Button>
    </form>
  </FormPanel>;

  return <TemplateBody bundle={bundle} stepLabels={STEP_LABELS} onRetry={submit} columnLabels={{ field: "Trường", value: "Giá trị", page: "Trang", confidence: "Độ tin cậy" }}>
    <IntroSection form={form}
      lead="Hợp đồng dài, chữ nhỏ, và điều quan trọng thường nằm ở trang hai. Hãy để chúng tôi đọc kỹ giúp bạn."
      paragraphs={[
        "Mẫu này trích xuất các trường theo schema của từng loại tài liệu, rồi đánh dấu đúng đoạn văn làm căn cứ – ngay trên văn bản gốc.",
        "Điều khoản nào thiếu sẽ được nói thẳng là thiếu, thay vì đoán. Và tất nhiên: đây là công cụ hỗ trợ đọc, không thay cho tư vấn pháp lý.",
      ]} />
    <JumpBar basePath={basePath} state={state} links={[
      { label: "Tổng quan", href: "#tong-quan" }, { label: "Văn bản và trường", href: "#van-ban" }, { label: "Điều cần lưu ý", href: "#luu-y" },
      { label: "Kiểm tra điều khoản", href: "#kiem-tra" }, { label: "Khuyến nghị", href: "#khuyen-nghi" }, { label: "Tóm tắt", href: "#tom-tat" },
    ]} />
    <RunNotice state={run.state} onDismiss={run.reset} />
    <ResultStatus reveal={{ image: "/images/desk.jpg", title: "Đọc xong rồi", lead: "9 trường đã trích xuất, 3 điều khoản cần lưu ý – và một điều khoản còn thiếu." }} onRetry={submit} emptyIcon="file-text" emptyTitle="Tài liệu không có nội dung" emptyHint="Tệp đọc được nhưng không có trang chứa chữ. Kiểm tra lại tệp gốc.">
      <DocumentSections document={extras.document} evidenceTone={extras.evidenceTone} />
    </ResultStatus>
  </TemplateBody>;
}

function DocumentSections({ document, evidenceTone }: { document: NormalizedDocument | null; evidenceTone: DocumentExtras["evidenceTone"] }) {
  const { blocksById, datasets, evidence, inspect } = useResult();
  const [focused, setFocused] = useState<string | null>(null);
  const metrics = useBlocks("metric");
  const insights = useBlocks("insight");
  const verdicts = useBlocks("verdict");
  const recommendations = useBlocks("recommendation");
  const actions = useBlocks("action");
  const fields = datasets[FIELDS_DATASET]?.rows ?? [];
  const focusEvidence = (id: string) => {
    setFocused(id);
    window.document.getElementById(`mark-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  const report = blocksById.get("report"), sources = blocksById.get("sources"), progress = blocksById.get("progress");

  return <>
    <Section tone="navy" id="tong-quan">
      <SectionHeading title="Hợp đồng trong ba con số" subtitle="Bản mẫu tổng hợp: hợp đồng thuê căn hộ 12 tháng, 3 trang, 8 điều khoản." />
      <MetricStats blocks={metrics} />
    </Section>

    <Section id="van-ban">
      <SectionHeading title="Văn bản và các trường" subtitle="Bấm một trường để nhảy tới đoạn văn làm căn cứ. Đoạn được tô màu là bằng chứng đã liên kết." />
      <div className="vn-intro" style={{ gridTemplateColumns: "minmax(0, 1fr) minmax(0, 440px)" }}>
        {document ? <DocumentPreview document={document} evidence={evidence} tone={evidenceTone} focused={focused} onPick={id => inspect({ kind: "evidence", id })} /> : <p className="vn-muted">Chưa có bản xem trước.</p>}
        <div className="vn-linklist" style={{ position: "sticky", top: 24 }}>
          <h3 className="vn-linklist__title">Trường đã trích xuất</h3>
          <ul>{fields.map(row => {
            const evidenceId = typeof row.values.evidenceId === "string" ? row.values.evidenceId : null;
            const missing = row.values.value === null;
            return <li key={row.id}>
              <button type="button" className="vn-linklist__row" style={{ alignItems: "flex-start", cursor: evidenceId ? "pointer" : "default" }} onClick={() => evidenceId && focusEvidence(evidenceId)} disabled={!evidenceId}>
                <span className="vn-stack" style={{ gap: 4 }}>
                  <span className="vn-caption" style={{ fontWeight: 600 }}>{String(row.values.field)}</span>
                  <span style={{ fontSize: 17, color: missing ? "var(--vn-flag-red)" : undefined }}>{missing ? "Không tìm thấy trong tài liệu" : String(row.values.value)}</span>
                </span>
                {row.values.page ? <span className="vn-linklist__meta">Trang {String(row.values.page)}</span> : <Badge tone="warning">Thiếu</Badge>}
                {evidenceId ? <Icon name="chevron-right" size={20} /> : null}
              </button>
            </li>;
          })}</ul>
        </div>
      </div>
    </Section>

    {insights.length ? <Section tight flushTop id="luu-y">
      <SectionHeading size="m" title="Điều cần lưu ý" subtitle="Những gì hợp đồng nói – và những gì nó không nói." />
      <div className="vn-grid vn-grid--3">{insights.map(block => <InsightNotice key={block.id} block={block} />)}</div>
    </Section> : null}

    {verdicts.length ? <Section tone="subtle" id="kiem-tra">
      <SectionHeading title="Kiểm tra điều khoản" subtitle="Mỗi câu hỏi được trả lời bằng bằng chứng – hoặc ghi rõ là chưa đủ bằng chứng." />
      <Accordion defaultOpen={verdicts.findIndex(v => v.props.support !== "supported")} items={verdicts.map(block => ({
        title: <VerdictTitle claimId={block.props.claimId} support={block.props.support} />,
        content: <VerdictBody claimId={block.props.claimId} reason={block.props.reason} />,
      }))} />
    </Section> : null}

    {recommendations.length ? <Section tone="ice" id="khuyen-nghi">
      <SectionHeading title="Trước khi đặt bút ký" subtitle="Ba đề xuất chỉnh sửa, xếp theo mức ưu tiên." />
      <Carousel>{recommendations.map((block, index) => <RecommendationOffer key={block.id} block={block} image={OFFER_IMAGES[index % OFFER_IMAGES.length]} />)}</Carousel>
    </Section> : null}

    <Section id="tom-tat">
      <SectionHeading title="Tóm tắt và nguồn" subtitle="Bản tóm tắt để gửi cho người thân – kèm đoạn trích gốc." />
      <Accordion defaultOpen={0} items={[
        ...(report ? [{ title: "Tóm tắt hợp đồng", content: <BlockContent block={report} /> }] : []),
        ...(blocksById.get("table-fields") ? [{ title: "Bảng trường đã trích xuất", content: <BlockContent block={blocksById.get("table-fields")!} /> }] : []),
        ...(sources ? [{ title: "Tài liệu nguồn", content: <BlockContent block={sources} /> }] : []),
        ...(progress ? [{ title: "Các bước đã chạy", content: <BlockContent block={progress} /> }] : []),
        ...(actions.length ? [{ title: "Xuất kết quả", content: <div className="vn-row">{actions.map(block => <BlockContent key={block.id} block={block} />)}</div> }] : []),
      ]} />
    </Section>
  </>;
}

function VerdictBody({ claimId, reason }: { claimId: string; reason: string }) {
  const { claim, evidenceById, source } = useResult();
  const ids = claim(claimId)?.evidenceIds ?? [];
  return <div className="vn-stack vn-stack--s">
    <p>{reason}</p>
    {ids.map(id => { const item = evidenceById(id); return item ? <blockquote key={id} className="vn-quote">“{item.excerpt}” <span className="vn-caption">— {source(item.sourceId)?.title}, trang {item.locator.type === "pdf" ? item.locator.page : "?"}</span></blockquote> : null; })}
  </div>;
}

function VerdictTitle({ claimId, support }: { claimId: string; support: "supported" | "contradicted" | "insufficient" | "unchecked" }) {
  const { claim } = useResult();
  return <span className="vn-row" style={{ gap: 12, flexWrap: "wrap" }}><span>{claim(claimId)?.text ?? claimId}</span><SupportBadge support={support} /></span>;
}

/** Renders normalised pages with evidence excerpts highlighted at their pdf locators. */
function DocumentPreview({ document, evidence, tone, focused, onPick }: { document: NormalizedDocument; evidence: Evidence[]; tone: DocumentExtras["evidenceTone"]; focused: string | null; onPick: (id: string) => void }) {
  const pages = [...new Set(document.segments.map(segment => segment.locator.type === "pdf" ? segment.locator.page : 1))];
  return <div className="vn-stack">
    {pages.map(page => <article key={page} className="vn-doc" aria-label={`Trang ${page}`}>
      <div className="vn-doc__page" style={{ marginBottom: 16 }}>Trang {page} / {pages.length}</div>
      {document.segments.filter(segment => segment.locator.type === "pdf" && segment.locator.page === page).map((segment, index) => {
        if (segment.locator.type !== "pdf") return null;
        const { start, end } = segment.locator;
        const marks = evidence.filter(e => e.locator.type === "pdf" && e.locator.page === page && e.locator.start >= start && e.locator.end <= end)
          .map(e => ({ id: e.id, from: (e.locator as { start: number }).start - start, to: (e.locator as { end: number }).end - start }))
          .sort((a, b) => a.from - b.from);
        const parts: ReactNode[] = [];
        let cursor = 0;
        for (const mark of marks) {
          if (mark.from < cursor) continue;
          parts.push(segment.text.slice(cursor, mark.from));
          parts.push(<mark key={mark.id} id={`mark-${mark.id}`} className={cx("vn-mark", tone[mark.id] && tone[mark.id] !== "info" && `vn-mark--${tone[mark.id]}`, focused === mark.id && "is-focused")} onClick={() => onPick(mark.id)} title="Mở bằng chứng">{segment.text.slice(mark.from, mark.to)}</mark>);
          cursor = mark.to;
        }
        parts.push(segment.text.slice(cursor));
        return <p key={segment.id} style={index === 0 && page === 1 ? { fontWeight: 800, fontSize: 18, textAlign: "center" } : undefined}>{parts}</p>;
      })}
    </article>)}
  </div>;
}
