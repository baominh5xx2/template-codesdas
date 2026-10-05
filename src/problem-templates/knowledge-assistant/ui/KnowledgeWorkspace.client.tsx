"use client";

import { useEffect, useRef, useState } from "react";
import type { Claim } from "@/contracts/evidence";
import type { DemoBundle } from "@/demo/schemas";
import { BlockContent, useBlocks } from "@/ui/blocks/BlockRenderer";
import { useResult } from "@/ui/blocks/context";
import { MetricStats } from "@/ui/blocks/kit-blocks";
import { ResultStatus } from "@/ui/blocks/ResultStatus";
import { Citations, describeLocator, SupportBadge } from "@/ui/blocks/shared";
import { Field, FileDrop, type UploadedFile } from "@/ui/forms";
import { useRunRequest } from "@/ui/hooks/useRunRequest";
import { Img, Section, SectionHeading } from "@/ui/kit";
import { Accordion } from "@/ui/primitives/Accordion";
import { Badge, Button, Icon, Notice } from "@/ui/primitives";
import { FormPanel, IntroSection, JumpBar, RunNotice, TemplateBody, type DemoStateId } from "@/ui/shells/template";
import type { KnowledgeExtras, ScriptedTurn } from "../fixtures";
import { knowledgeMeta } from "../manifest.client";

const STEP_LABELS = Object.fromEntries(knowledgeMeta.steps.map(step => [step.id, step.label]));
type ChatTurn = { key: string; question: string; turn: ScriptedTurn | null };

export function KnowledgeWorkspace({ bundle, extras, state, basePath }: { bundle: DemoBundle; extras: KnowledgeExtras; state: DemoStateId; basePath: string }) {
  const run = useRunRequest(knowledgeMeta.id);
  const [enabled, setEnabled] = useState<string[]>(bundle.sources.map(source => source.id));
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [topK, setTopK] = useState(5);

  const form = <FormPanel title="Kho tri thức" subtitle="Trợ lý chỉ đọc những tài liệu được chọn, trong đúng không gian làm việc này.">
    <form className="vn-form" onSubmit={event => { event.preventDefault(); void run.submit({ sourceIds: enabled, uploads: files.map(f => f.name), topK }); }} noValidate>
      <Field label="Tài liệu đang dùng" hint="Bỏ chọn một tài liệu để xem câu trả lời thay đổi.">
        <div className="vn-stack vn-stack--s" style={{ gap: 8 }}>{bundle.sources.map(source => <label key={source.id} className="vn-check">
          <input type="checkbox" checked={enabled.includes(source.id)} onChange={() => setEnabled(prev => prev.includes(source.id) ? prev.filter(id => id !== source.id) : [...prev, source.id])} />
          <span style={{ fontSize: 15, color: "var(--text-strong)", fontWeight: 600 }}>{source.title}</span>
        </label>)}</div>
      </Field>
      <Field label="Thêm tài liệu" optional><FileDrop accept=".pdf,.docx,.txt,.md" multiple label="Kéo thả tài liệu" hint="PDF, DOCX, TXT hoặc Markdown" files={files} onChange={setFiles} /></Field>
      <Field label="Số đoạn truy xuất mỗi câu hỏi" htmlFor="kb-topk"><select id="kb-topk" className="vn-select" value={topK} onChange={event => setTopK(Number(event.target.value))}>{[3, 5, 8, 12].map(n => <option key={n} value={n}>{n} đoạn</option>)}</select></Field>
      <Button type="submit" size="l" fullWidth iconRight="arrow-right" disabled={run.state.phase === "submitting" || !enabled.length}>{run.state.phase === "submitting" ? "Đang gửi…" : "Cập nhật kho tri thức"}</Button>
    </form>
  </FormPanel>;

  return <TemplateBody bundle={bundle} stepLabels={STEP_LABELS}>
    <IntroSection form={form}
      lead="Quy chế dày một trăm trang, còn bạn chỉ cần một câu trả lời. Hỏi đi – kèm đúng điều khoản làm căn cứ."
      paragraphs={[
        "Mẫu này nạp tài liệu của bạn, chia đoạn, truy xuất những đoạn liên quan rồi soạn câu trả lời – từng câu đều có trích dẫn.",
        "Không tìm thấy thì trợ lý nói là không tìm thấy. Bịa ra một con số học phí nghe hợp lý còn nguy hiểm hơn là im lặng!",
      ]} />
    <JumpBar basePath={basePath} state={state} links={[
      { label: "Kho tri thức", href: "#tong-quan" }, { label: "Hỏi đáp", href: "#hoi-dap" }, { label: "Tài liệu", href: "#tai-lieu" }, { label: "Phạm vi", href: "#pham-vi" },
    ]} />
    <RunNotice state={run.state} onDismiss={run.reset} />
    <ResultStatus reveal={{ image: "/images/knowledge-card.jpg", title: "Hỏi đi", lead: "Kho tri thức đã sẵn sàng – mọi câu trả lời đều kèm đúng điều khoản làm căn cứ." }} emptyIcon="book" emptyTitle="Kho tri thức đang trống" emptyHint="Hãy tải ít nhất một tài liệu có chữ để bắt đầu hỏi đáp.">
      <KnowledgeSections turns={extras.turns} images={extras.sourceImages} enabled={enabled} onUnknown={question => void run.submit({ sourceIds: enabled, question, topK })} />
    </ResultStatus>
  </TemplateBody>;
}

