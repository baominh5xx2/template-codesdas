import type { UIBlock } from "@/contracts/ui/blocks";
import type { DemoBundle, DemoState } from "@/demo/schemas";
import { deriveState, sourceRef } from "../fixture-states";
import type { TemplateFixture } from "../types";
import { researchMeta } from "./manifest.client";

/** Source images for the source cards (template presentation only). */
export type ResearchExtras = { sourceImages: Record<string, string> };

// All sources use reserved example.* domains: this is clearly synthetic research material.
const SOURCES = [
  sourceRef("s-report", "url", "Báo cáo du lịch bền vững 2025 (mẫu)", { url: "https://example.org/bao-cao-du-lich-ben-vung-2025", publishedAt: "2025-11-20" }),
  sourceRef("s-survey", "url", "Khảo sát hành vi du khách trẻ (mẫu)", { url: "https://example.com/khao-sat-du-khach-tre", publishedAt: "2026-02-14" }),
  sourceRef("s-homestay", "url", "Phân tích thị trường homestay (mẫu)", { url: "https://example.net/thi-truong-homestay", publishedAt: "2026-04-02" }),
  sourceRef("s-news", "url", "Bản tin ngành lữ hành (mẫu)", { url: "https://example.org/tin-tuc/du-lich-xanh", publishedAt: "2026-06-10" }),
];
const web = (id: string, sourceId: string, section: string, excerpt: string) => ({ id, sourceId, locator: { type: "web" as const, section, start: 0, end: excerpt.length }, excerpt });

