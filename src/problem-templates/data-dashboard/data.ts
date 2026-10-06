import { z } from "zod";
import type { ColumnSpec, DataRow, DatasetPage } from "@/contracts/datasets";
import type { UIBlock } from "@/contracts/ui/blocks";

export const DashboardInputSchema = z.object({
  fileName: z.string().regex(/\.(csv|xlsx)$/i, "Chỉ nhận tệp .csv hoặc .xlsx"),
  measures: z.array(z.enum(["visitors", "revenue", "avgStay"])).min(1, "Chọn ít nhất một chỉ số"),
  question: z.string().max(500).optional(),
});
export type DashboardInput = z.infer<typeof DashboardInputSchema>;

export const DATASET_ID = "tourism-monthly-2025";
export const SOURCE_ID = "source-tourism-xlsx";
export const MONTHS = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12"] as const;
export const SEGMENTS = ["Nội địa", "Quốc tế"] as const;
export type Segment = (typeof SEGMENTS)[number];

export const COLUMN_LABELS: Record<string, string> = { month: "Tháng", quarter: "Quý", segment: "Phân khúc", visitors: "Lượt khách", revenue: "Doanh thu", avgStay: "Số đêm TB" };

const columns: ColumnSpec[] = [
  { key: "month", type: "string", nullable: false },
  { key: "quarter", type: "string", nullable: false },
  { key: "segment", type: "string", nullable: false },
  { key: "visitors", type: "number", nullable: false, unit: "lượt" },
  { key: "revenue", type: "number", nullable: false, unit: "tỷ VND" },
  { key: "avgStay", type: "number", nullable: false, unit: "đêm" },
];

// Synthetic, hand-shaped seasonality (thousand visitors) — not real statistics.
const DOMESTIC = [520, 610, 580, 640, 720, 910, 980, 940, 610, 560, 530, 600];
const INTERNATIONAL = [310, 340, 300, 260, 220, 200, 230, 240, 210, 280, 330, 360];
const SPEND = { "Nội địa": 2.1e6, "Quốc tế": 5.4e6 } as const;
const STAY = { "Nội địa": [2.1, 2.3, 2.0, 2.2, 2.4, 2.8, 3.0, 2.9, 2.1, 2.0, 2.0, 2.3], "Quốc tế": [3.6, 3.8, 3.5, 3.3, 3.1, 3.0, 3.2, 3.3, 3.1, 3.4, 3.7, 3.9] } as const;

export function buildRows(): DataRow[] {
  return MONTHS.flatMap((month, index) => SEGMENTS.map(segment => {
    const visitors = (segment === "Nội địa" ? DOMESTIC : INTERNATIONAL)[index] * 1000;
    return { id: `${month}-${segment === "Nội địa" ? "dom" : "intl"}`, values: { month, quarter: `Q${Math.floor(index / 3) + 1}`, segment, visitors, revenue: Math.round((visitors * SPEND[segment]) / 1e9), avgStay: STAY[segment][index] } };
  }));
}

export function datasetPage(rows: DataRow[]): DatasetPage {
  return { datasetId: DATASET_ID, columns, rows, total: rows.length, offset: 0, limit: Math.max(1, rows.length) };
}

const num = (row: DataRow, key: string) => (typeof row.values[key] === "number" ? (row.values[key] as number) : 0);
const sum = (rows: DataRow[], key: string) => rows.reduce((total, row) => total + num(row, key), 0);

/** Deterministic KPI calculation shared by the fixture presenter and the client-side filters. */
export function computeKpis(rows: DataRow[]) {
  const visitors = sum(rows, "visitors");
  const revenue = sum(rows, "revenue");
  const intl = rows.filter(row => row.values.segment === "Quốc tế");
  const stayWeighted = visitors ? rows.reduce((total, row) => total + num(row, "avgStay") * num(row, "visitors"), 0) / visitors : null;
  const byMonth = new Map<string, number>();
  for (const row of rows) byMonth.set(String(row.values.month), (byMonth.get(String(row.values.month)) ?? 0) + num(row, "visitors"));
  const peak = [...byMonth.entries()].sort((a, b) => b[1] - a[1])[0];
  return {
    visitors, revenue,
    intlVisitorShare: visitors ? sum(intl, "visitors") / visitors : null,
    intlRevenueShare: revenue ? sum(intl, "revenue") / revenue : null,
    avgStay: stayWeighted === null ? null : Math.round(stayWeighted * 100) / 100,
    peakMonth: peak?.[0] ?? null, peakVisitors: peak?.[1] ?? 0,
    byMonth,
  };
}

/** Pure presenter for the KPI row. Year-over-year deltas only apply to the unfiltered dataset. */
export function kpiBlocks(rows: DataRow[], withDelta = true): UIBlock[] {
  const k = computeKpis(rows);
  const delta = (value: number) => (withDelta ? { delta: value } : {});
  return [
    { id: "metric-visitors", type: "metric", props: { label: "Tổng lượt khách", value: k.visitors || null, unit: "lượt", ...delta(0.082), sourceIds: [SOURCE_ID] } },
    { id: "metric-revenue", type: "metric", props: { label: "Tổng doanh thu", value: k.revenue || null, unit: "tỷ VND", ...delta(0.114), sourceIds: [SOURCE_ID] } },
    { id: "metric-intl-share", type: "metric", props: { label: "Tỷ trọng khách quốc tế", value: k.intlVisitorShare === null ? null : Math.round(k.intlVisitorShare * 1000) / 10, unit: "%", sourceIds: [SOURCE_ID] } },
    { id: "metric-stay", type: "metric", props: { label: "Số đêm lưu trú TB", value: k.avgStay, unit: "đêm", ...delta(-0.03), sourceIds: [SOURCE_ID] } },
  ];
}
