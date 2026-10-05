import { DemoBundleSchema, type DemoBundle, type DemoState } from "./schemas";
import { getDemoBundle } from "./catalog";

/** Fixture boundary always parses through the public DTO schema before returning JSON. */
export function loadDemoFixture(domainId: string, state: DemoState = "success"): DemoBundle {
  return DemoBundleSchema.parse(getDemoBundle(domainId, state));
}
