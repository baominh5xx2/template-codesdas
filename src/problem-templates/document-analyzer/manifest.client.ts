import type { TemplateMeta } from "../types";

export const documentMeta: TemplateMeta = {
  id: "document-analyzer",
  manifest: {
    id: "document-analyzer", version: 1, title: "Phân tích tài liệu", description: "Tải PDF/DOCX để trích xuất trường theo schema, đánh dấu bằng chứng trong văn bản, kiểm tra điều khoản và nhận khuyến nghị.",
    branding: { name: "Document Analyzer", accent: "#004DE8" }, surface: "workspace",
    inputFields: [
      { name: "file", label: "Tài liệu", kind: "upload", required: true },
      { name: "documentType", label: "Loại tài liệu", kind: "select", required: true, options: [{ label: "Hợp đồng thuê nhà", value: "lease" }, { label: "Hợp đồng lao động", value: "employment" }, { label: "Hoá đơn", value: "invoice" }, { label: "Khác", value: "other" }] },
      { name: "focus", label: "Điều cần chú ý", kind: "textarea", required: false },
    ],
    examples: [{ label: "Hợp đồng thuê căn hộ", input: { fileName: "hop-dong-thue-can-ho.pdf", documentType: "lease", checks: ["missing-clauses", "fairness"] } }],
    toolNames: [],
  },
  kicker: "Mẫu 02 · Document analyzer",
  headline: "Đọc kỹ từng điều khoản",
  tagline: "Trích xuất trường có cấu trúc, đánh dấu bằng chứng ngay trên văn bản và chỉ ra điều khoản còn thiếu.",
  sampleTopic: "Hợp đồng thuê căn hộ (bản mẫu tổng hợp)",
  heroTitle: "Phân tích tài liệu",
  images: { hero: "/images/document-hero.jpg", card: "/images/document-card.jpg" },
  icon: "file-text",
  steps: [
    { id: "parse", label: "Đọc và tách trang" },
    { id: "extract", label: "Trích xuất trường theo schema" },
    { id: "classify", label: "Phân loại và phân tích điều khoản" },
    { id: "link-evidence", label: "Liên kết bằng chứng" },
    { id: "recommend", label: "Đề xuất chỉnh sửa" },
    { id: "report", label: "Soạn tóm tắt" },
  ],
  capabilities: ["ingestion", "extraction", "evidence", "analysis", "recommendation", "report"],
};
