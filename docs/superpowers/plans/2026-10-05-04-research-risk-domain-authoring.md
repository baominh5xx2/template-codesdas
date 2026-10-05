# 04 — Research, Risk and Domain Authoring Implementation Plan

**Execution update — user directive 2026-10-05:** Starter độc lập. Build/test/demo không cần API key hoặc tài liệu của BTC; không đọc repo thi hay cấu hình của họ. Demo adapter là default rõ nhãn cho local development; optional generic gateway adapter để cắm sau, không có live-AI gate bắt buộc trong baseline. Thiếu external gateway là unavailable, không phải lý do dừng triển khai. Production vẫn không tự bật fixture.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hoàn thiện shared research/risk capabilities, archetypes và hướng dẫn ráp Domain Pack khi nhận đề.

**Architecture:** Re-use source/LLM/artifact ports và generic UI; add declarative packs. Research chấp nhận seed URLs, search chỉ bật khi có connector/policy hợp lệ.

**Tech Stack:** Next.js App Router, TypeScript, Zod, Postgres/Drizzle, CopilotKit v2, optional AI Gateway, local pgEdge MCP; Vitest + Playwright.

**Spec:** [Design v0.3](../specs/2026-10-05-hackathon-plug-and-play-design.md)

**Prerequisite:** Phases 01–03 gates pass. Shared artifacts/services/renderers giữ signatures trong master ledger.

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

Mọi đường dẫn Files bên dưới tương đối với repo root trên. Chạy PowerShell tại root đó. Đọc master plan và spec trước mỗi phase. Dependencies npm cài bằng --save-exact, commit pnpm-lock.yaml; version SDK và image được ghi sau khi compatibility checks thật pass, không coi version latest là compatibility guarantee.

Test red phải thất bại vì behavior/import chưa triển khai, không phải vì thiếu Docker/env ngoài task. Unit tests dùng fakes có nhãn fixture; integration tests cần services được khởi động rõ ràng. Baseline chạy bằng demo/fixture adapter, không cần external AI credentials hoặc tài liệu BTC. Generic gateway config là optional extension; không có live-AI acceptance gate bắt buộc. Không đọc .env/key files ở repo thi, không ghi secret vào output.

Một task có thể cần nhiều vòng 2–5 phút cho các files nhỏ. Mỗi task có test cycle và local commit riêng; không gộp cả phase thành một lần viết code lớn.

## File map và execution order

D1 mở rộng source capability với shared profiles. D2 là pure numeric/rules module. D3 là consumer archetypes. D4 sở hữu domain-authoring workflow. D5 sở hữu scoped memory có consumer là agent tools. D6 chứng minh ráp một pack mới và ghi runbook.

### Task D1: Shared source profiles và research fetch/clean/dedupe/rank

**Files:**
- Create: src/sources/profiles/official-web.ts, legal.ts, statistics.ts
- Modify: src/sources/profiles/general-web.ts, uploaded-documents.ts, src/sources/catalog.ts
- Create: src/capabilities/research/index.ts, schemas.ts, rank.ts; src/adapters/sources/search-http.ts
- Modify: src/adapters/sources/registry.ts, src/server/container.ts, .env.example
- Test: tests/integration/research-sources.test.ts; Create: docs/source-adapters.md

**Interfaces:**
- Consumes: A6 fetchAllowedUrl/ingestUrl, A2 SourcePort/SourceProfile/NormalizedDocument, A5 RunContext/Budget; source limits from global constraints.
- Produces: researchSources({question,seedUrls,profile},ctx):Promise<{sources:SourceRef[],documents:NormalizedDocument[],warnings:string[]}>; canonicalizeUrl(value:string):string; rankSearchHits(hits:SearchHit[],question:string,profile:SourceProfile):SearchHit[]; SourceSearchResponseSchema={results:{url,title,summary?}[]}. Source profiles export immutable config; adapter registry maps profile.adapterId to SourcePort.

- [ ] **Step 1: Viết test behavior**

