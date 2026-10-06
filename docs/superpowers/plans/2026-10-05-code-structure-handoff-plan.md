# Code Structure and Frontend Handoff Implementation Plan

> **Scope update — 2026-10-06:** pgEdge MCP chỉ dành cho coding agent khi phát triển; app không kết nối, đăng ký DB tools hoặc nhận token pgEdge. Mọi bước/gate/adapter app-to-pgEdge trong tài liệu cũ này hết hiệu lực, không triển khai. App dùng Drizzle/repositories cho DB; C03 là custom business MCP server trong Next.js tại `/api/mcp/business`. Theo [PRD hiện hành](../../platform-build-spec.md), business MCP và coding-agent pgEdge là hai luồng riêng.

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development to implement task-by-task. All implementers/reviewers use gpt-6-luna. Steps use checkbox syntax.

**Goal:** Deliver a runnable, typed skeleton that another developer can immediately use to build reusable UI components independently.

**Architecture:** Keep the approved modular-monolith boundaries. Contracts and pure validation are real; business engines and external adapters are declared extension points. Schema-valid synthetic fixtures feed UI development through explicit demo APIs. Unimplemented write/workflow endpoints return unavailable rather than fabricated success.

**Tech Stack:** Stable Next.js/React/TypeScript/Zod; Drizzle/Postgres and CopilotKit integrations remain planned extension points. Current compatible pins from official metadata: Node24 LTS, Next16.3.8, React19.3.0, TS6.0.3, Zod4.6.5.

**Spec:** [Approved design](../specs/2026-10-05-hackathon-plug-and-play-design.md), overridden in execution scope by the user's instruction to finish structure and hand UI to their friend.

## Global Constraints

- Work only at E:/thucchienai/hackathon-starter-kit on feat/starter-baseline; no competition repo reads/writes/push.
- No external AI key or BTC docs needed. Skeleton boots/builds/tests with no .env file, no database and no external model.
- Production-stable compatible dependencies, exact pins and lockfile. No prerelease packages.
- Do not implement reusable React cards/components, model workflows, ingestion algorithms, repository persistence or actual MCP/Copilot runtime in this scope.
- src/ui is the friend's ownership boundary; add only a README there. Shared UI props live in src/contracts/ui and demo fixtures outside src/ui.
- Contracts are Zod/inferred JSON-safe types. UIBlock has exactly19 approved types, singular source.
- Pure registries/validators may be implemented because they make extension boundaries usable. Unbound business services return typed unavailable, never pretend an engine ran.
- Demo fixtures are explicitly synthetic, enabled only in development/test; production returns unavailable for demo APIs.
- Preserve the interrupted bootstrap files; do not reset/delete them. Tests verify meaningful changed behavior, not folder existence.
- All commits local with exact file paths. No remote configuration or push.

## Responsibility and files

| Area | Deliverable |
|---|---|
| src/app, toolchain | Boots and exposes liveness; basic pages only |
| src/contracts | Artifact, source/evidence/dataset/run/domain and19 block schemas |
| src/core | Port and definition exports; pure registry/workflow/domain validation; service signatures |
| src/adapters, src/capabilities, src/agents | Explicit extension contracts/README, no pretend implementation |
| src/domains | Client-safe manifests, server definitions, executable template and pure presenters |
| src/demo | Schema-valid fixture bundles for19 blocks and four archetypes |
| src/ui | Friend's future primitives/cards/renderers/chat/forms/registry/shells |
| docs | Architecture, fixture/API usage, ownership and component handoff |

### Task 1: Finish runnable bootstrap without external configuration

**Files:**
- Finish existing package.json, bun.lock, bunfig.toml, tsconfig.json, next.config.ts, eslint.config.mjs, vitest.config.ts, playwright.config.ts, next-env.d.ts.
- Modify src/server/env.ts, src/contracts/errors.ts, src/app/api/health/route.ts, src/app/page.tsx, src/app/layout.tsx, src/app/globals.css, .env.example, .gitignore, docs/dependencies.md.
- Test tests/contracts/env-errors.test.ts and tests/integration/health.test.ts.

**Interfaces:** loadServerEnv(values):ServerEnv with APP_MODE skeleton default and optional database/session fields; live backend config validates its own prerequisites when later enabled. No current gateway-key loader. GET /api/health():Response payload {status:"ok",mode:"skeleton",version:"1.0.0"}. Public ErrorEnvelope {code,message,retryable,traceId}; FeatureUnavailableError handled in Task2.

