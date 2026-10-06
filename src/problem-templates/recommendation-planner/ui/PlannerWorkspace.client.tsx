"use client";

import { useMemo, useState } from "react";
import type { DemoBundle } from "@/demo/schemas";
import { BlockContent, useBlocks } from "@/ui/blocks/BlockRenderer";
import { useResult } from "@/ui/blocks/context";
import { ComparisonBlock } from "@/ui/blocks/basic";
import { ClaimSentences, InsightNotice } from "@/ui/blocks/kit-blocks";
import { SchematicMap } from "@/ui/blocks/MapBlock";
import { ResultStatus } from "@/ui/blocks/ResultStatus";
import { Field } from "@/ui/forms";
import { useRunRequest } from "@/ui/hooks/useRunRequest";
import { FeatureBanner, ListingCard, Section, SectionHeading } from "@/ui/kit";
import { MapSection } from "@/ui/kit/MapSection";
import { Carousel } from "@/ui/kit/client";
import { Accordion } from "@/ui/primitives/Accordion";
import { Badge, Button, Chip, Icon, Notice } from "@/ui/primitives";
import { FormPanel, IntroSection, JumpBar, RunNotice, TemplateBody, type DemoStateId } from "@/ui/shells/template";
import { DEFAULT_BUDGET, DEFAULT_WEIGHTS, PlannerInputSchema, rankStays, validatePlan, type PlannerInput, type PlanItem, type Weights } from "../data";
import type { PlannerExtras } from "../fixtures";
import { plannerMeta } from "../manifest.client";

const STEP_LABELS = Object.fromEntries(plannerMeta.steps.map(step => [step.id, step.label]));
const INTERESTS: Array<{ value: PlannerInput["interests"][number]; label: string }> = [
  { value: "beach", label: "Biển" }, { value: "culture", label: "Văn hoá" }, { value: "food", label: "Ẩm thực" }, { value: "nature", label: "Thiên nhiên" }, { value: "shopping", label: "Mua sắm" },
];