```ts
import { expect, it } from "vitest";
import { researchSources } from "@/capabilities/research";
import { createTestContext } from "../helpers/runtime";

it("uses seed URLs when search is unavailable and deduplicates content", async () => {
  const profile = {id:"demo",adapterId:"web",allowedDomains:["example.org"],
    maxSources:8,maxBytes:5000000,fetchTimeoutMs:15000,requireCitation:true};
  const source = {id:"s1",kind:"url" as const,title:"Demo source",
    retrievedAt:"2026-10-05T00:00:00Z",contentHash:"same-content",
    url:"https://example.org/a"};
  const document = {id:"d1",sourceId:"s1",title:"Demo source",warnings:[],
    segments:[{id:"p1",text:"Official statistic: 42.",
      locator:{type:"web" as const,section:"main",start:0,end:23}}]};
  const ctx = createTestContext({ports:{sources:{
    search:async () => {throw new Error("search_unavailable");},
    fetch:async () => ({source,document}),
  }}});
  const result = await researchSources({question:"statistic",
    seedUrls:["https://example.org/a","https://example.org/a#duplicate"],profile},ctx);
  expect(result.sources).toHaveLength(1);
  expect(result.documents).toHaveLength(1);
  expect(result.warnings).toContain("search_unavailable");
});
```

- [ ] **Step 2: Xác nhận RED**

Run: `pnpm exec vitest run tests/integration/research-sources.test.ts`
Expected: FAIL tại behavior/import chưa triển khai, sau khi prerequisites của task đã sẵn sàng.

- [ ] **Step 3: Triển khai phần tối thiểu**

Adapter catalog is shared, domain sources.ts selects IDs/allowlist/seed URLs. Profiles do not bypass A6 public-IP/redirect/content limits. Optional SEARCH_ENDPOINT is explicit team-approved JSON adapter endpoint with fixed response schema; blank endpoint returns search_unavailable. Doctor reports unsupported adapter payload, no guess scraping generic search HTML. Candidate URLs canonicalize fragment removal and known tracking params, retain semantic query params; reject credentials/protocol. Dedupe URL before fetching then contentHash after cleaning. Deterministic rank by allowed domain match/title query-token count/input rank; no LLM rank requirement. Fetch pool at most3, results at most8, response5MB/15s and remaining run/step deadline. Store retrieval time/hash/source URL and warning for skipped/failed candidates; zero sources results partial/insufficient, no fabricated evidence. Backend crawler only traverses approved seed/search candidates; no unbounded recursive crawl.

```ts
export function canonicalizeUrl(value: string): string {
  const url = new URL(value);
  if (!["https:","http:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("source_url_denied");
  }
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (key.startsWith("utm_") || ["fbclid","gclid"].includes(key)) {
      url.searchParams.delete(key);
    }
  }
  url.searchParams.sort();
  return url.href;
}
```

- [ ] **Step 4: Xác nhận GREEN**

Run: `pnpm exec vitest run tests/integration/research-sources.test.ts`
Additional run: `pnpm check`
Expected: Seed URL path works without search, tracks warning; duplicates removed; fetch concurrency/deadline enforced. Failed/private/oversized fetch never becomes SourceRef with fabricated body. Uploaded sources remain reusable.

- [ ] **Step 5: Commit local**

```powershell
git -C E:/thucchienai/hackathon-starter-kit add -- src/sources src/capabilities/research src/adapters/sources/search-http.ts src/adapters/sources/registry.ts src/server/container.ts .env.example tests/integration/research-sources.test.ts docs/source-adapters.md
git -C E:/thucchienai/hackathon-starter-kit commit -m 'feat: add reusable evidence-first research sources'
```

### Task D2: Deterministic risk scoring, missing data và evidence factors

**Files:**
- Create: src/contracts/risk.ts; src/capabilities/risk/index.ts, schemas.ts, score.ts
- Modify: src/core/capabilities/schema-registry.ts
- Test: tests/contracts/risk-score.test.ts

**Interfaces:**
- Consumes: A2 Evidence/Claim/provenance, A5 capability executor, C4 risk UI schema. Scores are rule-defined demo assessments, no invented probability/calibration.
- Produces: RiskSignal={id:string,ruleId:string,value:number|null,evidenceIds:string[],sourceIds:string[]}; RiskRules={id:string,version:number,direction:'higher-is-worse'|'higher-is-better',minCompleteness:number,thresholds:{lowMax:number,mediumMax:number},factors:{id:string,label:string,weight:number,min:number,max:number}[]}; RiskData={score:number|null,min:0,max:100,direction,level:'low'|'medium'|'high'|'unknown',method:'weighted-rules',ruleVersion:number,completeness:number,factors:{id,label,value:number|null,weight:number,contribution:number|null,evidenceIds:string[],sourceIds:string[]}[]}. scoreSignals(signals:RiskSignal[],rules:RiskRules):RiskData; core/risk-score v1 schema.

