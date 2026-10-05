import type { TemplateMeta } from "../types";

export const plannerMeta: TemplateMeta = {
  id: "recommendation-planner",
  manifest: {
    id: "recommendation-planner", version: 1, title: "Gợi ý và lập kế hoạch", description: "Nhập sở thích và ràng buộc; nhận lựa chọn được xếp hạng có lý do và một kế hoạch chỉnh sửa được, tự kiểm tra ràng buộc.",
    branding: { name: "Recommendation Planner", accent: "#2BB673" }, surface: "workspace",
    inputFields: [
      { name: "destination", label: "Điểm đến", kind: "select", required: true, options: [{ label: "Đà Nẵng – Hội An", value: "da-nang" }] },
      { name: "days", label: "Số ngày", kind: "select", required: true, options: [{ label: "2 ngày", value: "2" }, { label: "3 ngày", value: "3" }, { label: "4 ngày", value: "4" }] },
      { name: "interests", label: "Sở thích", kind: "select", required: false },
    ],
    examples: [{ label: "Gia đình 3 ngày", input: { destination: "da-nang", days: 3, budgetPerNight: 1500, interests: ["beach", "culture"], withKids: true, maxPerDay: 3 } }],
    toolNames: [],
  },
  kicker: "Mẫu 05 · Recommendation & planning",
  headline: "Chọn đúng, đi nhẹ nhàng",
  tagline: "Xếp hạng lựa chọn theo tiêu chí bạn đặt, đánh dấu những gì vi phạm ràng buộc và dựng kế hoạch chỉnh sửa được.",
  sampleTopic: "Lịch trình Đà Nẵng – Hội An 3 ngày (giả lập)",
  heroTitle: "Lập kế hoạch",
  images: { hero: "/images/planner-hero.jpg", card: "/images/planner-card.jpg" },
  icon: "route",
  steps: [
    { id: "filter", label: "Lọc lựa chọn theo ràng buộc" },
    { id: "score", label: "Chấm điểm và xếp hạng" },
    { id: "explain", label: "Giải thích lựa chọn" },
    { id: "plan", label: "Dựng lịch trình" },
    { id: "validate", label: "Kiểm tra ràng buộc" },
  ],
  capabilities: ["recommendation", "scoring", "planning", "evidence", "report"],
};
