# 01 — Document Foundation Implementation Plan

**Execution update — user directive 2026-10-05:** Starter độc lập. Build/test/demo không cần API key hoặc tài liệu của BTC; không đọc repo thi hay cấu hình của họ. Demo adapter là default rõ nhãn cho local development; optional generic gateway adapter để cắm sau, không có live-AI gate bắt buộc trong baseline. Thiếu external gateway là unavailable, không phải lý do dừng triển khai. Production vẫn không tự bật fixture.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Một app local upload/tải document, extraction/analysis/evidence và dashboard/report chạy end-to-end.

**Architecture:** Đặt contracts, artifact executor và sequential runner trước. Document archetype là consumer đầu tiên; adapters được inject ở server/container.ts, UI đọc ResultView từ artifact service.

**Tech Stack:** Next.js App Router, TypeScript, Zod, Postgres/Drizzle, CopilotKit v2, optional AI Gateway, local pgEdge MCP; Vitest + Playwright.

**Spec:** [Design v0.3](../specs/2026-10-05-hackathon-plug-and-play-design.md)

**Prerequisite:** Đọc master plan và design v0.3. Không có application source hiện tại.

## Global Constraints

- Repo chuẩn bị ở E:/thucchienai/hackathon-starter-kit. Repo thi aitc2026-team-939-triplepeek nằm ngoài phạm vi thao tác. Không tự chuyển source, cấu hình remote hay push sang repo thi.
- Chọn modular monolith: một app Next.js + TypeScript + BFF + CopilotKit runtime, Postgres Docker + Drizzle, mọi lời gọi model qua optional AI Gateway.
- pgEdge Postgres MCP được chọn làm service host local cho database exploration/query; mỗi domain chỉ bật các database tools thực sự cần.
- P0 chạy tuần tự. Dependency chỉ được tham chiếu một step trước đó.
- Default deadline toàn run 120 giây, mỗi step tối đa 30 giây trong ngân sách còn lại.
- Research: maxSources 8, fetch concurrency 3, deadline mỗi fetch 15 giây, response max 5 MB.
- File max 20 MB, parse resource limits, không execute macro.
- Retry tối đa hai attempts cho transient read/model failure trong deadline; JSON repair tối đa một call và tính vào cùng budget.
- P0 không có worker, queue, leases, parallel DAG, automatic resume hoặc durable business SSE.
- Agent không generate JSX, component path hay executable JavaScript.
- Capability tạo ArtifactDraft; executor gắn metadata và lưu artifact + step state qua một transaction ngắn.
- Chat và dashboard gọi cùng core services, workflow, artifact store và presenter.
- User/workspace identity lấy từ server session; raw pgEdge SQL tools chỉ dành cho trusted local operator.
- Không scaffold application hoặc chạy Docker trong lượt viết plan này. Các lệnh dưới đây dành cho lượt execution.
- Commit chỉ local tại repo riêng. Không dùng git add . và không tự cấu hình remote/push.

### Quy ước execution chung

Mọi đường dẫn Files bên dưới tương đối với repo root trên. Chạy PowerShell tại root đó. Đọc master plan và spec trước mỗi phase. Dependencies từ npm registry cài bằng bun add --exact, commit bun.lock; version SDK và image được ghi sau khi compatibility checks thật pass, không coi version latest là compatibility guarantee.

Test red phải thất bại vì behavior/import chưa triển khai, không phải vì thiếu Docker/env ngoài task. Unit tests dùng fakes có nhãn fixture; integration tests cần services được khởi động rõ ràng. Baseline chạy bằng demo/fixture adapter, không cần external AI credentials hoặc tài liệu BTC. Generic gateway config là optional extension; không có live-AI acceptance gate bắt buộc. Không đọc .env/key files ở repo thi, không ghi secret vào output.

Một task có thể cần nhiều vòng 2–5 phút cho các files nhỏ. Mỗi task có test cycle và local commit riêng; không gộp cả phase thành một lần viết code lớn.

## Task order

A1 → A2 → A3 → A4 → A5 → A6 → A7 → A8 → A9. Gate1 là document product chạy được; chat integration chưa thuộc phase này.

### Task A1: App bootstrap, env contract và public error envelope

**Files:**
- Create: package.json, bun.lock, tsconfig.json, next.config.ts, eslint.config.mjs, vitest.config.ts, playwright.config.ts
- Create: src/app/layout.tsx, src/app/page.tsx, src/app/globals.css, src/app/api/health/route.ts
- Create: src/server/env.ts, src/contracts/errors.ts, .env.example, docs/dependencies.md
- Create: tests/helpers/server-only.ts; Test: tests/contracts/env-errors.test.ts

**Interfaces:**
- Consumes: Spec v0.3; repo chưa có app.
- Produces: loadServerEnv(values:Record<string,string|undefined>):ServerEnv; toPublicError(error:unknown,traceId:string):ErrorEnvelope; GET /api/health; bun run check/test/build scripts. ServerEnv có DATABASE_URL, SESSION_SECRET, AI config optional cho fixture mode; loadLiveGatewayConfig bắt buộc đủ AI fields.

- [ ] **Step 0: Chuẩn bị test infrastructure thuộc task**

Chạy bun init --bare tại root, rồi bun add --exact next react react-dom zod drizzle-orm pg server-only; bun add --dev --exact typescript @types/node @types/react @types/react-dom @types/pg vitest tsx drizzle-kit eslint eslint-config-next @playwright/test @testing-library/react @testing-library/jest-dom jsdom dotenv. Cấu hình Vitest alias @/ → src/ và server-only → tests/helpers/server-only.ts (export {}); không alias server-only ở app build. Ghi versions/engines thực tế vào docs/dependencies.md. Chưa import SDK hoặc gọi network trong test.