- [ ] **Step 1: Viết test behavior**

```ts
import { expect, it } from "vitest";
import { scoreSignals } from "@/capabilities/risk/score";
import type { RiskRules } from "@/contracts/risk";

it("returns unknown when half the required weight is missing", () => {
  const rules: RiskRules = {id:"demo",version:1,direction:"higher-is-worse",
    minCompleteness:0.8,thresholds:{lowMax:30,mediumMax:70},factors:[
      {id:"a",label:"Factor A",weight:1,min:0,max:1},
      {id:"b",label:"Factor B",weight:1,min:0,max:1},
    ]};
  const result = scoreSignals([{id:"s",ruleId:"a",value:1,
    evidenceIds:["e1"],sourceIds:["src1"]}],rules);
  expect(result.score).toBeNull();
  expect(result.level).toBe("unknown");
  expect(result.completeness).toBe(0.5);
});
```

- [ ] **Step 2: Xác nhận RED**

Run: `pnpm exec vitest run tests/contracts/risk-score.test.ts`
Expected: FAIL tại behavior/import chưa triển khai, sau khi prerequisites của task đã sẵn sàng.

- [ ] **Step 3: Triển khai phần tối thiểu**

Zod ensures positive finite weights, max>min, thresholds 0<=lowMax<mediumMax<=100, unique factors/signals and version>=1. Missing/null signal remains missing; no model fill. Completeness observed weight / total required weight; normalize each observed value to[0,1] bounded. When completeness below configured threshold return score null/unknown; otherwise weighted observed mean *100. Risk level uses score for higher-is-worse and100-score for higher-is-better. Contributions use normalized *weight/observedWeight*100. Capability validates every evidence/source ID exists in run artifacts before scoring; unknown referenced IDs fail, insufficient support keeps value null. Result carries rule version, method and per-factor provenance. Rule changes need domain version + registered artifact schema version if output shape changes.

```ts
export function calculateWeightedScore(
  signals: RiskSignal[], rules: RiskRules,
): {score:number|null;completeness:number} {
  const totalWeight = rules.factors.reduce((sum,f) => sum+f.weight,0);
  let observedWeight = 0;
  let weighted = 0;
  for (const factor of rules.factors) {
    const signal = signals.find(s => s.ruleId === factor.id);
    if (!signal || signal.value === null) continue;
    const normalized = Math.max(0,Math.min(1,
      (signal.value-factor.min)/(factor.max-factor.min)));
    observedWeight += factor.weight;
    weighted += normalized*factor.weight;
  }
  const completeness = observedWeight/totalWeight;
  return {
    score:completeness < rules.minCompleteness || observedWeight === 0
      ? null : weighted/observedWeight*100,
    completeness,
  };
}
// calculateWeightedScore is local export in risk/score.ts. scoreSignals validates
// schemas, calls it, and builds RiskData factors/level using formulas above.

```

- [ ] **Step 4: Xác nhận GREEN**

Run: `pnpm exec vitest run tests/contracts/risk-score.test.ts`
Additional run: `pnpm check`
Expected: Golden cases cover full/partial/missing inputs, numeric range/weight rejection and both directions. Repeated runs on same signals/rules identical; no model numeric score.

- [ ] **Step 5: Commit local**

```powershell
git -C E:/thucchienai/hackathon-starter-kit add -- src/contracts/risk.ts src/capabilities/risk src/core/capabilities/schema-registry.ts tests/contracts/risk-score.test.ts
git -C E:/thucchienai/hackathon-starter-kit commit -m 'feat: add deterministic evidence-backed risk scoring'
```

### Task D3: Research-report và risk-analyzer Domain Packs

