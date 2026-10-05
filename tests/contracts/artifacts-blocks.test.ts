import { expect, it } from "vitest";
import { ArtifactEnvelopeSchema } from "@/contracts/artifacts";
import { UIBlockSchema } from "@/contracts/ui/blocks";
import { ResultViewSchema } from "@/contracts/ui/result-view";
import { createArtifactRegistry } from "@/core/capabilities/schema-registry";
import { z } from "zod";

const envelope = {
  id: "artifact-1",
  kind: "analysis",
  version: 1,
  runId: "run-1",
  workspaceId: "workspace-1",
  data: { summary: "Synthetic", score: 42 },
  sourceIds: [],
  evidenceIds: [],
  createdAt: "2026-10-05T00:00:00.000Z",
  provenance: { capabilityId: "demo", capabilityVersion: 1 },
};

it("accepts JSON artifact data and rejects non-JSON persisted values", () => {
  expect(ArtifactEnvelopeSchema.safeParse(envelope).success).toBe(true);
  expect(ArtifactEnvelopeSchema.safeParse({ ...envelope, version: 0 }).success).toBe(false);
  expect(ArtifactEnvelopeSchema.safeParse({ ...envelope, data: { date: new Date() } }).success).toBe(false);
});

it("validates registered artifact kind and schema version", () => {
  const registry = createArtifactRegistry();
  registry.register("analysis", 1, z.object({ summary: z.string(), score: z.number() }));
  expect(registry.parse(envelope)).toMatchObject({ kind: "analysis", version: 1 });
  expect(() => registry.parse({ ...envelope, version: 2 })).toThrow("artifact_schema_unregistered");
});

it("rejects executable blocks, out-of-range risk, and invalid coordinates", () => {
  expect(UIBlockSchema.safeParse({ id: "x", type: "jsx", props: {} }).success).toBe(false);
  expect(UIBlockSchema.safeParse({
    id: "r", type: "risk", props: {
      score: 120, min: 0, max: 100, direction: "higher-is-worse", level: "high",
      factorIds: [], method: "demo", completeness: 1,
    },
  }).success).toBe(false);
  expect(UIBlockSchema.safeParse({
    id: "p", type: "place", props: { name: "x", lat: 91, lng: 0, sourceIds: [] },
  }).success).toBe(false);
});

it("rejects report references that are missing or cyclic", () => {
  const view = (blocks: unknown[]) => ResultViewSchema.safeParse({ runId: "run-1", revision: 1, title: "Report", status: "completed", blocks });
  expect(view([{ id: "section", type: "report-section", props: { title: "Overview", blockIds: ["missing"] } }]).success).toBe(false);
  expect(view([
    { id: "a", type: "report-section", props: { title: "A", blockIds: ["b"] } },
    { id: "b", type: "report-section", props: { title: "B", blockIds: ["a"] } },
  ]).success).toBe(false);
});