function KnowledgeSections({ turns, images, enabled, onUnknown }: { turns: ScriptedTurn[]; images: Record<string, string>; enabled: string[]; onUnknown: (question: string) => void }) {
  const { claim, evidenceById, sources, evidence, inspect, blocksById } = useResult();
  const [log, setLog] = useState<ChatTurn[]>([{ key: "t0", question: turns[0].question, turn: turns[0] }]);
  const [selected, setSelected] = useState("t0");
  const [draft, setDraft] = useState("");
  const logRef = useRef<HTMLDivElement>(null);
  const metrics = useBlocks("metric");
  const actions = useBlocks("action");
  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" }); }, [log]);

  /** Claims usable with the selected sources: at least one citation must come from an enabled document. */
  const answerFor = (turn: ScriptedTurn) => turn.claimIds.map(id => claim(id)).filter((c): c is Claim => Boolean(c)).map(c => ({ claim: c, evidenceIds: c.evidenceIds.filter(id => enabled.includes(evidenceById(id)?.sourceId ?? "")) })).filter(a => a.claim.support !== "supported" || a.evidenceIds.length);
  const ask = (question: string, turn?: ScriptedTurn | null) => {
    const normalized = question.toLowerCase();
    const match = turn ?? turns.find(t => t.question === question || t.keywords.some(k => normalized.includes(k))) ?? null;
    const key = `t${log.length}`;
    setLog(prev => [...prev, { key, question, turn: match }]);
    setSelected(key);
    if (!match) onUnknown(question);
  };
  const current = log.find(item => item.key === selected);
  const currentEvidence = current?.turn ? answerFor(current.turn).flatMap(a => a.evidenceIds) : [];
  const asked = new Set(log.map(item => item.turn?.id));

  return <>
    <Section tone="navy" id="tong-quan">
      <SectionHeading title="Kho tri thức trong ba con số" subtitle="Ba tài liệu mẫu của một trường giả lập, đã chia đoạn và lập chỉ mục." />
      <MetricStats blocks={metrics} />
    </Section>

    <Section id="hoi-dap">
      <SectionHeading title="Hỏi đáp" subtitle="Bấm vào một câu trả lời để xem toàn bộ trích dẫn ở cột bên phải." />
      <div className="vn-intro" style={{ gridTemplateColumns: "minmax(0, 1fr) minmax(0, 420px)" }}>
        <div className="vn-card vn-chat">
          <div className="vn-chat__log" ref={logRef} style={{ maxHeight: 620, overflowY: "auto" }}>
            {log.map(item => {
              const answer = item.turn ? answerFor(item.turn) : [];
              return <div key={item.key} className="vn-stack" style={{ gap: 16 }}>
                <div className="vn-chat__msg vn-chat__msg--user"><div className="vn-chat__bubble">{item.question}</div></div>
                <div className="vn-chat__msg vn-chat__msg--assistant" onClick={() => setSelected(item.key)} style={{ cursor: "pointer" }}>
                  <span className="vn-chat__who">Trợ lý{selected === item.key ? " · đang xem trích dẫn" : ""}</span>
                  <div className="vn-chat__bubble" style={selected === item.key ? { boxShadow: "0 0 0 2px var(--vn-blue)" } : undefined}>
                    {!item.turn ? <>Bản demo chỉ trả lời các câu hỏi mẫu – năng lực truy xuất chưa được bật nên mình không tra cứu được câu này. Bạn thử một gợi ý bên dưới nhé.</>
                      : answer.length ? answer.map(a => <p key={a.claim.id} style={{ margin: "0 0 8px" }}>{a.claim.text}<Citations evidenceIds={a.evidenceIds} />{a.claim.support !== "supported" ? <> <SupportBadge support={a.claim.support} /></> : null}</p>)
                      : <>Mình không tìm thấy căn cứ cho câu này trong <strong>các tài liệu đang chọn</strong>. Hãy bật lại tài liệu liên quan ở khung bên trên. <SupportBadge support="insufficient" /></>}
                  </div>
                  {item.turn ? <div className="vn-chip-row">{item.turn.followUps.map(id => turns.find(t => t.id === id)).filter((t): t is ScriptedTurn => Boolean(t) && !asked.has(t!.id)).map(t => <button key={t.id} type="button" className="vn-chip vn-chip--s" onClick={event => { event.stopPropagation(); ask(t.question, t); }}>{t.question}</button>)}</div> : null}
                </div>
              </div>;
            })}
          </div>
          <form className="vn-chat__composer" onSubmit={event => { event.preventDefault(); if (draft.trim()) { ask(draft.trim()); setDraft(""); } }}>
            <input className="vn-input" value={draft} onChange={event => setDraft(event.target.value)} placeholder="Hỏi về quy chế học vụ…" aria-label="Câu hỏi" />
            <Button type="submit" iconRight="send" disabled={!draft.trim()}>Gửi</Button>
          </form>
        </div>
        <div className="vn-stack" style={{ position: "sticky", top: 24 }}>
          <h3 className="vn-linklist__title">Trích dẫn</h3>
          {currentEvidence.length ? currentEvidence.map(id => {
            const item = evidence.find(e => e.id === id);
            if (!item) return null;
            return <button key={id} type="button" className="vn-card vn-card--hover" style={{ textAlign: "left", cursor: "pointer", font: "inherit" }} onClick={() => inspect({ kind: "evidence", id })}>
              <div className="vn-card__body" style={{ gap: 8 }}>
                <span className="vn-overline">{sources.find(s => s.id === item.sourceId)?.title} · {describeLocator(item.locator)}</span>
                <span style={{ color: "var(--text-strong)", fontSize: 16, lineHeight: 1.5 }}>“{item.excerpt}”</span>
              </div>
            </button>;
          }) : <Notice title="Chưa có trích dẫn">{current?.turn ? "Câu trả lời này không có đoạn nào làm căn cứ trong các tài liệu đang chọn." : "Chọn một câu trả lời để xem trích dẫn."}</Notice>}
        </div>
      </div>
    </Section>

    <Section tone="ice" id="goi-y">
      <SectionHeading size="m" title="Gợi ý câu hỏi" subtitle="Thử cả câu cuối – trợ lý sẽ nói thật là không tìm thấy." />
      <div className="vn-linklist"><ul style={{ columns: 2 }}>{turns.map(turn => <li key={turn.id}>
        <button type="button" className="vn-linklist__row" onClick={() => { ask(turn.question, turn); window.document.getElementById("hoi-dap")?.scrollIntoView({ behavior: "smooth" }); }}><span>{turn.question}</span><Icon name="chevron-right" size={20} /></button>
      </li>)}</ul></div>
    </Section>

    <Section id="tai-lieu">
      <SectionHeading title="Tài liệu trong kho" subtitle="Bấm để xem các đoạn đã được trích dẫn từ mỗi tài liệu." />
      <div className="vn-grid vn-grid--3">{sources.map(source => <button key={source.id} type="button" className="vn-partner vn-zoom" style={{ all: "unset", cursor: "pointer", display: "flex", flexDirection: "column", gap: 12, opacity: enabled.includes(source.id) ? 1 : 0.45 }} onClick={() => inspect({ kind: "source", id: source.id })}>
        <Img src={images[source.id]} ratio="3/2" radius="var(--radius-card)" sizes="400px" />
        <span className="vn-partner__name">{source.title}<Icon name="arrow-right" size={16} /></span>
        <span className="vn-row" style={{ gap: 6 }}><Badge tone={enabled.includes(source.id) ? "success" : "neutral"}>{enabled.includes(source.id) ? "Đang dùng" : "Đã tắt"}</Badge><span className="vn-caption">{evidence.filter(e => e.sourceId === source.id).length} đoạn được trích</span></span>
      </button>)}</div>
    </Section>

    <Section tone="subtle" id="pham-vi">
      <SectionHeading size="m" title="Phạm vi và giới hạn" subtitle="Trợ lý hữu ích nhất khi bạn biết nó không làm gì." />
      <div className="vn-grid vn-grid--3" style={{ marginBottom: 32 }}>
        <Notice title="Chỉ tài liệu đã chọn">Không tra cứu web, không dùng kiến thức chung để lấp chỗ trống.</Notice>
        <Notice title="Không đọc chéo" icon="shield">Mỗi không gian làm việc có kho tri thức riêng; câu hỏi ở đây không đọc tài liệu của người khác.</Notice>
        <Notice tone="navy" title="Không thay thế phòng đào tạo" icon="alert-triangle">Với quyết định quan trọng, hãy đối chiếu văn bản gốc và hỏi trực tiếp phòng đào tạo.</Notice>
      </div>
      <Accordion items={[
        ...(blocksById.get("md-scope") ? [{ title: "Quy tắc trả lời", content: <BlockContent block={blocksById.get("md-scope")!} /> }] : []),
        ...(blocksById.get("verdict-tuition") ? [{ title: "Ví dụ câu không có căn cứ", content: <BlockContent block={blocksById.get("verdict-tuition")!} /> }] : []),
        ...(blocksById.get("progress") ? [{ title: "Các bước đã chạy", content: <BlockContent block={blocksById.get("progress")!} /> }] : []),
        ...(actions.length ? [{ title: "Xuất kết quả", content: <div className="vn-row">{actions.map(block => <BlockContent key={block.id} block={block} />)}</div> }] : []),
      ]} />
    </Section>
  </>;
}
