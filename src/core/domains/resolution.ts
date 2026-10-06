import type { DomainManifest, DomainReference } from "@/contracts/domains";
import type { DomainDefinition } from "./definition";
export { projectDomainForAgent } from "./runtime-projection";
export type { DomainAgentProjection } from "./runtime-projection";

export type ActiveDomainConfig = { id?: string; version?: string };
export type DomainCatalog = ReadonlyMap<string, DomainDefinition>;
export type NewThreadDomainResolution = { kind: "generic" } | { kind: "domain"; reference: DomainReference; manifest: DomainManifest };
export type ExistingThreadDomainResolution = { kind: "unavailable"; reference: DomainReference } | { kind: "readOnly"; reference: DomainReference; manifest: DomainManifest } | { kind: "available"; reference: DomainReference; manifest: DomainManifest };
const key = (ref: DomainReference) => `${ref.id}@${ref.version}`;
const activeReference = (active: ActiveDomainConfig): DomainReference | null => {
  const hasId = active.id !== undefined && active.id !== "";
  const hasVersion = active.version !== undefined && active.version !== "";
  if (!hasId && !hasVersion) return null;
  if (!hasId || !hasVersion || !/^\d+$/.test(active.version!) || Number(active.version) < 1) throw new Error("domain_config_partial");
  return { id: active.id!, version: Number(active.version) };
};
export function resolveDomainForNewThread({ active, catalog }: { active: ActiveDomainConfig; catalog: DomainCatalog }): NewThreadDomainResolution {
  const reference = activeReference(active);
  if (!reference) return { kind: "generic" };
  const domain = catalog.get(key(reference));
  if (!domain || domain.manifest.id !== reference.id || domain.manifest.version !== reference.version) throw new Error("domain_config_unknown");
  return { kind: "domain", reference, manifest: domain.manifest };
}
export function resolveDomainForExistingThread({ pinned, active, catalog }: { pinned: DomainReference; active: ActiveDomainConfig; catalog: DomainCatalog }): ExistingThreadDomainResolution {
  const saved = catalog.get(key(pinned));
  if (!saved || saved.manifest.id !== pinned.id || saved.manifest.version !== pinned.version) return { kind: "unavailable", reference: pinned };
  const current = activeReference(active);
  if (!current || current.id !== pinned.id || current.version !== pinned.version) return { kind: "readOnly", reference: pinned, manifest: saved.manifest };
  return { kind: "available", reference: pinned, manifest: saved.manifest };
}