- [ ] **Step 1: Viết test behavior**

```ts
import { expect, it } from "vitest";
import { loadServerEnv } from "@/server/env";
import { toPublicError } from "@/contracts/errors";

it("requires a session secret and masks internal credentials", () => {
  expect(() => loadServerEnv({ DATABASE_URL: "postgres://local/test" })).toThrow();
  const error = toPublicError(new Error("token=private-value"), "trace-1");
  expect(JSON.stringify(error)).not.toContain("private-value");
  expect(error.traceId).toBe("trace-1");
});
```

- [ ] **Step 2: Xác nhận RED**

Run: `bun run vitest run tests/contracts/env-errors.test.ts`
Expected: FAIL tại import/behavior chưa triển khai, sau khi prerequisites của task đã sẵn sàng.

- [ ] **Step 3: Triển khai phần tối thiểu**

Dùng Zod cho env, không log input env. Public error chứa code/message/retryable/traceId; generic internal message không chứa cause/stack. Fixture mode là chế độ dev rõ ràng và không được bật mặc định trong production. Thêm import-boundary lint: client/UI không import server/adapters/capabilities; core không import domain cụ thể. Root page link workspace/playground có trạng thái chưa có domain thay vì route crash.

```ts
import { z } from "zod";

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  AI_GATEWAY_BASE_URL: z.url().optional(),
  AI_GATEWAY_API_KEY: z.string().min(1).optional(),
  AI_MODEL: z.string().min(1).optional(),
});
export const loadServerEnv = (values: Record<string, string | undefined>) =>
  serverEnvSchema.parse(values);

export function toPublicError(_error: unknown, traceId: string) {
  return { code: "internal_error", message: "Không thể hoàn tất thao tác.",
    retryable: false, traceId };
}
```

- [ ] **Step 4: Xác nhận GREEN**

Run: `bun run vitest run tests/contracts/env-errors.test.ts`
Additional run: `bun run check; bun run build`
Expected: Env/error tests pass, TS/lint/build pass, health route không expose secrets. Package scripts: dev=next dev --hostname 127.0.0.1, check=tsc --noEmit + eslint, test=vitest run, build=next build, e2e=playwright test, db:generate/drizzle-kit generate, db:migrate/drizzle-kit migrate.

- [ ] **Step 5: Commit local**

```powershell
git -C E:/thucchienai/hackathon-starter-kit add -- package.json bun.lock tsconfig.json next.config.ts eslint.config.mjs vitest.config.ts playwright.config.ts src/app src/server/env.ts src/contracts/errors.ts .env.example tests/helpers/server-only.ts tests/contracts/env-errors.test.ts docs/dependencies.md
git -C E:/thucchienai/hackathon-starter-kit commit -m 'chore: bootstrap isolated starter and server boundaries'
```

### Task A2: JSON-safe artifact, document/run contracts và 19 block schemas

**Files:**
- Create: src/contracts/common.ts, artifacts.ts, documents.ts, datasets.ts, evidence.ts, runs.ts, sources.ts, domains.ts
- Create: src/contracts/ui/blocks.ts, result-view.ts, schemas/metric.ts, chart.ts, table.ts, insight.ts, recommendation.ts, risk.ts, warning.ts, source.ts, evidence.ts, verdict.ts, timeline.ts, progress.ts, action.ts, map.ts, place.ts, comparison.ts, report-section.ts, markdown.ts, media.ts
- Create: src/core/ports/definition.ts, src/core/capabilities/schema-registry.ts; Test: tests/contracts/artifacts-blocks.test.ts

**Interfaces:**
- Consumes: A1 test/toolchain; DTO and UI props ledgers trong master.
- Produces: Tất cả A2 ledger exports; ArtifactEnvelopeSchema, UIBlockSchema, ResultViewSchema; createArtifactRegistry():ArtifactSchemaRegistry với register(kind,version,schema):void, has(kind,version):boolean và parse(artifact):Artifact<unknown>.

- [ ] **Step 1: Viết test behavior**

```ts
import { expect, it } from "vitest";
import { ArtifactEnvelopeSchema } from "@/contracts/artifacts";
import { UIBlockSchema } from "@/contracts/ui/blocks";
import { createArtifactRegistry } from "@/core/capabilities/schema-registry";
import { z } from "zod";

it("rejects unknown blocks, non-JSON data and unregistered schema versions", () => {
  expect(UIBlockSchema.safeParse({ id:"x", type:"jsx", props:{} }).success).toBe(false);
  const valid = {id:"a1",kind:"example/extracted-data",version:1,
    workspaceId:"w1",runId:"r1",stepId:"extract",data:{amount:1},
    provenance:{sourceIds:[],evidenceIds:[],derivedFrom:[]},
    createdAt:"2026-10-05T00:00:00Z"};
  expect(ArtifactEnvelopeSchema.safeParse(valid).success).toBe(true);
  expect(ArtifactEnvelopeSchema.safeParse({...valid,data:new Date()}).success).toBe(false);
  const registry = createArtifactRegistry();
  registry.register("example/extracted-data",1,z.object({amount:z.number()}));
  expect(registry.parse(valid).data).toEqual({amount:1});
  expect(() => registry.parse({...valid,version:2})).toThrow("artifact_schema_unregistered");
});
```

- [ ] **Step 2: Xác nhận RED**

