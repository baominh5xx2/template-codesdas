import type { TemplateMeta } from "../types";

export const researchMeta: TemplateMeta = {
  id: "research-intelligence",
  manifest: {
    id: "research-intelligence", version: 1, title: "Nghiên cứu tổng hợp", description: "Đặt câu hỏi, chọn phạm vi nguồn; nhận phát hiện có trích dẫn, so sánh phương án và chỉ ra chỗ các nguồn mâu thuẫn.",
    branding: { name: "Research Intelligence", accent: "#004DE8" }, surface: "workspace",
    inputFields: [
      { name: "query", label: "Câu hỏi nghiên cứu", kind: "textarea", required: true },
      { name: "seedUrls", label: "Nguồn gợi ý", kind: "url-list", required: false },
      { name: "timeRange", label: "Khoảng thời gian", kind: "select", required: true, options: [{ label: "12 tháng qua", value: "12m" }, { label: "2 năm qua", value: "24m" }, { label: "Không giới hạn", value: "all" }] },
    ],
    examples: [{ label: "Du lịch xanh", input: { query: "Xu hướng du lịch xanh tại Việt Nam và phân khúc nào đáng đầu tư?", seedUrls: [], timeRange: "12m", maxSources: 8 } }],
    toolNames: [],
  },
  kicker: "Mẫu 04 · Research intelligence",
  headline: "Đọc trăm nguồn, giữ lại điều đáng tin",
  tagline: "Lập kế hoạch tìm kiếm, gom và loại trùng nguồn, rút phát hiện có trích dẫn và nói rõ chỗ các nguồn không thống nhất.",
  sampleTopic: "Xu hướng du lịch xanh (nguồn giả lập)",
  heroTitle: "Nghiên cứu tổng hợp",
  images: { hero: "/images/research-hero.jpg", card: "/images/research-card.jpg" },
  icon: "compass",
  steps: [
    { id: "plan", label: "Lập kế hoạch truy vấn" },
    { id: "search", label: "Tìm kiếm nguồn" },
    { id: "fetch", label: "Tải và làm sạch nội dung" },
    { id: "dedupe", label: "Loại trùng và xếp hạng" },
    { id: "extract", label: "Trích xuất bằng chứng" },
    { id: "synthesize", label: "Tổng hợp phát hiện" },
    { id: "report", label: "Soạn báo cáo" },
  ],
  capabilities: ["planning", "research", "extraction", "evidence", "analysis", "report"],
};
