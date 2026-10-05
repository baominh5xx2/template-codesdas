import type { NormalizedDocument } from "@/contracts/sources";
import type { UIBlock } from "@/contracts/ui/blocks";
import type { DemoBundle, DemoState } from "@/demo/schemas";
import { deriveState, sourceRef } from "../fixture-states";
import type { TemplateFixture } from "../types";
import { buildDocument, FIELDS_DATASET, locate, SOURCE_ID } from "./data";
import { documentMeta } from "./manifest.client";

export type DocumentExtras = { document: NormalizedDocument | null; evidenceTone: Record<string, "info" | "warning" | "critical"> };

const ev = (id: string, page: number, excerpt: string) => ({ id, sourceId: SOURCE_ID, documentId: "doc-lease", locator: locate(page, excerpt), excerpt });

function success(): DemoBundle {
  const evidence = [
    ev("ev-object", 1, "Căn hộ số 12.05, Toà C, Khu đô thị Mẫu, diện tích 68 m²"),
    ev("ev-term", 1, "12 tháng, từ ngày 01/11/2026 đến hết ngày 31/10/2027"),
    ev("ev-renewal", 1, "Hợp đồng được gia hạn nếu hai bên đồng ý bằng văn bản trước 30 ngày"),
    ev("ev-price", 1, "12.000.000 đồng/tháng, cố định trong suốt thời hạn thuê"),
    ev("ev-payment", 2, "thanh toán tiền thuê trước ngày 05 hằng tháng bằng chuyển khoản"),
    ev("ev-late", 2, "Chậm thanh toán quá 10 ngày, Bên B chịu phạt 0,1% số tiền chậm trả cho mỗi ngày"),
    ev("ev-deposit", 2, "Bên B đặt cọc 36.000.000 đồng, tương đương 03 tháng tiền thuê"),
    ev("ev-refund", 2, "Tiền cọc được hoàn trả trong vòng 30 ngày sau khi bàn giao lại căn hộ"),
    ev("ev-term-a", 2, "Bên A có quyền đơn phương chấm dứt hợp đồng khi báo trước 15 ngày"),
    ev("ev-term-b", 2, "Bên B đơn phương chấm dứt trước hạn sẽ mất toàn bộ tiền đặt cọc"),
    ev("ev-sublet", 3, "không cho thuê lại khi chưa có sự đồng ý của Bên A"),
  ];
  const claims = [
    { id: "c-deposit", text: "Tiền cọc 3 tháng cao hơn mức 1–2 tháng thường gặp ở hợp đồng thuê 12 tháng.", kind: "inference" as const, evidenceIds: ["ev-deposit"], support: "supported" as const },
    { id: "c-termination", text: "Quyền chấm dứt bất cân xứng: Bên A chỉ cần báo trước 15 ngày, còn Bên B mất toàn bộ tiền cọc.", kind: "inference" as const, evidenceIds: ["ev-term-a", "ev-term-b"], support: "supported" as const },
    { id: "c-balanced", text: "Quyền chấm dứt hợp đồng cân bằng giữa hai bên.", kind: "fact" as const, evidenceIds: ["ev-term-a", "ev-term-b"], support: "contradicted" as const },
    { id: "c-maintenance", text: "Hợp đồng không quy định trách nhiệm sửa chữa, bảo trì thiết bị.", kind: "fact" as const, evidenceIds: [], support: "insufficient" as const },
    { id: "c-price", text: "Giá thuê cố định 12.000.000 đồng/tháng trong suốt 12 tháng.", kind: "fact" as const, evidenceIds: ["ev-price", "ev-term"], support: "supported" as const },
    { id: "c-late", text: "Phạt chậm trả 0,1%/ngày, chỉ áp dụng khi trễ quá 10 ngày.", kind: "fact" as const, evidenceIds: ["ev-late"], support: "supported" as const },
    { id: "c-renewal", text: "Gia hạn cần văn bản đồng ý của hai bên trước 30 ngày.", kind: "fact" as const, evidenceIds: ["ev-renewal"], support: "supported" as const },
    { id: "c-refund", text: "Tiền cọc được hoàn trong 30 ngày sau bàn giao, sau khi trừ hư hỏng.", kind: "fact" as const, evidenceIds: ["ev-refund"], support: "supported" as const },
  ];
  const fieldRows: Array<[string, string, string | null, number, number, string]> = [
    ["f-type", "Loại tài liệu", "Hợp đồng thuê nhà ở", 1, 99, "ev-object"],
    ["f-object", "Đối tượng thuê", "Căn hộ 12.05, Toà C – 68 m²", 1, 97, "ev-object"],
    ["f-term", "Thời hạn", "12 tháng (01/11/2026 – 31/10/2027)", 1, 98, "ev-term"],
    ["f-price", "Giá thuê", "12.000.000 đ/tháng, cố định", 1, 99, "ev-price"],
    ["f-payment", "Hạn thanh toán", "Trước ngày 05 hằng tháng", 2, 96, "ev-payment"],
    ["f-deposit", "Tiền đặt cọc", "36.000.000 đ (3 tháng)", 2, 99, "ev-deposit"],
    ["f-late", "Phạt chậm trả", "0,1%/ngày sau 10 ngày", 2, 94, "ev-late"],
    ["f-notice", "Báo trước khi chấm dứt (Bên A)", "15 ngày", 2, 95, "ev-term-a"],
    ["f-sublet", "Cho thuê lại", "Cần Bên A đồng ý", 3, 92, "ev-sublet"],
    ["f-maintenance", "Trách nhiệm sửa chữa", null, 0, 0, ""],
  ];
  const blocks: UIBlock[] = [
    { id: "metric-fields", type: "metric", props: { label: "Trường đã trích xuất", value: 9, unit: "/ 10", sourceIds: [SOURCE_ID] } },
    { id: "metric-flags", type: "metric", props: { label: "Điều khoản cần lưu ý", value: 3, unit: "điều", sourceIds: [SOURCE_ID] } },
    { id: "metric-coverage", type: "metric", props: { label: "Nhận định có bằng chứng", value: Math.round((claims.filter(c => c.evidenceIds.length).length / claims.length) * 100), unit: "%", sourceIds: [SOURCE_ID] } },
    { id: "table-fields", type: "table", props: { title: "Trường đã trích xuất", datasetId: FIELDS_DATASET, columns: ["field", "value", "page", "confidence"], pageSize: 10 } },
    { id: "insight-negotiate", type: "insight", props: { title: "Nên thương lượng lại", claimIds: ["c-deposit", "c-termination"], severity: "warning" } },
    { id: "insight-clear", type: "insight", props: { title: "Điều khoản tài chính rõ ràng", claimIds: ["c-price", "c-late"], severity: "info" } },
    { id: "insight-missing", type: "insight", props: { title: "Thiếu điều khoản quan trọng", claimIds: ["c-maintenance"], severity: "critical" } },
    { id: "verdict-renewal", type: "verdict", props: { claimId: "c-renewal", support: "supported", reason: "Điều 2 quy định rõ thủ tục và thời hạn gia hạn." } },
    { id: "verdict-refund", type: "verdict", props: { claimId: "c-refund", support: "supported", reason: "Điều 5 có thời hạn hoàn cọc cụ thể." } },
    { id: "verdict-balanced", type: "verdict", props: { claimId: "c-balanced", support: "contradicted", reason: "Điều 6 cho Bên A chấm dứt với 15 ngày báo trước nhưng phạt Bên B toàn bộ tiền cọc." } },
    { id: "verdict-maintenance", type: "verdict", props: { claimId: "c-maintenance", support: "insufficient", reason: "Không đoạn nào trong 8 điều khoản nhắc tới sửa chữa hay bảo trì – cần bổ sung, không được suy ra." } },
    { id: "action-export-md", type: "action", props: { label: "Xuất tóm tắt", actionId: "export.markdown" } },
    { id: "action-export-json", type: "action", props: { label: "Xuất JSON", actionId: "export.json" } },
    { id: "rec-deposit", type: "recommendation", props: { title: "Đề nghị giảm tiền cọc xuống 2 tháng", reasonClaimIds: ["c-deposit"], priority: "high", actionIds: ["action-export-md"] } },
    { id: "rec-maintenance", type: "recommendation", props: { title: "Bổ sung phụ lục trách nhiệm sửa chữa", reasonClaimIds: ["c-maintenance"], priority: "high", actionIds: [] } },
    { id: "rec-termination", type: "recommendation", props: { title: "Thống nhất 30 ngày báo trước cho cả hai bên", reasonClaimIds: ["c-termination"], priority: "medium", actionIds: [] } },
    { id: "md-summary", type: "markdown", props: { content: "### Tóm tắt\nĐây là **hợp đồng thuê nhà ở** 12 tháng, giá cố định 12.000.000 đ/tháng (bản mẫu tổng hợp).\n\n- 2 điều khoản nên thương lượng: **tiền cọc** và **quyền chấm dứt**.\n- 1 điều khoản còn thiếu: **trách nhiệm sửa chữa**.\n- Các điều khoản thanh toán, gia hạn và hoàn cọc rõ ràng.\n\n*Đây không phải tư vấn pháp lý.*" } },
    { id: "evidence-termination", type: "evidence", props: { claimId: "c-termination", evidenceIds: ["ev-term-a", "ev-term-b"] } },
    { id: "evidence-deposit", type: "evidence", props: { claimId: "c-deposit", evidenceIds: ["ev-deposit"] } },
    { id: "sources", type: "source", props: { sourceIds: [SOURCE_ID] } },
    { id: "report", type: "report-section", props: { title: "Tóm tắt hợp đồng", blockIds: ["md-summary", "evidence-termination", "evidence-deposit"] } },
  ];
  return {
    label: `${documentMeta.manifest.title} — dữ liệu demo tổng hợp`,
    view: { runId: `demo-${documentMeta.id}`, revision: 1, title: "Hợp đồng thuê căn hộ", status: "completed", blocks },
    snapshot: { id: `demo-${documentMeta.id}`, workspaceId: "workspace-demo", domainId: documentMeta.id, domainVersion: 1, input: { fileName: "hop-dong-thue-can-ho.pdf", documentType: "lease", checks: ["missing-clauses", "fairness"] }, status: "completed", revision: 1, deadlineAt: null, steps: [], artifacts: [], warnings: ["Dữ liệu tổng hợp; engine chưa chạy."] },
    sources: [sourceRef(SOURCE_ID, "upload", "hop-dong-thue-can-ho.pdf (bản mẫu tổng hợp)")],
    evidence, claims,
    datasets: {
      [FIELDS_DATASET]: {
        datasetId: FIELDS_DATASET,
        columns: [{ key: "field", type: "string", nullable: false }, { key: "value", type: "string", nullable: true }, { key: "page", type: "number", nullable: true }, { key: "confidence", type: "number", nullable: true, unit: "%" }, { key: "evidenceId", type: "string", nullable: true }],
        rows: fieldRows.map(([id, field, value, page, confidence, evidenceId]) => ({ id, values: { field, value, page: page || null, confidence: confidence || null, evidenceId: evidenceId || null } })),
        total: fieldRows.length, offset: 0, limit: fieldRows.length,
      },
    },
  };
}

