import type { RunStatus, StepState } from "@/contracts/common";
export interface AgentProjection { businessRunId: string; revision: number; artifactIds: string[]; summary: string }
export interface UiSessionState { domainId: string; runId: string | null; status: RunStatus | null; revision: number; steps: StepState[]; summary: string }
export interface RunAgentInput { prompt: string; runId?: string }
