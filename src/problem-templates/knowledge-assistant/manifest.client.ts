import type { TemplateMeta } from "../types";

export const knowledgeMeta: TemplateMeta = {
  id: "knowledge-assistant",
  manifest: {
    id: "knowledge-assistant", version: 1, title: "Trợ lý tri thức", description: "Chọn tài liệu làm kho tri thức rồi hỏi đáp; mọi câu trả lời có trích dẫn, không tìm thấy thì nói không tìm thấy.",
    branding: { name: "Knowledge Assistant", accent: "#004DE8" }, surface: "workspace",
    inputFields: [
      { name: "sources", label: "Tài liệu", kind: "upload", required: true },
      { name: "question", label: "Câu hỏi", kind: "text", required: true },
    ],
    examples: [{ label: "Quy chế học vụ", input: { sourceIds: ["s-regulation", "s-guide", "s-faq"], question: "Mỗi học kỳ được đăng ký tối đa bao nhiêu tín chỉ?", topK: 5 } }],
    toolNames: [],
  },
  kicker: "Mẫu 06 · Knowledge assistant",
  headline: "Hỏi gì cũng có trích dẫn",
  tagline: "Hỏi đáp trên chính tài liệu bạn chọn, mỗi câu trả lời trỏ về đúng điều khoản – và biết nói “không tìm thấy”.",
  sampleTopic: "Quy chế học vụ của một trường giả lập",
  heroTitle: "Trợ lý tri thức",
  images: { hero: "/images/knowledge-hero.jpg", card: "/images/knowledge-card.jpg" },
  icon: "message-circle",
  steps: [
    { id: "ingest", label: "Nạp tài liệu" },
    { id: "chunk-index", label: "Chia đoạn và lập chỉ mục" },
    { id: "retrieve", label: "Truy xuất đoạn liên quan" },
    { id: "answer", label: "Soạn câu trả lời có căn cứ" },
    { id: "validate-citations", label: "Kiểm tra trích dẫn" },
  ],
  capabilities: ["ingestion", "retrieval", "evidence", "analysis", "agent bridge"],
};
