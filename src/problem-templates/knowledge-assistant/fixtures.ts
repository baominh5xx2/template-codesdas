import type { UIBlock } from "@/contracts/ui/blocks";
import type { DemoBundle, DemoState } from "@/demo/schemas";
import { deriveState, sourceRef } from "../fixture-states";
import type { TemplateFixture } from "../types";
import { knowledgeMeta } from "./manifest.client";

/** A scripted question/answer pair; answers are claims so every sentence carries its own citations. */
export type ScriptedTurn = { id: string; question: string; keywords: string[]; claimIds: string[]; followUps: string[] };
export type KnowledgeExtras = { turns: ScriptedTurn[]; sourceImages: Record<string, string> };

const SOURCES = [
  sourceRef("s-regulation", "upload", "Quy chế đào tạo – Trường Đại học Mẫu.pdf"),
  sourceRef("s-guide", "upload", "Hướng dẫn đăng ký học phần (mẫu).pdf"),
  sourceRef("s-faq", "upload", "Câu hỏi thường gặp phòng đào tạo (mẫu).docx"),
];
const pdf = (id: string, sourceId: string, page: number, excerpt: string) => ({ id, sourceId, locator: { type: "pdf" as const, page, start: 0, end: excerpt.length }, excerpt });

export const TURNS: ScriptedTurn[] = [
  { id: "q-credits", question: "Mỗi học kỳ được đăng ký tối đa bao nhiêu tín chỉ?", keywords: ["tín chỉ", "tin chi", "đăng ký", "tối đa"], claimIds: ["c-credit-max", "c-credit-honor"], followUps: ["q-grad", "q-defer"] },
  { id: "q-grad", question: "Điều kiện tốt nghiệp loại giỏi là gì?", keywords: ["tốt nghiệp", "loại giỏi", "xếp loại"], claimIds: ["c-grad-good", "c-grad-downgrade"], followUps: ["q-credits", "q-tuition"] },
  { id: "q-defer", question: "Bị ốm thì có được hoãn thi không?", keywords: ["hoãn thi", "ốm", "vắng thi", "hoãn"], claimIds: ["c-defer", "c-defer-deadline"], followUps: ["q-grad", "q-tuition"] },
  { id: "q-tuition", question: "Học phí năm 2027 là bao nhiêu?", keywords: ["học phí", "hoc phi", "tiền học"], claimIds: ["c-tuition"], followUps: ["q-credits"] },
];

