# Agent boundary

This module owns client-safe projections and request DTOs only. `AgentProjection` exposes a business run ID, revision, artifact IDs, and summary; `UiSessionState` exposes run status and steps. A future server adapter validates `RunAgentInput` and routes requests through `CoreServices`. SDK stream/runtime types stay in `src/adapters/agents`; no agent SDK or streaming implementation is bound in this starter.