Run: `bun run vitest run tests/contracts/artifacts-blocks.test.ts`
Expected: FAIL tại import/behavior chưa triển khai, sau khi prerequisites của task đã sẵn sàng.

- [ ] **Step 3: Triển khai phần tối thiểu**

Tạo các schemas theo đúng ledger; type infer từ schema, không duplicate TS union bằng tay. Artifact provenance có sourceIds/evidenceIds/derivedFrom luôn hiện diện. Envelope reject non-JSON values và bắt workspace/run/step IDs. Registry reject duplicate kind/version có schema khác; parse unknown kind/version throws artifact_schema_unregistered trước decode data. has(kind,version) phục vụ validator. UI range validation: lat [-90,90], lng [-180,180], completeness [0,1], pageSize [1,100], score trong min/max hoặc null. report-section cycles kiểm tra ở ResultView validator.

```ts
import { z } from "zod";

export const ProvenanceSchema = z.object({
  sourceIds: z.array(z.string().min(1)),
  evidenceIds: z.array(z.string().min(1)),
  derivedFrom: z.array(z.string().min(1)),
});
export const MetricBlockSchema = z.object({
  id: z.string().min(1),
  type: z.literal("metric"),
  props: z.object({
    label: z.string(), value: z.number().finite().nullable(),
    unit: z.string().optional(), delta: z.number().finite().optional(),
    sourceIds: z.array(z.string()),
  }).strict(),
}).strict();
```

- [ ] **Step 4: Xác nhận GREEN**

Run: `bun run vitest run tests/contracts/artifacts-blocks.test.ts`
Additional run: `bun run check`
Expected: 19 schema entries có cùng canonical type names trong master; invalid schema version/non-JSON/unknown UI type bị reject; schema modules không import server or React.

- [ ] **Step 5: Commit local**

```powershell
git -C E:/thucchienai/hackathon-starter-kit add -- src/contracts src/core/ports/definition.ts src/core/capabilities/schema-registry.ts tests/contracts/artifacts-blocks.test.ts
git -C E:/thucchienai/hackathon-starter-kit commit -m 'feat: define artifact and UI contracts'
```

### Task A3: Postgres repository, session scope và atomic step checkpoint

**Files:**
- Create: compose.yaml, drizzle.config.ts, infra/postgres/init/001-roles.sh, scripts/setup-local-env.ps1
- Create: src/adapters/postgres/client.ts, repositories.ts, schema/app.ts, schema/analytics.ts, migrations/
- Create: src/adapters/storage/local-files.ts, src/server/session.ts, src/server/container.ts
- Create: tests/helpers/memory-repositories.ts, runtime.ts; Test: tests/integration/repositories.test.ts

**Interfaces:**
- Consumes: A2 ports/DTOs; A1 env. DATABASE_URL chỉ trỏ DB của repo riêng.
- Produces: Run/Artifact/Upload/Dataset repositories theo ledger; createMemoryRepositories/createTestContext test helpers; requireScope(request:Request):Promise<Scope>; local storage; Postgres app/analytics schemas.

- [ ] **Step 0: Chuẩn bị test infrastructure thuộc task**

Khởi động chỉ Postgres bằng docker compose --env-file .env.local up -d postgres sau khi script tạo random session/DB credentials. Integration command phải dùng DATABASE_URL_TEST riêng cho test tables; không dùng DB thi. Docker unavailable là runtime prerequisite cần giải quyết trước GREEN, không skip test rồi claim pass.

- [ ] **Step 1: Viết test behavior**

```ts
import { expect, it } from "vitest";
import { createMemoryRepositories } from "../helpers/memory-repositories";

it("claims a run once and hides another workspace's artifacts", async () => {
  const repo = createMemoryRepositories();
  const a = { userId: "u-a", workspaceId: "w-a", trustedOperator: false };
  const b = { userId: "u-b", workspaceId: "w-b", trustedOperator: false };
  const run = await repo.runs.create(a, "document-review", 1, { text: "abc" });
  expect(await repo.runs.claim(a, run.id, new Date(Date.now()+120000).toISOString())).toBe(true);
  expect(await repo.runs.claim(a, run.id, new Date(Date.now()+120000).toISOString())).toBe(false);
  expect(await repo.runs.get(b, run.id)).toBeNull();
});
```

- [ ] **Step 2: Xác nhận RED**

Run: `bun run vitest run tests/integration/repositories.test.ts`
Expected: FAIL tại import/behavior chưa triển khai, sau khi prerequisites của task đã sẵn sàng.

- [ ] **Step 3: Triển khai phần tối thiểu**

Chạy cùng repository behavior suite cho memory và actual Postgres adapters, cộng assertion rollback nếu artifact insert lỗi. Tables như spec §15: workspaces/sessions/uploads/sources/runs/run_steps/artifacts và analytics datasets/rows. Keys text; index(workspace_id, run_id); artifact unique(run_id,step_id,kind,version). App writes dùng app_writer, migrations dùng owner riêng; MCP role sẽ cấp grants ở B3. Sessions cookie HttpOnly/SameSite, token hash trong DB; operator role từ session record, không từ request.body. Local storage canonical path phải nằm trong .data, từ chối traversal.

```ts
// SQL pattern trong Drizzle transaction; identifiers là developer-owned.
await db.transaction(async (tx) => {
  await tx.insert(artifacts).values(artifactRecord);
  await tx.update(runSteps).set({ status: "succeeded" }).where(
    and(eq(runSteps.runId, runId), eq(runSteps.stepId, stepId),
        eq(runSteps.workspaceId, scope.workspaceId))
  );
  await tx.update(runs).set({ revision: sql`revision + 1` }).where(
    and(eq(runs.id, runId), eq(runs.workspaceId, scope.workspaceId))
  );
});
```

