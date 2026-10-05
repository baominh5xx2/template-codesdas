import type { SourceProfile } from "@/contracts/sources";
/** Empty by default. Applications inject reviewed profiles; source retrieval remains unavailable in the skeleton. */
export interface SourceCatalog { get(id: string): SourceProfile | undefined; list(): readonly SourceProfile[] }
export function createSourceCatalog(profiles: readonly SourceProfile[] = []): SourceCatalog {
  const byId = new Map<string, SourceProfile>();
  for (const profile of profiles) {
    if (byId.has(profile.id)) throw new Error("source_profile_duplicate");
    byId.set(profile.id, profile);
  }
  return { get: id => byId.get(id), list: () => [...byId.values()] };
}
