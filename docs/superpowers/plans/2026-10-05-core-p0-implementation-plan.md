# Core P0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hoàn thiện shared core tạo/execute/cancel/read run, persist artifacts và present generic UI blocks bằng một demo không cần API key.

**Architecture:** Modular monolith; pure core qua ports, Drizzle/Postgres adapter và scoped Next.js BFF. Capability execution có schema boundary, deadline và attempt fence; business state không nằm trong chat SDK. P0 không cài runtime CopilotKit, nhưng cung cấp projection contract cho phase tích hợp sau.

**Tech Stack:** Node 24 LTS, pnpm 11.25.0, Next.js 16.3.8, React 19.3.0, TypeScript 6.0.3, Zod 4.6.5, Drizzle 0.45.3, pg 8.23.1, drizzle-kit 0.31.11, Vitest 5.0.3; Docker Postgres 18.6 cần verify manifest lúc triển khai.

**Spec:** [Core P0 design](../specs/2026-10-05-core-p0-design.md). Đọc cả spec và plan trước khi thực thi.

## Global Constraints

- Chỉ làm tại `E:/thucchienai/hackathon-starter-kit`, origin `baominh5xx2/template-codesdas`; không thao tác `aitc2026-team-939-triplepeek`.
- Phương pháp đã được user chọn: subagent-driven; mọi implementer/reviewer subagent dùng **gpt-6-luna**. Task có dependency chạy tuần tự, không để nhiều agent sửa shared contracts cùng lúc.
- Bản plan này chưa được execute. Khi user review xong, đọc skill subagent-driven-development và applicable AGENTS.md trước Task 1.
- Không API key, tài liệu BTC, external-write tool, friend problem templates, React cards hoặc dependency CopilotKit/model/parser trong P0.
- Core không import React, Next.js, Drizzle, CopilotKit SDK hoặc `process.env`; adapters/server compose dependencies.
- Giữ Artifact envelope và public RunSnapshot/ResultView; migrations của Step/RunContext/repository phải cập nhật mọi consumer.
- Deadline run **120_000 ms**; step **1–30_000 ms**; workflow tối đa **32 steps**; maxAttempts **1 hoặc 2** tính cả lần đầu.
- Budget maxima: model **8**, repair **1**, fetch **8**, tool **16**. Retry chỉ safe capability + known transient error; không retry timeout/cancel/validation/budget failure.
- Request body tối đa **256 KiB**; dev session token **32 bytes**, SHA-256 lưu DB, TTL **24 giờ**; scope do server resolve.
- Docker project **hackathon-starter-core**, port **127.0.0.1:55432:5432**, volume mount **/var/lib/postgresql**; không đụng containers/volumes khác.
- Default skeleton boot không .env/DB; giữ fixture APIs và POST runs 501 khi chưa bật live. Production không có dev-session bootstrap.
- Không tuyên bố test PASS từ plan. Các commands dưới đây là checks phải chạy trong implementation; docs hiện tại không xác nhận core đã tồn tại.

## Review Focus

1. Capability ignore AbortSignal rồi resolve muộn: executor discard output, cancel/timeout fence chặn commit — Tasks 2, 4, 5.
2. Hai execute requests hoặc stale retry cùng run: một claim, đúng attempt, không duplicate artifacts — Tasks 4, 5, 8.
3. Restart sau partial progress: snapshot durable, expired running thành interrupted, không tự replay — Tasks 4, 9.
4. Schema transform tạo NaN/Date và presenter tạo dangling references: chặn tại JSON/result boundary — Tasks 1, 2, 6.
5. Browser giả scope, thiếu Origin/session hoặc scope khác biết UUID: reject trước service/DB access, không lộ resource — Tasks 4, 7, 8.

## File map và test conventions

| Unit | Files chính | Trách nhiệm |
|---|---|---|
| Contracts/registries | `src/core/{capabilities,workflows,domains,ports}`, `src/contracts/errors.ts` | Interfaces thống nhất, executable catalog validation |
| Executor/budget | `src/core/capabilities/executor.ts`, `src/core/runs/budget.ts` | Parse, deadline, JSON boundary, envelope |
| Tools | `src/core/tools/{definition,registry}.ts` | Allowlist, schemas, effect policy |
| Persistence | `src/adapters/postgres/*`, `drizzle/*`, `compose.yaml` | Atomic scoped state/artifact writes |
| Runner | `src/core/workflows/runner.ts` | Ordered execution, dependencies, retry, terminal state |
| Services/presentation | `src/core/services/runs.ts`, `src/core/domains/presentation.ts` | Lifecycle và typed ResultView |
| Composition/scope | `src/server/{container,env,scope}.ts`, `src/domains/core-demo/*` | Modes, dev auth, demo registration |
| BFF | `src/app/api/runs/*`, `src/app/api/artifacts/*` | Strict requests, authenticated scope, HTTP mapping |
| Delivery | `scripts/core-smoke.ts`, docs | Repeatable integration + handoff |

