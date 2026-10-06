import type { UIBlock } from "@/contracts/ui/blocks";
import type { DemoBundle, DemoState } from "@/demo/schemas";
import { deriveState, sourceRef } from "../fixture-states";
import type { TemplateFixture } from "../types";
import { locateText, MESSAGE, MESSAGE_SOURCE, RULES, RULES_SOURCE, scoreRules, SIGNALS_DATASET } from "./data";
import { riskMeta } from "./manifest.client";

export type RiskExtras = { message: string | null; evidenceTone: Record<string, "warning" | "critical"> };

const ev = (id: string, excerpt: string) => ({ id, sourceId: MESSAGE_SOURCE, locator: locateText(excerpt), excerpt });

function success(): DemoBundle {
  const { score, completeness, level } = scoreRules(RULES);
  const evidence = [
    ev("ev-urgency", "trong 24h"),
    ev("ev-forever", "de tranh bi khoa vinh vien"),
    ev("ev-link", "https://nh-xyz-xacminh.top/kh"),
    ev("ev-verify", "Vui long xac minh"),
    ev("ev-pretext", "bi tam khoa do dang nhap bat thuong"),
    ev("ev-otp", "Khong chia se ma OTP"),
    { id: "ev-rule-domain", sourceId: RULES_SOURCE, locator: { type: "table" as const, sheet: "rules", row: 2, column: "suspicious-link" }, excerpt: "Tên miền ngân hàng chính thức không dùng đuôi .top và không chứa từ “xacminh”." },
  ];
  const claims = [
    { id: "c-urgency", text: "Tin nhắn tạo áp lực thời gian: “trong 24h”, “khoá vĩnh viễn”.", kind: "fact" as const, evidenceIds: ["ev-urgency", "ev-forever"], support: "supported" as const },
    { id: "c-link", text: "Liên kết trỏ tới tên miền .top lạ, không phải tên miền của ngân hàng.", kind: "fact" as const, evidenceIds: ["ev-link", "ev-rule-domain"], support: "supported" as const },
    { id: "c-verify", text: "Yêu cầu “xác minh” tài khoản qua liên kết bên ngoài – kiểu dẫn dụ nhập mật khẩu.", kind: "inference" as const, evidenceIds: ["ev-verify", "ev-pretext"], support: "supported" as const },
    { id: "c-otp", text: "Câu “không chia sẻ OTP” được chèn vào để tạo vẻ chính thống.", kind: "inference" as const, evidenceIds: ["ev-otp"], support: "supported" as const },
    { id: "c-brand", text: "Chưa xác minh được người gửi có đúng là ngân hàng hay không.", kind: "fact" as const, evidenceIds: [], support: "insufficient" as const },
    { id: "c-official", text: "Đường link thuộc tên miền chính thức của ngân hàng.", kind: "fact" as const, evidenceIds: ["ev-link", "ev-rule-domain"], support: "contradicted" as const },
    { id: "c-domain-age", text: "Tên miền mới được đăng ký gần đây.", kind: "fact" as const, evidenceIds: [], support: "unchecked" as const },
  ];
  const blocks: UIBlock[] = [
    { id: "risk", type: "risk", props: { score, min: 0, max: 100, direction: "higher-is-worse", level, factorIds: ["c-link", "c-urgency", "c-verify", "c-otp", "c-brand"], method: "Quy tắc có trọng số scam-rules v1 – tổng điểm các tín hiệu phát hiện được, không dùng mô hình.", completeness } },
    { id: "warning-link", type: "warning", props: { title: "Đừng bấm vào liên kết", message: "Không nhập tài khoản, mật khẩu hay mã OTP vào trang được gửi qua tin nhắn này.", severity: "critical" } },
    { id: "metric-signals", type: "metric", props: { label: "Tín hiệu phát hiện", value: RULES.filter(r => r.status === "detected").length, unit: `/ ${RULES.length}`, sourceIds: [MESSAGE_SOURCE] } },
    { id: "metric-completeness", type: "metric", props: { label: "Độ đầy đủ dữ liệu", value: Math.round(completeness * 100), unit: "%", sourceIds: [RULES_SOURCE] } },
    { id: "table-signals", type: "table", props: { title: "Bảng tín hiệu", datasetId: SIGNALS_DATASET, columns: ["label", "weight", "status", "points"], pageSize: 10 } },
    { id: "verdict-official", type: "verdict", props: { claimId: "c-official", support: "contradicted", reason: "Tên miền dùng đuôi .top và chứa “xacminh” – trái với danh sách tên miền chính thức trong bộ quy tắc." } },
    { id: "verdict-brand", type: "verdict", props: { claimId: "c-brand", support: "insufficient", reason: "Không có mã brandname gốc từ nhà mạng để đối chiếu. Thiếu dữ liệu này không làm giảm điểm rủi ro." } },
    { id: "verdict-domain-age", type: "verdict", props: { claimId: "c-domain-age", support: "unchecked", reason: "Dịch vụ tra cứu WHOIS chưa được bật nên tín hiệu này chưa được kiểm tra." } },
    { id: "timeline-pattern", type: "timeline", props: { items: [
      { id: "t1", title: "Báo tài khoản bị khoá", description: "Tin nhắn mạo danh báo sự cố để gây hoảng hốt.", at: "Bước 1" },
      { id: "t2", title: "Dẫn tới trang giả", description: "Trang web nhái giao diện ngân hàng, tên miền gần giống.", at: "Bước 2" },
      { id: "t3", title: "Xin mật khẩu và OTP", description: "Nạn nhân nhập thông tin đăng nhập và mã OTP.", at: "Bước 3" },
      { id: "t4", title: "Chuyển tiền đi", description: "Kẻ gian đăng nhập và rút tiền trong vài phút.", at: "Bước 4" },
    ] } },
    { id: "action-export-md", type: "action", props: { label: "Xuất báo cáo", actionId: "export.markdown" } },
    { id: "action-export-json", type: "action", props: { label: "Xuất JSON", actionId: "export.json" } },
    { id: "rec-dont-click", type: "recommendation", props: { title: "Không bấm liên kết, không nhập OTP", reasonClaimIds: ["c-link", "c-verify"], priority: "high", actionIds: ["action-export-md"] } },
    { id: "rec-call-bank", type: "recommendation", props: { title: "Tự gọi tổng đài in sau thẻ để xác minh", reasonClaimIds: ["c-brand"], priority: "high", actionIds: [] } },
    { id: "rec-report", type: "recommendation", props: { title: "Báo cáo tin nhắn rác cho nhà mạng", reasonClaimIds: ["c-urgency"], priority: "medium", actionIds: [] } },
    { id: "md-summary", type: "markdown", props: { content: `### Kết luận\nTin nhắn có **rủi ro cao (${score}/100)**: phát hiện ${RULES.filter(r => r.status === "detected").length}/${RULES.length} tín hiệu của bộ quy tắc *scam-rules v1*.\n\n- Liên kết dẫn tới tên miền lạ.\n- Tạo áp lực thời gian và giả lý do khoá tài khoản.\n- Chưa xác minh được người gửi – thiếu dữ liệu, **không** được coi là an toàn.\n\n*Ví dụ minh hoạ bằng dữ liệu tổng hợp.*` } },
    { id: "sources", type: "source", props: { sourceIds: [MESSAGE_SOURCE, RULES_SOURCE] } },
    { id: "report", type: "report-section", props: { title: "Báo cáo", blockIds: ["md-summary", "verdict-official"] } },
  ];
  return {
    label: `${riskMeta.manifest.title} — dữ liệu demo tổng hợp`,
    view: { runId: `demo-${riskMeta.id}`, revision: 1, title: "Tin nhắn báo khoá tài khoản", status: "completed", blocks },
    snapshot: { id: `demo-${riskMeta.id}`, workspaceId: "workspace-demo", domainId: riskMeta.id, domainVersion: 1, input: { mode: "text", text: MESSAGE, urls: [], ruleset: "finance-scam" }, status: "completed", revision: 1, deadlineAt: null, steps: [], artifacts: [], warnings: ["Dữ liệu tổng hợp; engine chưa chạy."] },
    sources: [sourceRef(MESSAGE_SOURCE, "upload", "Tin nhắn bạn cung cấp"), sourceRef(RULES_SOURCE, "dataset", "Bộ quy tắc scam-rules v1 (tổng hợp)")],
    evidence, claims,
    datasets: {
      [SIGNALS_DATASET]: {
        datasetId: SIGNALS_DATASET,
        columns: [{ key: "label", type: "string", nullable: false }, { key: "weight", type: "number", nullable: false, unit: "điểm" }, { key: "status", type: "string", nullable: false }, { key: "points", type: "number", nullable: false, unit: "điểm" }],
        rows: RULES.map(rule => ({ id: rule.id, values: { label: rule.label, weight: rule.weight, status: rule.status === "detected" ? "Phát hiện" : "Chưa kiểm tra", points: rule.points } })),
        total: RULES.length, offset: 0, limit: RULES.length,
      },
    },
  };
}

