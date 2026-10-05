# Task 1 report: standalone skeleton bootstrap

## Result

Implemented and committed locally on `feat/starter-baseline` as `6e56512`
(`chore: finish standalone skeleton bootstrap`). No remote operation was run.

## Behavior and files

- `src/server/env.ts` defaults `APP_MODE` to `skeleton`, with optional validated
  `DATABASE_URL` and `SESSION_SECRET`; removed the gateway-key loader.
- `src/app/api/health/route.ts` returns status, mode, and version.
- Updated the home page and styles to a simple standalone shell; no font download
  or external configuration is needed.
- Kept the public `ErrorEnvelope` shape and masked internal errors.
- Removed gateway configuration from `.env.example`; added the TypeScript build
  info ignore rule.
- Restricted lint boundaries to UI/client imports, framework/server imports in
  contracts, and domain/adapter imports in core.
- Finalized the runnable config files, exact package pins, lockfile, and
  dependency notes. `pnpm-workspace.yaml` explicitly allows the `esbuild` and
  `unrs-resolver` install scripts required by the locked toolchain.
- Added tests for environment defaults, optional backend fields, malformed
  backend fields, public error masking, and health response behavior.
- Committed 21 files, including `tests/helpers/server-only.ts`, required by the
  Vitest alias.

## Test-first record

**RED command:**

```text
pnpm exec vitest run tests/contracts/env-errors.test.ts tests/integration/health.test.ts
```

The test runner did not start. Pnpm stopped before executing Vitest with:

```text
[ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY] Aborted removal of modules directory due to no TTY
```

After a frozen offline install began recreating `node_modules`, direct execution
of the cached Vitest entrypoint also could not start tests:

```text
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'std-env' imported from .../vitest/dist/chunks/env...
```

This is toolchain setup failure, not a behavioral test failure. The pnpm install
printed “Lockfile is up to date, resolution step is skipped” but continued
consuming CPU without creating `node_modules/.bin` links. I stopped that install
process (PID 20036) rather than leave it running. Therefore there is no observed
RED failure or GREEN pass for the changed tests.

**GREEN command (not run):**

```text
pnpm exec vitest run tests/contracts/env-errors.test.ts tests/integration/health.test.ts
```

The next checks, `pnpm check` and `pnpm build`, were not run because dependencies
were not linked and would trigger the same pnpm bootstrap issue.

## Other checks

- `git diff --cached --check` passed before commit.
- Repository status was clean immediately after commit.
- Pins in `package.json` and `pnpm-lock.yaml` were preserved from the interrupted
  bootstrap; no package version changes were made.

## Concern

Tests, typecheck/lint, and production build remain unverified until pnpm can
finish linking the lockfile dependencies. The repeated install/link process
appeared restricted or stalled in this environment; the controller may need to
run the frozen install outside the sandbox before the verification gate.

## Round-one follow-up

Review found that `next-env.d.ts` references generated declarations under
`.next`, while the original `check` script ran TypeScript first. It also noted
that the client import boundary uses a `.client.ts` / `.client.tsx` filename
convention.

The `check` script now runs `next typegen` before TypeScript and ESLint. The
README documents that App Router client component naming convention.

After the controller restored dependency linking outside the sandbox, these
commands completed successfully:

```text
pnpm exec next typegen
Generating route types...
✓ Types generated successfully

pnpm exec vitest run tests/contracts/env-errors.test.ts tests/integration/health.test.ts
Test Files  2 passed (2)
Tests       4 passed (4)

pnpm check
$ next typegen && tsc --noEmit && eslint .
Generating route types...
✓ Types generated successfully

pnpm build
▲ Next.js 16.3.8 (Turbopack)
✓ Compiled successfully
Finished TypeScript
Generating static pages ...
Route (app): /, /_not-found, /api/health
```

The earlier pnpm-linking concern is resolved. The initial pass could not observe
the tests' RED phase because Vitest could not start before the dependency restore;
the restored focused tests pass, and the clean-checkout type generation issue is
covered by the `check` script's explicit first step.