Unit harness ở `tests/helpers/core.ts` dùng in-memory test doubles, không phải production memory backend. `makeCoreHarness(options?)` trả `{scope, otherScope, services, runs, artifacts, capabilities, registerDomain, calls}`; hai scopes khác cả user/workspace. Fake repository phải mirror CAS/fence semantics; real DB tests vẫn là bằng chứng atomicity.

`tests/helpers/postgres.ts` dùng explicit `TEST_DATABASE_URL` trỏ **starter test DB** ở 55432, schema riêng random mỗi suite; từ chối database ngoài tên `starter_core_test`. Chỉ drop schema do suite tạo sau khi xác minh prefix `core_test_`. Không dùng database production hay truncate shared tables.

Không cần fixtures phức tạp: demo input `[2,3,5]`, sum `10`, optional failure riêng để chứng minh partial. Mỗi task thêm test helpers khi cần, không tạo một task scaffolding riêng.

## Task 1: Migrate contracts và executable registries

**Files:**
- Modify: `src/core/capabilities/definition.ts`, `src/core/workflows/definition.ts`, `src/core/workflows/validation.ts`, `src/core/domains/definition.ts`, `src/core/domains/validation.ts`, `src/core/ports/definition.ts`, `src/core/services/definition.ts`, `src/contracts/errors.ts`, `src/domains/catalog.server.ts`, `scripts/validate-domains.ts`.
- Create: `src/core/capabilities/registry.ts`, `src/core/domains/registry.ts`.
- Test: `tests/core/registries.test.ts`; update `tests/contracts/workflow-domain.test.ts` và consumers tìm bằng `rg`.

**Interfaces:**
- Consumes: `Schema<T>`, `ArtifactDraft<T>`, existing `ArtifactSchemaRegistry`, `DomainDefinition`, `Scope`, `RunSnapshot`.
- Produces: `CapabilityRef { id: string; version: number }`; `Capability.retrySafety: "safe" | "never"`; Step giữ bind/deps/artifact fields, dùng ref, bỏ run và thay retry bằng `{maxAttempts:1|2}`.
- Produces: `RegisteredCapability { id: string; version: number; retrySafety: "safe"|"never"; input: Schema<unknown>; output: Schema<unknown>; run(ctx: RunContext, input: unknown): Promise<ArtifactDraft<unknown>> }`.
- Produces: `CapabilityRegistry.register<I,O>(capability: Capability<I,O>): void`, `resolve(ref: CapabilityRef): RegisteredCapability`, `has(ref: CapabilityRef): boolean`.
- Produces: `DomainRegistry` constructor `(catalog: DomainValidationCatalog)`; `register(domain: DomainDefinition): void`, `get(id: string, version?: number): DomainDefinition`, `list(): DomainManifest[]`.
- Produces: `DomainValidationCatalog.capabilities: CapabilityRegistry`; giữ `validateWorkflow(definition: WorkflowDefinition): void` cho structural checks, `validateDomain(domain: DomainDefinition, catalog: DomainValidationCatalog): void` thêm registered-ref/retry-safety checks. Catalog server/script inject empty capability registry cho bốn empty seeds.
- Produces: `StepFence { stepId: string; attempt: number }`; `TerminalRunStatus = Exclude<RunSnapshot["status"], "queued" | "running">`.
- Produces: RunRepository `startStep(scope, runId, fence): Promise<void>`, `finishStep(scope, runId, fence, status: "failed"|"skipped", errorCode?: string): Promise<void>`, `commitStep(scope, runId, fence, artifact): Promise<void>`, `finish(scope, runId, status: TerminalRunStatus, warnings): Promise<void>`; giữ create/claim/get/cancel signatures.
- Produces: `CapabilityPorts` gồm scoped `artifacts.get(id)/list(runId)`, `datasets.read(id,query)`, `storage.read(key)`, existing `llm/sources/parsers`. RunContext dùng CapabilityPorts; repository writers không đi vào capability context.
- Produces: `RunServices` subset được định nghĩa trong spec; `CoreError(code: ErrorEnvelope["code"], message: string, retryable?: boolean)`; expanded safe codes và public mapper giữ masking.

- [ ] **Step 1: Viết tests registration/contract failures.** Fixture `domainWithStep(overrides)` cung cấp registered cap/schema; không dùng type cast để né new interface.

```ts
expect(() => registry.register(sumCapability)).not.toThrow();
expect(() => registry.register(sumCapability)).toThrow(/duplicate/);
expect(() => domains.register(domainWithStep({ timeoutMs: NaN }))).toThrow();
expect(() => domains.register(domainWithStep({ retry: { maxAttempts: 2 }, retrySafety: "never" }))).toThrow();
expect(() => domains.register(domainWithStep({ capability: { id: "missing", version: 1 } }))).toThrow();
expect(() => domains.register(domainWithExample(z.any().transform(() => new Date())))).toThrow();
expect(domains.get("example", 1).manifest.version).toBe(1);
expect(domains.get("example").manifest.version).toBe(2);
```