- [ ] Write changed-behavior test:
```ts
import {expect,it} from "vitest";
import {loadServerEnv} from "@/server/env";
import {GET} from "@/app/api/health/route";
it("boots a skeleton without external configuration",async()=>{
  expect(loadServerEnv({}).APP_MODE).toBe("skeleton");
  expect(await GET().json()).toMatchObject({status:"ok",mode:"skeleton"});
});
```
- [ ] RED: bun run vitest run tests/contracts/env-errors.test.ts tests/integration/health.test.ts. Existing env requires DB/session and health lacks mode; changed expectation must fail.
- [ ] Implement Zod skeleton defaults, optional backend fields, health mode/version, masked errors. Remove current gateway-key configuration from env/.env.example. Narrow lint rules to UI/client imports, not all server App Router files; contracts cannot import framework/server code, core cannot import concrete domains/adapters. Add *.tsbuildinfo ignore. No next/font network fetch. Start/build requires no env.
```ts
const ServerEnvSchema = z.object({
  APP_MODE:z.enum(["skeleton","live"]).default("skeleton"),
  NODE_ENV:z.enum(["development","test","production"]).optional(),
  DATABASE_URL:z.string().min(1).optional(),
  SESSION_SECRET:z.string().min(32).optional(),
});
```
- [ ] GREEN: focused tests, bun run check, bun run build. Record exact stable pins and compatibility/source links; no live-AI claims.
- [ ] Commit exact bootstrap files: chore: finish standalone skeleton bootstrap.

### Task 2: Canonical contracts and usable module boundaries

**Files:**
- Create src/contracts/common.ts, artifacts.ts, documents.ts, evidence.ts, sources.ts, datasets.ts, runs.ts, domains.ts and src/contracts/ui/blocks.ts, result-view.ts plus per-kind schemas.
- Create src/core/ports/definition.ts, src/core/capabilities/definition.ts, schema-registry.ts, src/core/workflows/definition.ts, validation.ts, src/core/domains/definition.ts, validation.ts, src/core/services/definition.ts.
- Create src/server/container.ts; src/adapters/README.md and boundary READMEs for postgres/storage/llm/gateway/parsers/sources/mcp/pgedge/agents; src/capabilities/README.md with12 capability directories and concise contracts; src/agents/definition.ts, README.md; src/sources/catalog.ts; src/ui/README.md.
- Test tests/contracts/artifacts-blocks.test.ts, tests/contracts/workflow-domain.test.ts.

**Interfaces:** Use shared ledger from the master design plan for JSON DTOs and19 UI props. Export Scope, JsonValueSchema/JsonValue, Schema<T>, ArtifactEnvelopeSchema/Artifact<T>/ArtifactDraft<T>, Evidence/SourceLocator/NormalizedDocument, DatasetPage/Query, RunSnapshot/StepState, DomainManifest/InputField, ResultViewSchema/UIBlockSchema.
Port signatures are declarations only. RuntimePorts contains typed run/artifact/upload/dataset/storage/model/source/parser ports. RunContext contains scope/run/step IDs, signal/deadline/budget and expected artifact/schema registry.
Capability<I,O> {id,version,input,output,run}; Step<I,O> approved bind/run/timeout/retry/required plus artifactKind/version; WorkflowDefinition {steps,requiredArtifactKinds}; StepBindingContext.get typed artifact helper.
createArtifactRegistry():ArtifactSchemaRegistry with register/has/parse; validateWorkflow(definition):void. DomainDefinition uses injected capabilities/catalog; core knows no example domain. CoreServices interface declares run/upload/artifact/query use cases. FeatureUnavailableError has code feature_unavailable; toPublicError preserves safe unavailable code/message and masks internals.
createContainer():SkeletonContainer {mode:"skeleton",features:Record<string,boolean>} describes which engines are unbound. AgentProjection and UiSessionState are client-safe projection definitions; no runtime SDK imports yet.

- [ ] Write behavior tests using a fully valid envelope, then vary JSON data/schema version; reject unknown blocks, bad score ranges, invalid coordinates/report cycles. Verify later/missing/duplicate workflow dependencies.
```ts
import {expect,it} from "vitest";
import {UIBlockSchema} from "@/contracts/ui/blocks";
it("rejects executable blocks and out-of-range risk",()=>{
 expect(UIBlockSchema.safeParse({id:"x",type:"jsx",props:{}}).success).toBe(false);
 expect(UIBlockSchema.safeParse({id:"r",type:"risk",props:{
   score:120,min:0,max:100,direction:"higher-is-worse",level:"high",
   factorIds:[],method:"demo",completeness:1,
 }}).success).toBe(false);
});
```
- [ ] RED: bun run vitest run tests/contracts/artifacts-blocks.test.ts tests/contracts/workflow-domain.test.ts.
- [ ] Implement canonical schemas, inferred types and pure validators. Contracts cannot contain React/env/SDK imports. Source/doc/evidence data stored once, derived artifacts reference IDs. Registry validates full envelope and registered kind/version. Workflow validation enforces earlier-only deps but does not execute steps. Module READMEs state exact future input/output and ownership, no empty .gitkeep files or fake algorithms.
```ts
export function assertPriorDependencies(ids:string[],index:number,dependsOn:string[]):void {
 for(const dependency of dependsOn){
  const dependencyIndex=ids.indexOf(dependency);
  if(dependencyIndex<0 || dependencyIndex>=index) throw new Error("workflow_dependency_invalid");
 }
}
```
- [ ] GREEN: focused contracts tests, bun run check, bun run build. All19 schemas typecheck and unavailable errors remain explicit.
- [ ] Commit exact contracts/core/boundary files: feat: define typed starter boundaries for parallel work.