**Files:**
- Create: src/domains/examples/research-report/manifest.ts, index.server.ts, schemas.ts, prompts.ts, workflow.ts, sources.ts, presenter.ts, fixtures/input.json
- Create: src/domains/examples/risk-analyzer/manifest.ts, index.server.ts, schemas.ts, prompts.ts, workflow.ts, sources.ts, scoring.ts, presenter.ts, fixtures/input.json
- Modify: src/core/domains/catalog.server.ts, src/domains/catalog.client.ts, src/server/container.ts, tests/helpers/runtime.ts
- Test: tests/integration/research-risk-workflows.test.ts; Create: tests/e2e/research-risk.spec.ts

**Interfaces:**
- Consumes: D1 source collection, D2 scores, A7 extraction/evidence/analysis/recommendations/report, A5 executor, A8 ResultView, C3 AgentPanel/C4 blocks.
- Produces: Two registered DomainDefinitions: research-report collect→extract→evidence→analyze→recommend→report; risk-analyzer ingest→extract signals→verify evidence→score→recommend→report. Client manifests/forms and pure presenters. Required kinds documented per pack; no service branches by domainId.

- [ ] **Step 1: Viết test behavior**

```ts
import { expect, it } from "vitest";
import { buildResultView } from "@/core/services/artifacts";
import { requireDomain } from "@/core/domains/catalog.server";
import { makeRunSnapshot } from "../helpers/runtime";

it("renders an honest empty research result without manufacturing a score", () => {
  const snapshot = makeRunSnapshot({domainId:"research-report",status:"partial",
    artifacts:[],warnings:["search_unavailable"]});
  const view = buildResultView(requireDomain("research-report"),snapshot,[],[]);
  expect(view.blocks.some(b => b.type === "warning")).toBe(true);
  expect(view.blocks.some(b => b.type === "risk")).toBe(false);
});
```

- [ ] **Step 2: Xác nhận RED**

Run: `pnpm exec vitest run tests/integration/research-risk-workflows.test.ts`
Expected: FAIL tại behavior/import chưa triển khai, sau khi prerequisites của task đã sẵn sàng.

- [ ] **Step 3: Triển khai phần tối thiểu**

makeRunSnapshot(options:Partial<RunSnapshot>):RunSnapshot added to tests/helpers/runtime.ts with deterministic JSON-safe defaults. Input manifests use fields question:string,seedUrls:string[] for research; uploadId:string,rulesetId:'demo-v1' for risk, no arbitrary rule code. research-report uses shared profile default general-web with user seed URLs intersected by server policy; run input cannot lower SSRF limits. risk demo rules evaluate document-review presence/completeness signals with one clearly named demo ruleset; never label as definitive scam/clinical/credit probability. Extraction namespaces research-report/extracted-data and risk-analyzer/signals, schema registry declaresversions. Report uses claims/sources already persisted. Presenters emit markdown,insight,source,evidence,verdict,warning/recommendation; risk adds score+factor/table using registered data. Missing sources/signal support yields partial/unknown states. UI forms generated from client-safe manifest and selected input schemas; no import of prompts/server entries in browser. Register optional tools through pack allowlist.

```ts
export function researchEmptyBlocks(warnings: string[]): UIBlock[] {
  return [{
    id:"research-warning",type:"warning",
    props:{title:"Chưa đủ nguồn",
      message:warnings.join(", ") || "Thêm URL hoặc tài liệu để tiếp tục.",
      severity:"warning"},
  }];
}

export function riskSummaryBlock(data: RiskData): UIBlock {
  return {id:"risk-summary",type:"risk",props:{
    score:data.score,min:data.min,max:data.max,direction:data.direction,
    level:data.level,factorIds:data.factors.map(f => f.id),
    method:data.method+" v"+data.ruleVersion,completeness:data.completeness,
  }};
}
// Put each function in its pack presenter.ts; presenter reads typed artifact
// through ctx.get(kind,schema) and uses this function only after Zod decoding.

```

- [ ] **Step 4: Xác nhận GREEN**

Run: `pnpm exec vitest run tests/integration/research-risk-workflows.test.ts`
Additional run: `pnpm exec playwright test tests/e2e/research-risk.spec.ts; pnpm check; pnpm build`
Expected: Fixture HTTP/model adapters drive both actual workflow/service paths; fabricated quotes fail, missing inputs show partial/unknown; live research from team-selected approved source is separately recorded. Both packs run in dashboard and agent without engine modifications.

