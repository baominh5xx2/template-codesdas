"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { Artifact } from "@/contracts/artifacts";
import type { DatasetPage } from "@/contracts/datasets";
import type { Claim, Evidence } from "@/contracts/evidence";
import type { RunSnapshot } from "@/contracts/runs";
import type { SourceRef } from "@/contracts/sources";
import type { UIBlock } from "@/contracts/ui/blocks";
import type { ResultView } from "@/contracts/ui/result-view";
import { downloadText, viewToMarkdown } from "../export";

export type ActionId = Extract<UIBlock, { type: "action" }>["props"]["actionId"];
export const ACTION_ALLOWLIST: readonly ActionId[] = ["export.markdown", "export.json", "retry-run", "focus-artifact"];

/** The data a template hands to the renderer: a ResultView plus the shared reference data it points into. */
export type ResultBundle = {
  label?: string;
  view: ResultView;
  snapshot: RunSnapshot;
  sources: SourceRef[];
  evidence: Evidence[];
  claims: Claim[];
  datasets: Record<string, DatasetPage>;
};

/** Handoff shape from docs/frontend-handoff.md. */
export type BlockRenderContext = {
  snapshot: RunSnapshot;
  sources: SourceRef[];
  evidence: Evidence[];
  claims: Claim[];
  datasets: Record<string, DatasetPage>;
  artifacts: Artifact<unknown>[];
  onAction: (actionId: ActionId, artifactId?: string) => void;
};

export type InspectTarget = { kind: "source" | "evidence" | "claim"; id: string };

type ResultContextValue = BlockRenderContext & {
  bundle: ResultBundle;
  blocksById: Map<string, UIBlock>;
  inspected: InspectTarget | null;
  inspect: (target: InspectTarget | null) => void;
  focusedBlockId: string | null;
  focusBlock: (id: string | null) => void;
  claim: (id: string) => Claim | undefined;
  source: (id: string) => SourceRef | undefined;
  evidenceById: (id: string) => Evidence | undefined;
  /** Stable 1-based citation number per evidence item, for inline [n] markers. */
  citation: (evidenceId: string) => number;
  /** Human label for a dataset column key; templates may supply translations. */
  columnLabel: (key: string) => string;
  /** Human label for a workflow step ID. */
  stepLabel: (id: string) => string;
};

const ResultContext = createContext<ResultContextValue | null>(null);

export function useResult(): ResultContextValue {
  const value = useContext(ResultContext);
  if (!value) throw new Error("useResult must be used inside <ResultProvider>");
  return value;
}

export function ResultProvider({ bundle, datasets, columnLabels, stepLabels, onRetry, children }: { bundle: ResultBundle; datasets?: Record<string, DatasetPage>; columnLabels?: Record<string, string>; stepLabels?: Record<string, string>; onRetry?: () => void; children: ReactNode }) {
  const [inspected, inspect] = useState<InspectTarget | null>(null);
  const [focusedBlockId, focusBlock] = useState<string | null>(null);

  const onAction = useCallback((actionId: ActionId, artifactId?: string) => {
    if (!ACTION_ALLOWLIST.includes(actionId)) return;
    if (actionId === "export.json") downloadText(`${bundle.view.runId}.json`, JSON.stringify(bundle, null, 2), "application/json");
    else if (actionId === "export.markdown") downloadText(`${bundle.view.runId}.md`, viewToMarkdown(bundle), "text/markdown");
    else if (actionId === "retry-run") onRetry?.();
    else if (actionId === "focus-artifact" && artifactId) {
      focusBlock(artifactId);
      document.querySelector(`[data-block-id="${CSS.escape(artifactId)}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [bundle, onRetry]);

  const value = useMemo<ResultContextValue>(() => {
    const blocksById = new Map(bundle.view.blocks.map(block => [block.id, block]));
    const claims = new Map(bundle.claims.map(item => [item.id, item]));
    const sources = new Map(bundle.sources.map(item => [item.id, item]));
    const evidence = new Map(bundle.evidence.map(item => [item.id, item]));
    const order = new Map(bundle.evidence.map((item, index) => [item.id, index + 1]));
    return {
      bundle,
      snapshot: bundle.snapshot,
      sources: bundle.sources,
      evidence: bundle.evidence,
      claims: bundle.claims,
      datasets: datasets ?? bundle.datasets,
      artifacts: bundle.snapshot.artifacts,
      onAction,
      blocksById,
      inspected,
      inspect,
      focusedBlockId,
      focusBlock,
      claim: id => claims.get(id),
      source: id => sources.get(id),
      evidenceById: id => evidence.get(id),
      citation: id => order.get(id) ?? 0,
      columnLabel: key => columnLabels?.[key] ?? key,
      stepLabel: id => stepLabels?.[id] ?? id,
    };
  }, [bundle, datasets, columnLabels, stepLabels, onAction, inspected, focusedBlockId]);

  return <ResultContext.Provider value={value}>{children}</ResultContext.Provider>;
}
