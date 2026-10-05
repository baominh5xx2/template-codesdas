import { expect, it } from "vitest";
import { assertPriorDependencies, validateWorkflow } from "@/core/workflows/validation";
import { FeatureUnavailableError, toPublicError } from "@/contracts/errors";
import { validateDomain } from "@/core/domains/validation";

it("requires workflow dependencies to be earlier, present, and unique", () => {
  expect(() => assertPriorDependencies(["a", "b"], 1, ["a"])).not.toThrow();
  expect(() => assertPriorDependencies(["a", "b"], 0, ["b"])).toThrow("workflow_dependency_invalid");
  expect(() => assertPriorDependencies(["a", "b"], 1, ["missing"])).toThrow("workflow_dependency_invalid");
  expect(() => validateWorkflow({ steps: [
    { id: "a", dependsOn: [], artifactKind: "analysis", version: 1 },
    { id: "a", dependsOn: [], artifactKind: "report", version: 1 },
  ], requiredArtifactKinds: [] } as never)).toThrow("workflow_step_duplicate");
});

it("preserves safe unavailable errors and masks arbitrary internal errors", () => {
  expect(toPublicError(new FeatureUnavailableError("Storage is not configured."), "trace-2"))
    .toMatchObject({ code: "feature_unavailable", message: "Storage is not configured.", traceId: "trace-2" });
  expect(toPublicError(new Error("token=secret"), "trace-3").message).not.toContain("secret");
});

it("keeps domain validation dependent on injected source, tool, and artifact catalogs", () => {
  const domain = {
    manifest: { id: "example", version: 1, toolNames: [], inputFields: [], examples: [], title: "Example", description: "", branding: { name: "x", accent: "#000" }, surface: "workspace" },
    sources: [], requiredArtifactKinds: [], workflow: { steps: [], requiredArtifactKinds: [] },
  };
  expect(() => validateDomain(domain as never, {
    sourceProfileIds: new Set(), toolNames: new Set(), artifactSchemas: {
      has: () => true, register: () => undefined, parse: value => value as never,
    },
  })).not.toThrow();
});
