import type { UIBlock } from "@/contracts/ui/blocks";
import type { ResultBundle } from "./blocks/context";
import { formatValue } from "./format";

export function downloadText(filename: string, content: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: `${mime};charset=utf-8` }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** Serialises a ResultView into a readable Markdown report, keeping claim and source references. */
export function viewToMarkdown(bundle: ResultBundle): string {
  const claims = new Map(bundle.claims.map(claim => [claim.id, claim]));
  const sources = new Map(bundle.sources.map(source => [source.id, source]));
  const claimLines = (ids: string[]) => ids.map(id => claims.get(id)).filter(Boolean).map(claim => `- ${claim!.text}`);
  const lines: string[] = [`# ${bundle.view.title}`, ""];
  if (bundle.label) lines.push(`> ${bundle.label}`, "");
  const render = (block: UIBlock): string[] => {
    switch (block.type) {
      case "metric": return [`- **${block.props.label}:** ${formatValue(block.props.value, block.props.unit)}`];
      case "insight": return [`### ${block.props.title}`, ...claimLines(block.props.claimIds), ""];
      case "recommendation": return [`### Khuyến nghị: ${block.props.title} (${block.props.priority})`, ...claimLines(block.props.reasonClaimIds), ""];
      case "warning": return [`> **${block.props.title}:** ${block.props.message}`, ""];
      case "risk": return [`### Điểm rủi ro: ${block.props.score ?? "chưa đủ dữ liệu"} / ${block.props.max} (${block.props.level})`, `Phương pháp: ${block.props.method}`, ...claimLines(block.props.factorIds), ""];
      case "verdict": return [`- ${claims.get(block.props.claimId)?.text ?? block.props.claimId} — **${block.props.support}**: ${block.props.reason}`];
      case "markdown": return [block.props.content, ""];
      case "timeline": return block.props.items.map(item => `- ${item.at ? `${item.at} — ` : ""}${item.title}${item.description ? `: ${item.description}` : ""}`);
      case "comparison": return [
        `| Tiêu chí | ${block.props.options.map(option => option.label).join(" | ")} |`,
        `|---|${block.props.options.map(() => "---").join("|")}|`,
        ...block.props.criteria.map(criterion => `| ${criterion.label} | ${block.props.options.map(option => formatValue(option.values[criterion.key], criterion.unit)).join(" | ")} |`),
        "",
      ];
      case "source": return block.props.sourceIds.map(id => sources.get(id)).filter(Boolean).map(source => `- ${source!.title}${source!.url ? ` — ${source!.url}` : ""}`);
      case "report-section": return [`## ${block.props.title}`, ""];
      default: return [];
    }
  };
  for (const block of bundle.view.blocks) lines.push(...render(block));
  if (bundle.sources.length) {
    lines.push("", "## Nguồn", ...bundle.sources.map(source => `- ${source.title}${source.url ? ` — ${source.url}` : ""}`));
  }
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}
