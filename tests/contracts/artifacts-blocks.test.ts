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

it("keeps registered schema transforms inside JSON-safe artifact data", () => {
  const envelopeWithString = { ...envelope, data: "input" };
  const registry = createArtifactRegistry();
  registry.register("analysis", 1, z.string().transform(value => value.toUpperCase()));
  expect(registry.parse(envelopeWithString).data).toBe("INPUT");

  const unsafeRegistry = createArtifactRegistry();
  unsafeRegistry.register("analysis", 1, z.string().transform(() => new Date("2026-10-05T00:00:00.000Z")));
  expect(() => unsafeRegistry.parse(envelopeWithString)).toThrow();
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

it("allows HTTP(S) or storage-backed media and rejects unsafe URL schemes", () => {
  const media = (url: string) => UIBlockSchema.safeParse({
    id: "media", type: "media", props: { kind: "image", url, alt: "Preview" },
  }).success;
  expect(media("https://cdn.example.test/image.png")).toBe(true);
  expect(media("http://cdn.example.test/image.png")).toBe(true);
  for (const url of ["javascript:alert(1)", "data:image/png;base64,AA==", "file:///tmp/image.png", "not a URL"]) {
    expect(media(url)).toBe(false);
  }
  expect(UIBlockSchema.safeParse({
    id: "media", type: "media", props: { kind: "image", storageKey: "uploads/image.png", alt: "Preview" },
  }).success).toBe(true);
});

it("rejects report references that are missing or cyclic", () => {
  const view = (blocks: unknown[]) => ResultViewSchema.safeParse({ runId: "run-1", revision: 1, title: "Report", status: "completed", blocks });
  expect(view([{ id: "section", type: "report-section", props: { title: "Overview", blockIds: ["missing"] } }]).success).toBe(false);
  expect(view([
    { id: "a", type: "report-section", props: { title: "A", blockIds: ["b"] } },
    { id: "b", type: "report-section", props: { title: "B", blockIds: ["a"] } },
  ]).success).toBe(false);
});