- [ ] **Step 2: RED.** Run `.\node_modules\.bin\vitest.cmd run tests/core/registries.test.ts tests/contracts/workflow-domain.test.ts`; expect FAIL missing registry/new validation.
- [ ] **Step 3: Implement interfaces, wrappers và validators trong files trên.** Pin step count/timeouts/attempts, exact capability refs, prior deps, required producers, source/tool/artifact catalogs và JSON-safe examples. Preserve empty seed catalogs; service sẽ gate execution.
- [ ] **Step 4: GREEN.** Same test command PASS; `.\node_modules\.bin\tsx.cmd scripts/validate-domains.ts` giữ bốn seeds valid; `rg "step\.run|retry: [0-9]" src tests` không còn stale consumers.
- [ ] **Step 5: Commit.** Stage đúng files của task và consumer migrations tìm được; `git commit -m "feat(core): define executable registries and fenced contracts"`.

## Task 2: Budget và schema-safe capability executor

**Files:**
- Create: `src/core/runs/budget.ts`, `src/core/capabilities/executor.ts`, `tests/helpers/core.ts`.
- Test: `tests/core/executor.test.ts`, `tests/core/budget.test.ts`.

**Interfaces:**
- Consumes: Task 1 registries/ref, `RunContext`, existing artifact/schema registry và `Budget`.
- Produces: `RunBudget(deadlineAt: number, limits?: Partial<Record<BudgetOperation, number>>, now?: () => number)`, `consume(operation: BudgetOperation): void`, `remainingMs(): number`; `BudgetOperation = "model"|"repair"|"fetch"|"tool"`.
- Produces: `ExecutionRequest { capability: CapabilityRef; input: unknown; inputArtifactIds: string[]; context: RunContext; timeoutMs: number }`.
- Produces: `CapabilityExecutor` constructor `(deps: { capabilities: CapabilityRegistry; artifactSchemas: ArtifactSchemaRegistry; now(): number; id(): string })`; `execute(request: ExecutionRequest): Promise<Artifact<unknown>>`. Executor không persist hay retry.
- Produces: initial `makeCoreHarness` executor/registry/fixture factories; extend service/repo fields ở Tasks 5–6.

- [ ] **Step 1: Tests input/output, budget và late resolution bằng fake timers.** Fixtures `executeSum`, `executeInvalidOutput`, `executeIgnoringAbort` gọi executor, cung cấp canonical ctx.

```ts
expect((await executeSum([2, 3, 5])).data).toEqual({ total: 10 });
await expect(executeInvalidOutput(NaN)).rejects.toMatchObject({ code: "invalid_request" });
await expect(executeWrongArtifactKind()).rejects.toMatchObject({ code: "invalid_request" });
const pending = executeIgnoringAbort({ timeoutMs: 30_000 });
const assertion = expect(pending).rejects.toMatchObject({ code: "timeout" });
await vi.advanceTimersByTimeAsync(30_000); await assertion;
resolveLate({ total: 99 });
await expect(pending).rejects.toMatchObject({ code: "timeout" });
budget.consume("repair");
expect(() => budget.consume("repair")).toThrow(/resource_limit/);
```

- [ ] **Step 2: RED.** Run `.\node_modules\.bin\vitest.cmd run tests/core/executor.test.ts tests/core/budget.test.ts`; expect FAIL absent executor/budget.
- [ ] **Step 3: Implement execute và RunBudget.** Race deadline/caller abort, cleanup timer/listener, validate draft provenance/kind/version and post-transform JSON. Generate envelope authoritative fields; no envelope from raw client. Default counters đúng spec; executor không double-charge integration operations.
- [ ] **Step 4: GREEN.** Same tests PASS; thêm assertions caller already aborted không gọi cap, run remaining 10ms thắng step 30s, mismatched provenance reject, malformed transformed JSON reject, operation limit boundary 8/1/8/16 và finite validated overrides.
- [ ] **Step 5: Commit.** `git add src/core/runs/budget.ts src/core/capabilities/executor.ts tests/helpers/core.ts tests/core/executor.test.ts tests/core/budget.test.ts`; `git commit -m "feat(core): add bounded capability execution"`.

## Task 3: Typed tool registry và effect gate

**Files:** Create `src/core/tools/definition.ts`, `src/core/tools/registry.ts`; test `tests/core/tools.test.ts`.

