# 03 — Agent Bridge and UI Playground Implementation Plan

> **Scope update — 2026-10-06:** pgEdge MCP chỉ dành cho coding agent khi phát triển; app không kết nối, đăng ký DB tools hoặc nhận token pgEdge. Mọi bước/gate/adapter app-to-pgEdge trong tài liệu cũ này hết hiệu lực, không triển khai. App dùng Drizzle/repositories cho DB; C03 là custom business MCP server trong Next.js tại `/api/mcp/business`. Theo [PRD hiện hành](../../platform-build-spec.md), business MCP và coding-agent pgEdge là hai luồng riêng.

**Execution update — user directive 2026-10-05:** Starter độc lập. Build/test/demo không cần API key hoặc tài liệu của BTC; không đọc repo thi hay cấu hình của họ. Demo adapter là default rõ nhãn cho local development; optional generic gateway adapter để cắm sau, không có live-AI gate bắt buộc trong baseline. Thiếu external gateway là unavailable, không phải lý do dừng triển khai. Production vẫn không tự bật fixture.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chat CopilotKit chạy cùng workflows/artifacts với dashboard và playground phủ 19 block types.

**Architecture:** Tool registry enforce server scope và bridge cùng run/artifact services. CopilotKit factory mode dùng AI transport; frontend tools chỉ điều khiển UI.

**Tech Stack:** Next.js App Router, TypeScript, Zod, Postgres/Drizzle, CopilotKit v2, optional AI Gateway, local pgEdge MCP; Vitest + Playwright.

**Spec:** [Design v0.3](../specs/2026-10-05-hackathon-plug-and-play-design.md)

**Prerequisite:** Phases 01–02 gates pass; document/dataset examples hoạt động, pgEdge tools đã được scope.

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

## File map và execution order

C1 sở hữu business tool dispatch. C2 sở hữu protocol/model adapter và scoped runtime. C3 sở hữu chat/view state. C4 sở hữu block completeness/fixtures. Không đưa CopilotKit/AI SDK types vào core capabilities.

### Task C1: Scoped tool registry và native tool-name bridge

**Files:**
- Create: src/core/tools/definition.ts, registry.ts, names.ts; src/core/services/tools.ts
- Create: src/agents/tools/run-tools.ts, artifact-tools.ts, database-tools.ts, index.server.ts
- Modify: src/server/container.ts
- Test: tests/contracts/tool-dispatch.test.ts

**Interfaces:**
- Consumes: createRun/executeRun/getRun/cancelRun, artifact repository/getResult, queryDataset/describeSchema; Scope và JsonValue ở master ledger.
- Produces: ToolDefinition<I,O>; createToolRegistry(definitions:AnyToolDefinition[]):ToolRegistry; ToolRegistry.dispatch(scope,name,input,signal):Promise<JsonValue>; dispatchTool(scope,name,input,signal):Promise<JsonValue>; toNativeName(name:string):string; ToolRegistry.names(scope):string[]; core/tools/registry.ts exports registeredToolNames:ReadonlySet<string> for injected domain validation. AnyToolDefinition là type-erased internal descriptor đã có Zod input/output; không bypass schemas.

- [ ] **Step 1: Viết test behavior**

```ts
import { expect, it } from "vitest";
import { z } from "zod";
import { createToolRegistry } from "@/core/tools/registry";

it("enforces trusted scope and rejects injected workspace arguments", async () => {
  const registry = createToolRegistry([{
    name:"db.query_dataset",description:"Query a curated dataset",trustedOnly:true,
    input:z.object({datasetId:z.string(),query:z.string()}).strict(),
    output:z.object({workspaceId:z.string()}),
    run:async scope => ({workspaceId:scope.workspaceId}),
  }]);
  const signal = new AbortController().signal;
  const scope = {userId:"u",workspaceId:"w1",trustedOperator:false};
  await expect(registry.dispatch(scope,"db.query_dataset",
    {datasetId:"d",query:"SELECT 1"},signal)).rejects.toThrow("permission_denied");
  await expect(registry.dispatch({...scope,trustedOperator:true},"db.query_dataset",
    {datasetId:"d",query:"SELECT 1",workspaceId:"w2"},signal)).rejects.toThrow();
  expect(await registry.dispatch({...scope,trustedOperator:true},"db.query_dataset",
    {datasetId:"d",query:"SELECT 1"},signal)).toEqual({workspaceId:"w1"});
});
```