- [ ] **Step 5: Commit local**

```powershell
git -C E:/thucchienai/hackathon-starter-kit add -- src/domains/examples/research-report src/domains/examples/risk-analyzer src/core/domains/catalog.server.ts src/domains/catalog.client.ts src/server/container.ts tests/helpers/runtime.ts tests/integration/research-risk-workflows.test.ts tests/e2e/research-risk.spec.ts
git -C E:/thucchienai/hackathon-starter-kit commit -m 'feat: add research report and risk analyzer domain packs'
```

### Task D4: Domain template, validator và 11 playbooks

**Files:**
- Create: src/domains/_template/manifest.ts, index.server.ts, schemas.ts, prompts.ts, workflow.ts, sources.ts, presenter.ts, fixtures/input.json
- Create: scripts/create-domain.ts, scripts/validate-domains.ts; src/core/domains/validate.ts
- Create: docs/domain-authoring.md, docs/playbooks/scam-deepfake.md, privacy.md, finance.md, education.md, healthcare.md, public-service.md, tourism.md, marketing-sme.md, food-safety.md, fake-news.md, logistics.md
- Modify: src/core/domains/catalog.server.ts, src/server/container.ts, package.json, tests/helpers/runtime.ts; Test: tests/contracts/domain-authoring.test.ts

**Interfaces:**
- Consumes: A7 domain definition/catalog, A2 artifact registry, A5 workflow validator, D1 source catalog, C1 tool registry; A3 Drizzle adapter/session scope.
- Produces: validateDomain(domain:DomainDefinition,catalog:DomainValidationCatalog):void; registerDomain(domain:DomainDefinition):void; scaffoldDomain(options:{id:string,title:string,root:string}):Promise<string>. DomainValidationCatalog fields are in master; createDomainValidationCatalog():DomainValidationCatalog test helper declared here.

- [ ] **Step 1: Viết test behavior**

```ts
import { expect, it } from "vitest";
import { validateDomain } from "@/core/domains/validate";
import { requireDomain } from "@/core/domains/catalog.server";
import { createDomainValidationCatalog } from "../helpers/runtime";

it("rejects duplicate step IDs and unknown source profiles in a copied pack", () => {
  const original = requireDomain("document-review");
  const catalog = createDomainValidationCatalog();
  expect(() => validateDomain({...original,workflow:{
    ...original.workflow,steps:[original.workflow.steps[0],original.workflow.steps[0]],
  }},catalog)).toThrow();
  expect(() => validateDomain({...original,sources:["missing-profile"]},catalog)).toThrow();
});
```

- [ ] **Step 2: Xác nhận RED**

Run: `pnpm exec vitest run tests/contracts/domain-authoring.test.ts`
Expected: FAIL tại behavior/import chưa triển khai, sau khi prerequisites của task đã sẵn sàng.

- [ ] **Step 3: Triển khai phần tối thiểu**

Create createDomainValidationCatalog():DomainValidationCatalog in tests/helpers/runtime.ts from fixture profile/tool IDs and registered artifact schemas; production catalog injected by container. Template is a complete minimal document-review derivative with template-demo namespaced extraction schema and real fixtures; _template excluded from production catalog. create-domain validates kebab ID, resolves output src/domains/custom/<id> inside starter root, rejects existing dir, copies known allowlist template files and replaces exact template identifiers only. No generic recursive shell move/delete. Validator checks manifest/schema/tool IDs, duplicate steps, earlier-only deps, capability registered kind/version, required artifact coverage, known source profiles and all presenter fixture outputs; catalog uses explicit server imports with marker, client catalog imports manifests only.

```ts
export function validateDomain(
  domain: DomainDefinition, catalog: DomainValidationCatalog,
): void {
  validateWorkflow(domain.workflow);
  const profiles = catalog.sourceProfileIds;
  for (const id of domain.sources) {
    if (!profiles.has(id)) throw new Error("source_profile_missing:"+id);
  }
  const outputKinds = new Set(domain.workflow.steps.map(s => s.artifactKind));
  for (const kind of domain.requiredArtifactKinds) {
    if (!outputKinds.has(kind)) throw new Error("required_artifact_missing:"+kind);
  }
  for (const name of domain.manifest.toolNames) {
    if (!catalog.toolNames.has(name)) throw new Error("tool_missing:"+name);
  }
}
// Container injects source IDs, C1 registry names and A2 artifact schemas.
// Validator imports core definitions only; server catalog binds this function.
// Every step must also pass catalog.artifactSchemas.has(kind,version).

```

