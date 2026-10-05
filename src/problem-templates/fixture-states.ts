import type { StepState } from "@/contracts/common";
import type { UIBlock } from "@/contracts/ui/blocks";
import type { DemoBundle, DemoState } from "@/demo/schemas";

export const FIXTURE_TIME = "2026-10-05T09:00:00.000Z";
const later = (seconds: number) => new Date(Date.parse(FIXTURE_TIME) + seconds * 1000).toISOString();

export function steps(ids: string[], status: (index: number) => StepState["status"], errorAt?: { index: number; code: string }): StepState[] {
  return ids.map((id, index) => {
    const value = status(index);
    return {
      id, status: value, attempt: value === "pending" || value === "skipped" ? 0 : 1, artifactIds: [],
      startedAt: value === "pending" || value === "skipped" ? null : later(index * 3),
      finishedAt: value === "succeeded" || value === "failed" ? later(index * 3 + 2) : null,
      errorCode: errorAt?.index === index ? errorAt.code : null,
    };
  });
}

export type StateOptions = {
  stepIds: string[];
  progressBlockId: string;
  /** Step that fails in the error state, and the blocks removed in the partial state. */
  error: { stepIndex: number; code: string; title: string; message: string };
  partial: { stepIndex: number; code: string; dropBlockIds: string[]; title: string; message: string; patch?: (bundle: DemoBundle) => DemoBundle };
  unavailableMessage: string;
};

/**
 * Derives the six fixture states from one representative success bundle. Non-success states never
 * claim business success: loading shows progress only, error/unavailable keep only explanations.
 */
export function deriveState(success: DemoBundle, state: DemoState, options: StateOptions): DemoBundle {
  const bundle = structuredClone(success);
  const progress: UIBlock = { id: options.progressBlockId, type: "progress", props: { stepIds: options.stepIds } };
  const withStatus = (status: DemoBundle["view"]["status"], blocks: UIBlock[], stepStates: StepState[], warnings: string[] = []): DemoBundle => ({
    ...bundle,
    view: { ...bundle.view, status, blocks },
    snapshot: { ...bundle.snapshot, status, steps: stepStates, warnings: [...bundle.snapshot.warnings, ...warnings] },
  });
  const hasProgress = bundle.view.blocks.some(block => block.id === options.progressBlockId);
  const successBlocks = hasProgress ? bundle.view.blocks : [progress, ...bundle.view.blocks];
  const n = options.stepIds.length;
  switch (state) {
    case "success":
      return withStatus("completed", successBlocks, steps(options.stepIds, () => "succeeded"));
    case "loading": {
      const running = Math.floor(n / 2);
      return withStatus("running", [progress], steps(options.stepIds, i => (i < running ? "succeeded" : i === running ? "running" : "pending")));
    }
    case "empty":
      return { ...withStatus("completed", [], steps(options.stepIds, () => "succeeded")), sources: [], evidence: [], claims: [], datasets: {} };
    case "error": {
      const warning: UIBlock = { id: "state-error", type: "warning", props: { title: options.error.title, message: options.error.message, severity: "critical" } };
      return withStatus("failed", [progress, warning], steps(options.stepIds, i => (i < options.error.stepIndex ? "succeeded" : i === options.error.stepIndex ? "failed" : "skipped"), { index: options.error.stepIndex, code: options.error.code }), [options.error.code]);
    }
    case "partial": {
      const warning: UIBlock = { id: "state-partial", type: "warning", props: { title: options.partial.title, message: options.partial.message, severity: "warning" } };
      const kept = successBlocks.filter(block => !options.partial.dropBlockIds.includes(block.id));
      const partial = withStatus("partial", [warning, ...kept], steps(options.stepIds, i => (i === options.partial.stepIndex ? "failed" : "succeeded"), { index: options.partial.stepIndex, code: options.partial.code }), [options.partial.code]);
      return options.partial.patch ? options.partial.patch(partial) : partial;
    }
    case "unavailable": {
      const warning: UIBlock = { id: "state-unavailable", type: "warning", props: { title: "Chưa khả dụng", message: options.unavailableMessage, severity: "info" } };
      return { ...withStatus("interrupted", [warning], steps(options.stepIds, () => "skipped"), ["feature_unavailable"]), evidence: [], claims: [], datasets: {} };
    }
  }
}

export function sourceRef(id: string, kind: "upload" | "url" | "dataset", title: string, extra: { url?: string; publishedAt?: string } = {}) {
  return { id, kind, title, retrievedAt: FIXTURE_TIME, contentHash: `sha256:synthetic-${id}`, ...extra };
}
