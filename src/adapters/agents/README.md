# Agent runtime adapter

Future input/output: validated `RunAgentInput` and client-safe `AgentProjection`/`UiSessionState`. Owns stream SDK integration, request context validation, and server tool selection; business runs continue through `CoreServices`. No agent runtime is bound.
