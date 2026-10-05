# 02 — Dataset Analytics and Local pgEdge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CSV/XLSX tạo dataset, metrics/chart/table chính xác và agent-ready pgEdge query results thành artifacts.

**Architecture:** Dùng dataset repository/Drizzle cho import và app persistence. MCP server local có role riêng; query bridge dùng executor để lưu artifacts cùng result path.

**Tech Stack:** Next.js App Router, TypeScript, Zod, Postgres/Drizzle, CopilotKit v2, BTC Gateway, local pgEdge MCP; Vitest + Playwright.

**Spec:** [Design v0.3](../specs/2026-10-05-hackathon-plug-and-play-design.md)

**Prerequisite:** Phase 01 Gate 1 hoàn thành. Reuse exports trong master API ledger.

## Global Constraints

- Repo chuẩn bị ở E:/thucchienai/hackathon-starter-kit. Repo thi aitc2026-team-939-triplepeek nằm ngoài phạm vi thao tác. Không tự chuyển source, cấu hình remote hay push sang repo thi.
- Chọn modular monolith: một app Next.js + TypeScript + BFF + CopilotKit runtime, Postgres Docker + Drizzle, mọi lời gọi model qua BTC Gateway.
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

Mọi đường dẫn Files bên dưới tương đối với repo root trên. Chạy PowerShell tại root đó. Đọc master plan và spec trước mỗi phase. Dependencies npm cài bằng --save-exact, commit pnpm-lock.yaml; version SDK và image được ghi sau khi compatibility checks thật pass, không coi version latest là compatibility guarantee.

Test red phải thất bại vì behavior/import chưa triển khai, không phải vì thiếu Docker/env ngoài task. Unit tests dùng fakes có nhãn fixture; integration tests cần services được khởi động rõ ràng. Live BTC check cần BTC_GATEWAY_BASE_URL, BTC_GATEWAY_API_KEY và BTC_MODEL do đội cung cấp trong .env.local; không đọc .env hoặc key files ở repo thi, không ghi secret vào output.

Một task có thể cần nhiều vòng 2–5 phút cho các files nhỏ. Mỗi task có test cycle và local commit riêng; không gộp cả phase thành một lần viết code lớn.

## Task order

B1 → B2 → B3 → B4 → B5. Một dataset pipeline deterministic vẫn hoạt động khi MCP/database exploration tools bị tắt.

### Task B1: CSV/XLSX ingestion giữ typed rows và provenance

**Files:**
- Create: src/adapters/parsers/csv.ts, xlsx.ts, dataset.ts, src/capabilities/ingestion/dataset.ts
- Modify: src/adapters/parsers/index.ts, src/core/services/uploads.ts, src/adapters/postgres/repositories.ts
- Create: tests/fixtures/spending.csv; Test: tests/integration/dataset-ingestion.test.ts

**Interfaces:**
- Consumes: A2 DatasetRepository, ColumnSpec/DataRow/DatasetRef; A6 upload/storage/format dispatcher.
- Produces: parseDataset(bytes,mime,sourceId); dataset import idempotent theo contentHash+workspace; ingestion ArtifactDraft<DatasetRef>.

- [ ] **Step 1: Viết test behavior**

```ts
import { expect, it } from "vitest";
import { parseDataset } from "@/adapters/parsers/dataset";

it("preserves missing amounts and stable row IDs", async () => {
  const bytes = new TextEncoder().encode("merchant,amount\nA,10\nB,\nC,30\n");
  const result = await parseDataset(bytes,"text/csv","source-1");
  expect(result.columns.find(c=>c.key==="amount")?.type).toBe("number");
  expect(result.rows.map(r=>r.values.amount)).toEqual([10,null,30]);
  expect(new Set(result.rows.map(r=>r.id)).size).toBe(3);
});
```

- [ ] **Step 2: Xác nhận RED**

Run: `pnpm exec vitest run tests/integration/dataset-ingestion.test.ts`
Expected: FAIL vì behavior/import chưa có; services của task phải sẵn sàng trước integration assertion.

- [ ] **Step 3: Triển khai phần tối thiểu**

Install csv-parse và ExcelJS bằng --save-exact, update MIME/extension allowlist. XLSX xử lý workbook values không execute formulas/macros; formula cell chỉ dùng cached result nếu có, thiếu cache là null + warning. Không suy date từ chuỗi mơ hồ: chỉ ISO date/time hoặc XLSX date values. Duplicate headers có suffix tường minh. Row ID hash(sourceId,sheet,rowNumber). Leading zero string như phone/ZIP giữ string; mixed numeric/string column giữ string và warning. Count/missing-type statistics lấy source rows, không drop null. Cả file20MB và row/cell count limit; parser worker thread timeout như A6. Dataset import tạo SourceRef kind dataset và trả persisted DatasetRef.

