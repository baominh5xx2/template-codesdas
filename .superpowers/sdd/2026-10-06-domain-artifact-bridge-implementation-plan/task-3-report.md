# Task 3 report — atomic domain-result publication contract

Status: implemented in the C05 worktree; committed as `feat(artifacts): define atomic domain result publication`.

## Changes

- Added `DomainResultPublicationInput` and candidate/publication DTOs for scope, thread/execution/tool identities, pinned pack, binding, validated output, artifact registry, and server clock/ID generation.
- Added `DomainResultPublicationPort.publish(candidate)`. Its contract requires one atomic persistence operation and uniqueness/fingerprint idempotency for `(workspaceId,userId,threadId,agentRunId,toolCallId,bindingId)`. No production adapter or in-memory fallback was added.
- Added `publishDomainToolResult`. It returns the caller's original output unchanged and a separate nullable publication reference. For a bound output it validates the output schema and 32 KiB limit, `toRunInput` and input schema, artifact draft identity and registered artifact envelope, empty workflow steps, presenter blocks, references available to this service, the shared ResultView schema, 32-block limit, and 64 KiB view limit before the single port call.
- Business result IDs are server-generated and carried as `ArtifactEnvelope.runId` and `ResultView.runId`. The snapshot is a completed result collection with `steps: []`; the key contains only workspace/user/thread/agent-run/tool-call/binding identities.
- Unbound outputs return no publication and do not call the port. Technical failures are internal errors for the C03 boundary to project as exactly `Chưa kết nối`.
- Added eight fake-port behavioral tests for successful publication, empty steps and business ID propagation, same-payload retry, same-key conflict, invalid tool output, invalid run input, invalid artifact draft, invalid presenter block, and unbound output.

## Validation

- `bun run test -- tests/contracts/domain-result-publication.test.ts`: passed, 8 tests.
- `bun run check`: Next type generation and `tsc --noEmit` passed. ESLint could not start because the installed dependency tree is missing `es-abstract/2024/helpers/IsArray`, required from `eslint-plugin-react`; this is an environment/dependency installation issue before project linting.
- `git diff --check`: passed.
- RED phase: the initial focused test run failed because `@/core/artifacts/publication` did not exist. The focused suite then passed after implementation.

## Integration boundary and concerns

- C02 persistence/thread APIs are absent from this base, so there is intentionally no transaction implementation, history storage, cancel serialization, or C02 event append here. The service only offers the atomic port contract; C02 must implement it and return the existing publication on matching retries or reject the same key with a different fingerprint.
- This input does not provide scoped source/evidence/dataset/claim resolvers. Accordingly, publication rejects artifacts with source/evidence references and presenter blocks that refer to unresolved reference data. Current reference checks permit a block's `artifactId` only when it is the artifact produced by this binding; ResultViewSchema validates block IDs and report-section links.
- C03 owns MCP execution and the final model-facing tool output. This service does not create a second executor or modify that output.
- The C03 worktree reports tool versions as semver strings while this base's Task 1/2 `DomainResultBinding.toolVersion` is numeric. Task 3 treats the binding as opaque and does not format or compare its version; the shared contract needs the separately reported compatibility adaptation before integration.