- [ ] **Step 4: Xác nhận GREEN**

Run: `bun run vitest run tests/integration/repositories.test.ts`
Additional run: `bun run db:generate; bun run db:migrate; bun run check`
Expected: Memory and Postgres suites pass: duplicate claim false; all ID lookups scoped; atomic rollback; traversal rejected. Migrations/docs không chứa secret; operator session bootstrap chỉ local.

- [ ] **Step 5: Commit local**

```powershell
git -C E:/thucchienai/hackathon-starter-kit add -- compose.yaml drizzle.config.ts infra/postgres/init scripts/setup-local-env.ps1 src/adapters/postgres src/adapters/storage src/server/session.ts src/server/container.ts tests/helpers tests/integration/repositories.test.ts
git -C E:/thucchienai/hackathon-starter-kit commit -m 'feat: add scoped repositories and step transactions'
```

### Task A4: gateway adapter và feature doctor có fake/live separation

**Files:**
- Create: src/adapters/llm/gateway/client.ts, features.ts, structured.ts, sdk-model.ts
- Create: scripts/doctor.ts, docs/gateway-compatibility.md; Test: tests/integration/btc-adapter.test.ts
- Modify: package.json, .env.example

**Interfaces:**
- Consumes: A2 LlmPort/LlmRequest/GatewayFeatures; AI env contract A1.
- Produces: createGateway(config,fetcher):LlmPort; loadLiveGatewayConfig(env:NodeJS.ProcessEnv=process.env):GatewayConfig; probeGateway(config):Promise<GatewayFeatures>; sdk-model.ts là SDK facade chỉ cho agent phase C2.

- [ ] **Step 1: Viết test behavior**

```ts
import { expect, it, vi } from "vitest";
import { createGateway } from "@/adapters/llm/gateway/client";

it("uses configured configured gateway origin and does not retry to another provider", async () => {
  const fetcher = vi.fn(async () => new Response("rate limit", { status: 429 }));
  const gateway = createGateway({
    baseUrl: "https://gateway.test/v1", apiKey: "fixture-key", model: "fixture-model",
    features: { protocol: "openai-chat", streaming: false, structuredJson: false,
      nativeTools: false, vision: false, embeddings: false, audio: false },
  }, fetcher);
  await expect(gateway.complete({
    system: "Extract", messages: [{ role: "user", content: "abc" }],
    maxOutputTokens: 256,
  }, new AbortController().signal)).rejects.toThrow();
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(String(fetcher.mock.calls[0][0])).toMatch(/^https:\/\/btc\.test\//);
});
```

- [ ] **Step 2: Xác nhận RED**

Run: `bun run vitest run tests/integration/btc-adapter.test.ts`
Expected: FAIL tại import/behavior chưa triển khai, sau khi prerequisites của task đã sẵn sàng.

- [ ] **Step 3: Triển khai phần tối thiểu**

Install ai + @ai-sdk/openai-compatible với --save-exact ở task này nếu doctor confirms OpenAI chat protocol. Guard fetch phải reject origin ngoài configured configured gateway origin, redirects không được tự gửi bearer sang host khác. SDK retries=0; runner sở hữu retry budget. Probe nhỏ từng feature, optional probes chỉ chạy khi flag bật; thiếu env là configuration error. Không gửi image/audio/embedding probe tùy tiện. doctor reports status unavailable/verified riêng cho DB, gateway và feature; chỉ log model ID và capability bool, không keys/prompts.

```ts
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export function createGatewayModel(config: GatewayConfig, fetcher: typeof fetch = fetch) {
  const allowedOrigin = new URL(config.baseUrl).origin;
  return createOpenAICompatible({
    name: "gateway", baseURL: config.baseUrl, apiKey: config.apiKey,
    supportsStructuredOutputs: config.features.structuredJson,
    fetch: async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      if (url.origin !== allowedOrigin) throw new Error("gateway_origin_denied");
      return fetcher(input, { ...init, redirect: "error" });
    },
  }).chatModel(config.model);
}
```

- [ ] **Step 4: Xác nhận GREEN**

Run: `bun run vitest run tests/integration/btc-adapter.test.ts`
Additional run: `bun run tsx scripts/doctor.ts --gateway`
Expected: Fakes prove configured gateway origin/token masking/abort/error handling. Live doctor chỉ được ghi verified sau actual request với config do đội cung cấp; missing credentials giữ gate unverified, không dùng fixture thay live.

- [ ] **Step 5: Commit local**

```powershell
git -C E:/thucchienai/hackathon-starter-kit add -- src/adapters/llm/gateway scripts/doctor.ts docs/gateway-compatibility.md tests/integration/btc-adapter.test.ts package.json bun.lock .env.example
git -C E:/thucchienai/hackathon-starter-kit commit -m 'feat: add gateway-only model adapter and compatibility probes'
```

### Task A5: Artifact executor và sequential run services

**Files:**
- Create: src/core/capabilities/definition.ts, registry.ts, executor.ts
- Create: src/core/workflows/definition.ts, validation.ts, runner.ts, budget.ts
- Create: src/core/services/runs.ts, artifacts.ts; Test: tests/workflows/runner.test.ts

**Interfaces:**
- Consumes: A2 contracts, A3 repositories/test contexts, A4 LlmPort.
- Produces: Capability/Step/WorkflowDefinition, defineWorkflow/validateWorkflow/executeCapability, createRun/executeRun/getRun/cancelRun theo master. Artifact/schema registry được inject, step output commit qua runs.commitStep.