- [ ] **Step 4: Xác nhận GREEN**

Run: `pnpm exec vitest run tests/contracts/domain-authoring.test.ts`
Additional run: `pnpm exec tsx scripts/validate-domains.ts; pnpm check`
Expected: Template-generated pack validates and fixture runs without core changes; existing directory/path traversal rejected. All11 playbooks contain input schema/source choice/workflow/UI/custom-tool limits/sample input.

- [ ] **Step 5: Commit local**

```powershell
git -C E:/thucchienai/hackathon-starter-kit add -- src/domains/_template src/core/domains/validate.ts scripts/create-domain.ts scripts/validate-domains.ts src/core/domains/catalog.server.ts tests/helpers/runtime.ts src/server/container.ts package.json docs/domain-authoring.md docs/playbooks tests/contracts/domain-authoring.test.ts
git -C E:/thucchienai/hackathon-starter-kit commit -m 'feat: add validated domain authoring and playbooks'
```

### Task D5: Scoped structured memory và agent tools

**Files:**
- Create: src/contracts/memory.ts, src/core/ports/memory.ts, src/core/services/memory.ts, src/adapters/postgres/memory.ts, src/adapters/postgres/schema/memory.ts
- Modify: src/adapters/postgres/migrations/, src/agents/tools/index.server.ts, src/server/container.ts
- Create: tests/helpers/postgres.ts; Test: tests/integration/memory-scope.test.ts

**Interfaces:**
- Consumes: A3 Drizzle/session Scope, C1 tool registry, A2 JsonValue; migration owner and DATABASE_URL_TEST conventions.
- Produces: MemoryEntry={id:string,workspaceId:string,userId:string,key:string,value:JsonValue,updatedAt:string,expiresAt:string|null}; MemoryRepository={get(scope,key):Promise<MemoryEntry|null>,put(scope,key,value,expiresAt:string|null):Promise<MemoryEntry>,remove(scope,key):Promise<void>}; core getMemory/putMemory/removeMemory same signatures. createTestMemoryRepository():Promise<MemoryRepository> is helper backed by DATABASE_URL_TEST; production createPostgresMemoryRepository(db):MemoryRepository exported by adapter.

- [ ] **Step 1: Viết test behavior**

```ts
import { expect, it } from "vitest";
import { createTestMemoryRepository } from "../helpers/postgres";

it("never reads another user's memory and ignores expired entries",async()=>{
  const repo = await createTestMemoryRepository();
  const suffix = crypto.randomUUID();
  const a = {userId:"a-"+suffix,workspaceId:"w-"+suffix,trustedOperator:false};
  const b = {...a,userId:"b-"+suffix};
  await repo.put(a,"ui.preferredTab",{tab:"report"},null);
  expect(await repo.get(b,"ui.preferredTab")).toBeNull();
  expect((await repo.get(a,"ui.preferredTab"))?.value).toEqual({tab:"report"});
  await repo.put(a,"ui.preferredTab",{tab:"sources"},"2020-01-01T00:00:00Z");
  expect(await repo.get(a,"ui.preferredTab")).toBeNull();
});
```

- [ ] **Step 2: Xác nhận RED**

Run: `pnpm exec vitest run tests/integration/memory-scope.test.ts`
Expected: FAIL tại import/behavior chưa triển khai; test Postgres từ A3 đang chạy.

- [ ] **Step 3: Triển khai phần tối thiểu**

Schema JSON-safe/16KB max, key whitelist ui.preferredTab/domain.preference, expiry valid ISO UTC. User/workspace bound in every query/upsert unique(workspaceId,userId,key); expired entries return null. Core service validates key/value before injected repository access. Add memory.get/put/remove tools opt-in per pack, execute only server Scope. Store explicit preferences/context, no automatic conversation fact collection, vectors or provenance substitution. Memory text is data, never inserted as a higher-priority system instruction. Add migration via Drizzle owner on starter DB only.

