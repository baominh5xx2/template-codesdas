# C03 — Business MCP Tools, Context & Inline Results Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the existing CopilotKit chat discover and call validated custom business tools through the official MCP TypeScript SDK, preserve tool call/result context, and render real results inline while keeping failures private and C02 persistence deferred.

**Architecture:** Keep CopilotKit responsible for the model/agent loop. Implement a typed local business tool catalog and official Streamable HTTP MCP server at `/api/mcp/business`; bridge a per-run official MCP client into the AI SDK ToolSet expected by the pinned CopilotKit runtime. Validate at every boundary, bind cancellation/deadlines/budgets to the run, and project complete protocol call/result pairs into the existing chat controller/UI.

**Tech Stack:** Existing Next.js Node runtime, Bun 1.4.2 package manager, TypeScript, Zod 4, Vitest, CopilotKit runtime/react-core 1.77.0, AI SDK 6.0.300, official stable MCP TypeScript SDK v2 client/server packages (exact patches selected only after Task 1 compatibility probe).

**Spec:** `docs/superpowers/specs/2026-10-06-chat-tools-context-design.md`; product decisions and feature mapping in `docs/platform-build-spec.md` C03 and decision log.

## Global Constraints

- Work only in `E:\thucchienai\hackathon-starter-kit\worktree\chat-tools-mcp`, branch `feat/chat-tools-mcp`, starting commit `540c94c`; do not edit the original checkout or sibling worktrees.
- Use Node runtime. Use Bun only for package management and scripts: `bun install --frozen-lockfile`, `bun add --exact`, `bun run check`, `bun run test`, `bun run build`; do not use npm, pnpm, or Bun's native test runner.
- Keep existing dependency versions. Add only stable official MCP SDK packages needed by the proven bridge, pinned to exact versions after Task 1. Do not install prereleases or GitHub main.
- The app owns one local user; no login, multi-tenant support, or Settings UI. MCP backend URL, dedicated token, and allowlist are server-only config. Never use or forward pgEdge credentials; pgEdge MCP remains coding-agent-only. App DB access, if later needed, uses Drizzle/repositories.
- CopilotKit owns the agent/model loop. Do not implement a replacement loop or pass the official MCP `Client` directly to `mcpClients` without the probe proving compatibility; the planned bridge exposes a tested `.tools()` provider.
- Business tools are custom handlers with `name`, `version`, `description`, input/output schemas, `read | compute` policy, and `execute(input, context)`. Tool names exposed to the model use stable `business__` names and the existing 64-character namespace/collision rules.
- Validate tool inputs and outputs on both sides of the MCP boundary. Use allowlists; unknown or disabled tools fail closed. Only validated structured output reaches model or UI.
- Technical failures exposed in chat must be exactly `Chưa kết nối`. Do not expose tokens, headers, stacks, raw MCP messages/errors, or tool payloads in notices/logs. Latch/suppress failures before model/UI output; never convert a failure to a successful tool result or fixture answer.
- User Stop is `interrupted`, not failed/completed. Abort in-flight client/handler work, suppress late output, and close/release run resources once. A valid business result such as `overBudget: true` is successful output.
- Every per-run client must negotiate MCP modern protocol explicitly and fail closed if negotiation falls back to legacy. In the pinned stateless HTTP server, legacy cancellation travels as a separate request and cannot abort the active handler; modern request cancellation propagates through the HTTP request signal.
- CopilotKit Stop can emit a `RUN_FINISHED` outcome with type `cancelled` and synthesize a `TOOL_CALL_RESULT` whose payload is `{ status: "stopped", reason: "stop_requested" }`. Transcript projection must treat these as interruption status, never as validated business output or a replayable successful tool pair.
- C02 durable history is not implemented. Define a persistence handoff contract only; do not claim reload/restart persistence or replay.
- Before editing Next.js code, read the relevant local Next guide under `node_modules/next/dist/docs/` as required by `AGENTS.md`. Do not read secrets or copy `.env` files from another checkout. If starting a dev server, use a free port other than 3100.

---

### Task 1: Prove official MCP v2 → AI SDK/CopilotKit compatibility and pin dependencies