- [ ] **Step 1: Viết test behavior**

```ts
import { expect, it } from "vitest";
import { defineWorkflow, validateWorkflow } from "@/core/workflows/definition";
import { z } from "zod";

it("rejects dependencies on later steps", () => {
  const step = {
    id: "first", dependsOn: ["later"], input: z.string(), output: z.string(),
    bind: () => "abc", run: async () => ({ kind: "core/text", version: 1, data: "abc",
      provenance: { sourceIds: [], evidenceIds: [], derivedFrom: [] } }),
    artifactKind: "core/text", artifactVersion: 1, timeoutMs: 30000,
    retry: { maxAttempts: 2 }, required: true,
  };
  expect(() => validateWorkflow(defineWorkflow({
    steps: [step], requiredArtifactKinds: ["core/text"],
  }))).toThrow();
});
```

- [ ] **Step 2: Xác nhận RED**

Run: `bun run vitest run tests/workflows/runner.test.ts`
Expected: FAIL tại import/behavior chưa triển khai, sau khi prerequisites của task đã sẵn sàng.

- [ ] **Step 3: Triển khai phần tối thiểu**

AnyStep dùng internal type erasure nhưng input/output luôn parse. Thêm test thực thi với fixture ports: required error→failed; optional error+required artifacts đủ→partial; optional error nhưng thiếu required artifact→failed; cancel→cancelled; expired running→interrupted; duplicate execute không gọi capability lần hai; fake timers kiểm tra timeout/backoff. Cancel endpoint ghi DB, runner check DB cancel flag trong polling timer bounded và AbortSignal; cleanup timer trong finally. Một step timeout là min(configured, remainingMs). Step/version/prompt hash chốt lúc createRun; getRun không tự resume. Repository.create nhận pending StepState[] để insert cùng run; startStep cập nhật attempt/running, finishStep lưu failed/skipped+errorCode. commitStep chỉ thành công khi run còn running, chưa cancelled/deadline; cập nhật revision cùng transaction. Cancel/finish guarded state transitions, không overwrite terminal run.

```ts
export async function executeCapability<I, O>(
  definition: Capability<I, O>, raw: unknown, ctx: RunContext,
): Promise<Artifact<O>> {
  const input = definition.input.parse(raw);
  ctx.signal.throwIfAborted();
  const draft = await definition.run(ctx, input);
  if (draft.kind !== ctx.expectedArtifact.kind ||
      draft.version !== ctx.expectedArtifact.version) {
    throw new Error("artifact_registration_mismatch");
  }
  const data = definition.output.parse(draft.data);
  const artifact = ctx.artifactSchemas.parse({
    ...draft, data, id: crypto.randomUUID(), workspaceId: ctx.scope.workspaceId,
    runId: ctx.runId, stepId: ctx.stepId, createdAt: new Date().toISOString(),
  }) as Artifact<O>;
  await ctx.ports.runs.commitStep(ctx.scope, ctx.runId, ctx.stepId, artifact);
  return artifact;
}
```

- [ ] **Step 4: Xác nhận GREEN**

Run: `bun run vitest run tests/workflows/runner.test.ts`
Additional run: `bun run check`
Expected: Status/timeout/budget/schema failures match spec. Invalid draft kind/version bị reject trước commit theo step registration. No background job or request fire-and-forget; duplicate model execution test passes.

- [ ] **Step 5: Commit local**

```powershell
git -C E:/thucchienai/hackathon-starter-kit add -- src/core/capabilities src/core/workflows src/core/services/runs.ts src/core/services/artifacts.ts tests/workflows/runner.test.ts
git -C E:/thucchienai/hackathon-starter-kit commit -m 'feat: implement sequential artifact workflows'
```

### Task A6: Document upload/parsers và allowed URL ingestion

**Files:**
- Create: src/adapters/parsers/pdf.ts, docx.ts, text.ts, json.ts, html.ts, index.ts
- Create: src/adapters/sources/public-web.ts, url-policy.ts, disabled-search.ts, registry.ts
- Create: src/sources/profiles/uploaded-documents.ts, general-web.ts, src/sources/catalog.ts
- Create: src/capabilities/ingestion/index.ts, src/core/services/uploads.ts
- Create: src/app/api/uploads/route.ts; Test: tests/integration/document-ingestion.test.ts

**Interfaces:**
- Consumes: A2 documents/sources/upload contracts; A3 local storage/repositories; RunContext A5.
- Produces: sourceProfiles:SourceProfile[] with uploaded-documents/general-web baseline, source adapter registry; ingestUpload/ingestUrl/fetchAllowedUrl theo ledger; createParserPort(); POST uploads returns upload/source IDs; disabled search throws source_unavailable.

- [ ] **Step 1: Viết test behavior**