**Interfaces:**
- Consumes: `DomainRegistry.get`, `RunBudget`, Task 1 schemas/CoreError.
- Produces: `ToolContext { scope: Scope; domainId: string; domainVersion: number; signal: AbortSignal; budget: Budget }`.
- Produces: `ToolDefinition<I,O> { name: string; input: Schema<I>; output: Schema<O>; effect: "read"|"internal-write"|"external-write"; run(context: ToolContext, input: I): Promise<O> }`.
- Produces: `ToolRegistry.register<I,O>(tool: ToolDefinition<I,O>): void`, `names(): ReadonlySet<string>`, `execute(name: string, input: unknown, context: ToolContext, allowedNames: ReadonlySet<string>): Promise<JsonValue>`. Server lấy allowedNames từ registered domain, không từ client.

- [ ] **Step 1: Tests handler không bị gọi khi policy/input sai.**

```ts
await expect(invokeTool("read.total", { bad: true }, []))
  .rejects.toMatchObject({ code: "forbidden" });
expect(handler).not.toHaveBeenCalled();
await expect(invokeTool("send.email", {}, ["send.email"]))
  .rejects.toMatchObject({ code: "feature_unavailable" });
expect(await invokeTool("read.total", { values: [2, 3, 5] }, ["read.total"]))
  .toEqual({ total: 10 });
```

- [ ] **Step 2: RED.** `.\node_modules\.bin\vitest.cmd run tests/core/tools.test.ts`; FAIL missing registry.
- [ ] **Step 3: Implement registration wrapper + execute.** Reject duplicates, unauthorized/missing allowlist, external-write, aborted signal and invalid JSON outputs. Consume tool budget once per authorized invocation trước handler; output validation failure không retry tự động. Tool handler nhận resolved scope, không body identity.
- [ ] **Step 4: GREEN.** Same tests PASS; test 17th call resource_limit, unknown tool not_found, transformed output Date invalid, valid internal-write allowed và aborted handler never called.
- [ ] **Step 5: Commit.** `git add src/core/tools/definition.ts src/core/tools/registry.ts tests/core/tools.test.ts`; `git commit -m "feat(core): add scoped tool policy registry"`.

## Task 4: Local Postgres và atomic scoped repositories

**Files:**
- Create: `compose.yaml`, `.env.example`, `drizzle.config.ts`, `vitest.core-db.config.ts`, `src/adapters/postgres/schema.ts`, `src/adapters/postgres/client.ts`, `src/adapters/postgres/runs.ts`, `src/adapters/postgres/artifacts.ts`, `src/adapters/postgres/sessions.ts`, `tests/helpers/postgres.ts`, `tests/integration/postgres-runs.test.ts`, `scripts/test-core-db.ts`, generated `drizzle/0000_core.sql`, `drizzle/meta/0000_snapshot.json`, `drizzle/meta/_journal.json`.
- Modify: `package.json` thêm `db:generate`, `db:migrate`, `test:core-db`; `vitest.config.ts` exclude riêng `tests/integration/postgres-runs.test.ts` và future `tests/integration/core-smoke.test.ts`; `.gitignore` nếu local .env chưa được ignored.

**Interfaces:**
- Consumes: fenced RunRepository/ArtifactRepository từ Task 1; immutable envelope và snapshot DTOs.
- Produces: `createPostgresRepositories(pool: Pool): { runs: RunRepository; artifacts: ArtifactRepository; sessions: DevSessionRepository }` exported ở `src/adapters/postgres/runs.ts`; client `createPostgresPool(url: string): Pool`.
- Produces: `DevSessionRepository.create(tokenHash: string, scope: Scope, expiresAt: Date): Promise<void>`, `resolve(tokenHash: string): Promise<Scope|null>`. Production không sử dụng dev resolver.
- Produces: `withTestDatabase<T>(fn: (repositories: ReturnType<typeof createPostgresRepositories>, pool: Pool) => Promise<T>): Promise<T>`; test script fail rõ nếu thiếu dedicated DB URL.

- [ ] **Step 1: DB integration tests claim/atomicity/fences/scope/restart.** Fixture `createQueued`, `expireRun`, `reloadRepositories` dùng dedicated test schema.

```ts
expect(await Promise.all([claimRun(), claimRun()])).toEqual(expect.arrayContaining([true, false]));
await startAttempt(1); await failAttempt(1); await startAttempt(2);
await expect(commitAttempt(1)).rejects.toMatchObject({ code: "conflict" });
expect(await artifacts.list(otherScope, run.id)).toEqual([]);
await runs.cancel(scope, run.id);
await expect(commitAttempt(2)).rejects.toMatchObject({ code: "conflict" });
expect((await reloadRepositories().runs.get(scope, run.id))?.status).toBe("cancelled");
await expireRun(runningRun.id);
expect((await runs.get(scope, runningRun.id))?.status).toBe("interrupted");
```

