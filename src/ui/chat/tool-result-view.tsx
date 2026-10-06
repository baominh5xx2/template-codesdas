import type { ReactElement } from "react";
import type { JsonValue } from "@/contracts/common";

const PREVIEW_CHARS = 1200;
const PREVIEW_FIELDS = 20;
const PREVIEW_DEPTH = 6;
type BudgetOutput = { currency: string; totalMinor: number; remainingMinor: number; overBudget: boolean; itemCount: number };

function isBudgetOutput(output: JsonValue): output is BudgetOutput {
  if (!output || typeof output !== "object" || Array.isArray(output)) return false;
  return typeof output.currency === "string" && /^[A-Z]{3}$/.test(output.currency)
    && typeof output.totalMinor === "number" && Number.isSafeInteger(output.totalMinor) && output.totalMinor >= 0
    && typeof output.remainingMinor === "number" && Number.isSafeInteger(output.remainingMinor)
    && typeof output.overBudget === "boolean"
    && typeof output.itemCount === "number" && Number.isInteger(output.itemCount) && output.itemCount >= 0 && output.itemCount <= 100;
}

function boundedPreview(output: JsonValue): { text: string; truncated: boolean } {
  let text = "";
  let truncated = false;
  let fields = 0;
  const append = (value: string) => {
    const remaining = PREVIEW_CHARS - text.length;
    if (value.length > remaining) truncated = true;
    text += value.slice(0, remaining);
  };
  const quoted = (value: string) => {
    const remaining = PREVIEW_CHARS - text.length;
    if (value.length > remaining) truncated = true;
    append(JSON.stringify(value.slice(0, remaining)));
  };
  const visit = (value: JsonValue, depth: number): void => {
    if (text.length >= PREVIEW_CHARS) { truncated = true; return; }
    if (typeof value === "string") { quoted(value); return; }
    if (value === null || typeof value !== "object") { append(JSON.stringify(value)); return; }
    if (depth >= PREVIEW_DEPTH) { truncated = true; append("…"); return; }
    const array = Array.isArray(value);
    append(array ? "[" : "{");
    let first = true;
    for (const key in value) {
      if (!Object.hasOwn(value, key)) continue;
      if (fields >= PREVIEW_FIELDS || text.length >= PREVIEW_CHARS) { truncated = true; break; }
      fields++;
      if (!first) append(",");
      append(`\n${"  ".repeat(depth + 1)}`);
      if (!array) { quoted(key); append(": "); }
      visit(array ? value[Number(key)] : value[key], depth + 1);
      first = false;
    }
    if (!first) append(`\n${"  ".repeat(depth)}`);
    append(array ? "]" : "}");
  };
  visit(output, 0);
  return { text, truncated };
}

/** Receives only the adapter's validated business output, never raw MCP content. */
export function ToolResultView({ name, version, output }: { name: string; version: string; output: JsonValue }): ReactElement {
  if (name === "calculate_budget" && version === "1.0.0" && isBudgetOutput(output)) {
    const amount = (value: number) => `${new Intl.NumberFormat("vi-VN").format(value)} ${output.currency}`;
    return (
      <div className="chat-tool-result">
        <dl className="chat-tool-fields">
          <div><dt>Tổng chi</dt><dd>{amount(output.totalMinor)}</dd></div>
          <div><dt>Còn lại</dt><dd>{amount(output.remainingMinor)}</dd></div>
          <div><dt>Số khoản chi</dt><dd>{output.itemCount}</dd></div>
        </dl>
        <p>{output.overBudget ? "Vượt ngân sách" : "Trong ngân sách"}</p>
        <small>Số tiền theo đơn vị nhỏ nhất của {output.currency}.</small>
      </div>
    );
  }
  const { text, truncated } = boundedPreview(output);
  return (
    <div className="chat-tool-result">
      <pre>{text}{truncated ? "…" : ""}</pre>
      {truncated && <small>Bản xem trước đã rút gọn</small>}
    </div>
  );
}