function success(): DemoBundle {
  const evidence = [
    web("ev-growth-30", "s-report", "Tổng quan thị trường", "Lượt tìm kiếm liên quan đến du lịch xanh tăng khoảng 30% so với cùng kỳ."),
    web("ev-growth-18", "s-news", "Số liệu nổi bật", "Nhu cầu đặt dịch vụ du lịch xanh tăng 18% trong năm qua."),
    web("ev-young", "s-survey", "Kết quả chính", "Nhóm 18–30 tuổi cho biết sẵn sàng trả thêm 10–15% cho lựa chọn thân thiện môi trường."),
    web("ev-homestay-price", "s-homestay", "Giá và công suất", "Giá trung bình của homestay sinh thái khoảng 650 nghìn đồng/đêm, công suất dao động mạnh theo mùa."),
    web("ev-resort", "s-report", "Phân khúc cao cấp", "Khu nghỉ dưỡng xanh có giá trung bình khoảng 2,4 triệu đồng/đêm."),
    web("ev-community", "s-homestay", "Ghi chú", "Tour trải nghiệm cộng đồng được nhắc tới như một xu hướng mới nhưng chưa có số liệu."),
    web("ev-greenwash", "s-news", "Thách thức", "Nhiều cơ sở tự giới thiệu là ‘xanh’ nhưng chưa có chứng nhận độc lập."),
  ];
  const claims = [
    { id: "c-growth", text: "Nhu cầu du lịch xanh đang tăng rõ rệt so với năm trước.", kind: "fact" as const, evidenceIds: ["ev-growth-30", "ev-growth-18"], support: "supported" as const },
    { id: "c-growth-30", text: "Mức tăng 30% được các nguồn thống nhất.", kind: "fact" as const, evidenceIds: ["ev-growth-30", "ev-growth-18"], support: "contradicted" as const },
    { id: "c-young", text: "Du khách 18–30 tuổi sẵn sàng trả thêm 10–15% cho lựa chọn xanh.", kind: "fact" as const, evidenceIds: ["ev-young"], support: "supported" as const },
    { id: "c-homestay", text: "Homestay sinh thái rẻ hơn nhiều so với nghỉ dưỡng xanh nhưng công suất biến động theo mùa.", kind: "inference" as const, evidenceIds: ["ev-homestay-price", "ev-resort"], support: "supported" as const },
    { id: "c-community", text: "Tour trải nghiệm cộng đồng có tiềm năng tăng trưởng nhanh.", kind: "inference" as const, evidenceIds: ["ev-community"], support: "insufficient" as const },
    { id: "c-greenwash", text: "Thiếu chứng nhận độc lập khiến khách khó phân biệt cơ sở ‘xanh’ thật.", kind: "fact" as const, evidenceIds: ["ev-greenwash"], support: "supported" as const },
  ];
  const blocks: UIBlock[] = [
    { id: "metric-found", type: "metric", props: { label: "Nguồn tìm thấy", value: 12, sourceIds: [] } },
    { id: "metric-used", type: "metric", props: { label: "Nguồn sử dụng", value: SOURCES.length, sourceIds: SOURCES.map(s => s.id) } },
    { id: "metric-deduped", type: "metric", props: { label: "Đã loại trùng", value: 3, sourceIds: [] } },
    { id: "metric-cited", type: "metric", props: { label: "Phát hiện có trích dẫn", value: Math.round((claims.filter(c => c.support === "supported").length / claims.length) * 100), unit: "%", sourceIds: [] } },
    { id: "insight-growth", type: "insight", props: { title: "Thị trường đang lớn", claimIds: ["c-growth", "c-young"], severity: "info" } },
    { id: "insight-segment", type: "insight", props: { title: "Homestay sinh thái là điểm vào dễ", claimIds: ["c-homestay"], severity: "info" } },
    { id: "insight-trust", type: "insight", props: { title: "Niềm tin là nút thắt", claimIds: ["c-greenwash", "c-community"], severity: "warning" } },
    { id: "comparison", type: "comparison", props: {
      criteria: [{ key: "price", label: "Giá trung bình / đêm", unit: "nghìn đ" }, { key: "growth", label: "Tăng trưởng nhắc tới", unit: "%" }, { key: "mentions", label: "Số nguồn đề cập" }, { key: "evidence", label: "Mức độ bằng chứng" }],
      options: [
        { id: "homestay", label: "Homestay sinh thái", values: { price: 650, growth: 30, mentions: 3, evidence: "Cao" } },
        { id: "resort", label: "Nghỉ dưỡng xanh", values: { price: 2400, growth: 18, mentions: 2, evidence: "Trung bình" } },
        { id: "community", label: "Tour cộng đồng", values: { price: null, growth: null, mentions: 1, evidence: "Thấp" } },
      ],
    } },
    { id: "verdict-growth", type: "verdict", props: { claimId: "c-growth-30", support: "contradicted", reason: "Báo cáo bền vững nói 30% (lượt tìm kiếm), bản tin ngành nói 18% (lượt đặt dịch vụ) – hai chỉ số khác nhau, không nên gộp làm một." } },
    { id: "verdict-community", type: "verdict", props: { claimId: "c-community", support: "insufficient", reason: "Chỉ một nguồn nhắc tới và không kèm số liệu. Cần thêm dữ liệu trước khi kết luận." } },
    { id: "verdict-young", type: "verdict", props: { claimId: "c-young", support: "supported", reason: "Có trong kết quả khảo sát; mới một nguồn nên vẫn nên đối chiếu thêm." } },
    { id: "timeline-sources", type: "timeline", props: { items: SOURCES.map(s => ({ id: `t-${s.id}`, title: s.title, description: s.url, at: s.publishedAt })) } },
    { id: "action-export-md", type: "action", props: { label: "Xuất báo cáo", actionId: "export.markdown" } },
    { id: "action-export-json", type: "action", props: { label: "Xuất JSON", actionId: "export.json" } },
    { id: "rec-homestay", type: "recommendation", props: { title: "Bắt đầu từ homestay sinh thái cho khách trẻ", reasonClaimIds: ["c-homestay", "c-young"], priority: "high", actionIds: ["action-export-md"] } },
    { id: "rec-certify", type: "recommendation", props: { title: "Đầu tư chứng nhận ‘xanh’ độc lập", reasonClaimIds: ["c-greenwash"], priority: "medium", actionIds: [] } },
    { id: "rec-more-data", type: "recommendation", props: { title: "Thu thập thêm dữ liệu về tour cộng đồng", reasonClaimIds: ["c-community"], priority: "low", actionIds: [] } },
    { id: "md-report", type: "markdown", props: { content: "### Tổng quan\nCác nguồn (giả lập) cho thấy nhu cầu du lịch xanh **đang tăng**, nhưng **mức tăng chưa thống nhất**: 30% theo lượt tìm kiếm, 18% theo lượt đặt dịch vụ.\n\n### Phân khúc\n- **Homestay sinh thái:** giá dễ tiếp cận, nhiều bằng chứng nhất.\n- **Nghỉ dưỡng xanh:** giá cao, tăng chậm hơn.\n- **Tour cộng đồng:** được nhắc tới nhưng *chưa đủ dữ liệu*.\n\n### Giới hạn\nBốn nguồn sau khi loại trùng, trong 12 tháng gần nhất. Không có nguồn nào được tạo thêm để lấp chỗ trống." } },
    { id: "sources", type: "source", props: { sourceIds: SOURCES.map(s => s.id) } },
    { id: "report", type: "report-section", props: { title: "Báo cáo nghiên cứu", blockIds: ["md-report", "verdict-growth"] } },
  ];
  return {
    label: `${researchMeta.manifest.title} — nguồn giả lập`,
    view: { runId: `demo-${researchMeta.id}`, revision: 1, title: "Xu hướng du lịch xanh", status: "completed", blocks },
    snapshot: { id: `demo-${researchMeta.id}`, workspaceId: "workspace-demo", domainId: researchMeta.id, domainVersion: 1, input: { query: "Xu hướng du lịch xanh tại Việt Nam và phân khúc nào đáng đầu tư?", seedUrls: [], domains: ["reports", "news"], maxSources: 8, timeRange: "12m" }, status: "completed", revision: 1, deadlineAt: null, steps: [], artifacts: [], warnings: ["Nguồn giả lập; không có truy cập mạng."] },
    sources: SOURCES, evidence, claims, datasets: {},
  };
}

export function researchFixture(state: DemoState): TemplateFixture<ResearchExtras> {
  const bundle = deriveState(success(), state, {
    stepIds: researchMeta.steps.map(step => step.id),
    progressBlockId: "progress",
    error: { stepIndex: 1, code: "search_unavailable", title: "Không tìm kiếm được", message: "Nhà cung cấp tìm kiếm không phản hồi. Không có nguồn nào được tạo thay thế để hoàn tất báo cáo." },
    partial: { stepIndex: 2, code: "fetch_partial", dropBlockIds: ["comparison", "verdict-community"], title: "Một số nguồn không tải được", message: "3 trong 12 nguồn bị chặn hoặc hết thời gian tải. Bảng so sánh bị ẩn vì thiếu dữ liệu giá." },
    unavailableMessage: "Năng lực tìm kiếm và tải nguồn (research) chưa được bật trên nền tảng.",
  });
  return { bundle, extras: { sourceImages: { "s-report": "/images/research-card.jpg", "s-survey": "/images/meeting.jpg", "s-homestay": "/images/forest.jpg", "s-news": "/images/screens.jpg" } } };
}