- [ ] **Step 2: RED.** Trước khi thêm default suite excludes, run `.\node_modules\.bin\vitest.cmd run tests/integration/postgres-runs.test.ts`; expect FAIL missing repository imports/behavior. Viết DB helper URL guard trong test setup nhưng chưa cần DB cho import failure; không coi thiếu Docker là bằng chứng logic fail.
- [ ] **Step 3: Implement tables, row-lock transactions và repository factory.** Claim CAS; enforce running/deadline/current attempt trước start/commit; commit artifact + step + revision atomically. Failure/terminal/cancel writes được phép sau deadline nhưng không override terminal state. Guard ownership join, unique artifact per step, interruption-on-read và cancel idempotency. `finish` skip remaining pending steps atomically với reason phù hợp. Sessions lưu hash, check DB expiry, không lưu raw token. Dedicated DB config chỉ include postgres-runs test, reset inherited excludes; runner validate URL trước khi spawn Vitest, thiếu URL exit nonzero.
- [ ] **Step 4: GREEN với DB thật.** Verify `docker manifest inspect postgres:18.6`, record digest; ensure 55432 free, generate ignored local password, `docker compose -p hackathon-starter-core up -d db`. Run `pnpm db:generate --name core`, `pnpm db:migrate`, tạo dedicated `starter_core_test`, rồi `pnpm test:core-db` PASS và compose ps healthy. Migration cho test schema do helper quản lý. Add forced insert-error rollback assertion: no artifact, no succeeded step, revision unchanged; double commit conflict; cross-scope create/read/cancel/write denied; cancelled terminal không bị finish override; sessions expired resolve null. Không chỉnh DB/container khác; unit suite không giả PASS bằng skip integration.
- [ ] **Step 5: Commit.** Stage files của Task 4 kể cả generated migration metadata, không stage `.env`; `git commit -m "feat(db): persist scoped runs with atomic attempt fences"`.

## Task 5: Sequential workflow runner

**Files:** Create `src/core/workflows/runner.ts`, `tests/helpers/memory-runs.ts`, `tests/core/runner.test.ts`; extend `tests/helpers/core.ts`.

**Interfaces:**
- Consumes: executor, registered domain workflow, fenced RunRepository, scoped CapabilityPorts và shared RunBudget.
- Produces: `WorkflowRunRequest { scope: Scope; snapshot: RunSnapshot; domain: DomainDefinition; signal: AbortSignal; budget: Budget; ports: CapabilityPorts }`.
- Produces: `WorkflowRunner` constructor `(deps: { executor: CapabilityExecutor; runs: RunRepository; now(): number })`; `run(request: WorkflowRunRequest): Promise<RunSnapshot>`. Run phải đã được service claim; runner không claim lần hai.
- Produces: `MemoryRunRepository` chỉ trong test helpers, implement cùng RunRepository transitions cho fast unit tests.

- [ ] **Step 1: Tests required/optional dependencies và retries.** Fixture `runWorkflow` dựng claimed run với sum và optional failure caps.

```ts
expect((await runWorkflow("all-success")).status).toBe("completed");
expect((await runWorkflow("optional-failure")).status).toBe("partial");
expect((await runWorkflow("required-failure")).status).toBe("failed");
expect((await runWorkflow("missing-required-artifact")).status).toBe("failed");
const retried = await runWorkflow("transient-then-success");
expect(retried.steps[0]).toMatchObject({ status: "succeeded", attempt: 2 });
expect((await runWorkflow("invalid-output")).steps[0].attempt).toBe(1);
expect(callsToSkippedDependent).toBe(0);
```

- [ ] **Step 2: RED.** `.\node_modules\.bin\vitest.cmd run tests/core/runner.test.ts`; FAIL missing runner.
- [ ] **Step 3: Implement run sequentially.** Bind chỉ từ declared successful dependencies và copies; persist each attempt; executor timeout/error classify; safe transient retry tối đa 2. Recheck signal/deadline/state trước commit và finish. Commit conflict đọc durable snapshot, không reset state. Required failure stop; optional descendants skip; independent steps continue; missing required kinds fail. Cancel/timeout mark remaining steps theo spec.
- [ ] **Step 4: GREEN.** Same tests PASS. Add tests unauthorized binder dependency, wrong artifact kind/schema, optional timeout partial khi run còn thời gian, run deadline failed, active cancel + late output không commit, safe retry chỉ gọi 2 lần, terminal finish không overwrite repository state.
- [ ] **Step 5: Commit.** `git add src/core/workflows/runner.ts tests/helpers/memory-runs.ts tests/helpers/core.ts tests/core/runner.test.ts`; `git commit -m "feat(core): execute sequential workflows with guarded retries"`.

## Task 6: RunServices, presenter gate và agent projections

**Files:** Create `src/core/services/runs.ts`, `src/core/domains/presentation.ts`, `src/core/services/metadata.ts`, `src/agents/projection.ts`, `tests/core/services.test.ts`, `tests/core/presentation.test.ts`; extend `tests/helpers/core.ts`.

