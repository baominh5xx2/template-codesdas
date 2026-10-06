import type { UIBlock } from "@/contracts/ui/blocks";
import type { DemoBundle, DemoState } from "@/demo/schemas";
import { deriveState, sourceRef } from "../fixture-states";
import type { TemplateFixture } from "../types";
import { dashboardMeta } from "./manifest.client";
import { buildRows, computeKpis, datasetPage, DATASET_ID, kpiBlocks, SOURCE_ID } from "./data";

const fmt = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 });
const pct = (ratio: number) => `${fmt.format(ratio * 100)}%`;

function success(): DemoBundle {
  const rows = buildRows();
  const k = computeKpis(rows);
  const summer = ["T6", "T7", "T8"].reduce((t, m) => t + (k.byMonth.get(m) ?? 0), 0);
  const autumn = ["T9", "T10", "T11"].reduce((t, m) => t + (k.byMonth.get(m) ?? 0), 0);
  const drop = 1 - autumn / summer;
  const rowIndex = (id: string) => rows.findIndex(row => row.id === id) + 1;
  const evidence = [
    { id: "ev-peak-dom", sourceId: SOURCE_ID, locator: { type: "table" as const, sheet: "2025", row: rowIndex("T7-dom"), column: "visitors" }, excerpt: "T7 · Nội địa · 980.000 lượt khách" },
    { id: "ev-peak-intl", sourceId: SOURCE_ID, locator: { type: "table" as const, sheet: "2025", row: rowIndex("T7-intl"), column: "visitors" }, excerpt: "T7 · Quốc tế · 230.000 lượt khách" },
    { id: "ev-intl-rev", sourceId: SOURCE_ID, locator: { type: "table" as const, sheet: "2025", row: rowIndex("T12-intl"), column: "revenue" }, excerpt: "T12 · Quốc tế · 360.000 lượt · 1.944 tỷ VND" },
    { id: "ev-autumn", sourceId: SOURCE_ID, locator: { type: "table" as const, sheet: "2025", row: rowIndex("T10-dom"), column: "visitors" }, excerpt: "T10 · Nội địa · 560.000 lượt khách" },
    { id: "ev-stay", sourceId: SOURCE_ID, locator: { type: "table" as const, sheet: "2025", row: rowIndex("T12-intl"), column: "avgStay" }, excerpt: "T12 · Quốc tế · 3,9 đêm lưu trú trung bình" },
  ];
  const claims = [
    { id: "claim-peak", text: `${k.peakMonth} là tháng cao điểm với ${fmt.format(k.peakVisitors)} lượt khách (nội địa + quốc tế).`, kind: "calculation" as const, evidenceIds: ["ev-peak-dom", "ev-peak-intl"], support: "supported" as const },
    { id: "claim-intl-value", text: `Khách quốc tế chỉ chiếm ${pct(k.intlVisitorShare!)} lượt khách nhưng đóng góp ${pct(k.intlRevenueShare!)} doanh thu.`, kind: "calculation" as const, evidenceIds: ["ev-intl-rev"], support: "supported" as const },
    { id: "claim-autumn-drop", text: `Lượt khách T9–T11 thấp hơn ${pct(drop)} so với T6–T8.`, kind: "calculation" as const, evidenceIds: ["ev-autumn", "ev-peak-dom"], support: "supported" as const },
    { id: "claim-intl-stay", text: "Khách quốc tế lưu trú lâu hơn rõ rệt vào các tháng cuối năm.", kind: "inference" as const, evidenceIds: ["ev-stay"], support: "supported" as const },
    { id: "claim-weather", text: "Mưa bão cuối năm có thể là nguyên nhân giảm khách nội địa — chưa có dữ liệu thời tiết để kiểm chứng.", kind: "inference" as const, evidenceIds: [], support: "insufficient" as const },
  ];
  const blocks: UIBlock[] = [
    ...kpiBlocks(rows),
    { id: "chart-visitors", type: "chart", props: { title: "Lượt khách theo tháng", kind: "bar", datasetId: DATASET_ID, xKey: "month", series: [{ key: "visitors", label: "Lượt khách", unit: "lượt" }], aggregation: "sum", sourceIds: [SOURCE_ID] } },
    { id: "chart-revenue", type: "chart", props: { title: "Doanh thu theo tháng", kind: "line", datasetId: DATASET_ID, xKey: "month", series: [{ key: "revenue", label: "Doanh thu", unit: "tỷ VND" }], aggregation: "sum", sourceIds: [SOURCE_ID] } },
    { id: "chart-segment", type: "chart", props: { title: "Cơ cấu khách theo phân khúc", kind: "pie", datasetId: DATASET_ID, xKey: "segment", series: [{ key: "visitors", label: "Lượt khách", unit: "lượt" }], aggregation: "sum", sourceIds: [SOURCE_ID] } },
    { id: "chart-stay", type: "chart", props: { title: "Số đêm lưu trú trung bình", kind: "area", datasetId: DATASET_ID, xKey: "month", series: [{ key: "avgStay", label: "Số đêm TB", unit: "đêm" }], aggregation: "mean", sourceIds: [SOURCE_ID] } },
    { id: "insight-peak", type: "insight", props: { title: "Mùa hè là đỉnh, mùa thu hụt mạnh", claimIds: ["claim-peak", "claim-autumn-drop"], severity: "warning" } },
    { id: "insight-intl", type: "insight", props: { title: "Khách quốc tế giá trị cao", claimIds: ["claim-intl-value", "claim-intl-stay"], severity: "info" } },
    { id: "insight-unverified", type: "insight", props: { title: "Giả thuyết chưa kiểm chứng", claimIds: ["claim-weather"], severity: "info" } },
    { id: "action-export-md", type: "action", props: { label: "Xuất báo cáo Markdown", actionId: "export.markdown" } },
    { id: "action-export-json", type: "action", props: { label: "Xuất JSON", actionId: "export.json" } },
    { id: "rec-low-season", type: "recommendation", props: { title: "Đẩy chiến dịch quốc tế cho T9–T11", reasonClaimIds: ["claim-autumn-drop", "claim-intl-value"], priority: "high", actionIds: ["action-export-md"] } },
    { id: "rec-long-stay", type: "recommendation", props: { title: "Thiết kế gói lưu trú dài ngày cho khách quốc tế", reasonClaimIds: ["claim-intl-stay"], priority: "medium", actionIds: [] } },
    { id: "table-rows", type: "table", props: { title: "Dữ liệu chi tiết", datasetId: DATASET_ID, columns: ["month", "segment", "visitors", "revenue", "avgStay"], pageSize: 8 } },
    { id: "md-summary", type: "markdown", props: { content: `### Tóm tắt\nNăm 2025 ghi nhận **${fmt.format(k.visitors)} lượt khách** và **${fmt.format(k.revenue)} tỷ VND** doanh thu (dữ liệu tổng hợp).\n\n- Đỉnh mùa: **${k.peakMonth}**.\n- Mùa thu giảm **${pct(drop)}** so với mùa hè.\n- Khách quốc tế: ${pct(k.intlVisitorShare!)} lượt, ${pct(k.intlRevenueShare!)} doanh thu.\n\n*Các con số được tính trực tiếp từ bảng dữ liệu, không qua mô hình ngôn ngữ.*` } },
    { id: "sources", type: "source", props: { sourceIds: [SOURCE_ID] } },
    { id: "report", type: "report-section", props: { title: "Báo cáo nhanh", blockIds: ["md-summary"] } },
  ];
  const meta = dashboardMeta;
  return {
    label: `${meta.manifest.title} — dữ liệu demo tổng hợp`,
    view: { runId: `demo-${meta.id}`, revision: 1, title: "Du lịch theo tháng, 2025", status: "completed", blocks },
    snapshot: { id: `demo-${meta.id}`, workspaceId: "workspace-demo", domainId: meta.id, domainVersion: 1, input: { fileName: "du-lich-2025.xlsx", measures: ["visitors", "revenue", "avgStay"], question: "Mùa nào thấp điểm và nên làm gì?" }, status: "completed", revision: 1, deadlineAt: null, steps: [], artifacts: [], warnings: ["Dữ liệu tổng hợp; engine chưa chạy."] },
    sources: [sourceRef(SOURCE_ID, "upload", "du-lich-2025.xlsx (dữ liệu tổng hợp)")],
    evidence, claims,
    datasets: { [DATASET_ID]: datasetPage(rows) },
  };
}

export function dashboardFixture(state: DemoState): TemplateFixture {
  const bundle = deriveState(success(), state, {
    stepIds: dashboardMeta.steps.map(step => step.id),
    progressBlockId: "progress",
    error: { stepIndex: 1, code: "schema_invalid", title: "Không nhận diện được cấu trúc bảng", message: "Cột “visitors” chứa giá trị không phải số ở dòng 14. Hãy sửa tệp rồi tải lại." },
    partial: { stepIndex: 4, code: "analysis_timeout", dropBlockIds: ["insight-intl", "insight-unverified", "rec-long-stay"], title: "Một phần nhận định chưa hoàn tất", message: "Bước rút nhận định hết thời gian; KPI, biểu đồ và bảng vẫn chính xác vì được tính trực tiếp." },
    unavailableMessage: "Năng lực đọc tệp CSV/XLSX (ingestion) chưa được bật trên nền tảng.",
  });
  return { bundle, extras: undefined };
}