```ts
export function parseNumericCell(value: string): number | null {
  const normalized = value.trim();
  if (normalized === "") return null;
  if (!/^-?(?:\d+\.?\d*|\.\d+)$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function stableRowId(sourceId: string,sheet:string,row:number) {
  return createHash("sha256").update(sourceId+"|"+sheet+"|"+row).digest("hex");
}
```

- [ ] **Step 4: Xác nhận GREEN**

Run: `pnpm exec vitest run tests/integration/dataset-ingestion.test.ts`
Additional run: `pnpm check`
Expected: CSV/XLSX/null/mixed-type/leading-zero/formula fixtures pass; original sheet,row locators retained. Repeat import does not duplicate rows; cross-workspace dataset lookup remains inaccessible.

- [ ] **Step 5: Commit local**

```powershell
git -C E:/thucchienai/hackathon-starter-kit add -- src/adapters/parsers src/capabilities/ingestion/dataset.ts src/core/services/uploads.ts src/adapters/postgres/repositories.ts tests/fixtures/spending.csv tests/integration/dataset-ingestion.test.ts package.json pnpm-lock.yaml
git -C E:/thucchienai/hackathon-starter-kit commit -m 'feat: ingest typed CSV and XLSX datasets'
```

### Task B2: Deterministic analytics, trend/outlier và chart specifications

**Files:**
- Create: src/capabilities/analytics/statistics.ts, trend.ts, outliers.ts, chart-spec.ts, index.ts
- Create: src/contracts/analytics.ts; Create: src/app/api/datasets/[datasetId]/rows/route.ts
- Test: tests/contracts/analytics.test.ts, tests/integration/dataset-query.test.ts

**Interfaces:**
- Consumes: B1 typed rows, A2 DatasetQuery/scoped repository, master AnalyticsQuery/AnalyticsData/ChartSpec.
- Produces: analyzeDataset(page,query):AnalyticsData; loadDatasetForAnalytics(scope,datasetId,signal):Promise<DatasetPage> ở index.ts/service boundary; ChartSpec là chart props DTO; GET paginated dataset rows; SQL/aggregation paths use allowed keys and scope.

- [ ] **Step 1: Viết test behavior**

```ts
import { expect, it } from "vitest";
import { analyzeDataset } from "@/capabilities/analytics";

it("computes totals without model arithmetic and marks outliers", () => {
  const values = [10,11,12,13,14,15,16,100];
  const page = {datasetId:"d1",columns:[{key:"amount",type:"number" as const,nullable:false}],
    rows:values.map((amount,i)=>({id:String(i),values:{amount}})),
    total:values.length,offset:0,limit:100};
  const result = analyzeDataset(page,{numericKeys:["amount"]});
  expect(result.metrics[0].sum).toBe(191);
  expect(result.metrics[0].mean).toBe(23.875);
  expect(result.outliers.map(o=>o.rowId)).toEqual(["7"]);
});
```

- [ ] **Step 2: Xác nhận RED**

Run: `pnpm exec vitest run tests/contracts/analytics.test.ts tests/integration/dataset-query.test.ts`
Expected: FAIL vì behavior/import chưa có; services của task phải sẵn sàng trước integration assertion.

- [ ] **Step 3: Triển khai phần tối thiểu**

Pure analytics only accepts complete input slice: page rows must represent full data for global metrics; if total>rows.length throw incomplete_dataset; loadDatasetForAnalytics ở capability/service đọc DatasetRepository.read với pages100 rows, kiểm tra total/columns ổn định và gather complete slice trong resource budget, không dùng page50 rows làm toàn bộ dataset. Dataset import immutable sau creation; không sửa rows trong analytics run. Numeric finite values only; missing separate count. IQR type7 quantiles, below4 values return no outliers with method note, IQR0 handles unequal values explicitly. Trends require valid date column + sorted bucket series, compute deterministic direction/slope with method. Chart spec picks bar for category totals, line for time series, scatter for two numeric columns; validate keys/unit/type/allowed aggregation. Sorting/filtering uses column allowlist, parameter values bound, no raw column name injection.

```ts
export function numericSummary(values: Array<number|null>) {
  const valid = values.filter((v):v is number => v!==null && Number.isFinite(v));
  const sum = valid.reduce((a,b)=>a+b,0);
  return {count:valid.length,missing:values.length-valid.length,sum,
    mean:valid.length?sum/valid.length:null,
    min:valid.length?Math.min(...valid):null,
    max:valid.length?Math.max(...valid):null};
}
```

