import type { SourceCatalog } from "@/sources/catalog";
/** The default source map is empty; domain authors opt in only to injected, reviewed profiles. */
export const templateSourceProfileIds: readonly string[] = [];
export function validateTemplateSources(catalog: SourceCatalog, ids: readonly string[] = templateSourceProfileIds): void {
  if (ids.some(id => !catalog.get(id))) throw new Error("domain_source_unregistered");
}