```ts
import { expect, it, vi } from "vitest";
import { fetchAllowedUrl } from "@/adapters/sources/public-web";

it("rejects local/private destinations before fetching", async () => {
  const fetcher = vi.fn();
  const profile = { id: "fixture", adapterId: "public-web",
    allowedDomains: [], maxSources: 8, maxBytes: 5242880,
    fetchTimeoutMs: 15000, requireCitation: true };
  await expect(fetchAllowedUrl("http://127.0.0.1/admin", profile, {
    fetcher, resolveHost: async () => ["127.0.0.1"],
    signal: new AbortController().signal,
  })).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Xác nhận RED**

Run: `bun run vitest run tests/integration/document-ingestion.test.ts`
Expected: FAIL tại import/behavior chưa triển khai, sau khi prerequisites của task đã sẵn sàng.

- [ ] **Step 3: Triển khai phần tối thiểu**

Cài parser dependencies bằng --save-exact: pdfjs-dist, mammoth, cheerio, file-type, ipaddr.js. PDF page1-based offset end-exclusive, scan trả warnings/unsupported OCR. DOCX dùng text extraction, không render HTML/macro. JSON JSON.parse + schema, TXT decode UTF-8. Upload request size bounded cả Content-Length và streamed byte count. DNS/redirect check mỗi hop, HTTPS hostname/certificate giữ nguyên; use pinned DNS dispatcher khi fetch cần chặn DNS rebinding. Parse jobs trong worker_thread có timeout để sync parser không block event loop; đây là parser worker thread, không phải workflow job worker. Fixtures PDF/DOCX tạo nhỏ trong tests, không dùng tài liệu thật.

```ts
export function assertPublicAddresses(addresses: string[]) {
  if (addresses.length === 0) throw new Error("source_unavailable");
  for (const address of addresses) {
    const normalized = ipaddr.process(address);
    if (normalized.range() !== "unicast") throw new Error("source_destination_denied");
  }
}

export function assertUploadSize(bytes: Uint8Array) {
  if (bytes.byteLength > 20 * 1024 * 1024) throw new Error("upload_too_large");
}
```

- [ ] **Step 4: Xác nhận GREEN**

Run: `bun run vitest run tests/integration/document-ingestion.test.ts`
Additional run: `bun run check`
Expected: PDF/DOCX/TXT/JSON/HTML fixtures có locators; upload+ownership+scan+oversize+redirect+IPv6 private+DNS tests pass. URL fetch không vượt5MB/15s. CSV/XLSX request được trả unsupported format rõ ràng tới phase B1.

- [ ] **Step 5: Commit local**

```powershell
git -C E:/thucchienai/hackathon-starter-kit add -- src/adapters/parsers src/adapters/sources src/sources src/capabilities/ingestion src/core/services/uploads.ts src/app/api/uploads tests/integration/document-ingestion.test.ts package.json bun.lock
git -C E:/thucchienai/hackathon-starter-kit commit -m 'feat: ingest documents with source provenance'
```

### Task A7: Extraction/evidence/analysis/recommendation và document archetype

**Files:**
- Create: src/capabilities/extraction/index.ts, evidence/index.ts, analysis/index.ts, recommendation/index.ts, report/index.ts
- Create: src/core/domains/definition.ts, catalog.server.ts
- Create: src/domains/examples/document-review/manifest.ts, index.server.ts, schemas.ts, prompts.ts, workflow.ts, sources.ts, presenter.ts, fixtures/input.json
- Create: src/domains/catalog.client.ts; Test: tests/integration/document-workflow.test.ts

**Interfaces:**
- Consumes: A4 model port, A5 runner, A6 documents; master Claim/Evidence/AnalysisData/RecommendationData.
- Produces: extractStructured/validateEvidence/defineDomain; document-review domain with namespaced extracted schema, core analysis/recommendation/report artifact schemas and requiredArtifactKinds.

- [ ] **Step 1: Viết test behavior**

```ts
import { expect, it, vi } from "vitest";
import { validateEvidence } from "@/capabilities/evidence";
import { extractStructured } from "@/capabilities/extraction";
import { createTestContext } from "../helpers/runtime";
import { z } from "zod";

it("rejects fabricated quotes and invalid extraction after one repair", async () => {
  expect(() => validateEvidence([{ id: "e1", sourceId: "missing", excerpt: "quote",
    locator: { type: "text", start: 0, end: 5 } }], [])).toThrow();
  const complete = vi.fn(async () => '{"amount":"not-number"}');
  const ctx = createTestContext({
    ports: { llm: { complete,
      features: () => ({ protocol:"openai-chat",streaming:false,structuredJson:false,
        nativeTools:false,vision:false,embeddings:false,audio:false }) } },
  });
  const documents = [{id:"d1",sourceId:"s1",title:"Fixture",warnings:[],
    segments:[{id:"seg",text:"Amount: x",locator:{type:"text" as const,start:0,end:9}}]}];
  await expect(extractStructured({ documents, schema: z.object({ amount:z.number() }),
    instructions:"Extract amount" }, ctx)).rejects.toThrow();
  expect(complete).toHaveBeenCalledTimes(2);
});
```

- [ ] **Step 2: Xác nhận RED**

Run: `bun run vitest run tests/integration/document-workflow.test.ts`
Expected: FAIL tại import/behavior chưa triển khai, sau khi prerequisites của task đã sẵn sàng.

- [ ] **Step 3: Triển khai phần tối thiểu**

Extraction input includes only selected documents/segments and allowed IDs. Parse JSON→Zod; one repair with validation errors and same data references, budget tracked. Analysis requires claims/findings and verifies every referenced evidence ID. No evidence→unchecked/insufficient; không tự Supported. Recommendation reasons cite existing claim IDs. Report model uses existing claim/metric references, no new numbers. Workflow chooses ingest→extract→evidence→analysis→recommendation→report; presentation is separate. Domain entry chỉ defineDomain registration; source profiles uploaded-documents/general-web reuse adapter. Register core/source-collection, core/evidence-set, core/analysis, core/recommendations, core/report v1 schemas from A2. Sources/documents/evidence have canonical arrays in their primary artifacts; derived artifacts retain IDs/provenance and derivedFrom.

```ts
export function validateEvidence(
  evidence: Evidence[], documents: NormalizedDocument[],
): Evidence[] {
  for (const item of evidence) {
    const doc = documents.find(d => d.sourceId === item.sourceId &&
      (!item.documentId || d.id === item.documentId));
    if (!doc) throw new Error("evidence_source_missing");
    const match = doc.segments.some(segment =>
      exactExcerptAt(segment, item.locator) === item.excerpt);
    if (!match) throw new Error("evidence_excerpt_mismatch");
  }
  return evidence;
}

