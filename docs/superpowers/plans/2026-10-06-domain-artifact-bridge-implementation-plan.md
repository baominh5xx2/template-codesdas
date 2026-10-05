# C05 Domain Plug-in & Artifact Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let server-registered domain packs configure a chat and turn validated business-tool outputs into immutable, typed, replayable result projections without replacing C02 history or C03 tool transport.

**Architecture:** Extend the existing `DomainDefinition` and artifact/view contracts. Keep pack resolution and agent projection pure, then pass validated bound-tool outputs to an atomic publication port that the C02-owned persistence adapter can implement. No parallel chat runner, MCP client, transcript store, or fixture fallback is introduced.

**Tech Stack:** Next.js 16 Node runtime, TypeScript 6, Bun 1.4.2 scripts/package manager, Zod 4, Vitest, existing Drizzle/PostgreSQL dependency and shared contracts.

**Spec:** `docs/superpowers/specs/2026-10-06-domain-artifact-bridge-design.md`

## Global Constraints

- Work only in `E:\thucchienai\hackathon-starter-kit\worktree\domain-artifact-bridge`, branch `feat/domain-artifact-bridge`; do not edit the original checkout or sibling worktrees.
- Use Node runtime. Use Bun 1.4.2 for package management and scripts; do not use npm, pnpm, or Bun's native test runner.
- C02 owns thread lifecycle, authoritative message/execution identity, persistence/replay and delete retention. C05 must consume ports and must not create a transcript store or a second global execution gate.
- C03 owns business tool definitions, MCP transport, tool validation/execution, budgets, cancellation, and error projection. C05 must not fork its client/provider/runtime or execute tools itself.
- One local user only. Pack choice and rules are server-owned; browser/model input cannot change pack, identity, scope, or permissions.
- Technical failures shown in chat are exactly `Chưa kết nối`; do not return raw exception/provider/database details or fixture success.
- Reuse existing `ArtifactEnvelope`, `RunSnapshot`, `UIBlock`, and `ResultView` contracts. `ArtifactEnvelope.runId` and `ResultView.runId` mean `businessRunId`, never C03 `agentRunId`.
- A successful bound tool call publishes at most one immutable artifact and one `ResultView`; unbound calls and ordinary chat create no business run.
- Keep `chat-tools-mcp` and all sibling worktrees untouched; do not merge or push this branch.

---

### Task 1: Extend the domain pack contract and validate chat/result bindings

**Files:**
- Modify: `src/core/domains/definition.ts`
- Modify: `src/core/domains/validation.ts`
- Modify: `src/domains/catalog.server.ts`
- Modify: `src/domains/_template/index.server.ts`
- Test: `tests/contracts/workflow-domain.test.ts`
- Test: `tests/contracts/domain-pack.test.ts`

**Interfaces:**
- Add `DomainResultBinding` with `id`, `toolName`, `toolVersion`, `outputSchema`, `artifactKind`, `artifactVersion`, `inputSchema`, `toRunInput(output): JsonValue`, and `toArtifactDraft(output): ArtifactDraft<JsonValue>`; callbacks are server-only and are never serialized in `DomainManifest`.
- Extend `DomainDefinition` with optional `tools`, `resultBindings`, `requirements`, and `rules`; make `workflow` optional while preserving the existing workflow pack shape.
- `validateDomain(domain, catalog)` continues validating workflow packs and validates chat packs through registered tool names and artifact schemas. A required artifact kind must have either a workflow producer or a matching binding.
- Reject duplicate binding IDs, duplicate tool/version bindings, unregistered tools/sources/artifact schemas, conflicting pack identity/version registrations, and unsupported output producers with stable error codes.

