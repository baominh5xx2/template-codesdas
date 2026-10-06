# C05 Task 2 report

Implemented pure domain resolution and agent projection, with persisted-reference Zod validation.

- New-thread resolution keeps unset config generic and returns only an exact catalog entry; partial and unknown config fail with stable codes `domain_config_partial` and `domain_config_unknown`.
- Existing-thread resolution returns `available` only for exact active ID/version, `readOnly` for a pinned version still present in the catalog when active config differs or is unset, and `unavailable` when the pinned version is absent. It never rebinds.
- Agent projection includes the server prompt, reference, readiness, and only tools in the pack/server/allowlist/readiness intersection. It excludes rules and other definition internals. Unavailable tools are reported as omitted; missing required features mark the pack unavailable.

Validation:
- `bun run test -- tests/contracts/domain-resolution.test.ts` — passed, 9 tests.
- `bun run check` — blocked by existing compile errors in `tests/contracts/domain-pack.test.ts:49` and `:57`: `toolNames` is typed as `ReadonlySet<string>` but those tests call `.add`. This is outside Task 2 and was not changed.
- `git diff --check` — passed.

Commit: `e9a53cc feat(domains): resolve pinned packs for chat`.

Concern: `requirements` is the current domain definition's representation of required feature names; the projection uses it for readiness. `omittedOptionalTools` reports all manifest tools removed by the intersection because the current manifest schema has no required/optional tool distinction.

## Round 1 fixes

- Added `optional?: boolean` to domain tool references. Projection now makes the pack unavailable when a required tool is missing from the full intersection and lists only explicitly optional missing tools under `omittedOptionalTools`.
- Kept `domain_config_partial` for missing ID/version components and added `domain_config_invalid` for malformed, unsafe, fractional, or non-positive versions.
- Updated the two domain-pack test fixtures to replace their `ReadonlySet` values with new mutable sets rather than calling `.add()` through the readonly type.

Validation after fixes:
- `bun run test -- tests/contracts/domain-resolution.test.ts tests/contracts/domain-pack.test.ts` — passed, 22 tests.
- `bunx tsc --noEmit` — passed.
- `bun run check` — type generation and TypeScript passed; ESLint could not load because installed `es-abstract` is missing `2024/helpers/IsArray` (`node_modules` dependency issue).
- `git diff --check` — passed.