**Interfaces:**
- Consumes: registries, runner, repos, budget, RunServices contract và existing AgentProjection/UiSessionState DTOs.
- Produces: `ResultMetadataProvider.resolve(scope: Scope, snapshot: RunSnapshot): Promise<ResultInputs>`; `EmptyResultMetadataProvider` gate trong spec.
- Produces: `RunServiceDependencies { domains: DomainRegistry; runs: RunRepository; artifacts: ArtifactRepository; runner: WorkflowRunner; metadata: ResultMetadataProvider; makePorts(scope: Scope): CapabilityPorts; now(): number }`.
- Produces: `createRunServices(deps: RunServiceDependencies): RunServices`; local controller map nằm trong factory, key bằng runId; cleanup trong finally.
- Produces: `presentRun(domain: DomainDefinition, snapshot: RunSnapshot, inputs: ResultInputs): ResultView`, `assertCoreResultReferences(view: ResultView, snapshot: RunSnapshot, inputs: ResultInputs): void`.
- Produces: `projectRun(snapshot: RunSnapshot): AgentProjection`, `toUiSession(snapshot: RunSnapshot): UiSessionState`; summary deterministic từ domain/status/step counts, không model call.

- [ ] **Step 1: Tests service lifecycle, version và presenter boundary.**

```ts
const queued = await services.createRun(scope, "core-demo", { numbers: [2, 3, 5] });
expect(queued.status).toBe("queued");
const done = await services.executeRun(scope, queued.id, new AbortController().signal);
expect(done.status).toBe("completed");
expect((await services.getResult(scope, queued.id)).blocks[0])
  .toMatchObject({ type: "metric", props: { value: 10 } });
await services.executeRun(scope, queued.id, new AbortController().signal);
expect(calls.sum).toBe(1);
expect(projectRun(done).businessRunId).toBe(queued.id);
expect(() => presentRun(danglingChartDomain, done, emptyMetadata)).toThrow();
```

- [ ] **Step 2: RED.** `.\node_modules\.bin\vitest.cmd run tests/core/services.test.ts tests/core/presentation.test.ts`; FAIL missing factories.
- [ ] **Step 3: Implement services/projection/presenter.** create parses schema+JSON, snapshots domain version và pending steps; reject empty seeds. execute claim với deadline now+120000, refresh running snapshot sau claim, return terminal snapshot on repeat, running loser conflict; combine caller/local cancellation. get resolves expired run qua repo; cancel persist trước abort. Presenter dùng đúng domain version, validation và reference gate; không đổi terminal status nếu presenter lỗi.
- [ ] **Step 4: GREEN.** Same tests PASS. Add missing historical domain version unavailable, schema transform Date invalid, empty seed unavailable, changed latest domain không đổi saved version, dangling sources/evidence/claims/datasets/factors reject, invalid report cycle reject, progress step/action artifact references checked và completed status giữ nguyên sau presenter failure.
- [ ] **Step 5: Commit.** Stage files của Task 6; `git commit -m "feat(core): expose run services and validated result projections"`.

## Task 7: Server composition, dev scope và deterministic core-demo

**Files:**
- Modify: `src/server/container.ts`, `src/server/env.ts`, `src/domains/catalog.server.ts`, `.env.example`.
- Create: `src/server/scope.ts`, `src/server/live-container.ts`, `src/domains/core-demo/definition.ts`, `src/domains/core-demo/capabilities.ts`, `src/app/api/session/dev/route.ts`, `tests/core/container.test.ts`, `tests/integration/dev-session.test.ts`.
- Modify: `tests/contracts/env-errors.test.ts` nếu new environment validation ảnh hưởng assertions.

**Interfaces:**
- Consumes: createPostgresRepositories, registries/services, DevSessionRepository, typed unavailable errors.
- Produces: `ScopeResolver.resolve(request: Request): Promise<Scope>`; `createDevScopeResolver(sessions: DevSessionRepository): ScopeResolver`; `requireMutationOrigin(request: Request, expectedOrigin: string): void`.
- Produces: `LiveContainer { mode: "live"; features: Record<string,boolean>; services: RunServices; scope: ScopeResolver; tools: ToolRegistry; domains: DomainRegistry; close(): Promise<void> }`.
- Produces: `createLiveContainer(env: ServerEnv, productionScope?: ScopeResolver): Promise<LiveContainer>` và `getServerContainer(): Promise<SkeletonContainer|LiveContainer>`; giữ existing `createContainer(): SkeletonContainer` cho no-env compatibility, server getter cache lifecycle riêng.
- Produces: server env `APP_ORIGIN` mặc định local `http://127.0.0.1:3000`; live mode requires DATABASE_URL. Production live requires injected ScopeResolver, không silently dùng dev scope.
- Produces: `coreDemoDomain: DomainDefinition`, `sumCapability: Capability<{numbers:number[]},{total:number}>`; schema finite numbers array min1/max100; registered artifact `core.sum@1`.

- [ ] **Step 1: Tests skeleton/live gates và session scope.**

