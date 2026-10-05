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

Node 24.14.1 and pnpm 11.25.0 are the observed local tool versions. The newer
`jsdom` 30.1.2 requires Node `^24.15.0`; 29.1.1 was selected for compatibility
with the installed Node 24.14.1. Next, React, and Vitest are pinned to stable
registry releases. No AI SDK is included in this bootstrap.