function exactExcerptAt(
  segment: NormalizedDocument["segments"][number], loc: SourceLocator,
): string|null {
  const base = segment.locator;
  if (base.type !== loc.type) return null;
  if (loc.type === "table" && base.type === "table") {
    return loc.sheet === base.sheet && loc.row === base.row &&
      loc.column === base.column ? segment.text : null;
  }
  if (loc.type === "table" || base.type === "table") return null;
  if (loc.type === "pdf" &&
      (base.type !== "pdf" || loc.page !== base.page)) return null;
  if (loc.type === "web" &&
      (base.type !== "web" || loc.section !== base.section)) return null;
  if (loc.start < base.start || loc.end > base.end || loc.start >= loc.end) return null;
  return segment.text.slice(loc.start-base.start,loc.end-base.start);
}
```

Thêm golden test: segment text "abc quote xyz", locator text[0,13); excerpt "quote" chỉ hợp lệ với[4,9), reject[0,5) dù quote tồn tại trong document. PDF page numbering bắt đầu1, table cell quote là toàn text đã normalized.

- [ ] **Step 4: Xác nhận GREEN**

Run: `bun run vitest run tests/integration/document-workflow.test.ts`
Additional run: `bun run tsx scripts/doctor.ts --gateway; bun run check`
Expected: Fixture workflow produces persisted expected artifacts; repair capped; fabricated IDs/quotes rejected. Real gateway output must validate before live doctor/workflow gate. Locator comparison implementation must compare document/segment offsets exactly, not accept quote elsewhere in document.

- [ ] **Step 5: Commit local**

```powershell
git -C E:/thucchienai/hackathon-starter-kit add -- src/capabilities/extraction src/capabilities/evidence src/capabilities/analysis src/capabilities/recommendation src/capabilities/report src/core/domains src/domains tests/integration/document-workflow.test.ts
git -C E:/thucchienai/hackathon-starter-kit commit -m 'feat: add document review domain and evidence flow'
```

### Task A8: Document cards, result presenter và scoped BFF workspace

**Files:**
- Create: src/ui/primitives/card.tsx, button.tsx, dialog.tsx; src/ui/blocks/InsightCard.tsx, RecommendationCard.tsx, WarningCard.tsx, SourceCard.tsx, EvidenceCard.tsx, ProgressCard.tsx, MarkdownCard.tsx, ActionCard.tsx
- Create: src/ui/registry/index.tsx, renderers/BlockRenderer.tsx, ResultRenderer.tsx, ReportView.tsx, forms/DocumentInput.tsx, shells/WorkspaceShell.tsx, hooks/useRun.ts
- Create: src/app/workspace/[domainId]/page.tsx, src/app/api/domains/route.ts, runs/route.ts, runs/[runId]/route.ts, runs/[runId]/execute/route.ts, runs/[runId]/cancel/route.ts, artifacts/[artifactId]/route.ts
- Modify: src/core/services/artifacts.ts, src/domains/examples/document-review/presenter.ts, src/server/container.ts
- Test: tests/integration/run-http.test.ts, tests/contracts/presenter.test.ts

**Interfaces:**
- Consumes: A2 UI/result schemas, A5 run services, A7 document pack, A3 session.
- Produces: buildResultView/getResult, BlockRenderer/ResultRenderer/ReportView components; BFF create201 + await execute + snapshot/cancel; workspace input/upload/result.

- [ ] **Step 1: Viết test behavior**

```ts
import { expect, it } from "vitest";
import { buildResultView } from "@/core/services/artifacts";
import { documentReview } from "@/domains/examples/document-review/index.server";
import { createMemoryRepositories } from "../helpers/memory-repositories";