- [ ] **Step 2: Xác nhận RED**

Run: `bun run vitest run tests/contracts/tool-dispatch.test.ts`
Expected: FAIL tại behavior/import chưa triển khai, sau khi prerequisites của task đã sẵn sàng.

- [ ] **Step 3: Triển khai phần tối thiểu**

Registry definitions là server-owned. Register runs.create/execute/get/cancel, artifacts.get/result và db.describe_schema/query_dataset; DB tools trustedOnly và chỉ expose khi pack bật. Input scope fields không tồn tại; unknown fields reject. Output Zod parse rồi JSON-safe check trước khi trả. Native aliases thay dấu chấm bằng underscore; validate ^[A-Za-z0-9_-]{1,64}$, reject alias collisions tại startup. Tool execute đóng scope trong server closure, có AbortSignal; cap tool budget và mask errors. UI tool bridge ở C3 dùng namespace khác, không đăng ký raw capability hay MCP connection tools.

```ts
export function toNativeName(name: string): string {
  const alias = name.replaceAll(".", "_");
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(alias)) throw new Error("invalid_tool_name");
  return alias;
}

export async function dispatchDefinition<I,O>(
  definition: ToolDefinition<I,O>, scope: Scope, input: JsonValue, signal: AbortSignal,
): Promise<O> {
  signal.throwIfAborted();
  if (definition.trustedOnly && !scope.trustedOperator) {
    throw new Error("permission_denied");
  }
  const args = definition.input.parse(input);
  const output = await definition.run(scope, args, signal);
  return definition.output.parse(output);
}
```

- [ ] **Step 4: Xác nhận GREEN**

Run: `bun run vitest run tests/contracts/tool-dispatch.test.ts`
Additional run: `bun run check`
Expected: Tool dispatch validates input/output, rejects spoofed scope and duplicate native aliases; non-operator tool discovery omits raw SQL. Services retain their own permission checks.

- [ ] **Step 5: Commit local**

```powershell
git -C E:/thucchienai/hackathon-starter-kit add -- src/core/tools src/core/services/tools.ts src/agents/tools src/server/container.ts tests/contracts/tool-dispatch.test.ts
git -C E:/thucchienai/hackathon-starter-kit commit -m 'feat: register scoped business tools for agent bridge'
```

### Task C2: CopilotKit factory runtime qua AI, native tools và bounded fallback

**Files:**
- Create: src/adapters/agents/stream.ts, fallback.ts, protocol.ts, budget.ts
- Create: src/agents/runtime.ts, scope-runtime.ts, context.ts; src/app/api/copilotkit/[[...slug]]/route.ts
- Modify: src/adapters/llm/gateway/sdk-model.ts, scripts/doctor.ts, docs/dependencies.md, package.json, bun.lock
- Test: tests/integration/agent-runtime.test.ts, tests/contracts/agent-fallback.test.ts

**Interfaces:**
- Consumes: C1 registry, A4 createGatewayModel/config/features, domain catalog server, run services. Read runtime SKILL.md references/built-in-agent-factory-modes.md and setup-endpoint.md before execution; check actual pinned package exports.
- Produces: createAgentStream(request:AgentStreamRequest):ReturnType<typeof streamText> in adapters only. AgentStreamRequest={scope:Scope;domainId:string;input:RunAgentInput;signal:AbortSignal}; RunAgentInput dùng AG-UI package validated schema ở adapter boundary. createScopedRuntime(scope:Scope,domainId:string):CopilotRuntime; getScopedHandler(scope,domainId):(Request)=>Promise<Response>. createAgentBudget({maxTurns:number,deadlineAt:number}):{nextTurn():void,remainingMs():number}; parseActionIntent(value:unknown):ActionIntent; ActionIntent union {kind:'respond',text:string}|{kind:'tool',name:string,arguments:JsonValue}. runFallbackTurn(options:FallbackOptions):Promise<FallbackResult> with FallbackOptions={scope,domainId,input,signal,ports,registry,maxTurns:number}; FallbackResult={text:string,toolResults:JsonValue[],businessRunId?:string}.