**Files:**
- Create: `tests/integration/mcp-compatibility.test.ts`
- Create or adjust: `src/adapters/mcp/compatibility-probe.ts` (remove the production helper if the probe can remain test-local)
- Modify: `package.json`
- Modify: `bun.lock`
- Read before editing runtime: `node_modules/next/dist/docs/` route-handler guide relevant to a Node-runtime HTTP endpoint

**Interfaces:**
- Produces: an evidence-backed choice of official stable MCP v2 client/server package versions and a provider shape accepted by the existing CopilotKit 1.77.0 / AI SDK 6.0.300 stack.
- The provider contract must expose `tools(): Promise<ToolSet>` with validated `inputSchema` and an `execute` function that receives/propagates abort signals. Its invocation must use official Client `listTools`/`callTool` over real HTTP.

- [ ] Inspect official stable v2 package metadata and local installed CopilotKit/AI SDK declarations; record exact candidates and supported provider/agent-runner APIs in the test comments or a short compatibility note.
- [ ] Add the minimum official client/server packages with `bun add --exact` using the exact stable patches verified by the probe; retain all existing pins.
- [ ] Write a failing integration test that starts an official MCP Streamable HTTP server on an ephemeral local port, connects with the official SDK Client, initializes, lists a `calculate_budget` test tool, calls it, checks structured content, and closes the client/server.
- [ ] Extend the probe to wrap that discovered tool as the AI SDK `ToolSet` and execute it through the pinned runtime's supported registration path; assert input schema, validated output, `isError` rejection, abort propagation, and one-time cleanup.
- [ ] Run `bun run test -- tests/integration/mcp-compatibility.test.ts`; expect the probe to fail before the provider/adapter exists and pass after implementation.
- [ ] If the pinned CopilotKit runtime cannot accept a provider or safely delegate an inner run with cancellation, stop this plan for an architecture review; do not bypass CopilotKit with a custom model loop.

### Task 2: Add the typed business tool contract, catalog, and real budget calculation

**Files:**
- Create: `src/core/tools/definition.ts`
- Create: `src/server/mcp/catalog.ts`
- Create: `src/server/mcp/tools/calculate-budget/schemas.ts`
- Create: `src/server/mcp/tools/calculate-budget/handler.ts`
- Create: `src/server/mcp/tools/calculate-budget/definition.ts`
- Create: `tests/server/tools/catalog.test.ts`
- Create: `tests/server/tools/calculate-budget.test.ts`

**Interfaces:**
- `BusinessTool<TInput, TOutput>`: `name`, `version`, `description`, `input: z.ZodType<TInput>`, `output: z.ZodType<TOutput>`, `kind: "read" | "compute"`, and `execute(input: TInput, context: BusinessToolContext): Promise<TOutput>`.
- `BusinessToolContext`: server-resolved `threadId`, `runId`, `toolCallId`, `signal`, and absolute deadline. Correlation IDs are trace-only and grant no authority.
- Catalog registration accepts definitions plus enabled-name allowlist, exposes only enabled tools, and rejects duplicate/reserved/invalid names and namespace collisions.
- `calculate_budget` accepts one currency of 3 uppercase letters, `budgetMinor` safe nonnegative integer up to `10^12`, and at most 100 items with label length 1–120 and safe nonnegative integer `amountMinor` up to `10^12`. It returns currency, total, remaining, overBudget, and itemCount.

- [ ] Write schema/catalog tests for supported definition, invalid metadata, duplicate and reserved names, disabled tools, and the 64-character stable namespace limit.
- [ ] Write budget tests for the documented sample (`totalMinor: 3500000`, `remainingMinor: 1500000`), over-budget success, zero values, 100-item boundary, currency/label/count/amount/budget limits, and unsafe aggregate arithmetic.
- [ ] Run `bun run test -- tests/server/tools/catalog.test.ts tests/server/tools/calculate-budget.test.ts`; confirm the missing contract/catalog/handler failures.
- [ ] Implement the contract and catalog with Zod-to-JSON-Schema support compatible with the Task 1 SDK, without `any` fallback; implement deterministic arithmetic only.
- [ ] Re-run the two focused Vitest files and confirm all boundaries and valid business outputs pass.

### Task 3: Host the official Business MCP HTTP server behind backend config and request guards

