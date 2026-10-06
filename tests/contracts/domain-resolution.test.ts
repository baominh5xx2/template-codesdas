import { describe, expect, it } from "vitest";
import { DomainReferenceSchema } from "@/contracts/domains";
import { projectDomainForAgent, resolveDomainForExistingThread, resolveDomainForNewThread } from "@/core/domains/resolution";
import type { DomainDefinition } from "@/core/domains/definition";

const pack = (id: string, version: number, tools: string[] = ["a", "b"]): DomainDefinition => ({
  manifest: { id, version, title: id, description: "safe description", branding: { name: id, accent: "blue" }, surface: "workspace", inputFields: [], examples: [], toolNames: tools },
  inputSchema: {} as DomainDefinition["inputSchema"], requiredArtifactKinds: [],
  systemPrompt: "server prompt", sources: [], tools: tools.map(name => ({ name, version: "1.0.0" })),
  requirements: ["search"], rules: { secret: "must not project" }, present: () => [],
});

describe("domain resolution", () => {
  const catalog = new Map([["alpha@1", pack("alpha", 1)], ["alpha@2", pack("alpha", 2)]]);

  it("validates persisted references", () => {
    expect(DomainReferenceSchema.parse({ id: "alpha", version: 1 })).toEqual({ id: "alpha", version: 1 });
    expect(DomainReferenceSchema.safeParse({ id: "alpha", version: 0 }).success).toBe(false);
  });
  it("keeps unset deployments generic", () => expect(resolveDomainForNewThread({ active: {}, catalog })).toEqual({ kind: "generic" }));
  it("rejects partial active configuration safely", () => expect(() => resolveDomainForNewThread({ active: { id: "alpha" }, catalog })).toThrowError("domain_config_partial"));
  it("rejects malformed active versions with a distinct safe code", () => {
    for (const version of ["abc", "0", "1.2", "-1"]) expect(() => resolveDomainForNewThread({ active: { id: "alpha", version }, catalog })).toThrowError("domain_config_invalid");
  });
  it("rejects unknown active configuration without selecting a fallback", () => expect(() => resolveDomainForNewThread({ active: { id: "missing", version: "1" }, catalog })).toThrowError("domain_config_unknown"));
  it("pins a new thread to the exact active pack", () => expect(resolveDomainForNewThread({ active: { id: "alpha", version: "2" }, catalog })).toEqual({ kind: "domain", reference: { id: "alpha", version: 2 }, manifest: pack("alpha", 2).manifest }));
  it("makes an old version read-only and never rebinds it", () => {
    expect(resolveDomainForExistingThread({ pinned: { id: "alpha", version: 1 }, active: { id: "alpha", version: "2" }, catalog })).toMatchObject({ kind: "readOnly", reference: { id: "alpha", version: 1 } });
    expect(resolveDomainForExistingThread({ pinned: { id: "alpha", version: 99 }, active: { id: "alpha", version: "2" }, catalog })).toMatchObject({ kind: "unavailable", reference: { id: "alpha", version: 99 } });
  });
  it("marks an exact thread pin available", () => expect(resolveDomainForExistingThread({ pinned: { id: "alpha", version: 2 }, active: { id: "alpha", version: "2" }, catalog })).toMatchObject({ kind: "available", reference: { id: "alpha", version: 2 } }));
  it("projects only the intersection of registered, catalogued, allowed, and ready tools", () => {
    const projected = projectDomainForAgent(pack("alpha", 1), { registeredToolNames: new Set(["a", "b", "c"]), deploymentAllowlist: new Set(["a", "b"]), readyFeatures: new Set(["a", "search"]) });
    expect(projected).toEqual({ systemPrompt: "server prompt", permittedToolNames: ["a"], reference: { id: "alpha", version: 1 }, readiness: { available: false, missingRequiredFeatures: [], missingRequiredTools: ["b"], omittedOptionalTools: [] } });
    expect(JSON.stringify(projected)).not.toContain("secret");
  });
  it("omits explicitly optional missing tools and reports required feature failures", () => {
    const domain = pack("alpha", 1, ["a", "optional"]);
    domain.tools![1]!.optional = true;
    domain.requirements = ["search", "browser"];
    const projected = projectDomainForAgent(domain, { registeredToolNames: new Set(["a"]), deploymentAllowlist: new Set(["a"]), readyFeatures: new Set(["search", "a"]) });
    expect(projected.permittedToolNames).toEqual(["a"]);
    expect(projected.readiness).toEqual({ available: false, missingRequiredFeatures: ["browser"], missingRequiredTools: [], omittedOptionalTools: ["optional"] });
  });
});

