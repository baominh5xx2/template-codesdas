"use client";

import { useMemo, useState } from "react";
import type { UIBlock } from "@/contracts/ui/blocks";
import { Button, EmptyState, Icon } from "../primitives";
import { formatValue } from "../format";
import { useResult } from "./context";

type TableProps = Extract<UIBlock, { type: "table" }>["props"];

export function TableBlock({ props }: { props: TableProps }) {
  const { datasets, columnLabel } = useResult();
  const page = datasets[props.datasetId];
  const [offset, setOffset] = useState(0);
  const [sort, setSort] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);
  const rows = useMemo(() => {
    if (!page) return [];
    if (!sort) return page.rows;
    return [...page.rows].sort((a, b) => {
      const av = a.values[sort.key], bv = b.values[sort.key];
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av ?? "").localeCompare(String(bv ?? ""), "vi");
      return sort.direction === "asc" ? cmp : -cmp;
    });
  }, [page, sort]);
  if (!page) return <EmptyState icon="list" title="Không tìm thấy bảng dữ liệu">Bộ dữ liệu “{props.datasetId}” không có trong kết quả.</EmptyState>;
  const specs = new Map(page.columns.map(column => [column.key, column]));
  const total = rows.length;
  const safeOffset = Math.min(offset, Math.max(0, total - 1));
  const visible = rows.slice(safeOffset, safeOffset + props.pageSize);
  const toggleSort = (key: string) => setSort(prev => prev?.key !== key ? { key, direction: "desc" } : prev.direction === "desc" ? { key, direction: "asc" } : null);

  return <div className="vn-stack vn-stack--s">
    <div className="vn-table-wrap">
      <table className="vn-table">
        <thead><tr>{props.columns.map(key => {
          const spec = specs.get(key);
          const numeric = spec?.type === "number";
          return <th key={key} className={numeric ? "is-num" : undefined} aria-sort={sort?.key === key ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}>
            <button type="button" onClick={() => toggleSort(key)}>
              {columnLabel(key)}{spec?.unit ? <span className="vn-muted" style={{ fontWeight: 500 }}> ({spec.unit})</span> : null}
              <Icon name={sort?.key === key ? (sort.direction === "asc" ? "arrow-up" : "arrow-down") : "chevron-down"} size={14} style={{ opacity: sort?.key === key ? 1 : 0.35 }} />
            </button>
          </th>;
        })}</tr></thead>
        <tbody>
          {visible.length ? visible.map(row => <tr key={row.id}>{props.columns.map(key => {
            const spec = specs.get(key);
            return <td key={key} className={spec?.type === "number" ? "is-num" : undefined}>{formatValue(row.values[key], spec?.unit === "%" ? "%" : undefined)}</td>;
          })}</tr>) : <tr><td colSpan={props.columns.length} className="vn-muted" style={{ textAlign: "center", padding: 32 }}>Không có dòng nào khớp bộ lọc.</td></tr>}
        </tbody>
      </table>
    </div>
    <div className="vn-pager">
      <span>{total ? `Hiển thị ${safeOffset + 1}–${Math.min(total, safeOffset + props.pageSize)} trên ${total} dòng` : "0 dòng"}</span>
      <span className="vn-row" style={{ gap: 8 }}>
        <Button size="s" variant="secondary" iconLeft="chevron-left" disabled={safeOffset === 0} onClick={() => setOffset(Math.max(0, safeOffset - props.pageSize))}>Trước</Button>
        <Button size="s" variant="secondary" iconRight="chevron-right" disabled={safeOffset + props.pageSize >= total} onClick={() => setOffset(safeOffset + props.pageSize)}>Sau</Button>
      </span>
    </div>
  </div>;
}
