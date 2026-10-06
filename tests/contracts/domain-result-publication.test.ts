import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createArtifactRegistry } from "@/core/capabilities/schema-registry";
import { publishDomainToolResult } from "@/core/artifacts/publication";
import type { DomainResultPublicationPort } from "@/core/artifacts/definition";
import type { DomainResultPublicationCandidate, DomainResultPublicationInput } from "@/contracts/domain-results";

const outputSchema = z.object({ total: z.number() });
const registry = createArtifactRegistry();
registry.register("budget.summary", 1, z.object({ total: z.number(), note: z.string().optional() }));
const domain = {
  manifest: { id: "budget-review", version: 1, title: "Budget", description: "", branding: { name: "Budget", accent: "#123456" }, surface: "workspace" as const, inputFields: [], examples: [], toolNames: ["business__calculate"] },
  inputSchema: outputSchema,
  requiredArtifactKinds: ["budget.summary"], systemPrompt: "", sources: [],
  resultBindings: [],
  present: ({ snapshot }: { snapshot: { artifacts: { id: string }[] } }) => [{ id: "total", type: "metric" as const, props: { label: "Total", value: 10, sourceIds: [] } }],
};
const binding = {
  id: "calculate-budget", toolName: "business__calculate", toolVersion: 1,
  outputSchema, artifactKind: "budget.summary", artifactVersion: 1,
  inputSchema: outputSchema, toRunInput: (output: { total: number }) => output,
  toArtifactDraft: (output: { total: number }) => ({ kind: "budget.summary", version: 1, data: output, sourceIds: [], evidenceIds: [], provenance: { capabilityId: "tool.business.calculate", capabilityVersion: 1 } }),
};
const input: DomainResultPublicationInput = {
  scope: { userId: "user-1", workspaceId: "workspace-1", trustedOperator: false }, threadId: "thread-1", agentRunId: "agent-1", toolCallId: "call-1",
  pack: { id: "budget-review", version: 1 }, bindingId: binding.id, binding, domain,
  output: { total: 10 }, artifactSchemas: registry,
  clock: () => new Date("2026-10-06T00:00:00.000Z"), id: (() => { let n = 0; return (kind: string) => `${kind}-${++n}`; })(),
};

function fakePort(): DomainResultPublicationPort & { calls: unknown[] } {
  const calls: unknown[] = [];
  const existing = new Map<string, { fingerprint: string; publication: DomainResultPublicationCandidate["publication"] }>();
  return { calls, publish: async value => {
    calls.push(value);
    const key = JSON.stringify(value.key);
    const prior = existing.get(key);
    if (prior) {
      if (prior.fingerprint !== value.fingerprint) throw new Error("domain_result_publication_conflict");
      return prior.publication;
    }
    existing.set(key, { fingerprint: value.fingerprint, publication: value.publication });
    return value.publication;
  } };
}

