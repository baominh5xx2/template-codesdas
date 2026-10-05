import { expect, it } from "vitest";
import { getDemoBundle, DEMO_STATES } from "@/demo/catalog";
import { ResultViewSchema } from "@/contracts/ui/result-view";
import { DatasetPageSchema } from "@/contracts/datasets";
import { DEMO_DOMAINS } from "@/demo/data";

it("ships validated fixtures for all domain archetypes and UI block types", () => {
  for (const domain of DEMO_DOMAINS) {
    const bundle = getDemoBundle(domain.id, "success");
    expect(bundle.label).toContain("Demo");
    ResultViewSchema.parse(bundle.view);
    expect(new Set(bundle.view.blocks.map(({ type }) => type)).size).toBe(19);
    for (const block of bundle.view.blocks) {
      if (block.type === "chart" || block.type === "table") {
        expect(bundle.datasets[block.props.datasetId]).toBeDefined();
        expect(bundle.datasets[block.props.datasetId].columns.map(({ key }) => key)).toEqual(expect.arrayContaining(block.type === "chart" ? [block.props.xKey, ...block.props.series.map(({ key }) => key)] : block.props.columns));
      }
    }
    expect(bundle.sources.length).toBeGreaterThan(0);
  }
  expect(DEMO_STATES).toEqual(["loading", "empty", "error", "success", "partial", "unavailable"]);
});

it("returns JSON-safe loading, empty, error, partial and unavailable states", () => {
  for (const state of ["loading", "empty", "error", "partial", "unavailable"] as const) {
    const bundle = getDemoBundle("dataset-analysis", state);
    expect(ResultViewSchema.parse(bundle.view).status).toBe(state === "loading" ? "running" : state === "empty" ? "completed" : state === "error" ? "failed" : state === "partial" ? "partial" : "interrupted");
    expect(JSON.stringify(bundle)).toBeTruthy();
  }
});

it("preserves total row count and validates fixture dataset pages", () => {
  const bundle = getDemoBundle("dataset-analysis", "success");
  const page = DatasetPageSchema.parse(bundle.datasets["sales-quarterly"]);
  expect(page.total).toBe(page.rows.length);
  expect(page.offset).toBe(0);
});
