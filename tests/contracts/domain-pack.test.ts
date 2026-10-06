import { expect, it } from "vitest";
import { validateDomain } from "@/core/domains/validation";
import type { DomainDefinition, DomainValidationCatalog } from "@/core/domains/definition";
import type { JsonValue, Schema } from "@/contracts/common";
import type { Artifact } from "@/contracts/artifacts";
import { templateDomain } from "@/domains/_template/index.server";
import { domain as documentReviewDomain } from "@/domains/examples/document-review/index.server";

const schema = <T extends JsonValue>(): Schema<T> => ({ parse: value => value as T }) as Schema<T>;
const registeredSchema = schema<{ total: number }>();

const manifest = (id = "chat-pack", version = 1, toolNames = ["business__calculate"]): DomainDefinition["manifest"] => ({
  id, version, title: id, description: "", branding: { name: id, accent: "#000000" }, surface: "workspace",
  inputFields: [], examples: [], toolNames,
});
const catalog = (): DomainValidationCatalog => {
  return { sourceProfileIds: new Set(["approved-source"]), toolNames: new Set(), registeredTools: new Map([["business__calculate@1.0.0", { name: "business__calculate", version: "1.0.0" }]]), registeredDomainIdentities: new Set(), artifactSchemas: { has: (kind: string, version: number) => kind === "budget.summary" && version === 1, register: () => undefined, parse: (value: unknown) => value as Artifact<unknown> } };
};
const binding = (overrides: Partial<NonNullable<DomainDefinition["resultBindings"]>[number]> = {}) => ({
  id: "calculate-result", toolName: "business__calculate", toolVersion: "1.0.0", outputSchema: registeredSchema,
  artifactKind: "budget.summary", artifactVersion: 1, inputSchema: schema<{ amount: number }>(),
  toRunInput: (output: JsonValue) => output, toArtifactDraft: (output: JsonValue) => ({ kind: "budget.summary", version: 1, data: output, sourceIds: [], evidenceIds: [], provenance: { capabilityId: "business__calculate", capabilityVersion: 1 } }),
  ...overrides,
});
const pack = (overrides: Partial<DomainDefinition> = {}): DomainDefinition => ({ manifest: manifest(), inputSchema: schema<Record<string, JsonValue>>(), requiredArtifactKinds: ["budget.summary"], systemPrompt: "", sources: [], present: () => [], tools: [{ name: "business__calculate", version: "1.0.0" }], resultBindings: [binding()], ...overrides });

it("validates a chat-only pack with registered tool and artifact schema", () => {
  expect(() => validateDomain(pack(), catalog())).not.toThrow();
});

it("rejects duplicate binding IDs and duplicate tool/version bindings", () => {
  const first = binding();
  expect(() => validateDomain(pack({ resultBindings: [first, { ...first, toolName: "other" }] }), catalog())).toThrow("domain_result_binding_duplicate");
  expect(() => validateDomain(pack({ resultBindings: [first, { ...first, id: "second" }] }), catalog())).toThrow("domain_result_binding_duplicate");
});

it("rejects unregistered tool bindings and manifest tool names", () => {
  expect(() => validateDomain(pack({ tools: [{ name: "missing", version: "1.0.0" }], manifest: manifest("chat-pack", 1, ["missing"]) }), catalog())).toThrow("domain_tool_unregistered");
});

it("rejects a binding whose tool version is not registered", () => {
  expect(() => validateDomain(pack({ tools: [{ name: "business__calculate", version: "2.0.0" }], resultBindings: [binding({ toolVersion: "2.0.0" })] }), catalog())).toThrow("domain_tool_unregistered");
});

it("requires a versioned registry for tool references and result bindings", () => {
  const withoutVersionedRegistry = catalog();
  withoutVersionedRegistry.registeredTools = undefined;
  withoutVersionedRegistry.toolNames = new Set([...withoutVersionedRegistry.toolNames, "business__calculate"]);
  expect(() => validateDomain(pack({ resultBindings: [], requiredArtifactKinds: [] }), withoutVersionedRegistry)).toThrow("domain_tool_unregistered");
  expect(() => validateDomain(pack(), withoutVersionedRegistry)).toThrow("domain_tool_unregistered");
});

it("preserves name-only validation for a legacy workflow pack", () => {
  const legacyCatalog = catalog();
  legacyCatalog.registeredTools = undefined;
  legacyCatalog.toolNames = new Set([...legacyCatalog.toolNames, "business__calculate"]);
  const workflowPack = pack({ tools: undefined, resultBindings: [], workflow: { steps: [], requiredArtifactKinds: [] }, requiredArtifactKinds: [] });
  expect(() => validateDomain(workflowPack, legacyCatalog)).not.toThrow();
});

it("exposes the template result binding on the server domain definition", () => {
  expect(templateDomain.workflow).toBeUndefined();
  expect(templateDomain.resultBindings?.map(({ id, toolName, toolVersion, artifactKind, artifactVersion }) => ({ id, toolName, toolVersion, artifactKind, artifactVersion }))).toEqual([
    { id: "example-result", toolName: "business__example", toolVersion: "1.0.0", artifactKind: "example.result", artifactVersion: 1 },
  ]);
});

it("keeps example workflow domains free of the template-only result binding", () => {
  expect(documentReviewDomain.workflow).toBeUndefined();
  expect(documentReviewDomain.resultBindings).toBeUndefined();
});

it("rejects an artifact binding with an unregistered schema version", () => {
  expect(() => validateDomain(pack({ resultBindings: [binding({ artifactVersion: 2 })] }), catalog())).toThrow("domain_artifact_schema_unregistered");
});

it("requires every required artifact kind to have a producer", () => {
  expect(() => validateDomain(pack({ resultBindings: [], requiredArtifactKinds: ["budget.summary"] }), catalog())).toThrow("domain_artifact_unproduced");
});

it("rejects unregistered source profiles", () => {
  expect(() => validateDomain(pack({ sources: ["missing-source"] }), catalog())).toThrow("domain_source_unregistered");
});

it("rejects a duplicate pack identity/version registered in the same catalog", () => {
  const shared = catalog();
  expect(() => validateDomain(pack(), shared)).not.toThrow();
  expect(() => validateDomain(pack(), shared)).toThrow("domain_identity_duplicate");
});