export function documentFixture(state: DemoState): TemplateFixture<DocumentExtras> {
  const bundle = deriveState(success(), state, {
    stepIds: documentMeta.steps.map(step => step.id),
    progressBlockId: "progress",
    error: { stepIndex: 0, code: "document_unreadable", title: "Không đọc được tài liệu", message: "Tệp PDF là ảnh quét không có lớp chữ. Hãy tải bản có thể chọn văn bản, hoặc chờ năng lực OCR được bật." },
    partial: { stepIndex: 3, code: "evidence_linking_timeout", dropBlockIds: ["verdict-renewal", "verdict-refund", "verdict-balanced", "verdict-maintenance"], title: "Chưa kiểm tra xong điều khoản", message: "Bước liên kết bằng chứng hết thời gian; các trường đã trích xuất vẫn dùng được, nhưng danh sách kiểm tra điều khoản chưa có." },
    unavailableMessage: "Năng lực đọc PDF/DOCX và trích xuất theo schema chưa được bật trên nền tảng.",
  });
  const hasDocument = bundle.view.status === "completed" || bundle.view.status === "partial";
  return {
    bundle,
    extras: {
      document: hasDocument && bundle.view.blocks.length ? buildDocument() : null,
      evidenceTone: { "ev-deposit": "warning", "ev-term-a": "warning", "ev-term-b": "critical" },
    },
  };
}