- [ ] **Step 0: Chuẩn bị prerequisite**

Inspect runtime dependency/peer metadata and AI SDK converter compatibility before choosing exact versions. Install CopilotKit runtime/react-core and compatible ai/provider pair with --save-exact; record versions plus native-tool/streaming probe outcomes in docs/dependencies.md. Keep A4 raw gateway port independent of SDK. No provider defaults, managed Intelligence or upstream pgEdge client. Gateway without native tools uses custom factory branch; lack of streaming still emits validated final text through AG-UI.

- [ ] **Step 1: Viết test behavior**

```ts
import { expect, it } from "vitest";
import { parseActionIntent } from "@/adapters/agents/fallback";
import { createAgentBudget } from "@/adapters/agents/budget";

it("rejects executable output and caps the agent turn budget", () => {
  expect(() => parseActionIntent({kind:"jsx",code:"alert(1)"})).toThrow();
  expect(() => parseActionIntent({kind:"tool",name:"db.change_connection",
    arguments:{connection:"private"}})).toThrow();
  const budget = createAgentBudget({maxTurns:6,deadlineAt:Date.now()+120000});
  for (let i=0;i<6;i++) budget.nextTurn();
  expect(() => budget.nextTurn()).toThrow("agent_budget_exhausted");
});
```

- [ ] **Step 2: Xác nhận RED**

Run: `bun run vitest run tests/integration/agent-runtime.test.ts tests/contracts/agent-fallback.test.ts`
Expected: FAIL tại behavior/import chưa triển khai, sau khi prerequisites của task đã sẵn sàng.

- [ ] **Step 3: Triển khai phần tối thiểu**

BuildInAgent type aisdk factory uses createAgentStream only when doctor proves protocol + streaming + native tools. streamText uses explicit AI model, systemPrompt from selected server pack, validated context/messages, maxRetries:0, abort signal and max6 steps. Tool conversion includes only approved server definitions and C3 UI names; server tools execute via registry. A4 retry policy governs raw model calls; do not stack SDK automatic retries. For no native tools, custom factory calls LlmPort.complete and parses ActionIntentSchema, executes approved tool, feeds JSON result back, repeats max6 within120s; only one validation repair across the turn budget. Output AG-UI typed events RUN_STARTED → TEXT_MESSAGE_START/CONTENT/END → RUN_FINISHED, tool/state events as applicable; errors RUN_ERROR. Check signal every yield and actual stream event schema in tests. Thread ID and run ID come from validated protocol, never authorize artifacts. Scoped handler cache keyed user/workspace/domain, bounded TTL60min/max32 local runtimes; never share mutable agents across scopes. Session-required same-origin BFF wraps info/run/connect/stop routes; reject domain spoof and cross-scope thread reuse. GET/POST/OPTIONS plus PATCH/DELETE export same scoped wrapper if pinned route table uses them. No business SSE replacement.

