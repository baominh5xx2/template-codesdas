import { DEMO_DOMAINS, createFixtureBundle } from "./data";
import { DemoBundleSchema, DemoStateSchema, type DemoState } from "./schemas";
import { FeatureUnavailableError } from "@/contracts/errors";
export { DemoStateSchema, type DemoState } from "./schemas";
export const DEMO_STATES = DemoStateSchema.options;

const statuses = { loading: "running", empty: "completed", error: "failed", success: "completed", partial: "partial", unavailable: "interrupted" } as const;
export function getDemoBundle(domainId: string, state: DemoState = "success") {
  if (!DEMO_DOMAINS.some(domain => domain.id === domainId)) throw new DemoRequestError("not_found", "Demo domain not found.");
  const parsedState = DemoStateSchema.safeParse(state);
  if (!parsedState.success) throw new DemoRequestError("invalid_request", "Demo state is invalid.");
  const bundle = DemoBundleSchema.parse(createFixtureBundle(domainId, parsedState.data === "success" ? "completed" : parsedState.data));
  if (bundle.view.status !== statuses[parsedState.data]) throw new Error("demo_state_mapping_invalid");
  return bundle;
}

export class DemoRequestError extends Error {
  constructor(readonly code: "invalid_request" | "not_found", message: string) { super(message); this.name = "DemoRequestError"; }
}
export function assertDemoEnabled(mode: string | undefined): void {
  if (mode === "production") throw new FeatureUnavailableError("Demo fixtures are not available in production.");
}
