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