**Files:**
- Create: `src/server/mcp/config.ts`
- Create: `src/server/mcp/business-server.ts`
- Create: `src/server/mcp/http.ts`
- Create: `src/server/mcp/errors.ts`
- Create: `src/app/api/mcp/business/route.ts`
- Modify: `src/server/env.ts` and env contract tests as needed
- Create: `tests/server/mcp/business-http.test.ts`
- Create: `tests/integration/business-mcp-http.test.ts`

**Interfaces:**
- Config is disabled by default. Enabling requires backend URL, a dedicated `BUSINESS_MCP_TOKEN`, explicit tool allowlist, and allowed Host/Origin values. It must not read `MCP_AUTH_TOKEN` or any pgEdge setting.
- Server factory creates an official MCP v2 HTTP handler for each request and registers only catalog tools allowed by backend config. Each handler validates input, resolves local context, executes once, validates output, and emits structured object plus equivalent text content.
- HTTP boundary enforces bearer auth before protocol dispatch, Host/Origin policy, Node runtime, request body at most 256 KiB, result at most 32 KiB, no wildcard CORS, and no cross-host token forwarding on redirects.

- [ ] Write failing route tests for disabled config, valid bearer, missing/wrong bearer, denied direct tool call, denied discovery, invalid input, disallowed Host/Origin, body over 256 KiB, and structured result over 32 KiB.
- [ ] Write an official SDK integration test that initializes, calls `tools/list`, and calls `calculate_budget` through the actual HTTP route; assert sample values and that handler dispatch occurred through the protocol.
- [ ] Run focused server/HTTP tests and observe expected failures.
- [ ] Implement the config parser and thin Next Node route that delegates to the official server handler; keep business handlers transport-independent.
- [ ] Re-run focused tests; verify secret-bearing auth/protocol errors are mapped to safe diagnostics and never returned as raw headers or payloads.

### Task 4: Implement bounded official MCP client, schema-aware provider, and per-run scope

**Files:**
- Create: `src/adapters/mcp/business-client.ts`
- Create: `src/adapters/mcp/tool-provider.ts`
- Create: `src/adapters/mcp/results.ts`
- Create: `src/adapters/mcp/run-scope.ts`
- Create: `tests/adapters/mcp/business-client.test.ts`
- Create: `tests/adapters/mcp/tool-provider.test.ts`
- Create: `tests/adapters/mcp/run-scope.test.ts`

**Interfaces:**
- `createBusinessRunScope({ config, threadId, runId, signal, now? })` owns one official MCP Client/transport, a per-run AbortController, discovered ToolSet, up to 3 total calls, max concurrency 1, and idempotent `close()`.
- Discovery validates stable names, allowlist membership, discovered-vs-registered input/output schema compatibility, and rejects unsupported tools before exposing any tool to the model.
- Client initialization must use the official SDK's modern protocol negotiation and verify the negotiated protocol era is modern before exposing tools or executing calls; legacy fallback fails closed.
- Provider maps MCP `structuredContent` to AI SDK tool output only after validating the output schema; reject `isError`, missing/malformed structured result, oversized response, and unregistered names before the model sees them.

- [ ] Write failing unit tests for discovery/allowlist/schema mismatch, namespace stability independent of discovery order, invalid input/output, missing structured content, `isError`, 32 KiB response limit, atomic three-call budget, serialized concurrency, and repeated close.
- [ ] Write timeout/cancellation tests for connect/discovery (5 s), each call (15 s or remaining deadline), whole run (120 s), queue wait included in deadline, no automatic retry, modern protocol negotiation with legacy fallback rejection, abort signal reaches HTTP fetch and cooperative handler, and no floating handler work after timeout.
- [ ] Run focused adapter tests and confirm the pre-implementation failures.
- [ ] Implement a thin provider using the Task 1-proven `.tools()` interface and official SDK client; do not use `Promise.race` as a substitute for aborting work.
- [ ] Re-run focused adapter tests and verify client transport is closed exactly once on success, error, timeout, cancellation, and disconnect.

### Task 5: Wire tools into BuiltInAgent with a pre-output failure boundary and Stop lifecycle

