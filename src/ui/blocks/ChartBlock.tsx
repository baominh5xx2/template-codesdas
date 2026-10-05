"use client";

import { useMemo, useState } from "react";
import type { DataRow } from "@/contracts/datasets";
import type { UIBlock } from "@/contracts/ui/blocks";
import { Badge, EmptyState } from "../primitives";
import { formatCompact, formatValue } from "../format";
import { useResult } from "./context";

type ChartProps = Extract<UIBlock, { type: "chart" }>["props"];
type Point = { x: string | number; values: Record<string, number | null> };

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-6)"];
const W = 640, H = 300, PAD = { top: 16, right: 16, bottom: 36, left: 56 };
const AGGREGATION_LABEL = { none: "", sum: "Tổng", mean: "Trung bình", count: "Đếm" } as const;

/** Applies the declared aggregation over the dataset rows, grouping by xKey in first-seen order. */
export function aggregate(rows: DataRow[], props: Pick<ChartProps, "xKey" | "series" | "aggregation">): Point[] {
  const numeric = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);
  if (props.aggregation === "none") {
    return rows.map(row => ({ x: (row.values[props.xKey] ?? "—") as string | number, values: Object.fromEntries(props.series.map(s => [s.key, numeric(row.values[s.key])])) }));
  }
  const groups = new Map<string | number, DataRow[]>();
  for (const row of rows) {
    const key = (row.values[props.xKey] ?? "—") as string | number;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.entries()].map(([x, group]) => ({
    x,
    values: Object.fromEntries(props.series.map(s => {
      const nums = group.map(row => numeric(row.values[s.key])).filter((v): v is number => v !== null);
      if (props.aggregation === "count") return [s.key, group.length];
      if (!nums.length) return [s.key, null];
      const sum = nums.reduce((a, b) => a + b, 0);
      return [s.key, props.aggregation === "sum" ? sum : sum / nums.length];
    })),
  }));
}

function niceMax(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find(m => m * magnitude >= value)!;
  return step * magnitude;
}

export function ChartBlock({ props }: { props: ChartProps }) {
  const { datasets, columnLabel } = useResult();
  const page = datasets[props.datasetId];
  const points = useMemo(() => (page ? aggregate(page.rows, props) : []), [page, props]);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const series = props.series.filter(s => !hidden.has(s.key));
  if (!page) return <EmptyState icon="bar-chart" title="Không tìm thấy dữ liệu biểu đồ">Bộ dữ liệu “{props.datasetId}” không có trong kết quả.</EmptyState>;
  if (!points.length) return <EmptyState icon="bar-chart" title="Không có dòng dữ liệu phù hợp">Thử bỏ bớt bộ lọc để xem lại biểu đồ.</EmptyState>;
  const toggle = (key: string) => setHidden(prev => { const next = new Set(prev); if (next.has(key)) next.delete(key); else if (next.size < props.series.length - 1) next.add(key); return next; });

  return <figure style={{ margin: 0, display: "grid", gap: 12 }}>
    {props.kind === "pie" ? <PieChart points={points} props={props} /> : props.kind === "scatter" ? <ScatterChart points={points} props={props} /> : <CartesianChart points={points} props={props} series={series} />}
    <figcaption className="vn-row vn-row--between">
      {props.kind !== "pie" ? <div className="vn-legend" role="group" aria-label="Chú giải">
        {props.series.map((s, index) => <button key={s.key} type="button" className="vn-legend__item" style={{ all: "unset", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, opacity: hidden.has(s.key) ? 0.4 : 1 }} onClick={() => toggle(s.key)} aria-pressed={!hidden.has(s.key)}>
          <span className="vn-legend__swatch" style={{ background: COLORS[index % COLORS.length] }} />{s.label}{s.unit ? ` (${s.unit})` : ""}
        </button>)}
      </div> : <span />}
      {props.aggregation !== "none" ? <Badge>{AGGREGATION_LABEL[props.aggregation]} theo {columnLabel(props.xKey).toLowerCase()}</Badge> : null}
    </figcaption>
  </figure>;
}

function useTip() {
  const [tip, setTip] = useState<{ x: number; y: number; lines: string[] } | null>(null);
  const node = tip ? <div className="vn-chart-tip" style={{ left: `${(tip.x / W) * 100}%`, top: `${(tip.y / H) * 100}%` }}>{tip.lines.map((line, i) => <div key={i} style={i === 0 ? { fontWeight: 700 } : undefined}>{line}</div>)}</div> : null;
  return { setTip, node };
}

