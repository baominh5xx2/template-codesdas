import type { TemplateMeta } from "../types";

export const riskMeta: TemplateMeta = {
  id: "risk-analyzer",
  manifest: {
    id: "risk-analyzer", version: 1, title: "Phân tích rủi ro", description: "Dán tin nhắn, đường link hoặc tải ảnh chụp để nhận điểm rủi ro có phương pháp, tín hiệu, bằng chứng và hành động nên làm.",
    branding: { name: "Risk Analyzer", accent: "#BA0C2F" }, surface: "workspace",
    inputFields: [
      { name: "text", label: "Nội dung cần kiểm tra", kind: "textarea", required: false },
      { name: "urls", label: "Đường link", kind: "url-list", required: false },
      { name: "file", label: "Ảnh chụp màn hình", kind: "upload", required: false },
      { name: "ruleset", label: "Bộ quy tắc", kind: "select", required: true, options: [{ label: "Lừa đảo tài chính", value: "finance-scam" }, { label: "Tuyển dụng giả", value: "job-scam" }, { label: "Đầu tư lãi cao", value: "investment-scam" }] },
    ],
    examples: [{ label: "Tin nhắn báo khoá tài khoản", input: { text: "[NH-XYZ] Tai khoan cua Quy khach bi tam khoa…", urls: [], ruleset: "finance-scam" } }],
    toolNames: [],
  },
  kicker: "Mẫu 03 · Risk & safety",
  headline: "Bấm hay không bấm?",
  tagline: "Chấm điểm rủi ro theo quy tắc rõ ràng, chỉ ra từng tín hiệu trong nội dung và gợi ý việc nên làm ngay.",
  sampleTopic: "Tin nhắn nghi lừa đảo ngân hàng (tổng hợp)",
  heroTitle: "Phân tích rủi ro",
  images: { hero: "/images/risk-hero.jpg", card: "/images/risk-card.jpg" },
  icon: "shield-alert",
  steps: [
    { id: "ingest", label: "Nhận nội dung và chuẩn hoá" },
    { id: "extract-signals", label: "Trích xuất tín hiệu" },
    { id: "score", label: "Chấm điểm theo bộ quy tắc" },
    { id: "verify", label: "Kiểm chứng bằng chứng" },
    { id: "recommend", label: "Đề xuất hành động" },
    { id: "report", label: "Soạn báo cáo" },
  ],
  capabilities: ["ingestion", "extraction", "scoring", "evidence", "verification", "recommendation"],
};
