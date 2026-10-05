import type { UIBlock } from "@/contracts/ui/blocks";
import type { DemoBundle, DemoState } from "@/demo/schemas";
import { deriveState, sourceRef } from "../fixture-states";
import type { TemplateFixture } from "../types";
import { DEFAULT_BUDGET, DEFAULT_WEIGHTS, PLACES, PLAN, rankStays, STAYS, type PlaceInfo, type PlanItem, type Stay } from "./data";
import { plannerMeta } from "./manifest.client";

export type PlannerExtras = { stays: Stay[]; places: PlaceInfo[]; plan: PlanItem[] };

const PRICE_SOURCE = "s-prices", REVIEW_SOURCE = "s-reviews", GUIDE_SOURCE = "s-guide";

function success(): DemoBundle {
  const ranked = rankStays(STAYS, DEFAULT_WEIGHTS, DEFAULT_BUDGET, true);
  const top = ranked[0];
  const row = (id: string) => STAYS.findIndex(stay => stay.id === id) + 1;
  const evidence = [
    { id: "ev-price-top", sourceId: PRICE_SOURCE, locator: { type: "table" as const, sheet: "giá", row: row(top.id), column: "price" }, excerpt: `${top.name}: ${top.price.toLocaleString("vi-VN")} nghìn đ/đêm` },
    { id: "ev-rating-top", sourceId: REVIEW_SOURCE, locator: { type: "table" as const, sheet: "đánh giá", row: row(top.id), column: "rating" }, excerpt: `${top.name}: ${String(top.rating).replace(".", ",")}/10` },
    { id: "ev-oldtown-kids", sourceId: REVIEW_SOURCE, locator: { type: "table" as const, sheet: "đánh giá", row: row("stay-oldtown"), column: "note" }, excerpt: "Cầu thang gỗ dốc, không có giường phụ cho trẻ em." },
    { id: "ev-sontra-price", sourceId: PRICE_SOURCE, locator: { type: "table" as const, sheet: "giá", row: row("stay-sontra"), column: "price" }, excerpt: "Resort bán đảo Sơn Trà: 3.200 nghìn đ/đêm" },
    { id: "ev-weather", sourceId: GUIDE_SOURCE, locator: { type: "web" as const, section: "Thời tiết", start: 0, end: 52 }, excerpt: "Từ tháng 10 đến tháng 12 là mùa mưa, thường có mưa lớn." },
    { id: "ev-dragon", sourceId: GUIDE_SOURCE, locator: { type: "web" as const, section: "Cầu Rồng", start: 0, end: 48 }, excerpt: "Cầu Rồng phun lửa và nước vào 21 giờ tối thứ bảy, chủ nhật." },
    { id: "ev-bana", sourceId: GUIDE_SOURCE, locator: { type: "web" as const, section: "Bà Nà", start: 0, end: 60 }, excerpt: "Tham quan Bà Nà thường mất từ 6 đến 8 tiếng kể cả di chuyển." },
  ];
  const claims = [
    { id: "c-top", text: `${top.name} cân bằng tốt nhất giữa giá, đánh giá và khoảng cách (${top.score}/100 với trọng số mặc định).`, kind: "calculation" as const, evidenceIds: ["ev-price-top", "ev-rating-top"], support: "supported" as const },
    { id: "c-oldtown-kids", text: "Homestay phố cổ được đánh giá cao nhưng không phù hợp khi đi cùng trẻ nhỏ.", kind: "fact" as const, evidenceIds: ["ev-oldtown-kids"], support: "supported" as const },
    { id: "c-sontra-budget", text: `Resort Sơn Trà vượt ngân sách ${DEFAULT_BUDGET.toLocaleString("vi-VN")} nghìn đ/đêm.`, kind: "calculation" as const, evidenceIds: ["ev-sontra-price"], support: "supported" as const },
    { id: "c-weather", text: "Cuối năm là mùa mưa – nên chuẩn bị phương án trong nhà.", kind: "fact" as const, evidenceIds: ["ev-weather"], support: "supported" as const },
    { id: "c-dragon", text: "Cầu Rồng chỉ phun lửa tối thứ bảy và chủ nhật.", kind: "fact" as const, evidenceIds: ["ev-dragon"], support: "supported" as const },
    { id: "c-bana", text: "Bà Nà cần gần trọn một ngày nên được xếp riêng.", kind: "inference" as const, evidenceIds: ["ev-bana"], support: "supported" as const },
  ];
  const blocks: UIBlock[] = [
    { id: "rec-stay", type: "recommendation", props: { title: `Nên chọn: ${top.name}`, reasonClaimIds: ["c-top", "c-oldtown-kids", "c-sontra-budget"], priority: "high", actionIds: ["action-export-md"] } },
    { id: "comparison", type: "comparison", props: {
      criteria: [{ key: "price", label: "Giá / đêm", unit: "nghìn đ" }, { key: "rating", label: "Đánh giá", unit: "/10" }, { key: "distance", label: "Cách trung tâm", unit: "km" }, { key: "kids", label: "Phù hợp trẻ nhỏ" }],
      options: STAYS.map(stay => ({ id: stay.id, label: stay.name, values: { price: stay.price, rating: stay.rating, distance: stay.distance, kids: stay.kidFriendly ? "Có" : "Không" } })),
    } },
    { id: "map", type: "map", props: { places: PLACES.map(({ id, name, lat, lng }) => ({ id, name, lat, lng })), available: true } },
    ...PLACES.map((place): UIBlock => ({ id: `place-${place.id}`, type: "place", props: { name: place.name, lat: place.lat, lng: place.lng, description: place.description, sourceIds: [GUIDE_SOURCE] } })),
    { id: "timeline-plan", type: "timeline", props: { items: PLAN.map(item => ({ id: item.id, title: item.title, description: item.note, at: `Ngày ${item.day} · ${item.time}` })) } },
    { id: "insight-weather", type: "insight", props: { title: "Mùa mưa cuối năm", claimIds: ["c-weather"], severity: "warning" } },
    { id: "insight-dragon", type: "insight", props: { title: "Xem Cầu Rồng đúng ngày", claimIds: ["c-dragon"], severity: "info" } },
    { id: "insight-pace", type: "insight", props: { title: "Đi chậm mà chắc", claimIds: ["c-bana"], severity: "info" } },
    { id: "action-export-md", type: "action", props: { label: "Xuất lịch trình", actionId: "export.markdown" } },
    { id: "action-export-json", type: "action", props: { label: "Xuất JSON", actionId: "export.json" } },
    { id: "md-summary", type: "markdown", props: { content: `### Kế hoạch 3 ngày\n- **Nơi ở:** ${top.name} (${top.price.toLocaleString("vi-VN")} nghìn đ/đêm).\n- **Ngày 1:** biển Mỹ Khê, Sơn Trà, Cầu Rồng.\n- **Ngày 2:** Bà Nà Hills, ăn tối chợ Cồn.\n- **Ngày 3:** Ngũ Hành Sơn, phố cổ Hội An.\n\n*Tên cơ sở lưu trú và giá là dữ liệu minh hoạ.*` } },
    { id: "sources", type: "source", props: { sourceIds: [PRICE_SOURCE, REVIEW_SOURCE, GUIDE_SOURCE] } },
    { id: "report", type: "report-section", props: { title: "Tóm tắt kế hoạch", blockIds: ["md-summary", "rec-stay"] } },
  ];
  return {
    label: `${plannerMeta.manifest.title} — dữ liệu minh hoạ`,
    view: { runId: `demo-${plannerMeta.id}`, revision: 1, title: "Đà Nẵng – Hội An 3 ngày", status: "completed", blocks },
    snapshot: { id: `demo-${plannerMeta.id}`, workspaceId: "workspace-demo", domainId: plannerMeta.id, domainVersion: 1, input: { destination: "da-nang", days: 3, budgetPerNight: DEFAULT_BUDGET, interests: ["beach", "culture", "food"], withKids: true, maxPerDay: 3, weights: DEFAULT_WEIGHTS }, status: "completed", revision: 1, deadlineAt: null, steps: [], artifacts: [], warnings: ["Dữ liệu minh hoạ; engine chưa chạy."] },
    sources: [sourceRef(PRICE_SOURCE, "dataset", "Bảng giá tham khảo (minh hoạ)"), sourceRef(REVIEW_SOURCE, "dataset", "Đánh giá tổng hợp (minh hoạ)"), sourceRef(GUIDE_SOURCE, "url", "Cẩm nang Đà Nẵng (mẫu)", { url: "https://example.org/cam-nang-da-nang" })],
    evidence, claims, datasets: {},
  };
}

export function plannerFixture(state: DemoState): TemplateFixture<PlannerExtras> {
  const bundle = deriveState(success(), state, {
    stepIds: plannerMeta.steps.map(step => step.id),
    progressBlockId: "progress",
    error: { stepIndex: 0, code: "no_candidates", title: "Không còn lựa chọn nào", message: "Mọi nơi ở đều vi phạm ràng buộc cứng (ngân sách, trẻ nhỏ). Hãy nới ngân sách rồi chạy lại." },
    partial: { stepIndex: 3, code: "planner_timeout", dropBlockIds: ["timeline-plan", "map", ...PLACES.map(place => `place-${place.id}`)], title: "Chưa dựng xong lịch trình", message: "Phần xếp hạng nơi ở đã hoàn tất; lịch trình theo ngày chưa được tạo." },
    unavailableMessage: "Năng lực xếp hạng và lập kế hoạch chưa được bật trên nền tảng.",
  });
  const hasPlan = bundle.view.blocks.some(block => block.id === "timeline-plan");
  return { bundle, extras: { stays: STAYS, places: PLACES, plan: hasPlan ? PLAN : [] } };
}
