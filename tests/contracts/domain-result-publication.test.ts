import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createArtifactRegistry } from "@/core/capabilities/schema-registry";
import { publishDomainToolResult } from "@/core/artifacts/publication";
import type { DomainResultPublicationPort } from "@/core/artifacts/definition";
import type { DomainResultPublicationCandidate, DomainResultPublicationInput } from "@/contracts/domain-results";

const outputSchema = z.object({ total: z.number() });
const registry = createArtifactRegistry();
registry.register("budget.summary", 1, outputSchema);
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
    const first = await publishDomainToolResult(input, port);
    const second = await publishDomainToolResult(input, port);
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

  it("does not publish ordinary unbound output", async () => {
    const port = fakePort();
    const result = await publishDomainToolResult({ ...input, binding: null }, port);
    expect(result.publication).toBeNull();
    expect(port.calls).toHaveLength(0);
  });
});