- [ ] Add regression tests proving existing workflow domains remain valid and a chat-only pack with one registered tool/schema validates without a workflow.
- [ ] Add negative tests for duplicate/unknown tool bindings, schema-version mismatch, missing producer, unregistered source, and duplicate pack identity.
- [ ] Run `bun run test -- tests/contracts/workflow-domain.test.ts tests/contracts/domain-pack.test.ts`; confirm new assertions fail before implementation.
- [ ] Extend the existing definition and validator; do not add a parallel `ChatDomainPack` interface or fake empty workflow.
- [ ] Update `_template` to demonstrate an optional workflow and typed binding without executing model/network/database work.
- [ ] Re-run the focused contract tests and `bun run domain:validate`.
- [ ] Commit as `feat(domains): validate chat result bindings`.

### Task 2: Resolve deployment/thread pack identity and project safe agent configuration

**Files:**
- Create: `src/core/domains/resolution.ts`
- Create: `src/core/domains/runtime-projection.ts`
- Create: `tests/contracts/domain-resolution.test.ts`
- Modify: `src/contracts/domains.ts`

**Interfaces:**
- `DomainReferenceSchema` is `{ id: string; version: number }`.
- `resolveDomainForNewThread({ active, catalog })` returns `{ kind: "generic" }` when both active env values are unset; returns `{ kind: "domain", reference, manifest }` only for a fully registered active pack; partial/unknown config throws a safe coded error and never selects another pack.
- `resolveDomainForExistingThread({ pinned, active, catalog })` returns `readOnly` when the saved version is available but differs from active, and `available` only for an exact ID/version match; it never rebinds a thread.
- `projectDomainForAgent(domain, { registeredToolNames, deploymentAllowlist, readyFeatures })` returns server-owned `systemPrompt`, exact permitted tool names, public reference, and readiness; tools are the intersection of pack registration, server catalog, allowlist, and readiness.
- These functions are pure and accept the C02 persisted thread reference as input; they do not read environment, DB, browser payload, or CopilotKit state directly.

- [ ] Write tests for generic unset config, partial config, unknown config, exact thread pin, old-version read-only, no rebind, and tool-set intersection.
- [ ] Run `bun run test -- tests/contracts/domain-resolution.test.ts` and confirm expected failures.
- [ ] Implement Zod reference DTO plus pure resolver/projection functions with stable safe error codes.
- [ ] Verify projection contains no handlers, rules, secrets, or client-supplied identities; ensure optional missing tools are omitted and required missing features make the pack unavailable.
- [ ] Run focused tests and `bun run check`.
- [ ] Commit as `feat(domains): resolve pinned packs for chat`.

### Task 3: Publish a bound tool result through an atomic C02-owned port

**Files:**
- Create: `src/contracts/domain-results.ts`
- Create: `src/core/artifacts/publication.ts`
- Create: `src/core/artifacts/definition.ts`
- Modify: `src/core/ports/definition.ts`
- Test: `tests/contracts/domain-result-publication.test.ts`

**Interfaces:**
- `DomainResultPublicationInput` carries only server-resolved `Scope`, `threadId`, `agentRunId`, `toolCallId`, pinned pack ref, binding ID, already schema-validated tool output, registered artifact registry, and clock/ID ports.
- `DomainResultPublicationPort.publish(input)` atomically persists a result `RunSnapshot` (`steps: []`), one `ArtifactEnvelope`, server-generated correlation binding, immutable `ResultView` (`revision: 1`), pack metadata snapshot, and outbox reference; it enforces uniqueness on `(workspaceId,userId,threadId,agentRunId,toolCallId,bindingId)`.
- `publishDomainToolResult(input, port)` validates output, binding input and artifact draft; creates a candidate completed snapshot; runs the pure presenter; validates the shared `UIBlockSchema`/`ResultViewSchema` and size/block limits; then invokes `port.publish` once. A repeated same-key/same-fingerprint request returns the existing publication; a conflicting payload is rejected.
- C05 provides the port/service contract only when no C02 PostgreSQL transaction/repository is available in this worktree. It must not ship an in-memory or non-atomic production fallback.