export function PlannerWorkspace({ bundle, extras, state, basePath }: { bundle: DemoBundle; extras: PlannerExtras; state: DemoStateId; basePath: string }) {
  const run = useRunRequest(plannerMeta.id);
  const [days, setDays] = useState(3);
  const [budget, setBudget] = useState(DEFAULT_BUDGET);
  const [interests, setInterests] = useState<PlannerInput["interests"]>(["beach", "culture", "food"]);
  const [withKids, setWithKids] = useState(true);
  const [maxPerDay, setMaxPerDay] = useState(3);
  const [weights, setWeights] = useState<Weights>(DEFAULT_WEIGHTS);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const parsed = PlannerInputSchema.safeParse({ destination: "da-nang", days, budgetPerNight: budget, interests, withKids, maxPerDay, weights });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Dữ liệu chưa hợp lệ"); return; }
    setError(null);
    void run.submit(parsed.data);
  };

  const form = <FormPanel title="Chuyến đi của bạn" subtitle="Ràng buộc cứng (ngân sách, trẻ nhỏ) loại lựa chọn; trọng số chỉ thay đổi thứ hạng.">
    <form className="vn-form" onSubmit={event => { event.preventDefault(); submit(); }} noValidate>
      <div className="vn-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Field label="Điểm đến" htmlFor="pl-dest"><select id="pl-dest" className="vn-select" defaultValue="da-nang"><option value="da-nang">Đà Nẵng – Hội An</option></select></Field>
        <Field label="Số ngày" htmlFor="pl-days"><select id="pl-days" className="vn-select" value={days} onChange={event => setDays(Number(event.target.value))}>{[2, 3, 4].map(n => <option key={n} value={n}>{n} ngày</option>)}</select></Field>
      </div>
      <Field label="Ngân sách mỗi đêm (nghìn đ)" htmlFor="pl-budget" error={error ?? undefined}>
        <input id="pl-budget" className="vn-input" type="number" min={200} step={100} value={budget} onChange={event => setBudget(Number(event.target.value))} />
      </Field>
      <Field label="Sở thích">
        <div className="vn-chip-row">{INTERESTS.map(i => <Chip key={i.value} size="s" active={interests.includes(i.value)} onClick={() => setInterests(prev => prev.includes(i.value) ? prev.filter(v => v !== i.value) : [...prev, i.value])}>{i.label}</Chip>)}</div>
      </Field>
      <label className="vn-check"><input type="checkbox" checked={withKids} onChange={event => setWithKids(event.target.checked)} /><span className="vn-stack" style={{ gap: 2 }}><strong className="vn-strong" style={{ fontSize: 15 }}>Đi cùng trẻ nhỏ</strong><span className="vn-hint">Loại nơi ở không phù hợp trẻ em</span></span></label>
      <Field label="Tối đa hoạt động mỗi ngày" htmlFor="pl-max"><select id="pl-max" className="vn-select" value={maxPerDay} onChange={event => setMaxPerDay(Number(event.target.value))}>{[2, 3, 4, 5].map(n => <option key={n} value={n}>{n} hoạt động</option>)}</select></Field>
      <Button type="submit" size="l" fullWidth iconRight="arrow-right" disabled={run.state.phase === "submitting"}>{run.state.phase === "submitting" ? "Đang gửi…" : "Lập kế hoạch"}</Button>
    </form>
  </FormPanel>;

  return <TemplateBody bundle={bundle} stepLabels={STEP_LABELS} onRetry={submit}>
    <IntroSection form={form}
      lead="Ba ngày, hai thành phố, một gia đình nhỏ – và cả trăm lựa chọn chỗ ở. Hãy bắt đầu từ điều bạn thật sự cần."
      paragraphs={[
        "Mẫu này xếp hạng lựa chọn theo tiêu chí bạn đặt, giải thích vì sao, và loại ngay những lựa chọn vi phạm ràng buộc cứng.",
        "Lịch trình bên dưới chỉnh sửa được: đổi ngày, đổi thứ tự, bỏ bớt hoạt động – mọi ràng buộc được kiểm tra lại ngay lập tức.",
      ]} />
    <JumpBar basePath={basePath} state={state} links={[
      { label: "Nơi ở phù hợp", href: "#noi-o" }, { label: "So sánh", href: "#so-sanh" }, { label: "Lịch trình", href: "#lich-trinh" },
      { label: "Bản đồ", href: "#ban-do" }, { label: "Lưu ý", href: "#luu-y" }, { label: "Tóm tắt", href: "#tom-tat" },
    ]} />
    <RunNotice state={run.state} onDismiss={run.reset} />
    <ResultStatus reveal={{ image: "/images/turquoise.jpg", title: "Chuyến đi đã sẵn sàng", lead: "Nơi ở được xếp hạng theo tiêu chí của bạn và một lịch trình 3 ngày chỉnh sửa được." }} onRetry={submit} emptyIcon="map-pin" emptyTitle="Không có lựa chọn phù hợp" emptyHint="Không nơi ở nào thoả mọi ràng buộc. Thử nới ngân sách hoặc bỏ bớt ràng buộc.">
      <PlannerSections extras={extras} weights={weights} onWeights={setWeights} budget={budget} withKids={withKids} maxPerDay={maxPerDay} />
    </ResultStatus>
  </TemplateBody>;
}