- [ ] **Step 4: Xác nhận GREEN**

Run: `pnpm exec vitest run tests/contracts/analytics.test.ts tests/integration/dataset-query.test.ts`
Additional run: `pnpm check`
Expected: Expected totals/mean/IQR/trend fixtures pass; missing columns, partial page globals and invalid query keys rejected. DatasetPage SQL pagination/scope tests pass.

- [ ] **Step 5: Commit local**

```powershell
git -C E:/thucchienai/hackathon-starter-kit add -- src/capabilities/analytics src/contracts/analytics.ts src/app/api/datasets tests/contracts/analytics.test.ts tests/integration/dataset-query.test.ts
git -C E:/thucchienai/hackathon-starter-kit commit -m 'feat: compute deterministic dataset analytics and chart specs'
```

### Task B3: Pin và chạy pgEdge MCP local, protocol client và result normalization

**Files:**
- Create: scripts/pin-local-images.ps1, infra/images.lock.json, infra/pgedge/config.example.yaml, infra/pgedge/README.md
- Create: infra/postgres/init/002-mcp-grants.sql
- Create: src/adapters/mcp/pgedge/client.ts, tools.ts, normalize.ts, sql-policy.ts, src/core/ports/mcp.ts
- Modify: compose.yaml, .env.example, scripts/setup-local-env.ps1, scripts/doctor.ts
- Test: tests/integration/pgedge-client.test.ts, tests/contracts/mcp-normalize.test.ts

**Interfaces:**
- Consumes: Spec14.1, A3 DB roles/source tables, master McpClient/McpCallResult/QueryResultData. Link: https://github.com/pgEdge/pgedge-postgres-mcp/blob/main/docs/guide/deploy_docker.md
- Produces: McpClient factory; describeSchema; normalizeQueryResult; image digest lock; authenticated pgEdge service; role mcp_reader only SELECT curated analytics views.

- [ ] **Step 0: Chuẩn bị integration prerequisite**

Pull base server once, inspect RepoDigests, write infra/images.lock.json and generated .env.images with exact postgres/pgEdge image digests. Startup reads image env with :? required, no default latest. Generate MCP token/role password into .env.local. Run migrations/grants on new starter DB only, then docker compose --env-file .env.local --env-file .env.images up -d postgres pgedge-mcp. Capture actual MCP protocol/tool response as synthetic-data fixture for parser tests; sanitize token/host metadata.

- [ ] **Step 1: Viết test behavior**

```ts
import { expect, it } from "vitest";
import { normalizeQueryResult } from "@/adapters/mcp/pgedge/normalize";

it("rejects malformed results instead of inventing numbers", () => {
  expect(() => normalizeQueryResult({
    content:[{type:"text",text:"not a valid query result"}],
  },{query:"SELECT 1",sourceIds:["s1"],maxRows:100})).toThrow();
});
```

- [ ] **Step 2: Xác nhận RED**

Run: `pnpm exec vitest run tests/integration/pgedge-client.test.ts tests/contracts/mcp-normalize.test.ts`
Expected: FAIL vì behavior/import chưa có; services của task phải sẵn sàng trước integration assertion.

- [ ] **Step 3: Triển khai phần tối thiểu**

Install libpg-query@pg17 bằng pnpm add --save-exact libpg-query@pg17, record resolved lockfile version matching Postgres17 grammar. Use MCP-compatible SDK only after negotiated version/header test succeeds, otherwise compatible JSON-RPC HTTP driver restricted to documented methods inside client.ts. initialize/tools-list/tool-call/auth/error/AbortSignal behavior tested against actual pinned server. config base service only, no upstream web/CLI agent. Bearer secret stays backend. Disable LLM proxy, KB, embedding/similarity/searchKB and connection switching; runtime assert advertised disabled tools not exposed by app. Image entrypoint INIT_TOKENS supported only if verified pinned version; config/token example follows actual upstream schema. SQL policy use libpg-query AST, exactly one SELECT including CTEs recursively, only permitted curated relations/functions, no user-set session config, parameter/row/time/bytes limits. Restricted DB role enforces permissions beyond AST. mcp grants exclude app sessions/secrets and ordinary users cannot invoke raw SQL bridge. MCP metadata filter bound to server-approved analytics schema. Result normalizer supports exact observed pinned format; reject ambiguous outputs, retain query hash/executedAt/truncation.