function CartesianChart({ points, props, series }: { points: Point[]; props: ChartProps; series: ChartProps["series"] }) {
  const { setTip, node } = useTip();
  const max = niceMax(Math.max(0, ...points.flatMap(p => series.map(s => p.values[s.key] ?? 0))));
  const innerW = W - PAD.left - PAD.right, innerH = H - PAD.top - PAD.bottom;
  const band = innerW / points.length;
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
  const xCenter = (i: number) => PAD.left + band * i + band / 2;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(t => t * max);
  const labelEvery = Math.ceil(points.length / 12);
  const colorOf = (key: string) => COLORS[props.series.findIndex(s => s.key === key) % COLORS.length];
  const tipLines = (p: Point) => [String(p.x), ...series.map(s => `${s.label}: ${formatValue(p.values[s.key], s.unit)}`)];

  return <div style={{ position: "relative" }}>
    <svg className="vn-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${props.title}: biểu đồ ${props.kind}`} onMouseLeave={() => setTip(null)}>
      {ticks.map(t => <g key={t}>
        <line className="vn-chart__grid" x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} />
        <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end">{formatCompact(t)}</text>
      </g>)}
      <line className="vn-chart__axis" x1={PAD.left} x2={W - PAD.right} y1={y(0)} y2={y(0)} />
      {points.map((p, i) => i % labelEvery === 0 ? <text key={i} x={xCenter(i)} y={H - 12} textAnchor="middle">{String(p.x)}</text> : null)}
      {props.kind === "bar" ? points.map((p, i) => {
        const groupW = band * 0.7, barW = groupW / Math.max(1, series.length);
        return <g key={i} onMouseEnter={() => setTip({ x: xCenter(i), y: y(Math.max(...series.map(s => p.values[s.key] ?? 0))), lines: tipLines(p) })}>
          <rect x={PAD.left + band * i} y={PAD.top} width={band} height={innerH} fill="transparent" />
          {series.map((s, j) => {
            const v = p.values[s.key];
            if (v === null) return null;
            return <rect key={s.key} className="vn-chart__bar" x={xCenter(i) - groupW / 2 + j * barW + 1} y={y(v)} width={Math.max(2, barW - 2)} height={Math.max(0, y(0) - y(v))} rx={4} fill={colorOf(s.key)} />;
          })}
        </g>;
      }) : <>
        {series.map(s => {
          const coords = points.map((p, i) => [xCenter(i), p.values[s.key] === null ? null : y(p.values[s.key]!)] as const).filter((c): c is readonly [number, number] => c[1] !== null);
          if (!coords.length) return null;
          const line = coords.map(([cx, cy], i) => `${i ? "L" : "M"}${cx},${cy}`).join(" ");
          const color = colorOf(s.key);
          return <g key={s.key}>
            {props.kind === "area" ? <path d={`${line} L${coords.at(-1)![0]},${y(0)} L${coords[0][0]},${y(0)} Z`} fill={color} opacity={0.14} /> : null}
            <path d={line} fill="none" stroke={color} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
            {coords.map(([cx, cy], i) => <circle key={i} cx={cx} cy={cy} r={4} fill="#fff" stroke={color} strokeWidth={2} />)}
          </g>;
        })}
        {points.map((p, i) => <rect key={i} x={PAD.left + band * i} y={PAD.top} width={band} height={innerH} fill="transparent" onMouseEnter={() => setTip({ x: xCenter(i), y: y(Math.max(...series.map(s => p.values[s.key] ?? 0))), lines: tipLines(p) })} />)}
      </>}
    </svg>
    {node}
  </div>;
}

