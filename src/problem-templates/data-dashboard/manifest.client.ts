import type { TemplateMeta } from "../types";

export const dashboardMeta: TemplateMeta = {
  id: "data-dashboard",
  manifest: {
    id: "data-dashboard", version: 1, title: "Bảng điều khiển dữ liệu", description: "Tải bảng CSV/XLSX, chọn cột và bộ lọc để nhận KPI, biểu đồ, bảng và nhận định có trích dẫn.",
    branding: { name: "Data Dashboard", accent: "#004DE8" }, surface: "workspace",
    inputFields: [
      { name: "file", label: "Tệp dữ liệu", kind: "upload", required: true },
      { name: "measures", label: "Chỉ số cần phân tích", kind: "select", required: true, options: [{ label: "Lượt khách", value: "visitors" }, { label: "Doanh thu", value: "revenue" }, { label: "Số đêm lưu trú TB", value: "avgStay" }] },
      { name: "question", label: "Câu hỏi phân tích", kind: "textarea", required: false },
    ],
    examples: [{ label: "Du lịch theo tháng", input: { fileName: "du-lich-2025.xlsx", measures: ["visitors", "revenue"], question: "Mùa nào thấp điểm và nên làm gì?" } }],
    toolNames: [],
  },
  kicker: "Mẫu 01 · Visual analytics",
  headline: "Biến bảng số thành câu chuyện",
  tagline: "Tải dữ liệu, lọc theo phân khúc và thời gian, đọc KPI, biểu đồ và nhận định có trích dẫn.",
  sampleTopic: "Lượt khách du lịch theo tháng (dữ liệu tổng hợp)",
  heroTitle: "Bảng điều khiển",
  images: { hero: "/images/dashboard-hero.jpg", card: "/images/dashboard-card.jpg" },
  icon: "bar-chart",
  steps: [
    { id: "ingest", label: "Đọc tệp dữ liệu" },
    { id: "infer-schema", label: "Nhận diện cột và kiểu dữ liệu" },
    { id: "compute-stats", label: "Tính thống kê và xu hướng" },
    { id: "chart-specs", label: "Dựng đặc tả biểu đồ" },
    { id: "analysis", label: "Rút nhận định có bằng chứng" },
    { id: "report", label: "Soạn báo cáo" },
  ],
  capabilities: ["ingestion", "analytics", "chart spec", "analysis", "report"],
};