**Files:**
- Create: `src/adapters/agents/run-scoped-agent.ts`
- Modify: `src/adapters/agents/chat-runtime.ts`
- Modify: `src/adapters/agents/chat-policy.ts`
- Modify: `src/server/chat/http.ts` only if request cancellation/status needs a boundary adjustment
- Modify: `src/contracts/chat.ts` for the four-step run and three-call caps if those limits belong in shared constants
- Create: `tests/chat/tool-runtime.test.ts`
- Extend: `tests/chat/runtime-policy.test.ts`
- Extend: `tests/integration/chat-runtime.test.ts`

**Interfaces:**
- Each run acquires the existing execution gate, opens a fresh run scope, performs MCP connect/initialize/discovery, and creates/delegates to BuiltInAgent with the validated provider. Set tool choice to `auto` and maximum model steps to 4; the MCP run scope separately enforces 3 tool executions total and 1 at a time.
- On technical tool failure, latch failure before any raw tool result or later assistant text reaches the model/browser; abort inner agent and calls, suppress ordinary success completion, emit one sanitized `RUN_ERROR` with the existing exact `CHAT_NOTICE`, release resources and gate once.
- Stop, unsubscribe, or request abort is interrupted; suppress late tool/assistant output, do not display a connection failure, and release the run scope once. Disabled MCP preserves existing C01 text-only behavior. Enabled-but-unavailable MCP fails closed before model call.

- [ ] Write failing tests using deterministic provider/agent doubles that prove the model receives actual handler output, and that MCP connect failure, token failure, `isError`, malformed output, and secret-bearing exceptions produce only `Chưa kết nối` before any assistant text/tool output leaks.
- [ ] Add tests for Stop during connection, tool call, and assistant continuation; assert status is interrupted, no late result is appended, scope closes once, execution gate releases, and the next run can proceed.
- [ ] Run focused runtime-policy and tool-runtime tests; observe failures.
- [ ] Implement lifecycle delegation using only the Task 1 verified CopilotKit runner/clone/subscription semantics; preserve model loop ownership. Read additional local Next guide pages required by the route wiring before editing it.
- [ ] Re-run focused runtime and HTTP integration tests. Assert enabled connector discovery failure stops before model invocation; disabled connector still answers plain text.

### Task 6: Preserve typed protocol transcript pairs, context, Retry, and C02 handoff

**Files:**
- Create: `src/contracts/chat-tools.ts`
- Modify: `src/adapters/agents/chat-client.ts`
- Modify: `src/ui/chat/controller.ts`
- Modify: `tests/chat/client-bridge.test.ts`
- Modify: `tests/chat/controller.test.ts`
- Create: `tests/chat/tool-transcript.test.ts`

**Interfaces:**
- Replace text-only run payloads with a serializable typed chat transcript that preserves assistant text, assistant tool calls, tool results, tool status, `toolCallId`, `runId`, `threadId`, tool name/version, validated input, validated output, and safe error code/status.
- Keep only complete successful call/result pairs in subsequent run context; interrupted/orphan calls never become replayable success. Trim history by whole pair. Retry reuses the original user message once, creates a new `runId`, and does not replay stale tool events as new events.
- Map CopilotKit's `RUN_FINISHED` cancellation outcome and synthetic stopped tool result to interrupted state; never persist/project the synthetic `{ status: "stopped", reason: "stop_requested" }` payload as business output.
- Define a `PersistedToolCallRecord` C02 handoff type with scope, IDs, connector/tool identity/version, validated input, status, validated output only when completed, timestamps, and safe error code. It is an interface only; this task adds no DB or durable storage.

- [ ] Write tests proving tool call/result messages survive adapter projection and the next user turn, stable IDs match, and text projection does not create fake assistant bubbles.
- [ ] Write controller tests for tool-pair atomic trimming, Stop preventing late pair append, Retry preserving one user message while using a new run ID, and incomplete calls excluded from future context.
- [ ] Run the focused transcript/client/controller Vitest tests and observe the missing typed records.
- [ ] Implement typed protocol conversion using actual AG-UI message shapes from installed `@ag-ui/client` types; do not flatten tool transport JSON into message text.
- [ ] Re-run focused tests and the existing Retry/Stop/New chat controller tests.

### Task 7: Render inline tool status and validated result without exposing transport data

**Files:**
- Create: `src/ui/chat/tool-renderers.tsx`
- Create: `src/ui/chat/tool-result-view.tsx`
- Modify: `src/ui/chat/white-chat-view.tsx`
- Modify: `src/ui/chat/message-views.tsx` or the typed transcript view selected by the existing CopilotKit message API
- Create: `tests/chat/tool-renderers.test.tsx`
- Extend: `tests/chat/transcript.test.tsx`