```ts
export function validateMemoryValue(value: unknown): JsonValue {
  const parsed = JsonValueSchema.parse(value);
  if (Buffer.byteLength(JSON.stringify(parsed),"utf8") > 16*1024) {
    throw new Error("memory_too_large");
  }
  return parsed;
}
// JsonValueSchema is A2 contracts/common.ts export.
// Put validator in core/services/memory.ts; repository owns expiry filtering.
// Test helper creates DB adapter using DATABASE_URL_TEST, not app DB URL.
```

- [ ] **Step 4: Xác nhận GREEN**

Run: `pnpm exec vitest run tests/integration/memory-scope.test.ts`
Additional run: `pnpm db:generate; pnpm db:migrate; pnpm check`
Expected: Actual DB suite proves same-workspace different-user isolation, cross-workspace isolation, expiry, JSON size and idempotent upsert/remove. Tool outputs contain no unrelated memory.

- [ ] **Step 5: Commit local**

```powershell
git -C E:/thucchienai/hackathon-starter-kit add -- src/contracts/memory.ts src/core/ports/memory.ts src/core/services/memory.ts src/adapters/postgres/memory.ts src/adapters/postgres/schema/memory.ts src/adapters/postgres/migrations src/agents/tools/index.server.ts src/server/container.ts tests/helpers/postgres.ts tests/integration/memory-scope.test.ts
git -C E:/thucchienai/hackathon-starter-kit commit -m 'feat: add scoped structured memory for agent tools'
```

### Task D6: Rehearsal, release checks và hướng dẫn nhận đề

**Files:**
- Create: docs/rehearsal.md, docs/competition-adaptation.md, tests/integration/domain-template.test.ts
- Modify: README.md, docs/local-run.md, docs/verification.md, package.json, scripts/doctor.ts
- Create: tests/e2e/adaptation.spec.ts

**Interfaces:**
- Consumes: All previous P0 gates, four archetypes, template/validator, .env.example and Docker image lock. No access to competition repo/credentials.
- Produces: Local rehearsal evidence and operational handoff; doctor --all verifies Postgres/session/storage/AI features/MCP health+protocol+tools+SELECT; doctor never prints keys. No deployment/push performed.

- [ ] **Step 1: Viết test behavior**

```ts
import { expect, test } from "@playwright/test";

test("registered packs remain discoverable after reload",async({page})=>{
  await page.goto("/");
  for (const title of ["Document Review","Dataset Analysis","Research Report","Risk Analyzer"]) {
    await expect(page.getByRole("link",{name:title,exact:true})).toBeVisible();
  }
  await page.reload();
  await expect(page.getByRole("link",{name:"UI Playground",exact:true})).toBeVisible();
});
```

- [ ] **Step 2: Xác nhận RED**

Run: `pnpm exec playwright test tests/e2e/adaptation.spec.ts`
Expected: FAIL tại behavior/import chưa triển khai, sau khi prerequisites của task đã sẵn sàng.

- [ ] **Step 3: Triển khai phần tối thiểu**

Write runbook from fresh dependency install/environment setup on starter only: frozen-lockfile, setup env secrets locally, pinned compose services, db:migrate, doctor, dev. Rehearsal task is a tiny new demo Document Pack with changed schema/prompt/presenter and one custom tool max; scaffold under temp repo directory, test fixture pipeline through services and validate finalblocks. Test cleanup resolves every temp path inside scratch directory before removing; do not prune user Docker volumes. docs/rehearsal separates automated fixtures from live gateway/MCP/source results and known unsupported features. Record actual benchmark numbers only when measured: coldstart/upload/parse/run latency, model call count, budget exits; no invented targets achieved. docs/competition-adaptation lists schema→prompt→workflow→source profile→custom tool→presenter→branding steps plus sample change without engine edit. Markdown/JSON report exports are P0; optional PDF/DOCX, voice, geo/planner, vector, backgroundresume have explicit unavailable status. README remains honest about current completion/gates. Final isolated git status/remote checks; no push or copy to competition repo.

