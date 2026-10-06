# Local Docker stack

This setup implements the starter's previously chosen local topology: Next.js
app + PostgreSQL + pgEdge Postgres MCP in the `hackathon-starter-core` project.
Requires Docker Desktop with Linux containers and Bun 1.4.2 on the host.

**Scope correction — 2026-10-06:** pgEdge MCP is development tooling for the
coding agent only. The app accesses PostgreSQL through Drizzle/repositories.
C03 business tools run in a separate module at `/api/mcp/business` in Next.js;
they do not connect to pgEdge. Earlier app-to-pgEdge integration proposals are
superseded. This document records the existing stack and the required config
cleanup below; this docs-only change has not modified running containers.

## Start

From the starter repo root:

```sh
bun run docker:setup
bun run docker:up
bun run docker:check
bun run docker:status
```

`docker:setup` creates an ignored `.env.docker` with five independent random
credentials. Running it again preserves the file. No external AI key is needed
to build or start the stack. `docker:up` builds the app and waits for healthchecks.

| Service | Host endpoint | Internal endpoint | State |
| --- | --- | --- | --- |
| App | http://127.0.0.1:3100 | `app:3000` | Production standalone build, Node 24 LTS |
| PostgreSQL | `127.0.0.1:55432` | `db:5432` | PostgreSQL 18.6, database `starter` |
| pgEdge MCP | http://127.0.0.1:18080/mcp/v1 | `http://mcp:8080/mcp/v1` | MCP 1.1.0, bearer authentication |

All published ports bind to localhost. Change `APP_PORT`, `POSTGRES_PORT` or
`MCP_PORT` in `.env.docker` if another local process uses them, then run
`bun run docker:up` again. Named volumes and the network belong to this project.
Image digests and tested versions are recorded in `infra/images.lock.json`.

## Database boundary

The first initialization creates three roles:

- `starter_admin`: bootstrap administrator; used by the database container.
- `starter_app`: app connection role, owns `app` and `analytics` schemas.
- `starter_mcp`: can read tables in `analytics`; cannot read `app` data or write.

Compose supplies `DATABASE_URL` to the app using `starter_app`, not the admin
role. MCP uses `starter_mcp`, a read-only default and a five-second query timeout.
Future analytics tables created **as `starter_app`** inherit the SELECT grant.
Tables made by an admin/migration role need an explicit owner/grant decision.
`analytics.setup_probe` and `app.setup_probe` are labeled infrastructure fixtures.
This bootstrap does not create future chat-history or domain tables.

PostgreSQL 18 stores data under the volume mounted at `/var/lib/postgresql`.
Initialization runs only on a fresh volume. Keep `.env.docker` with its matching
volume: editing passwords later does not alter existing database roles.

## Coding-agent pgEdge MCP boundary

Use the `/mcp/v1` HTTP endpoint with `Authorization: Bearer <MCP_AUTH_TOKEN>`
from a trusted coding-agent MCP client. The token remains in ignored local
credentials/coding-agent configuration;
do not pass it to browser components. `/health` is the container health endpoint.
LLM proxy, embeddings, similarity search, knowledgebase search and connection
switching are disabled. MCP performs database queries without a provider key.

**Current config discrepancy:** Compose still supplies the unused pgEdge
`MCP_SERVER_URL` and `MCP_AUTH_TOKEN` to the app. The next infrastructure change
must remove these two app environment entries; keep `MCP_AUTH_TOKEN` only for
the pgEdge service and the coding-agent client. Do not reuse it for business MCP.
Do not register pgEdge tools in CopilotKit or add an app-to-pgEdge adapter.

The smoke script exercises pgEdge directly as a development-infrastructure
probe. C03 adds a business MCP server/client bridge independently; C02 adds
durable history. Existing app persistence remains a separate task.

## Optional local chat model

Edit only this starter's `.env.docker`, for example:

```dotenv
CHAT_MODEL_BASE_URL=http://host.docker.internal:11434/v1
CHAT_MODEL_ID=llama3.2
```

Then run `bun run docker:up`. A model running on the host is reached through
`host.docker.internal`; `localhost` inside the app container means the container.
No model is installed by this stack. With no model config, readiness is false
and the chat endpoint returns the standard `Chưa kết nối` notice.

## Lifecycle and verification

```sh
# Run only PostgreSQL and MCP while using bun run dev on the host.
bun run docker:infra

# Stop this stack and retain the named volumes.
bun run docker:down

# Diagnostics, limited to this Compose project.
node scripts/docker.mjs logs --tail 50 app mcp db
```

A host dev app needs a separate starter `.env.local` with its database URL
pointing to `127.0.0.1:55432`. The coding agent's pgEdge MCP client connects to
`http://127.0.0.1:18080/mcp/v1`; do not put that endpoint/token in app config.
The container names `db` and `mcp` are only available inside the Compose network.
Use the generated role credentials; do not reuse credentials from another repo.

Verified on 2026-10-06 with Linux/amd64 containers:

- Bun frozen install and the Next.js production Docker build succeed.
- All three services become healthy; app page, JavaScript asset and health return 200.
- App container resolves/connects to DB; generated app role authenticates and writes a probe inside a rolled-back transaction.
- MCP negotiates protocol `2025-06-18`, lists the expected DB tools and executes a synthetic SELECT.
- Missing/invalid MCP tokens, write queries and private-schema reads are rejected; DB grants also reject writes after overriding the read-only default.
- No-config chat response contains only `chat_unavailable` / `Chưa kết nối`.

The production build blocker at `src/server/chat/http.ts` was fixed by replacing
dynamic `import.meta.resolve` with the public `@ag-ui/core/schemas` import.

Sources: [pgEdge Docker deployment](https://github.com/pgEdge/pgedge-postgres-mcp/blob/main/docs/guide/deploy_docker.md),
[feature toggles](https://github.com/pgEdge/pgedge-postgres-mcp/blob/main/docs/guide/feature_config.md),
[Compose dependency readiness](https://docs.docker.com/compose/how-tos/startup-order/),
[PostgreSQL image layout](https://github.com/docker-library/docs/blob/master/postgres/content.md).

Final checks: type/lint and domain validation pass; the full unit/integration
suite passes 115 tests across 22 files. Smoke checks pass again after restarting
the dedicated DB/MCP containers, confirming the volume and credential setup survives restart.
