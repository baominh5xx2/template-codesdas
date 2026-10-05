import type { UIBlock } from "@/contracts/ui/blocks";
import type { DemoBundle } from "@/demo/schemas";
export function presentRiskAnalyzerFixture(bundle: DemoBundle): UIBlock[] { return bundle.view.blocks.map(block => ({ ...block })); }