- [ ] Add fake-port behavioral tests for successful publish, no workflow steps, businessRunId propagation, same-payload idempotency, same-key conflict, invalid output rollback/no port call, invalid presenter block/no port call, and ordinary unbound output producing no publication.
- [ ] Run `bun run test -- tests/contracts/domain-result-publication.test.ts`; confirm failures before implementation.
- [ ] Implement the typed publication port and service; keep the original validated tool output unchanged for the caller and return a separate domain-result reference.
- [ ] Re-run focused tests and `bun run check`.
- [ ] Commit as `feat(artifacts): define atomic domain result publication`.

### Task 4: Add a real budget pack and compact acceptance variant

**Files:**
- Create: `src/domains/examples/budget-review/schemas.ts`
- Create: `src/domains/examples/budget-review/index.server.ts`
- Create: `src/domains/examples/budget-review/manifest.client.ts`
- Create: `src/domains/examples/budget-review/presenter.ts`
- Create: `src/domains/examples/budget-compact/index.server.ts`
- Create: `src/domains/examples/budget-compact/manifest.client.ts`
- Create: `tests/contracts/budget-domain-packs.test.ts`
- Modify: `src/domains/catalog.server.ts`
- Modify: `src/domains/catalog.client.ts`

**Interfaces:**
- Both packs reference the stable C03 exposed tool `business__calculate_budget@1` and shared `budget.summary@1` schema; they do not define handlers or call an MCP client.
- Budget Review presenter returns two metric blocks and an over-budget warning only when `overBudget` is true. Budget Compact returns a Markdown summary. Both use real validated tool output and empty source/evidence arrays.
- Catalog registration is explicit and validates against the C03 tool catalog at composition time; it does not silently advertise an unavailable tool.

- [ ] Test both pack identities, shared tool/artifact contracts, distinct prompts/presenters, exact budget metrics, valid over-budget warning, and no invented evidence.
- [ ] Run the focused pack test and observe missing exports/behavior.
- [ ] Implement the schemas, server definitions, client-safe manifests, pure presenters, and explicit catalog wiring using the C03 contract consumed by the existing integration plan.
- [ ] Re-run focused pack tests, `bun run domain:validate`, `bun run check`, and relevant C03 compatibility tests when its changes are available in the shared base.
- [ ] Commit as `feat(domains): add budget result packs`.

### Task 5: Verify C02/C03 handoff boundaries and document integration gate

**Files:**
- Create: `src/core/domains/README.md`
- Create: `src/core/artifacts/README.md`
- Modify: `docs/build-ownership.md`
- Test: `tests/contracts/domain-pack.test.ts`
- Test: `tests/contracts/domain-result-publication.test.ts`

**Interfaces:**
- Document the exact C02 thread pin/outbox/persistence handoff and C03 post-validation/pre-resolve publication hook without modifying either owner’s runtime implementation.
- Add a contract test proving the publication port receives only validated output and server-resolved scope/correlation fields.
- Final verification runs focused tests, `bun run domain:validate`, `bun run check`, and `bun run build`.

- [ ] Add the C02/C03 ownership and wiring guide, including failure boundary and `Chưa kết nối` behavior.
- [ ] Verify the C03 source contains a compatible BusinessTool registration/version contract; if it has changed, adapt only C05-owned types and tests without editing C03 files.
- [ ] Run focused tests, domain validation, check, and build; record exact outcomes.
- [ ] Commit as `docs(domains): document C02 C03 integration boundary`.

## Plan Self-Review

- Contract/validation, server resolution, result publication, sample packs, and handoff docs are each assigned to tasks above.
- C05 does not claim a PostgreSQL transaction implementation without the C02-owned DB adapter; it defines the atomic port and tests observable idempotency/validation boundaries.
- The sample pack task depends on the C03 tool contract and therefore follows the shared stable names and schemas already specified in the C03 plan.
- No app route is added until the C02 thread ownership/read API boundary is available; no parallel persistence or generic chat renderer is introduced.
- All tests and commands use Bun scripts; no “fake workflow” is used for chat-only packs.