export function riskFixture(state: DemoState): TemplateFixture<RiskExtras> {
  const bundle = deriveState(success(), state, {
    stepIds: riskMeta.steps.map(step => step.id),
    progressBlockId: "progress",
    error: { stepIndex: 2, code: "ruleset_missing", title: "Thiếu bộ quy tắc", message: "Bộ quy tắc “finance-scam” chưa được đăng ký nên không thể chấm điểm. Không có điểm nào được hiển thị thay thế." },
    partial: {
      stepIndex: 3, code: "verification_unavailable", dropBlockIds: ["verdict-official", "verdict-brand", "verdict-domain-age"],
      title: "Chưa kiểm chứng xong", message: "Bước kiểm chứng chưa chạy; điểm được tính trên ít tín hiệu hơn và độ đầy đủ thấp hơn.",
      patch: bundle => ({ ...bundle, view: { ...bundle.view, blocks: bundle.view.blocks.map(block => block.type === "risk" ? { ...block, props: { ...block.props, score: 55, level: "medium", completeness: 0.55 } } : block.id === "report" ? { ...block, type: "report-section", props: { title: "Báo cáo", blockIds: ["md-summary"] } } : block) } }),
    },
    unavailableMessage: "Năng lực trích xuất tín hiệu và chấm điểm theo quy tắc chưa được bật trên nền tảng.",
  });
  const ok = bundle.view.status === "completed" || bundle.view.status === "partial";
  return { bundle, extras: { message: ok && bundle.view.blocks.length ? MESSAGE : null, evidenceTone: { "ev-link": "critical", "ev-verify": "critical", "ev-urgency": "warning", "ev-forever": "warning", "ev-pretext": "warning", "ev-otp": "warning" } } };
}