```ts
import { streamText } from "ai";
import { convertMessagesToVercelAISDKMessages } from "@copilotkit/runtime/v2";

export function createAgentStream(request: AgentStreamRequest) {
  const pack = requireDomain(request.domainId);
  const tools = createScopedAiTools(request.scope, pack, request.signal);
  return streamText({
    model:createGatewayModel(loadLiveGatewayConfig()),
    system:pack.systemPrompt,
    messages:convertMessagesToVercelAISDKMessages(request.input.messages),
    tools,
    abortSignal:request.signal,
    maxRetries:0,
    stopWhen:({steps}) => steps.length >= 6,
  });
}
// requireDomain(id):DomainDefinition is catalog.server.ts export from A7.
// createScopedAiTools(scope,pack,signal) is this task's AI SDK tool adapter,
// wrapping C1 dispatchTool and validating tool outputs before conversion.
// loadLiveGatewayConfig/createGatewayModel are AI sdk-model.ts exports from A4.

```

- [ ] **Step 4: Xác nhận GREEN**

Run: `bun run vitest run tests/integration/agent-runtime.test.ts tests/contracts/agent-fallback.test.ts`
Additional run: `bun run tsx scripts/doctor.ts --gateway; bun run check; bun run build`
Expected: Actual runtime emits valid AG-UI SSE through catch-all endpoint; fixture/native and no-tool fallback both call shared services and respect cancel/budgets. Two independent sessions cannot read/stop the other's threads or artifacts. All model network requests hit only configured gateway origin.

- [ ] **Step 5: Commit local**

```powershell
git -C E:/thucchienai/hackathon-starter-kit add -- src/adapters/agents src/adapters/llm/gateway/sdk-model.ts src/agents/runtime.ts src/agents/scope-runtime.ts src/agents/context.ts src/app/api/copilotkit scripts/doctor.ts docs/dependencies.md package.json bun.lock tests/integration/agent-runtime.test.ts tests/contracts/agent-fallback.test.ts
git -C E:/thucchienai/hackathon-starter-kit commit -m 'feat: wire gateway-only CopilotKit factory runtime'
```

### Task C3: Agent panel, UI tools và state projection từ persisted artifacts

**Files:**
- Create: src/agents/state.ts; src/ui/agent/AgentProvider.tsx, AgentPanel.tsx, ui-tools.ts, state.ts
- Modify: src/ui/shells/WorkspaceShell.tsx, src/ui/hooks/useRun.ts, src/agents/runtime.ts, src/adapters/agents/protocol.ts
- Create: tests/e2e/chat-dashboard.spec.ts; Test: tests/contracts/agent-state.test.ts, tests/integration/agent-isolation.test.ts

**Interfaces:**
- Consumes: C2 scoped runtime, C1 run/artifact tools, A8 getResult/renderer and master RunSnapshot. React hooks/imports from pinned CopilotKit react-core/v2; read copilotkit-develop during execution.
- Produces: projectAgentState(scope,runId):Promise<AgentProjection> where AgentProjection={businessRunId:string,revision:number,artifactIds:string[],summary:string}; UiSessionState={selectedArtifactId:string|null,activeTab:'result'|'report'|'sources',filters:Record<string,string>}; UiToolIntent union selected artifact/filter/tab. applyUiIntent(state:UiSessionState,intent:UiToolIntent):UiSessionState; frontend schemas validate every intent.

- [ ] **Step 1: Viết test behavior**

```ts
import { expect, it } from "vitest";
import { applyUiIntent, UiToolIntentSchema } from "@/ui/agent/state";

it("UI tools only change validated view state", () => {
  expect(UiToolIntentSchema.safeParse({
    name:"ui_execute_sql",arguments:{query:"DELETE FROM app.runs"},
  }).success).toBe(false);
  const state = {selectedArtifactId:null,activeTab:"result" as const,filters:{}};
  expect(applyUiIntent(state,{
    name:"ui_focus_tab",arguments:{tab:"sources"},
  })).toEqual({...state,activeTab:"sources"});
});
```

- [ ] **Step 2: Xác nhận RED**

Run: `bun run vitest run tests/contracts/agent-state.test.ts tests/integration/agent-isolation.test.ts`
Expected: FAIL tại behavior/import chưa triển khai, sau khi prerequisites của task đã sẵn sàng.

- [ ] **Step 3: Triển khai phần tối thiểu**