**Interfaces:**
- Render pending/running/completed/failed/interrupted states keyed by `toolCallId`; reconcile duplicate status events without terminal-state regression.
- Completed UI uses validated handler output, with a bounded generic result preview and a `calculate_budget` inline summary. Technical failure displays the single `Chưa kết nối` notice owned by chat controller; no second tool-level error copy.
- Copy action copies assistant/user text only, never MCP JSON or raw tool records. Renderer is presentation-only; browser has no MCP token/executor.

- [ ] Write component tests for status progression, duplicate/reordered events, validated budget values, oversized/truncated preview, interrupted partial run, safe failure text, and Copy excluding protocol records.
- [ ] Run focused renderer/transcript tests and observe failures.
- [ ] Implement render-only components using the current white chat styling and the confirmed CopilotKit tool render API.
- [ ] Re-run focused UI tests; verify no UI path reads backend credentials.

### Task 8: Complete end-to-end acceptance, second-tool extensibility, and documentation handoff

**Files:**
- Create: `tests/integration/business-mcp-agent.test.ts`
- Create: `tests/integration/business-mcp-security.test.ts`
- Create: `src/server/mcp/tools/example-second-tool/` test fixture definition/handler/schema (test-only registration; do not ship a fake assistant fallback)
- Modify: `docs/superpowers/specs/2026-10-06-chat-tools-context-design.md` only for implementation-derived contract corrections
- Modify: `docs/platform-build-spec.md` C03 status/plan link after actual completion

**Interfaces:**
- Integrated path: deterministic test model requests `business__calculate_budget`, official SDK reaches the real `/api/mcp/business` handler, validated result returns through the tool result to the model, and assistant text uses that exact result.
- A second independently registered/allowlisted tool is discoverable and callable through the same route/provider/UI with no chat transport or agent-loop edits for the new tool.
- Live-model smoke is separate and marked unverified until run with a configured tool-capable model. Durable history is explicitly deferred to C02.

- [ ] Add integration assertions for initialize/list/call over the real HTTP route; deterministic model call + actual budget handler + assistant answer; tool registration for a second tool; and all auth/schema/budget/timeout/oversized/cancel/failure cases from the spec.
- [ ] Run `bun install --frozen-lockfile` and confirm lockfile consistency.
- [ ] Run `bun run check`, `bun run test`, and `bun run build`; resolve regressions before final review.
- [ ] Run targeted E2E with a free port if the app must be started; confirm Send, Stop, Retry, New chat, copy behavior, and inline result in the white C01 UI. Do not take port 3100.
- [ ] If configured credentials and a tool-capable live model are available within this worktree without reading/copying another checkout's secrets, run and label a separate live-model smoke; otherwise mark it `not run` and make no live-AI claim.
- [ ] Confirm `git diff` contains only this worktree and C03-owned files; confirm no durable history claim or pgEdge app credential/reference was introduced.
- [ ] Update the C03 decision log to say code/plan status accurately, preserving C02 as the replay/persistence gate.

## Acceptance Checklist

- Official SDK Client initializes, lists, and calls the real `/api/mcp/business` endpoint; `calculate_budget` produces the documented real calculation.
- Deterministic model test shows tool selection → MCP handler output → assistant response derived from that output.
- A second custom tool can be added using definition/schemas/handler/catalog+allowlist only; chat transport, provider bridge, agent loop, and generic result renderer do not require tool-specific edits.
- Invalid input/output, bad token, denied tool, disallowed Host/Origin, timeout, max calls/concurrency, oversized request/result, `isError`, cancellation, and one-time cleanup are checked.
- Error boundary prevents raw errors/results from reaching the model, browser, or chat logs; the only technical notice is exactly `Chưa kết nối`.
- Stop is interrupted, no late output appears, and the following run can execute. Business outcomes such as over budget remain successful structured results.
- Follow-up retains complete call/result context; Retry does not duplicate the user message; C01 Send/Stop/Retry/New chat/copy/responsive behavior has no regression.
- C02 durable storage/reload/replay is explicitly not implemented. Deterministic test-model evidence and optional live-model smoke are reported separately.