function PlannerSections({ extras, weights, onWeights, budget, withKids, maxPerDay }: { extras: PlannerExtras; weights: Weights; onWeights: (w: Weights) => void; budget: number; withKids: boolean; maxPerDay: number }) {
  const { blocksById, claim } = useResult();
  const ranked = useMemo(() => rankStays(extras.stays, weights, budget, withKids), [extras.stays, weights, budget, withKids]);
  const top = ranked.find(stay => !stay.violations.length);
  const [plan, setPlan] = useState<PlanItem[]>(extras.plan);
  const issues = validatePlan(plan, maxPerDay);
  const insights = useBlocks("insight");
  const actions = useBlocks("action");
  const comparison = blocksById.get("comparison"), map = blocksById.get("map"), report = blocksById.get("report"), sources = blocksById.get("sources"), progress = blocksById.get("progress");
  const recommendation = blocksById.get("rec-stay");
  const isDefault = weights.price === DEFAULT_WEIGHTS.price && weights.rating === DEFAULT_WEIGHTS.rating && weights.distance === DEFAULT_WEIGHTS.distance && budget === DEFAULT_BUDGET && withKids;
  const days = [...new Set([...extras.plan.map(item => item.day)])].sort();
  const placeName = (id: string) => extras.places.find(place => place.id === id)?.name ?? id;

  const move = (id: string, delta: number) => setPlan(prev => {
    const item = prev.find(p => p.id === id)!;
    const sameDay = prev.filter(p => p.day === item.day);
    const index = sameDay.indexOf(item), target = sameDay[index + delta];
    if (!target) return prev;
    return prev.map(p => p.id === item.id ? { ...p, time: target.time } : p.id === target.id ? { ...p, time: item.time } : p).sort((a, b) => a.day - b.day || a.time.localeCompare(b.time));
  });

  return <>
    <Section tone="subtle" id="noi-o">
      <SectionHeading title="Nơi ở phù hợp nhất" subtitle="Kéo thanh trượt để đổi mức quan trọng của từng tiêu chí – thứ hạng cập nhật ngay." />
      <div className="vn-card" style={{ marginBottom: 32 }}><div className="vn-card__body" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 24 }}>
        {([["price", "Giá thấp"], ["rating", "Đánh giá cao"], ["distance", "Gần trung tâm"]] as const).map(([key, label]) => <Field key={key} label={<>{label}<span className="vn-caption">{weights[key]}</span></>} htmlFor={`w-${key}`}>
          <input id={`w-${key}`} type="range" className="vn-range" min={0} max={100} step={5} value={weights[key]} onChange={event => onWeights({ ...weights, [key]: Number(event.target.value) })} />
        </Field>)}
        <div className="vn-row" style={{ alignSelf: "end" }}><Button variant="ghost" size="s" iconLeft="refresh-cw" onClick={() => onWeights(DEFAULT_WEIGHTS)}>Mặc định</Button></div>
      </div></div>
      <Carousel>{ranked.map((stay, index) => <div key={stay.id} className="vn-img-wrap" style={{ height: "100%" }}>
        <span className={`vn-rank-pos${!stay.violations.length && index === 0 ? " is-top" : ""}`}>{stay.violations.length ? "—" : index + 1}</span>
        <ListingCard image={stay.image} location={stay.area} title={stay.name}
          description={<span className="vn-stack" style={{ gap: 8 }}><span>{stay.blurb}</span><span className="vn-row" style={{ gap: 6 }}><Badge tone="ice">{stay.price.toLocaleString("vi-VN")} nghìn đ</Badge><Badge tone="ice">{String(stay.rating).replace(".", ",")}/10</Badge><Badge tone="ice">{String(stay.distance).replace(".", ",")} km</Badge></span></span>}
          footer={stay.violations.length ? stay.violations.map(v => <Badge key={v} tone="danger" icon="x-circle">{v}</Badge>) : <><Badge tone={index === 0 ? "blue" : "neutral"}>Điểm {stay.score}/100</Badge>{index === 0 ? <Badge tone="success" icon="check">Đề xuất</Badge> : null}</>} />
      </div>)}</Carousel>
    </Section>

    {top ? <FeatureBanner image={top.image} title={`Gợi ý: ${top.name}`} subtitle={isDefault && recommendation?.type === "recommendation" ? <span className="vn-stack" style={{ gap: 8, fontSize: 18 }}><ClaimSentences claimIds={[recommendation.props.reasonClaimIds[0]]} /></span> : `Điểm ${top.score}/100 theo trọng số bạn vừa chọn, thoả mọi ràng buộc cứng.`} cta={{ label: "Xem lịch trình", href: "#lich-trinh" }} /> : <Section><Notice tone="critical" title="Không còn lựa chọn nào">Mọi nơi ở đều vi phạm ràng buộc. Hãy nới ngân sách hoặc bỏ ràng buộc trẻ nhỏ.</Notice></Section>}

    {comparison?.type === "comparison" ? <Section id="so-sanh">
      <SectionHeading title="So sánh chi tiết" subtitle="Màu xanh đánh dấu giá trị tốt nhất của mỗi tiêu chí." />
      <ComparisonBlock props={comparison.props} highlightId={top?.id} better={{ price: "lower", rating: "higher", distance: "lower" }} />
    </Section> : null}

    {plan.length ? <Section tone="ice" id="lich-trinh">
      <SectionHeading title={`Lịch trình ${days.length} ngày`} subtitle="Đổi thứ tự, chuyển ngày hoặc bỏ hoạt động. Ràng buộc được kiểm tra lại sau mỗi thay đổi." action={<Button variant="secondary" size="s" iconLeft="refresh-cw" onClick={() => setPlan(extras.plan)}>Khôi phục</Button>} />
      {issues.length ? <div className="vn-stack vn-stack--s" style={{ marginBottom: 24 }}>{issues.map(issue => <Notice key={issue} tone="critical" title="Vi phạm ràng buộc">{issue}</Notice>)}</div> : <div style={{ marginBottom: 24 }}><Notice tone="success" title="Lịch trình hợp lệ">Mọi ngày đều trong giới hạn {maxPerDay} hoạt động và không có chặng quá xa.</Notice></div>}
      <div className="vn-grid vn-grid--3">{days.map(day => <div key={day} className="vn-card"><div className="vn-card__body">
        <span className="vn-overline">Ngày {day}</span>
        <ol className="vn-timeline">{plan.filter(item => item.day === day).map((item, index, list) => <li key={item.id} className="vn-timeline__item">
          <span className="vn-timeline__dot" />
          <div className="vn-stack vn-stack--s" style={{ gap: 6 }}>
            <span className="vn-timeline__at">{item.time} · {placeName(item.placeId)}</span>
            <strong className="vn-strong">{item.title}</strong>
            {item.note ? <span className="vn-caption">{item.note}</span> : null}
            <span className="vn-row" style={{ gap: 6 }}>
              <button type="button" className="vn-icon-btn vn-icon-btn--s" aria-label="Lên" disabled={index === 0} onClick={() => move(item.id, -1)}><Icon name="arrow-up" size={14} /></button>
              <button type="button" className="vn-icon-btn vn-icon-btn--s" aria-label="Xuống" disabled={index === list.length - 1} onClick={() => move(item.id, 1)}><Icon name="arrow-down" size={14} /></button>
              <select className="vn-select" aria-label="Chuyển sang ngày" style={{ minHeight: 32, height: 32, padding: "0 32px 0 10px", fontSize: 13, width: "auto", backgroundPosition: "right 8px center" }} value={item.day} onChange={event => setPlan(prev => prev.map(p => p.id === item.id ? { ...p, day: Number(event.target.value) } : p).sort((a, b) => a.day - b.day || a.time.localeCompare(b.time)))}>{days.map(d => <option key={d} value={d}>Ngày {d}</option>)}</select>
              <button type="button" className="vn-icon-btn vn-icon-btn--s" aria-label="Bỏ hoạt động" onClick={() => setPlan(prev => prev.filter(p => p.id !== item.id))}><Icon name="trash" size={14} /></button>
            </span>
          </div>
        </li>)}</ol>
        {!plan.some(item => item.day === day) ? <p className="vn-caption">Ngày tự do – nghỉ ngơi cũng là một kế hoạch!</p> : null}
      </div></div>)}</div>
    </Section> : null}

    {map?.type === "map" ? <MapSection id="ban-do" title="Trên bản đồ" subtitle="Lịch trình theo từng ngày và các nơi ở đã xếp hạng. Bấm một địa điểm để bay tới đó."
      fallback={<SchematicMap props={map.props} />}
      groups={[
        ...days.map(day => ({ title: `Ngày ${day}`, items: plan.filter(item => item.day === day).map(item => {
          const place = extras.places.find(p => p.id === item.placeId)!;
          return { id: `${item.id}-${place.id}`, name: place.name, lat: place.lat, lng: place.lng, meta: item.time, detail: <><strong>{item.title}.</strong> {place.description}</> };
        }) })),
        { title: "Nơi ở", items: ranked.map((stay, index) => ({ id: stay.id, name: stay.name, lat: stay.lat, lng: stay.lng, label: stay.violations.length ? "×" : String.fromCharCode(65 + index), meta: stay.violations.length ? "Vi phạm" : `${stay.score}/100`, detail: <>{stay.blurb} {stay.violations.join(" · ")}</> })) },
      ]} /> : null}

    {insights.length ? <Section tone="subtle" id="luu-y">
      <SectionHeading size="m" title="Lưu ý trước khi đi" subtitle="Những điều nhỏ giúp chuyến đi trọn vẹn hơn." />
      <div className="vn-grid vn-grid--3">{insights.map((block, index) => <InsightNotice key={block.id} block={block} tone={index === 2 ? "navy" : "ice"} />)}</div>
    </Section> : null}

    <Section id="tom-tat">
      <SectionHeading title="Tóm tắt và nguồn" subtitle="Mang theo kế hoạch – hoặc gửi cho cả nhà." />
      <Accordion defaultOpen={0} items={[
        ...(report ? [{ title: "Tóm tắt kế hoạch", content: <BlockContent block={report} /> }] : []),
        ...(recommendation?.type === "recommendation" ? [{ title: "Vì sao chọn nơi này (theo trọng số mặc định)", content: <div className="vn-stack vn-stack--s">{recommendation.props.reasonClaimIds.map(id => <p key={id}>{claim(id)?.text}</p>)}</div> }] : []),
        ...(sources ? [{ title: "Nguồn tham khảo", content: <BlockContent block={sources} /> }] : []),
        ...(progress ? [{ title: "Các bước đã chạy", content: <BlockContent block={progress} /> }] : []),
        ...(actions.length ? [{ title: "Xuất kết quả", content: <div className="vn-row">{actions.map(block => <BlockContent key={block.id} block={block} />)}</div> }] : []),
      ]} />
    </Section>
  </>;
}