```json
{
  "scripts": {
    "domain:new": "tsx scripts/create-domain.ts",
    "domain:validate": "tsx scripts/validate-domains.ts",
    "doctor": "tsx scripts/doctor.ts",
    "verify": "pnpm check && pnpm test && pnpm build"
  }
}
```

- [ ] **Step 4: Xác nhận GREEN**

Run: `pnpm exec playwright test tests/e2e/adaptation.spec.ts`
Additional run: `pnpm verify; pnpm domain:validate; pnpm doctor --all; pnpm exec playwright test`
Expected: Fresh local stack from pinned images passes eligible checks, all archetype fixture flows and new-pack rehearsal pass. Live gateway/source gates explicitly verified or marked unverified if credentials/source absent; no fixture represented as live. Repo remains isolated, no remote/push.

- [ ] **Step 5: Commit local**

```powershell
git -C E:/thucchienai/hackathon-starter-kit add -- docs/rehearsal.md docs/competition-adaptation.md docs/local-run.md docs/verification.md README.md package.json scripts/doctor.ts tests/integration/domain-template.test.ts tests/e2e/adaptation.spec.ts
git -C E:/thucchienai/hackathon-starter-kit commit -m 'docs: verify starter rehearsal and competition adaptation'
```

## Nội dung tối thiểu cho mỗi playbook ở D4

Mỗi file ghi một sample request, input schema field names/types, source profile IDs, archetype/workflow, block types, missing-data behavior và tối đa hai custom tools. Bảng này là đề bài của từng file, không chỉ tên thư mục.

| Playbook | Input/sample | Archetype + source | UI và custom tool boundary |
|---|---|---|---|
| scam-deepfake | message:string,links:string[] — kiểm tra tin nhắn yêu cầu chuyển khoản | risk-analyzer; uploaded-documents/general-web | risk/warning/evidence; link-metadata; deepfake media detector unavailable nếu chưa có API |
| privacy | uploadId:string — policy demo | document-review; uploaded-documents/legal | insight/recommendation/source; policy-rule-check |
| finance | uploadId:string,dateKey:string — CSV chi phí demo | dataset-analysis; statistics/uploaded-documents | metric/chart/table; budget-threshold; rule score không gọi là xác suất tín dụng |
| education | uploadId:string,goal:string — outline môn học | document-review; official-web/uploaded-documents | comparison/recommendation/progress; rubric-check |
| healthcare | question:string,seedUrls:string[] — tra thông tin hành chính bệnh viện | research-report; official-web | source/verdict/warning; service-directory; không gán score chẩn đoán chưa validated |
| public-service | procedure:string,locality:string — hồ sơ thủ tục demo | research-report; legal/official-web | timeline/source/recommendation; required-documents-check |
| tourism | destination:string,preferences:string[] — so sánh địa điểm đã cung cấp | research-report; official-web/general-web | place/comparison/map unavailable state; opening-hours-normalizer |
| marketing-sme | uploadId:string,goal:string — CSV hiệu quả chiến dịch | dataset-analysis; uploaded-documents/general-web | metric/chart/recommendation; unit-economics-calculator |
| food-safety | uploadId:string,rulesetId:string — bảng checklist nguồn gốc | risk-analyzer; uploaded-documents/official-web | risk/evidence/warning; checklist-rule-check |
| fake-news | claim:string,seedUrls:string[] — đối chiếu claim demo | research-report; official-web/general-web | verdict/evidence/source; claim-match; thiếu bằng chứng trả insufficient |
| logistics | uploadId:string,dateKey:string — CSV giao hàng demo | dataset-analysis; uploaded-documents | chart/timeline/table; SLA-calculator |

## Gate 4 — Definition of Done toàn baseline

- [ ] Bốn archetypes chạy cùng engine/artifact store/presenter; không có switch(domainId) trong core services.
- [ ] New-pack rehearsal chỉ sửa pack registration + schema/prompt/workflow/sources/presenter/custom tools/branding.
- [ ] Shared research có seed fallback, risk deterministic và memory scoped; missing evidence luôn visible.
- [ ] README/runbook ghi cách chạy, pin dependencies/images và thực tế live checks; optional P1 không được quảng cáo đã chạy.
- [ ] Không có thao tác Git/ghi source nào tại repo thi; không cấu hình remote hoặc push.