```powershell
docker pull ghcr.io/pgedge/postgres-mcp:latest
$pgEdgeImageInfo = docker image inspect ghcr.io/pgedge/postgres-mcp:latest | ConvertFrom-Json
$pgEdgeDigest = $pgEdgeImageInfo[0].RepoDigests[0]
if (-not $pgEdgeDigest.Contains('@sha256:')) { throw 'Image digest unavailable' }
$pgEdgeDigest | Set-Content -LiteralPath '.data/pgedge-image-digest.txt'
# pin-local-images.ps1 dùng cùng thuật toán cho Postgres và ghi lock/config image-only.
```

- [ ] **Step 4: Xác nhận GREEN**

Run: `pnpm exec vitest run tests/integration/pgedge-client.test.ts tests/contracts/mcp-normalize.test.ts`
Additional run: `pnpm exec tsx scripts/doctor.ts --mcp`
Expected: Actual pinned MCP health+negotiation+tool discovery+schema read+SELECT succeeds; bad bearer rejected; INSERT/UPDATE and app-private SELECT denied by role. No provider network call from MCP. Normalizer handles actual fixture and rejects unknown formatting.

- [ ] **Step 5: Commit local**

```powershell
git -C E:/thucchienai/hackathon-starter-kit add -- scripts/pin-local-images.ps1 scripts/setup-local-env.ps1 scripts/doctor.ts infra/images.lock.json infra/pgedge infra/postgres/init/002-mcp-grants.sql src/adapters/mcp src/core/ports/mcp.ts compose.yaml .env.example tests/integration/pgedge-client.test.ts tests/contracts/mcp-normalize.test.ts package.json pnpm-lock.yaml
git -C E:/thucchienai/hackathon-starter-kit commit -m 'feat: integrate authenticated local pgEdge MCP'
```

### Task B4: Dataset archetype, query artifacts và chart/table UI

**Files:**
- Create: src/domains/examples/dataset-analysis/manifest.ts, index.server.ts, schemas.ts, prompts.ts, workflow.ts, sources.ts, presenter.ts, fixtures/input.json
- Create: src/ui/blocks/MetricCard.tsx, ChartCard.tsx, DataTable.tsx, src/core/services/database.ts
- Modify: src/ui/registry/index.tsx, src/core/domains/catalog.server.ts, src/domains/catalog.client.ts, src/server/container.ts
- Test: tests/integration/dataset-workflow.test.ts, tests/contracts/query-scope.test.ts

**Interfaces:**
- Consumes: B1 parse/import, B2 deterministic analytics, B3 MCP client, A5 executor/services, A8 renderer.
- Produces: dataset-analysis Domain Pack; queryDataset(scope,{datasetId,query},signal):Artifact<QueryResultData>; normalized query result registered core/query-result v1; chart/table renders scoped DatasetPage.

- [ ] **Step 1: Viết test behavior**

```ts
import { expect, it } from "vitest";
import { assertDatabaseToolScope } from "@/core/services/database";

it("does not let a normal session gain raw SQL access", () => {
  expect(() => assertDatabaseToolScope({
    userId:"u",workspaceId:"w",trustedOperator:false,
  })).toThrow();
  expect(() => assertDatabaseToolScope({
    userId:"operator",workspaceId:"demo",trustedOperator:true,
  })).not.toThrow();
});
```

- [ ] **Step 2: Xác nhận RED**

Run: `pnpm exec vitest run tests/integration/dataset-workflow.test.ts tests/contracts/query-scope.test.ts`
Expected: FAIL vì behavior/import chưa có; services của task phải sẵn sàng trước integration assertion.

- [ ] **Step 3: Triển khai phần tối thiểu**

dataset-analysis workflow ingest→analytics→optional LLM summary→report; metadata/global numeric artifacts required, summary optional failure causes partial. MCP tools are opt-in on trusted demo session; queryDataset creates/executes business run step with executor, uses same artifacts service and presenter. DatasetRepository read for deterministic metrics remains direct Drizzle path, not arbitrary LLM SQL. create curated views only for demo datasets operator is permitted to inspect; no auto grants to private user datasets. Recharts installed exact for ChartCard; table pagination/refetch independent of chat state, column filters from validated contract. Query-result table binds validated result rows as dataset ref, never parses model prose to recover chart numbers.

```ts
export function assertDatabaseToolScope(scope: Scope): void {
  if (!scope.trustedOperator) throw new Error("permission_denied");
}

export function analyticsBlocks(artifact: Artifact<AnalyticsData>): UIBlock[] {
  return artifact.data.metrics.map(metric => ({
    id:"metric-"+metric.key,type:"metric",
    props:{label:metric.key,value:metric.sum,sourceIds:artifact.provenance.sourceIds},
  }));
}
```

