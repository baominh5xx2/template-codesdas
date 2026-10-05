# Dependency baseline

Packages are pinned to exact production-stable releases from the official npm
registry. The lockfile captures transitive versions. Metadata was checked on
2026-10-05 against each package's official registry record at
`https://registry.npmjs.org/<package>`.

| Package | Version | Role |
| --- | ---: | --- |
| `next` | `16.3.8` | App framework; Node `>=20.9.0`, React 19 peer supported |
| `react` / `react-dom` | `19.3.0` | UI runtime |
| `zod` | `4.6.5` | Environment validation |
| `drizzle-orm` | `0.45.3` | Database access |
| `pg` | `8.23.1` | PostgreSQL driver |
| `server-only` | `0.0.1` | Server import boundary |
| `@copilotkit/react-core` | `1.77.0` | CopilotKit React core bindings |
| `@copilotkit/runtime` | `1.77.0` | CopilotKit runtime execution engine |
| `ai` | `6.0.300` | AI SDK core; Vercel AI language model interface |
| `@ai-sdk/openai` | `3.0.124` | OpenAI provider for Vercel AI SDK |
| `@ag-ui/client` | `1.0.1` | AG-UI client protocol schemas and types |
| `rxjs` | `7.8.1` | Reactive streams for agent execution pipeline |
| `typescript` | `6.0.3` | Type checking; latest stable 7.x is incompatible with `typescript-eslint` peer `<6.1.0` |
| `eslint` / `eslint-config-next` | `10.12.0` / `16.3.8` | Lint rules; config accepts ESLint `>=9` |
| `vitest` | `5.0.3` | Unit tests; Node `>=24.0.0` supported |
| `vite` | `8.3.2` | Vitest runtime peer |
| `jsdom` | `29.1.1` | DOM test environment; supports Node `>=24.0.0` |
| `tsx` | `4.23.15` | TypeScript execution utility |
| `drizzle-kit` | `0.31.11` | Schema and migration CLI |
| `@playwright/test` | `1.63.0` | Browser test runner |
| `@testing-library/react` | `16.3.3` | React test utilities |
| `@testing-library/jest-dom` | `7.0.1` | DOM assertions |
| `@testing-library/dom` | `10.4.2` | Testing Library peer |
| `dotenv` | `18.0.5` | Local env file helper |
| `@types/node` | `24.19.1` | Node 24 declarations |
| `@types/react` / `@types/react-dom` | `19.3.0` / `19.3.0` | React declarations |
| `@types/pg` | `8.23.1` | PostgreSQL declarations |

Node 24.14.1 and Bun 1.4.2 are the observed local tool versions. The newer
`jsdom` 30.1.2 requires Node `^24.15.0`; 29.1.1 was selected for compatibility
with the installed Node 24.14.1. Next, React, and Vitest are pinned to stable
registry releases. Chat foundation packages (`@copilotkit/*`, `ai`, `@ai-sdk/openai`,
`@ag-ui/client`, `rxjs`) are pinned to verified compatible versions for C01 local chat model
and execution policy runtime.

## Package manager

On 2026-10-06 the starter moved to **Bun 1.4.2**, verified against the
[official stable release](https://github.com/oven-sh/bun/releases/tag/bun-v1.4.2).
`package.json` pins Bun, and `bunfig.toml` uses exact dependency versions and
the isolated linker. `bun.lock` replaces the pnpm lockfile; direct dependency
pins are preserved. See [Bun lockfile documentation](https://bun.com/docs/pm/lockfile).
Only `esbuild` and `unrs-resolver` are trusted to run dependency lifecycle scripts.

Use `bun install --frozen-lockfile` for a reproducible install and `bun run`
for project scripts. Use `bun run test` for Vitest; `bun test` selects a different
runner. Node remains the runtime for the existing Next.js and test scripts;
this migration does not add `--bun`.

Migration validation on 2026-10-06: `bun install --frozen-lockfile`,
`bun run check`, `bun run test` (96 tests), and `bun run domain:validate`
(4 domains) passed. `bun run build` compiled and typechecked, then failed
collecting the CopilotKit route at `src/server/chat/http.ts:15`, where the
existing runtime code calls `import.meta.resolve` in the Next.js bundle.
Production build acceptance remains open for that runtime integration.