function PieChart({ points, props }: { points: Point[]; props: ChartProps }) {
  const { setTip, node } = useTip();
  const key = props.series[0]?.key;
  const slices = points.map(p => ({ label: String(p.x), value: Math.max(0, p.values[key] ?? 0) })).filter(s => s.value > 0);
  const total = slices.reduce((a, s) => a + s.value, 0);
  const cx = 150, cy = H / 2, r = 120, inner = 72;
  // Cumulative slice angles, computed up front (no mutation during render).
  const bounds = slices.reduce<Array<[number, number]>>((acc, s) => {
    const start = acc.length ? acc[acc.length - 1][1] : -Math.PI / 2;
    return [...acc, [start, start + (s.value / total) * Math.PI * 2]];
  }, []);
  const arc = (start: number, end: number) => {
    const large = end - start > Math.PI ? 1 : 0;
    const p = (a: number, rad: number) => `${cx + rad * Math.cos(a)},${cy + rad * Math.sin(a)}`;
    return `M${p(start, r)} A${r},${r} 0 ${large} 1 ${p(end, r)} L${p(end, inner)} A${inner},${inner} 0 ${large} 0 ${p(start, inner)} Z`;
  };
  return <div style={{ position: "relative" }}>
    <svg className="vn-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${props.title}: biểu đồ tròn`} onMouseLeave={() => setTip(null)}>
      {slices.map((s, i) => {
        const [start, rawEnd] = bounds[i];
        const end = rawEnd - 0.0001;
        const mid = (start + end) / 2;
        return <path key={s.label} d={arc(start, end)} fill={COLORS[i % COLORS.length]} stroke="#fff" strokeWidth={2} onMouseEnter={() => setTip({ x: cx + r * Math.cos(mid), y: cy + r * Math.sin(mid), lines: [s.label, `${formatValue(s.value, props.series[0]?.unit)} · ${((s.value / total) * 100).toFixed(1)}%`] })} />;
      })}
      <text x={cx} y={cy - 4} textAnchor="middle" style={{ font: "800 26px var(--font-sans)", fill: "var(--text-strong)" }}>{formatCompact(total)}</text>
      <text x={cx} y={cy + 18} textAnchor="middle">{props.series[0]?.label ?? "Tổng"}</text>
      {slices.map((s, i) => <g key={s.label} transform={`translate(320, ${40 + i * 30})`}>
        <rect width={14} height={14} rx={3} fill={COLORS[i % COLORS.length]} />
        <text x={24} y={12} style={{ fill: "var(--text-strong)", fontSize: 14 }}>{s.label}</text>
        <text x={290} y={12} textAnchor="end" style={{ fill: "var(--text-muted)", fontSize: 14 }}>{((s.value / total) * 100).toFixed(1)}%</text>
      </g>)}
    </svg>
    {node}
  </div>;
}

function ScatterChart({ points, props }: { points: Point[]; props: ChartProps }) {
  const { setTip, node } = useTip();
  const [sx, sy] = props.series;
  const data = points.map(p => ({ label: String(p.x), x: sx ? p.values[sx.key] : null, y: sy ? p.values[sy.key] : sx ? p.values[sx.key] : null }))
    .filter((d): d is { label: string; x: number; y: number } => d.x !== null && d.y !== null);
  const maxX = niceMax(Math.max(0, ...data.map(d => d.x))), maxY = niceMax(Math.max(0, ...data.map(d => d.y)));
  const innerW = W - PAD.left - PAD.right, innerH = H - PAD.top - PAD.bottom;
  const px = (v: number) => PAD.left + (v / maxX) * innerW, py = (v: number) => PAD.top + innerH - (v / maxY) * innerH;
  return <div style={{ position: "relative" }}>
    <svg className="vn-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${props.title}: biểu đồ phân tán`} onMouseLeave={() => setTip(null)}>
      {[0, 0.5, 1].map(t => <g key={t}>
        <line className="vn-chart__grid" x1={PAD.left} x2={W - PAD.right} y1={py(t * maxY)} y2={py(t * maxY)} />
        <text x={PAD.left - 8} y={py(t * maxY) + 4} textAnchor="end">{formatCompact(t * maxY)}</text>
        <text x={px(t * maxX)} y={H - 12} textAnchor="middle">{formatCompact(t * maxX)}</text>
      </g>)}
      {data.map(d => <circle key={d.label} cx={px(d.x)} cy={py(d.y)} r={7} fill="var(--chart-1)" fillOpacity={0.75} stroke="#fff" strokeWidth={2}
        onMouseEnter={() => setTip({ x: px(d.x), y: py(d.y), lines: [d.label, `${sx?.label}: ${formatValue(d.x, sx?.unit)}`, `${sy?.label}: ${formatValue(d.y, sy?.unit)}`] })} />)}
    </svg>
    {node}
  </div>;
}