- [ ] **Step 4: Xác nhận GREEN**

Run: `pnpm exec vitest run tests/integration/dataset-workflow.test.ts tests/contracts/query-scope.test.ts`
Additional run: `pnpm check; pnpm build`
Expected: CSV/XLSX workflows produce exact numeric artifacts and valid chart/table blocks; operator query returns persisted artifact with metadata; normal user query denied; summary failure preserves deterministic metrics.

- [ ] **Step 5: Commit local**

```powershell
git -C E:/thucchienai/hackathon-starter-kit add -- src/domains/examples/dataset-analysis src/ui/blocks/MetricCard.tsx src/ui/blocks/ChartCard.tsx src/ui/blocks/DataTable.tsx src/ui/registry/index.tsx src/core/services/database.ts src/core/domains/catalog.server.ts src/domains/catalog.client.ts src/server/container.ts tests/integration/dataset-workflow.test.ts tests/contracts/query-scope.test.ts package.json pnpm-lock.yaml
git -C E:/thucchienai/hackathon-starter-kit commit -m 'feat: add dataset analysis and query artifact views'
```

### Task B5: Dataset/MCP acceptance E2E và local stack runbook

**Files:**
- Create: tests/e2e/dataset-analysis.spec.ts, tests/integration/mcp-permissions.test.ts
- Modify: docs/local-run.md, docs/verification.md, README.md, compose.yaml

**Interfaces:**
- Consumes: B1–B4 runnable dataset/MCP integration, Gate1 persistence/session conventions.
- Produces: Gate2 evidence: deterministic analytics E2E, read-only/private access test, failure behavior when MCP unavailable.

- [ ] **Step 1: Viết test behavior**

```ts
import { expect, test } from "@playwright/test";

test("CSV metrics persist and table pagination works",async({page})=>{
  await page.goto("/workspace/dataset-analysis");
  await page.getByLabel("Dataset").setInputFiles("tests/fixtures/spending.csv");
  await page.getByRole("button",{name:"Phân tích"}).click();
  await expect(page.getByTestId("metric-amount")).toContainText("40");
  await expect(page.getByTestId("dataset-chart")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("metric-amount")).toContainText("40");
});
```

- [ ] **Step 2: Xác nhận RED**

Run: `pnpm exec playwright test tests/e2e/dataset-analysis.spec.ts`
Expected: FAIL vì behavior/import chưa có; services của task phải sẵn sàng trước integration assertion.

- [ ] **Step 3: Triển khai phần tối thiểu**

spending.csv cố định A10/Bempty/C30 như B1, total40. Actual MCP permission suite calls SELECT analytic allowed, write denied, app.sessions denied and disabled model tools fail; use integration token from .env.local, never snapshots headers. Stop MCP only in this project service to verify database tools unavailable while document workflow still runs; restart service after check. Docker app connection uses pgedge-mcp hostname; host dev uses loopback. Final scope test normal user cannot read operator artifact/dataset outside workspace. Persist query/hash/source metadata for report verification.

```powershell
docker compose --env-file .env.local --env-file .env.images stop pgedge-mcp
pnpm exec vitest run tests/integration/mcp-permissions.test.ts -t unavailable
docker compose --env-file .env.local --env-file .env.images start pgedge-mcp
pnpm exec tsx scripts/doctor.ts --mcp
```

- [ ] **Step 4: Xác nhận GREEN**

Run: `pnpm exec playwright test tests/e2e/dataset-analysis.spec.ts`
Additional run: `pnpm exec vitest run tests/integration/mcp-permissions.test.ts; pnpm check; pnpm build`
Expected: Dataset E2E, actual MCP role/tool checks and degraded-MCP behavior pass. docs/verification records pinned digest/tool schema version and actual commands. Gate2 checked only after live local MCP query tested.

- [ ] **Step 5: Commit local**

```powershell
git -C E:/thucchienai/hackathon-starter-kit add -- tests/e2e/dataset-analysis.spec.ts tests/integration/mcp-permissions.test.ts docs/local-run.md docs/verification.md README.md compose.yaml
git -C E:/thucchienai/hackathon-starter-kit commit -m 'test: verify local dataset and MCP workflow'
```

## Gate 2

- [ ] Typed CSV/XLSX không mất null/unit/row identity.
- [ ] Global metrics/trends/outliers đúng trên toàn dataset.
- [ ] pgEdge pin/auth/protocol/tools/permissions thật đã kiểm tra.
- [ ] MCP query results đi vào artifact/presenter chung.
- [ ] MCP outage không làm hỏng document workflow độc lập.
