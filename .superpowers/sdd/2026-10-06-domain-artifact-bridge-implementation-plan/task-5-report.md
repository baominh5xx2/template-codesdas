# C05 Task 5 report

## Outcome

Documented the C02/C03 ownership and integration boundary in `src/core/domains/README.md`, `src/core/artifacts/README.md`, and `docs/build-ownership.md`. The docs specify the C02 thread pack pin, authoritative scope/run/tool-call context, atomic persistence/outbox transaction, idempotency key/fingerprint behavior, `domain_result` event fields, scoped routes/history gate, and the exact `Chưa kết nối` technical failure projection. They also state that C03/model receives unchanged business output after successful publication.

Read-only inspection of the C03 worktree confirmed `calculate_budget` is a `BusinessTool` at version `1.0.0`, exposed as `business__calculate_budget`. The C05 sample domain and binding already match that contract.

Added a contract assertion proving the publication candidate uses the server-provided scope and correlation values, contains schema-validated output in the artifact/run input, and leaves the original output unchanged for the caller. Existing invalid-output and invalid-derived-value cases continue to assert the port is not called.

C02 transaction/thread persistence is absent from this C05 checkout. Scoped result/artifact routes and history hydration remain explicitly gated on C02; no end-to-end persistence claim is made.

## Verification

- `bun run vitest run tests/contracts/domain-pack.test.ts tests/contracts/domain-result-publication.test.ts tests/contracts/budget-domain-packs.test.ts` — passed, 3 files / 43 tests.
- `bun run domain:validate` — passed, 4 domain definitions validated.
- `bun run check` — Next type generation and `tsc --noEmit` passed; ESLint failed because installed `es-abstract@1.24.2` cannot resolve `2024/helpers/IsArray` through `eslint-plugin-react` / `eslint-config-next`.
- `bun run build` — failed because Turbopack could not resolve `next/package.json` from this worktree's `src/app`; the local `node_modules/next` dependency is unavailable or broken.
- `git diff --check` — passed.

## Follow-up cleanup

Removed two unused locals from the contract test files without changing behavior. The subsequent `bun run check` passed, including Next route type generation, TypeScript, and ESLint, with no warnings. This successful rerun supersedes the earlier ESLint failure above; the separate build dependency resolution failure remains as recorded.

## Commit

`docs(domains): document C02 C03 integration boundary`