function success(): DemoBundle {
  const evidence = [
    pdf("ev-credit-max", "s-regulation", 5, "Điều 12.2: Khối lượng đăng ký tối đa trong học kỳ chính là 24 tín chỉ."),
    pdf("ev-credit-honor", "s-regulation", 5, "Điều 12.3: Sinh viên có điểm trung bình tích luỹ từ 3,20 trở lên được đăng ký tối đa 28 tín chỉ."),
    pdf("ev-credit-portal", "s-guide", 2, "Việc đăng ký vượt 24 tín chỉ thực hiện qua mục “Đăng ký mở rộng” trên cổng đào tạo."),
    pdf("ev-grad-good", "s-regulation", 18, "Điều 31.1: Loại giỏi khi điểm trung bình tích luỹ từ 3,20 đến dưới 3,60."),
    pdf("ev-grad-downgrade", "s-regulation", 18, "Điều 31.3: Xếp loại bị giảm một mức nếu khối lượng học phần phải học lại vượt quá 5% tổng số tín chỉ."),
    pdf("ev-defer", "s-faq", 3, "Sinh viên vắng thi vì lý do sức khoẻ được xét hoãn thi khi có giấy xác nhận của cơ sở y tế."),
    pdf("ev-defer-deadline", "s-regulation", 22, "Điều 36.2: Đơn xin hoãn thi nộp trong vòng 05 ngày làm việc kể từ ngày thi."),
  ];
  const claims = [
    { id: "c-credit-max", text: "Mỗi học kỳ chính được đăng ký tối đa 24 tín chỉ.", kind: "fact" as const, evidenceIds: ["ev-credit-max"], support: "supported" as const },
    { id: "c-credit-honor", text: "Nếu điểm trung bình tích luỹ từ 3,20 trở lên, bạn được đăng ký tới 28 tín chỉ qua mục “Đăng ký mở rộng”.", kind: "fact" as const, evidenceIds: ["ev-credit-honor", "ev-credit-portal"], support: "supported" as const },
    { id: "c-grad-good", text: "Tốt nghiệp loại giỏi khi điểm trung bình tích luỹ từ 3,20 đến dưới 3,60.", kind: "fact" as const, evidenceIds: ["ev-grad-good"], support: "supported" as const },
    { id: "c-grad-downgrade", text: "Xếp loại bị giảm một mức nếu số tín chỉ phải học lại vượt quá 5% tổng số tín chỉ.", kind: "fact" as const, evidenceIds: ["ev-grad-downgrade"], support: "supported" as const },
    { id: "c-defer", text: "Có. Vắng thi vì lý do sức khoẻ được xét hoãn thi khi có giấy xác nhận của cơ sở y tế.", kind: "fact" as const, evidenceIds: ["ev-defer"], support: "supported" as const },
    { id: "c-defer-deadline", text: "Đơn xin hoãn thi phải nộp trong vòng 5 ngày làm việc kể từ ngày thi.", kind: "fact" as const, evidenceIds: ["ev-defer-deadline"], support: "supported" as const },
    { id: "c-tuition", text: "Không tìm thấy thông tin học phí năm 2027 trong các tài liệu đã chọn.", kind: "fact" as const, evidenceIds: [], support: "insufficient" as const },
  ];
  const blocks: UIBlock[] = [
    { id: "metric-docs", type: "metric", props: { label: "Tài liệu đã nạp", value: SOURCES.length, sourceIds: SOURCES.map(s => s.id) } },
    { id: "metric-chunks", type: "metric", props: { label: "Đoạn đã lập chỉ mục", value: 214, sourceIds: [] } },
    { id: "metric-cited", type: "metric", props: { label: "Câu trả lời có trích dẫn", value: 3, unit: `/ ${TURNS.length}`, sourceIds: [] } },
    ...claims.filter(c => c.evidenceIds.length).map((claim): UIBlock => ({ id: `evidence-${claim.id}`, type: "evidence", props: { claimId: claim.id, evidenceIds: claim.evidenceIds } })),
    { id: "verdict-tuition", type: "verdict", props: { claimId: "c-tuition", support: "insufficient", reason: "Không đoạn nào trong 214 đoạn được truy xuất có nhắc tới học phí năm 2027. Trợ lý không suy đoán." } },
    { id: "md-scope", type: "markdown", props: { content: "### Phạm vi trả lời\n- Chỉ dùng **3 tài liệu** bạn chọn trong không gian làm việc này.\n- Mỗi câu trả lời phải có **ít nhất một trích dẫn** hợp lệ; không có thì trả về *không tìm thấy*.\n- Tài liệu là **bản mẫu tổng hợp** của một trường giả lập." } },
    { id: "action-export-md", type: "action", props: { label: "Xuất hội thoại", actionId: "export.markdown" } },
    { id: "action-export-json", type: "action", props: { label: "Xuất JSON", actionId: "export.json" } },
    { id: "sources", type: "source", props: { sourceIds: SOURCES.map(s => s.id) } },
  ];
  return {
    label: `${knowledgeMeta.manifest.title} — tài liệu mẫu tổng hợp`,
    view: { runId: `demo-${knowledgeMeta.id}`, revision: 1, title: "Hỏi đáp quy chế học vụ", status: "completed", blocks },
    snapshot: { id: `demo-${knowledgeMeta.id}`, workspaceId: "workspace-demo", domainId: knowledgeMeta.id, domainVersion: 1, input: { sourceIds: SOURCES.map(s => s.id), question: TURNS[0].question, topK: 5 }, status: "completed", revision: 1, deadlineAt: null, steps: [], artifacts: [], warnings: ["Tài liệu mẫu tổng hợp; engine chưa chạy."] },
    sources: SOURCES, evidence, claims, datasets: {},
  };
}

export function knowledgeFixture(state: DemoState): TemplateFixture<KnowledgeExtras> {
  const bundle = deriveState(success(), state, {
    stepIds: knowledgeMeta.steps.map(step => step.id),
    progressBlockId: "progress",
    error: { stepIndex: 1, code: "index_failed", title: "Không lập được chỉ mục", message: "Tài liệu “Câu hỏi thường gặp” bị hỏng định dạng. Trợ lý không trả lời khi chưa có chỉ mục." },
    partial: { stepIndex: 4, code: "citation_check_skipped", dropBlockIds: ["verdict-tuition"], title: "Chưa kiểm tra xong trích dẫn", message: "Một số trích dẫn chưa được đối chiếu lại với tài liệu gốc; hãy bấm vào số trích dẫn để tự kiểm tra." },
    unavailableMessage: "Năng lực truy xuất (retrieval) và agent bridge chưa được bật trên nền tảng.",
  });
  return { bundle, extras: { turns: TURNS, sourceImages: { "s-regulation": "/images/research-hero.jpg", "s-guide": "/images/typing.jpg", "s-faq": "/images/meeting.jpg" } } };
}