```ts
expect(createContainer().features.runs).toBe(false);
await expect(createLiveContainer(productionEnvWithoutResolver)).rejects.toMatchObject({ code: "feature_unavailable" });
expect(coreDemoDomain.manifest.id).toBe("core-demo");
expect(await resolver.resolve(validCookieRequest)).toEqual({ userId: "dev-user", workspaceId: "dev-workspace", trustedOperator: false });
await expect(resolver.resolve(forgedHeadersWithoutCookie)).rejects.toMatchObject({ code: "unauthorized" });
expect(() => requireMutationOrigin(crossOriginRequest, "http://127.0.0.1:3000"))
  .toThrow();
```

- [ ] **Step 2: RED.** `.\node_modules\.bin\vitest.cmd run tests/core/container.test.ts tests/integration/dev-session.test.ts tests/contracts/env-errors.test.ts`; FAIL missing live composition/session.
- [ ] **Step 3: Implement composition và session bootstrap.** Wrap scoped read ports, disable unavailable integrations; register demo chỉ development/test, preserve existing four seeds. Random 32-byte session, hash DB, set cookie attributes/TTL. Production endpoint unavailable và no dev scope fallback; reject absent/wrong Origin ở mutations. Tool allowlist chỉ lấy registered domain. Pool đóng qua close, không tạo pool mỗi request.
- [ ] **Step 4: GREEN.** Same tests PASS và database session tests Task 4 PASS. Assert raw token không persist, expired session unauthorized, trustedOperator false bất kể browser headers, no .env skeleton boot, live missing DB unavailable, model/sources/parsers/MCP false.
- [ ] **Step 5: Commit.** Stage Task 7 files; `git commit -m "feat(server): compose local core with server-owned development scope"`.

## Task 8: Scoped BFF run/artifact routes

**Files:**
- Modify: `src/app/api/runs/route.ts`, `docs/api-contracts.md`.
- Create: `src/server/http.ts`, `src/app/api/runs/[runId]/route.ts`, `src/app/api/runs/[runId]/execute/route.ts`, `src/app/api/runs/[runId]/cancel/route.ts`, `src/app/api/runs/[runId]/result/route.ts`, `src/app/api/artifacts/[artifactId]/route.ts`, `tests/integration/runs-http.test.ts`.

**Interfaces:**
- Consumes: server container, ScopeResolver, RunServices và existing DTOs.
- Produces: `readBoundedJson(request: Request, maxBytes: number): Promise<unknown>` counting actual stream bytes, `errorResponse(error: unknown, traceId: string): Response` mapping đúng spec. Bodyless mutation accepts zero bytes hoặc `{}`; reject other fields và oversized body.
- Produces: route handlers Node runtime; Next params handling đọc installed guide/types thay vì assume API cũ. Create returns full RunSnapshot 201; execute await terminal 200; cancel 204; artifact missing 404.

- [ ] **Step 1: Tests HTTP semantics và authenticated boundary.** Test imports route handlers với injected container double; DB end-to-end ở Task 9.

```ts
expect((await createRun(malformedJson)).status).toBe(400);
expect((await createRun(bodyWithUserId)).status).toBe(400);
expect((await createRun(noSession)).status).toBe(401);
expect((await createRun(chunkedBodyOver256KiB)).status).toBe(400);
expect((await getRunAsOtherScope()).status).toBe(404);
expect((await executeTwiceConcurrently()).map(r => r.status).sort()).toEqual([200, 409]);
expect((await createRunInSkeleton()).status).toBe(501);
expect((await cancelOwnedTerminal()).status).toBe(204);
```

- [ ] **Step 2: RED.** `.\node_modules\.bin\vitest.cmd run tests/integration/runs-http.test.ts`; FAIL missing routes/strict parsing.
- [ ] **Step 3: Implement handlers + HTTP helpers.** Await scope, origin and services; no body scope, no fire-and-forget execute. Use bounded body reader cho tất cả mutations, UUID/path checks, strict Zod object schemas và generated trace IDs. Cancel does not require prompt/input. Error response masks unknown errors. Update API docs phân biệt skeleton/live.
- [ ] **Step 4: GREEN.** Same tests PASS; assert interrupted read serialized valid snapshot, aborted execute cancels, invalid result 500 masked, unknown artifact 404, unique trace IDs, content-length thấp giả không bypass byte limit, no Content-Length stream still bounded. `.\node_modules\.bin\next.cmd typegen` và `.\node_modules\.bin\tsc.cmd --noEmit` PASS.
- [ ] **Step 5: Commit.** Stage Task 8 files; `git commit -m "feat(api): expose authenticated run lifecycle endpoints"`.

## Task 9: Real DB smoke, restart verification và handoff docs

**Files:** Create `scripts/core-smoke.ts`, `vitest.core-smoke.config.ts`, `tests/integration/core-smoke.test.ts`, `docs/core-p0-handoff.md`; modify `package.json`, `docs/README.md`, `docs/code-structure.md`, `docs/platform-build-spec.md`.