it("renders a failed run as failed rather than complete", async () => {
  const repo = createMemoryRepositories();
  const scope = { userId:"u",workspaceId:"w",trustedOperator:false };
  const run = await repo.runs.create(scope, "document-review", 1, { text:"abc" });
  await repo.runs.finish(scope,run.id,"failed",["Gateway unavailable"]);
  const snapshot = await repo.runs.get(scope,run.id);
  const view = buildResultView(documentReview,snapshot!,[],[]);
  expect(view.status).toBe("failed");
});
```

- [ ] **Step 2: Xác nhận RED**

Run: `bun run vitest run tests/integration/run-http.test.ts tests/contracts/presenter.test.ts`
Expected: FAIL tại import/behavior chưa triển khai, sau khi prerequisites của task đã sẵn sàng.

- [ ] **Step 3: Triển khai phần tối thiểu**

Presenter handles queued/running/failed/partial and required artifacts explicitly. Client POST create gets runId, execute fetch is awaited while snapshot polling runs; terminal state stops polling; closing tab aborts execute request. Cancel calls separate endpoint and runner polls cancellation DB. HTTP validate input/ownership, report error envelope; Next route params await correct version API. Source drawer scoped artifact/segment lookup; upload source opens local viewer with original PDF page. Sanitize Markdown(raw HTML disabled), Action allowlist only export/retry/focus. Placeholder registry fallback for block types not yet implemented is explicit unavailable, not silently dropped.

```ts
export function buildResultView(
  domain: DomainDefinition, snapshot: RunSnapshot,
  sources: SourceRef[], evidence: Evidence[],
): ResultView {
  const blocks = domain.present({
    snapshot, sources, evidence,
    get: (kind, schema) => {
      const artifact = snapshot.artifacts.find(a => a.kind === kind);
      return artifact ? { ...artifact, data: schema.parse(artifact.data) } : null;
    },
  });
  return ResultViewSchema.parse({ runId:snapshot.id,revision:snapshot.revision,
    title:domain.manifest.title,status:snapshot.status,blocks });
}
```

- [ ] **Step 4: Xác nhận GREEN**

Run: `bun run vitest run tests/integration/run-http.test.ts tests/contracts/presenter.test.ts`
Additional run: `bun run check; bun run build`
Expected: Presenter schema passes all run states; HTTP scoped lookups/cancel/duplicate execute tests pass; no UI import of prompts/secrets; sources open correctly and exports use persisted result.

- [ ] **Step 5: Commit local**

```powershell
git -C E:/thucchienai/hackathon-starter-kit add -- src/ui src/app/workspace src/app/api/domains src/app/api/runs src/app/api/artifacts src/core/services/artifacts.ts src/domains/examples/document-review/presenter.ts src/server/container.ts tests/integration/run-http.test.ts tests/contracts/presenter.test.ts
git -C E:/thucchienai/hackathon-starter-kit commit -m 'feat: render document artifacts through shared workspace'
```

### Task A9: Document vertical-slice E2E và runnable local container

**Files:**
- Create: Dockerfile, .dockerignore, tests/e2e/document-review.spec.ts, tests/fixtures/document.txt, docs/local-run.md, docs/verification.md
- Modify: compose.yaml, README.md, package.json, playwright.config.ts

**Interfaces:**
- Consumes: A1–A8 app, services, fixture/live gateway separation.
- Produces: Node Docker app+Postgres, repeatable document E2E, Gate1 evidence and local runbook.

- [ ] **Step 1: Viết test behavior**

```ts
import { expect, test } from "@playwright/test";

test("document upload creates a persisted result with evidence", async ({ page }) => {
  await page.goto("/workspace/document-review");
  await page.getByLabel("Tài liệu").setInputFiles("tests/fixtures/document.txt");
  await page.getByRole("button",{name:"Phân tích"}).click();
  await expect(page.getByTestId("run-status")).toHaveText("completed");
  await page.getByRole("button",{name:"Xem nguồn"}).first().click();
  await expect(page.getByRole("dialog")).toContainText("document.txt");
  const runId = await page.getByTestId("business-run-id").textContent();
  await page.reload();
  await expect(page.getByTestId("business-run-id")).toHaveText(runId!);
});
```

- [ ] **Step 2: Xác nhận RED**

Run: `bun run playwright test tests/e2e/document-review.spec.ts`
Expected: FAIL tại import/behavior chưa triển khai, sau khi prerequisites của task đã sẵn sàng.

- [ ] **Step 3: Triển khai phần tối thiểu**

tests/fixtures/document.txt có chính xác hai dòng: "Payment is due within 30 days." và "Contact: demo@example.org.". Fixture extraction trả paymentDays:30 và quote "30 days" với normalized locator thật; fake transport không bật trong production. Fixture transport được inject chỉ trong e2e/dev mode có nhãn Demo; package script chạy local webServer with fixture DB/session. Test phải cover source drawer và refresh không chạy model lại; thêm aborted run/partial flow khi fixture failure bật. Docker multi-stage Next standalone image excludes .env/.data, waits for db health, no debug secrets. Migrations là explicit command, không tự chạy bằng app_writer startup. Live manual flow repeat bằng permitted AI và PDF/URL riêng; ghi observed commands/output metadata trong docs/verification.md.

```json
{
  "scripts": {
    "dev": "next dev --hostname 127.0.0.1",
    "build": "next build",
    "start": "next start --hostname 0.0.0.0",
    "check": "tsc --noEmit && eslint .",
    "test": "vitest run",
    "e2e": "playwright test",
    "doctor": "tsx scripts/doctor.ts",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate"
  }
}
```

- [ ] **Step 4: Xác nhận GREEN**

Run: `bun run playwright test tests/e2e/document-review.spec.ts`
Additional run: `bun run check; bun run test; bun run build; docker compose --env-file .env.local up -d --build app postgres`
Expected: E2E/TS/unit/integration/build pass, container app healthy. Gate1 chứng minh demo/fixture document pipeline; optional gateway availability ghi riêng, không yêu cầu credentials. README có đúng run commands và P0 interruption limit.

- [ ] **Step 5: Commit local**

```powershell
git -C E:/thucchienai/hackathon-starter-kit add -- Dockerfile .dockerignore compose.yaml package.json playwright.config.ts tests/e2e/document-review.spec.ts tests/fixtures/document.txt docs/local-run.md docs/verification.md README.md
git -C E:/thucchienai/hackathon-starter-kit commit -m 'test: verify document vertical slice and local runtime'
```

## Gate 1

- [ ] Uploaded document/URL tạo artifact và source locators.
- [ ] Schema repair/evidence failure không báo success giả.
- [ ] Dashboard/report đọc lại artifact sau refresh.
- [ ] Scope, interruption/cancel và duplicate execution tests pass.
- [ ] Fixture/live verification được ghi riêng; AI integration được chạy bằng credentials của repo riêng.
