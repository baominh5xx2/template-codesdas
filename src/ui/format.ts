const numberFormat = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });
const compactFormat = new Intl.NumberFormat("vi-VN", { notation: "compact", maximumFractionDigits: 1 });

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return numberFormat.format(value);
}

export function formatCompact(value: number): string {
  return Math.abs(value) >= 10_000 ? compactFormat.format(value) : numberFormat.format(value);
}

/** Formatted by hand: Intl percent output differs between Node and browsers (spacing), breaking hydration. */
export function formatPercent(ratio: number): string {
  const value = Math.round(ratio * 1000) / 10;
  return `${String(value).replace(".", ",")}%`;
}

export function formatValue(value: string | number | boolean | null | undefined, unit?: string): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Có" : "Không";
  if (typeof value === "number") return unit === "%" ? `${formatNumber(value)}%` : unit ? `${formatNumber(value)} ${unit}` : formatNumber(value);
  return value;
}

export function formatDateTime(iso: string | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: iso.includes("T") ? "short" : undefined, timeZone: "Asia/Ho_Chi_Minh" }).format(date);
}