Provider uses runtimeUrl /api/copilotkit and multi-route mode matched to handler; local domain/session context is sanitized before forwarding. Register only ui_select_artifact, ui_set_filters, ui_focus_tab with Zod validation and server-approved IDs for selection; no UI registry execute SQL/workflow. Chat shows artifact references and opens existing ResultView. projectAgentState reads scoped RunSnapshot, publishes businessRunId/revision/artifactIds/summary via validated AG-UI state snapshot; model cannot author authoritative state. Factory mode explicitly wires state snapshot/delta tools but app constrains permitted paths and derives business fields from server. Shared state is view context, persisted artifacts remain source of truth. run ID from dashboard reused for follow-up questions; only explicit new analysis creates run. Scope changes clear UI context/thread state. Abort chat propagates when it owns current awaited workflow. Busy/cancelled/partial state visible; frontend reconnect fetches persisted run rather than resume execution automatically.

```ts
export async function projectAgentState(
  scope: Scope, runId: string,
): Promise<AgentProjection> {
  const snapshot = await getRun(scope, runId);
  const view = await getResult(scope, runId);
  return {
    businessRunId:snapshot.id,
    revision:snapshot.revision,
    artifactIds:snapshot.artifacts.map(a => a.id),
    summary:view.title + " · " + snapshot.status,
  };
}

export function applyUiIntent(
  state: UiSessionState, intent: UiToolIntent,
): UiSessionState {
  switch (intent.name) {
    case "ui_select_artifact":
      return {...state,selectedArtifactId:intent.arguments.artifactId};
    case "ui_set_filters":
      return {...state,filters:intent.arguments.filters};
    case "ui_focus_tab":
      return {...state,activeTab:intent.arguments.tab};
  }
}
```

- [ ] **Step 4: Xác nhận GREEN**

Run: `bun run vitest run tests/contracts/agent-state.test.ts tests/integration/agent-isolation.test.ts`
Additional run: `bun run playwright test tests/e2e/chat-dashboard.spec.ts; bun run check`
Expected: Fixture AG-UI tool-call test creates a run through actual service; chat opens same businessRunId/artifact IDs as dashboard. Follow-up reuses run and does not duplicate analysis; reload dashboard keeps artifacts. Separate sessions and simultaneous requests retain correct scope.

- [ ] **Step 5: Commit local**

```powershell
git -C E:/thucchienai/hackathon-starter-kit add -- src/agents/state.ts src/ui/agent src/ui/shells/WorkspaceShell.tsx src/ui/hooks/useRun.ts src/agents/runtime.ts src/adapters/agents/protocol.ts tests/e2e/chat-dashboard.spec.ts tests/contracts/agent-state.test.ts tests/integration/agent-isolation.test.ts
git -C E:/thucchienai/hackathon-starter-kit commit -m 'feat: share persisted run results between chat and dashboard'
```

### Task C4: 19-block playground, state fixtures và report parity

**Files:**
- Create: src/ui/blocks/RiskScore.tsx, VerdictCard.tsx, TimelineCard.tsx, MapCard.tsx, PlaceCard.tsx, ComparisonCard.tsx, ReportSection.tsx, MediaCard.tsx
- Create: src/ui/playground/fixtures.ts, FixtureGallery.tsx, states.ts; src/app/playground/page.tsx
- Modify: src/ui/registry/index.tsx, src/ui/renderers/BlockRenderer.tsx, ReportView.tsx
- Test: tests/contracts/playground.test.ts, tests/e2e/playground.spec.ts; Create: docs/ui-playground.md

**Interfaces:**
- Consumes: A2 19 UI schemas/props, A8 renderer/report, B4 metric/chart/table, C3 UI state. Existing document block components reused.
- Produces: fixtureCatalog:{id:string;label:string;view:ResultView;state:'loading'|'empty'|'error'|'success'|'partial'|'unavailable'}[]; blockRegistry:Record<UIBlock['type'],BlockComponent>; BlockComponent=(props:{block:UIBlock;context:BlockRenderContext})=>ReactNode; BlockRenderContext={snapshot:RunSnapshot|null;sources:SourceRef[];evidence:Evidence[];onAction:(intent:UiActionIntent)=>void}. UiActionIntent matches action allowlist in master.