describe("publishDomainToolResult", () => {
  it("publishes one completed result with no steps and businessRunId in envelope and view", async () => {
    const port = fakePort();
    const result = await publishDomainToolResult(input, port);
    expect(port.calls).toHaveLength(1);
    const candidate = port.calls[0] as { snapshot: { steps: unknown[] }; artifact: { runId: string }; resultView: { runId: string } };
    expect(candidate.snapshot.steps).toEqual([]);
    expect(candidate.artifact.runId).toBe(candidate.resultView.runId);
    expect(result.output).toEqual(input.output);
  });

  it("delegates same-payload idempotency to the atomic port", async () => {
    const port = fakePort();
    const selfReferencing = { ...input, domain: { ...domain, present: ({ snapshot }: { snapshot: { artifacts: { id: string }[] } }) => [{ id: "open", type: "action" as const, props: { label: "Open result", actionId: "focus-artifact" as const, artifactId: snapshot.artifacts[0].id } }] } };
    const first = await publishDomainToolResult(selfReferencing, port);
    const second = await publishDomainToolResult(selfReferencing, port);
    expect(first.publication).toEqual(second.publication);
  });

  it("rejects a conflicting payload for the same publication key", async () => {
    const port = fakePort();
    await publishDomainToolResult(input, port);
    await expect(publishDomainToolResult({ ...input, output: { total: 11 } }, port)).rejects.toThrow("domain_result_publication_conflict");
  });

  it("rejects an invalid toRunInput result before calling the port", async () => {
    const port = fakePort();
    const badInput = { ...input, binding: { ...binding, toRunInput: () => ({ total: "bad" }) } };
    await expect(publishDomainToolResult(badInput, port)).rejects.toThrow();
    expect(port.calls).toHaveLength(0);
  });

  it("rejects an invalid artifact draft before calling the port", async () => {
    const port = fakePort();
    const badInput = { ...input, binding: { ...binding, toArtifactDraft: () => ({ kind: "wrong", version: 1, data: { total: 10 }, sourceIds: [], evidenceIds: [], provenance: { capabilityId: "test", capabilityVersion: 1 } }) } };
    await expect(publishDomainToolResult(badInput, port)).rejects.toThrow();
    expect(port.calls).toHaveLength(0);
  });

  it("rejects a source reference in the artifact draft before calling the port", async () => {
    const port = fakePort();
    const badInput = { ...input, binding: { ...binding, toArtifactDraft: (output: { total: number }) => ({ ...binding.toArtifactDraft(output), sourceIds: ["source-1"] }) } };
    await expect(publishDomainToolResult(badInput, port)).rejects.toThrow("domain_result_reference_missing");
    expect(port.calls).toHaveLength(0);
  });

  it.each([
    ["metric sourceIds", { id: "metric", type: "metric", props: { label: "Total", value: 10, sourceIds: ["source-1"] } }],
    ["insight claimIds", { id: "insight", type: "insight", props: { title: "Claim", claimIds: ["claim-1"], severity: "info" } }],
    ["evidence ids", { id: "evidence", type: "evidence", props: { claimId: "claim-1", evidenceIds: ["evidence-1"] } }],
    ["dataset id", { id: "table", type: "table", props: { title: "Table", datasetId: "dataset-1", columns: ["total"], pageSize: 10 } }],
    ["recommendation actionIds", { id: "recommendation", type: "recommendation", props: { title: "Do it", reasonClaimIds: [], priority: "low", actionIds: ["action-1"] } }],
    ["progress stepIds", { id: "progress", type: "progress", props: { stepIds: ["step-1"] } }],
    ["foreign artifact id", { id: "action", type: "action", props: { label: "Open", actionId: "focus-artifact", artifactId: "artifact-foreign" } }],
  ])("rejects unresolved %s before calling the port", async (_label, block) => {
    const port = fakePort();
    const badInput = { ...input, domain: { ...domain, present: () => [block] } as never };
    await expect(publishDomainToolResult(badInput, port)).rejects.toThrow();
    expect(port.calls).toHaveLength(0);
  });

  it("rejects unresolved inputArtifactIds in provenance before calling the port", async () => {
    const port = fakePort();
    const badInput = { ...input, binding: { ...binding, toArtifactDraft: (output: { total: number }) => ({ ...binding.toArtifactDraft(output), provenance: { capabilityId: "tool.business.calculate", capabilityVersion: 1, inputArtifactIds: ["artifact-input"] } }) } };
    await expect(publishDomainToolResult(badInput, port)).rejects.toThrow("domain_result_reference_missing");
    expect(port.calls).toHaveLength(0);
  });

  it("rejects a workflow stepId in provenance for a chat-only run before calling the port", async () => {
    const port = fakePort();
    const badInput = { ...input, binding: { ...binding, toArtifactDraft: (output: { total: number }) => ({ ...binding.toArtifactDraft(output), provenance: { capabilityId: "tool.business.calculate", capabilityVersion: 1, stepId: "workflow-step" } }) } };
    await expect(publishDomainToolResult(badInput, port)).rejects.toThrow("domain_result_reference_missing");
    expect(port.calls).toHaveLength(0);
  });

  it("rejects an expanded toRunInput over 32 KiB before calling the port", async () => {
    const port = fakePort();
    const badInput = { ...input, binding: { ...binding, inputSchema: z.object({ note: z.string() }), toRunInput: () => ({ note: "x".repeat(33 * 1024) }) } };
    await expect(publishDomainToolResult(badInput, port)).rejects.toThrow("domain_result_input_too_large");
    expect(port.calls).toHaveLength(0);
  });

  it("rejects expanded artifact data over 32 KiB before calling the port", async () => {
    const port = fakePort();
    const badInput = { ...input, binding: { ...binding, toArtifactDraft: (output: { total: number }) => ({ ...binding.toArtifactDraft(output), data: { ...output, note: "x".repeat(33 * 1024) } }) } };
    await expect(publishDomainToolResult(badInput, port)).rejects.toThrow("domain_result_artifact_too_large");
    expect(port.calls).toHaveLength(0);
  });

  it("conflicts when the same output uses changed binding semantics", async () => {
    const port = fakePort();
    await publishDomainToolResult(input, port);
    const changed = { ...input, binding: { ...binding, toRunInput: (output: { total: number }) => ({ total: output.total + 1 }) } };
    await expect(publishDomainToolResult(changed, port)).rejects.toThrow("domain_result_publication_conflict");
  });

  it("rejects invalid tool output before calling the port", async () => {
    const port = fakePort();
    await expect(publishDomainToolResult({ ...input, output: { total: "bad" } as never }, port)).rejects.toThrow();
    expect(port.calls).toHaveLength(0);
  });

  it("rejects an invalid presenter block before calling the port", async () => {
    const port = fakePort();
    const badInput = { ...input, domain: { ...domain, present: () => [{ id: "bad", type: "missing" }] } as never };
    await expect(publishDomainToolResult(badInput, port)).rejects.toThrow();
    expect(port.calls).toHaveLength(0);
  });

  it("allows report sections that reference blocks in the candidate ResultView", async () => {
    const port = fakePort();
    const localReferences = { ...input, domain: { ...domain, present: () => [
      { id: "total", type: "metric" as const, props: { label: "Total", value: 10, sourceIds: [] } },
      { id: "summary", type: "report-section" as const, props: { title: "Summary", blockIds: ["total"] } },
    ] } };
    await expect(publishDomainToolResult(localReferences, port)).resolves.toMatchObject({ publication: { businessRunId: expect.any(String) } });
    expect(port.calls).toHaveLength(1);
  });

  it("rejects a report section with a missing local block reference before calling the port", async () => {
    const port = fakePort();
    const missingReference = { ...input, domain: { ...domain, present: () => [
      { id: "summary", type: "report-section" as const, props: { title: "Summary", blockIds: ["missing"] } },
    ] } };
    await expect(publishDomainToolResult(missingReference, port)).rejects.toThrow("report_reference_missing");
    expect(port.calls).toHaveLength(0);
  });

  it("does not publish ordinary unbound output", async () => {
    const port = fakePort();
    const result = await publishDomainToolResult({ ...input, binding: null }, port);
    expect(result.publication).toBeNull();
    expect(port.calls).toHaveLength(0);
  });
});