### Task 3: Domain template, fixture APIs and frontend handoff

**Files:**
- Create src/domains/catalog.client.ts, catalog.server.ts, _template/{manifest.ts,index.server.ts,schemas.ts,prompts.ts,workflow.ts,sources.ts,presenter.ts,fixtures/input.json}, examples/{document-review,dataset-analysis,research-report,risk-analyzer}/ with client manifests and pure fixture presenters.
- Create src/demo/catalog.ts, fixtures.ts, schemas.ts, data.ts. Fixtures cover19 block types, four archetypes and loading/empty/error/success/partial/unavailable states.
- Create src/app/api/domains/route.ts, src/app/api/demo/[domainId]/route.ts, src/app/api/demo/datasets/[datasetId]/rows/route.ts, src/app/api/runs/route.ts, src/app/playground/page.tsx.
- Create scripts/validate-domains.ts; Modify package.json, README.md.
- Create docs/code-structure.md, docs/frontend-handoff.md, docs/api-contracts.md, docs/parallel-work.md; Test tests/contracts/demo-fixtures.test.ts and tests/integration/demo-http.test.ts.

**Interfaces:** DemoBundle {label:string,view:ResultView,snapshot:RunSnapshot,sources:SourceRef[],evidence:Evidence[],claims:Claim[],datasets:Record<string,DatasetPage>} validated JSON. getDemoBundle(domainId:string,state?:DemoState):DemoBundle; DemoState loading|empty|error|success|partial|unavailable.
GET /api/domains -> {domains:DomainManifest[]}.
GET /api/demo/:domainId?state=success -> DemoBundle with Demo label; unknown ID/state -> typed400/404.
GET /api/demo/datasets/:datasetId/rows?offset=0&limit=25 -> DatasetPage with validated limits/known columns and total preserved.
POST /api/runs -> status501 and safe feature_unavailable response; no pretend queued/success record.
Domain template uses namespaced artifact schemas and pure presenter, without hidden network calls. Renderer contract for friend: (block:UIBlock,context:BlockRenderContext)=>ReactNode, defined in docs; block data contracts remain framework-free.

- [ ] Write schema/cross-reference test, dev/test demo HTTP test, production-unavailable test and unsupported business route test.
```ts
import {expect,it} from "vitest";
import {getDemoBundle} from "@/demo/catalog";
import {ResultViewSchema} from "@/contracts/ui/result-view";
it("shares stable data references for charts, tables and sources",()=>{
 const bundle=getDemoBundle("dataset-analysis","success");
 ResultViewSchema.parse(bundle.view);
 for(const block of bundle.view.blocks){
  if(block.type==="chart" || block.type==="table"){
   expect(bundle.datasets[block.props.datasetId]).toBeDefined();
  }
 }
 expect(bundle.label).toContain("Demo");
});
```
- [ ] RED: bun run vitest run tests/contracts/demo-fixtures.test.ts tests/integration/demo-http.test.ts.
- [ ] Implement real validated synthetic fixtures and catalog/routes. Demo disabled in production. API routes return meaningful errors, no external credentials/DB/models. Basic playground page lists fixture JSON and API links only; do not build cards. README provides bun install --frozen-lockfile, bun run dev, bun run check/test/build and known skeleton limitations.
```ts
export function assertDemoEnabled(mode:string|undefined):void {
 if(mode==="production") throw new FeatureUnavailableError("Demo disabled in production");
}
```
Frontend handoff lists all19 block types/props, sources/evidence drawer data, table pagination/chart dataset IDs, action allowlist, state fixtures, and files the friend may own. They implement src/ui/{primitives,blocks,registry,renderers,agent,forms,shells,hooks,playground}; shared contract changes must be coordinated, never silently fork types. Parallel work doc separates UI from future engine/adapter ownership and gives integration sequence.
- [ ] GREEN: fixture/HTTP tests, bun run domain:validate, bun run check, bun run test, bun run build; dev smoke fetch health/domains/demo/dataset endpoints and501 runs. Gate proves skeleton, not real ingestion/AI/MCP.
- [ ] Commit exact domain/demo/route/docs files: feat: prepare fixture-driven frontend handoff.

## Completion gate

- [ ] Repo boots/builds/tests with no external credentials/services.
- [ ] Shared schemas/ports/import boundaries are usable and validated.
- [ ] Friend has schema-valid fixtures/API/ownership docs for19 components and all states.
- [ ] Components and engine implementation clearly reserved for later parallel work.
- [ ] Local-only branch; competition repo untouched.