**Interfaces:**
- Consumes: all prior tasks; no new core abstractions.
- Produces: `runCoreSmoke(baseUrl: string): Promise<{runId: string; artifactId: string; total: number}>`; cookie jar local cho dev session, fetch đúng BFF. Add script `core:smoke` chạy tsx trên file này; test import không auto-start CLI.
- Produces: script `test:core-smoke` chạy `vitest run --config vitest.core-smoke.config.ts`; config chỉ include real smoke test, reset inherited excludes. Suite kiểm tra dedicated test URL trước khi start app, thiếu prerequisite exit nonzero; không skip silently.
- Produces: handoff hướng dẫn register một capability/schema/domain/presenter, local setup, limitations, future CopilotKit adapter và ownership bạn/mình.

- [ ] **Step 1: Test smoke acceptance.** Real local Next server + dedicated starter test DB; fixtures không thay thế HTTP/DB.

```ts
const result = await runCoreSmoke("http://127.0.0.1:3000");
expect(result.total).toBe(10);
expect(result.runId).toMatch(UUID_PATTERN);
expect((await reloadRunAfterAppRestart(result.runId)).status).toBe("completed");
expect((await reloadResultAfterAppRestart(result.runId)).blocks[0].props.value).toBe(10);
expect((await readExpiredAbandonedRun()).status).toBe("interrupted");
```

- [ ] **Step 2: RED.** `pnpm core:smoke` ban đầu FAIL missing script hoặc incomplete live flow; record actual failure. Test runner lifecycle quản lý đúng process của starter, không kill process/container khác.
- [ ] **Step 3: Implement smoke và handoff docs.** Session→create→execute→GET run/result/artifact; validate DTO/total10, fail process rõ nếu endpoint unavailable. Integration harness restart app process do test tạo, giữ DB/volume/session; expired abandoned fixture seeded dedicated DB. Document typed registration example theo new refs, no domain logic trong core. Update trạng thái doc từ planned thành implemented chỉ phần đã pass.
- [ ] **Step 4: Run final checks.** `pnpm test:core-db`, `pnpm test:core-smoke`, `pnpm core:smoke` với dev app đang chạy, toàn bộ unit/contract tests, domain validation, check và build đều phải PASS. Nếu pnpm sandbox gặp store/linking mismatch, dùng direct repo binaries dưới đây; không reinstall chỉ để né môi trường.

```powershell
.\node_modules\.bin\vitest.cmd run
.\node_modules\.bin\tsx.cmd scripts/validate-domains.ts
.\node_modules\.bin\next.cmd typegen
.\node_modules\.bin\tsc.cmd --noEmit
.\node_modules\.bin\eslint.cmd .
.\node_modules\.bin\next.cmd build
git diff --check
git status --short
```

Default Vitest suite exclude đúng hai files DB/smoke qua config, không dùng conditional `it.skip`. Dedicated config/runner chạy riêng để commands trên không cần DB; final gate bắt buộc `pnpm test:core-db` và `pnpm test:core-smoke`. Review tracked diff không chứa .env, token, raw DB URL; kiểm tra remote trước push.

- [ ] **Step 5: Commit và whole-branch review.** Stage đúng Task 9 files; `git commit -m "test(core): verify durable lifecycle and document platform handoff"`. Dùng fresh **gpt-6-luna** reviewer theo preserved SDD method, sửa findings và rerun affected checks. Push chỉ remote starter đã được user cho phép; không push repo thi đấu.

## Coverage map và self-review của plan

| Spec requirement | Tasks |
|---|---|
| Ownership, contracts, registry/versioning | 1, 7, 9 |
| JSON/schema boundaries, deadline, budget | 1, 2, 3 |
| Retry/dependency/terminal statuses | 4, 5, 6 |
| Atomic artifact persistence, scope và restart | 4, 5, 9 |
| Presenter metadata/reference gate | 6 |
| Tool allowlist, effect policy | 3, 7 |
| Dev scope/session, production gate | 4, 7, 8 |
| BFF status/body semantics, no detached run | 8, 9 |
| Docker/versions và no-key skeleton compatibility | 4, 7, 9 |
| CopilotKit future boundary/projections | 6, 9; SDK integration ngoài P0 |

Đã self-review: một execution path; attempt fence dùng cùng signature ở repo/runner; artifact fields đúng existing contract; terminal repeat không replay; năm Review Focus có tests trong owning tasks. Tool/metadata gates không giả vờ engines đã hoàn thiện. Plan kết thúc ở core chạy thật + docs, chưa xây friend templates hoặc chat runtime.

## Sau khi user review

Giữ phương pháp subagent-driven với gpt-6-luna đã được chọn. Triển khai từng task, implementer → spec review → quality review theo skill, rồi whole-branch review. Không bắt đầu core khi user đang đi ăn; tài liệu này là artifact để review trước lượt triển khai.
