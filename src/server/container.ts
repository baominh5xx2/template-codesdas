import "server-only";
export interface SkeletonContainer { mode: "skeleton"; features: Record<string, boolean> }
export function createContainer(): SkeletonContainer {
  return { mode: "skeleton", features: { runs: false, artifacts: false, uploads: false, datasets: false, storage: false, model: false, sources: false, parsers: false } };
}