- [ ] **Step 1: Viết test behavior**

```ts
import { expect, it } from "vitest";
import { fixtureCatalog } from "@/ui/playground/fixtures";
import { ResultViewSchema } from "@/contracts/ui/result-view";

it("all fixtures validate and cover each shipped block kind", () => {
  const types = new Set<string>();
  for (const fixture of fixtureCatalog) {
    const view = ResultViewSchema.parse(fixture.view);
    for (const block of view.blocks) types.add(block.type);
  }
  expect([...types].sort()).toEqual([
    "action","chart","comparison","evidence","insight","map","markdown","media",
    "metric","place","progress","recommendation","report-section","risk",
    "source","table","timeline","verdict","warning",
  ]);
});
```

- [ ] **Step 2: Xác nhận RED**

Run: `bun run vitest run tests/contracts/playground.test.ts`
Expected: FAIL tại behavior/import chưa triển khai, sau khi prerequisites của task đã sẵn sàng.

- [ ] **Step 3: Triển khai phần tối thiểu**

Fill 8 remaining components, keep allowlisted registry literal. Gallery has deterministic fixture source/evidence/data route, prominent Demo label, knobs for six states. Dataset fixtures use same DatasetPage shape; no LLM required for gallery. Map view uses static pins/coordinates and clearly unavailable interactive backend state; media fixtures stay local and browser validates origin/protocol. Invalid block degrades locally into warning; does not crash entire report. Report sections resolve block IDs and reject cyclic refs at ResultView schema stage. Runtime states come from actual RunSnapshot; gallery states explicitly fixtures. Sanitize markdown and links; keyboard evidence dialog focus/close, visible labels, responsive cards. Install testing-library/react and jsdom exact only if component contract tests need DOM. One E2E loops fixture selections to assert no page errors; keyboard flow opens/closes evidence and action export produces JSON/Markdown with same references as dashboard.

```ts
export function safeMediaUrl(value: string, origin: string): string {
  const url = new URL(value, origin);
  if (!["https:","http:"].includes(url.protocol) || url.origin !== origin) {
    throw new Error("media_origin_denied");
  }
  return url.href;
}
// Export safeMediaUrl from src/ui/blocks/MediaCard.tsx.
// fixtureCatalog uses concrete schema-valid props from master UI ledger;
// fixture sources and dataset pages are owned by ui/playground/fixtures.ts.

```

- [ ] **Step 4: Xác nhận GREEN**

Run: `bun run vitest run tests/contracts/playground.test.ts`
Additional run: `bun run playwright test tests/e2e/playground.spec.ts; bun run check; bun run build`
Expected: Gallery renders all19 validated block kinds/six states, unsupported content isolated; evidence keyboard flow works. Report/dashboard consume same view. No external model/provider requests while using playground.

- [ ] **Step 5: Commit local**

```powershell
git -C E:/thucchienai/hackathon-starter-kit add -- src/ui/blocks src/ui/playground src/ui/registry/index.tsx src/ui/renderers src/app/playground tests/contracts/playground.test.ts tests/e2e/playground.spec.ts docs/ui-playground.md package.json bun.lock
git -C E:/thucchienai/hackathon-starter-kit commit -m 'feat: complete reusable UI block playground'
```

## Gate 3

- [ ] Chat và dashboard truy cập cùng persisted run/artifact IDs, không nhân đôi engine.
- [ ] AI native-tool path hoặc validated fallback hoạt động theo doctor feature flags; live check được ghi riêng.
- [ ] Client không gọi raw MCP/SQL, không giữ gateway/MCP secrets.
- [ ] UI gallery đủ 19 kinds, sáu states, report cùng ResultView; business state không do model tự viết.
