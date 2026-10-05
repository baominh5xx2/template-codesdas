# Hackathon Starter Kit — Master Implementation Plan

**Execution update — user directive 2026-10-05:** Starter độc lập. Build/test/demo không cần API key hoặc tài liệu của BTC; không đọc repo thi hay cấu hình của họ. Demo adapter là default rõ nhãn cho local development; optional generic gateway adapter để cắm sau, không có live-AI gate bắt buộc trong baseline. Thiếu external gateway là unavailable, không phải lý do dừng triển khai. Production vẫn không tự bật fixture.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build bộ khung local tái sử dụng, chứng minh document và dataset workflows cùng artifact/presenter với chat agent.

**Architecture:** Artifact là tâm của modular monolith. Routes/agent tools dùng core services; runner tuần tự ghép capabilities và lưu artifacts; Domain Packs định nghĩa schema/config/presenter. Drizzle xử lý persistence và pgEdge MCP phục vụ các database tools local có scope.

**Tech Stack:** Next.js App Router, TypeScript, Zod, Postgres/Drizzle, CopilotKit v2, optional AI Gateway, local pgEdge MCP; Vitest + Playwright.

**Spec:** [Design v0.3](../specs/2026-10-05-hackathon-plug-and-play-design.md)

**Prerequisite:** Repo hiện chỉ có README, .gitignore và design spec; chưa có package.json, application source hoặc remote.

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

## Phân chia thành bốn phần thực thi

| Thứ tự | Plan | Đầu ra độc lập có thể kiểm tra |
|---|---|---|
| 1 | [Document foundation](2026-10-05-01-document-foundation.md) | Upload PDF/DOCX/TXT/JSON/URL → analysis/evidence → dashboard/report |
| 2 | [Dataset + pgEdge](2026-10-05-02-dataset-pgedge.md) | CSV/XLSX → deterministic metrics/chart/table; pgEdge local query → artifact |
| 3 | [Agent + UI playground](2026-10-05-03-agent-playground.md) | Chat gọi cùng run service; 19 UI blocks có fixture/feature states |
| 4 | [Research + risk + domain authoring](2026-10-05-04-research-risk-domain-authoring.md) | Research/risk archetypes, source profiles, domain template, playbooks và rehearsal |

Có 24 tasks: phase01 (9), phase02 (5), phase03 (4), phase04 (6). Chạy theo thứ tự 1 → 2 → 3 → 4. Có thể polish UI khi engine đang được xây nhưng chưa cần phân phối tasks cho nhiều agent; không dispatch subagent trong lượt viết plan. Mỗi phase kết thúc bằng demo chạy được, không chỉ một bộ interface.

Phạm vi plan là baseline P0 và hai archetypes bổ sung của spec. Worker/resume, geo/planner backend, voice, vector retrieval, advanced redaction, PDF/DOCX exporters, multi-workspace MCP và durable chat runner thuộc P1; chưa triển khai hoặc expose như tính năng live.

## File ownership và trách nhiệm

| Files | Chủ nhiệm nội dung | Khi thay đổi |
|---|---|---|
| src/contracts/*.ts, src/contracts/ui/* | JSON/Zod DTO và shared artifact/block schemas | Thêm contract có consumer |
| src/core/ports/*, src/core/capabilities/* | I/O interfaces và artifact validation/execution | Thay dependency/execution contract |
| src/core/workflows/*, src/core/services/* | Sequential run lifecycle và use cases | Workflow behavior hoặc scope |
| src/adapters/postgres/*, infra/postgres/* | Tables, transactions và database grants | Persistence/query layout |
| src/adapters/llm/gateway/* | Model protocol, limits, feature probe | AI capability/protocol |
| src/adapters/parsers/*, src/adapters/sources/* | File extraction và allowed URL fetch | Format/source adapter mới |
| src/adapters/mcp/pgedge/*, infra/pgedge/* | MCP transport/tool mapping/result normalization | Pinned pgEdge integration |
| src/agents/* | CopilotKit lifecycle, state projection và tool bridge | Chat integration |
| src/domains/* | Schema/prompt/workflow/presenter của pack | Đổi đề |
| src/ui/* | Pure blocks, shells, forms và fixture gallery | Presentation |
| scripts/*, docs/*, tests/* | Doctor, authoring, meaningful verification | Operational workflow |

Không thêm application/, worker hoặc một server HTTP thứ hai vào baseline.

## API/DTO ledger — các phase dùng chung tên này

Các signatures là contracts của dự án, được tạo ở Task A2 hoặc task được ghi trong cột Owner. Implementation phải thống nhất chúng thay vì tự đặt alias khi đổi phase.

| Owner | Export | Signature / fields |
|---|---|---|
| A2 | Scope | { userId: string; workspaceId: string; trustedOperator: boolean } |
| A2 | Schema<T>, JsonValue | ZodType<T>; JSON scalar/array/object, không Date/function/undefined trong persisted data |
| A2 | Artifact<T>, ArtifactDraft<T> | Fields và provenance như spec §6; version là schema version |
| A2 | RunStatus / StepStatus | Run: queued/running/completed/partial/failed/cancelled/interrupted; Step: pending/running/succeeded/skipped/failed |
| A2 | StepState | {id:string,status:StepStatus,attempt:number,artifactIds:string[],startedAt:string\|null,finishedAt:string\|null,errorCode:string\|null} |
| A2 | UploadRecord | {id:string,sourceId:string,workspaceId:string,userId:string,name:string,mime:string,size:number,contentHash:string,storageKey:string,createdAt:string} |
| A2 | RunSnapshot | { id, workspaceId, domainId, domainVersion, input: JsonValue, status, revision, deadlineAt: string\|null, steps: StepState[], artifacts: Artifact<unknown>[], warnings: string[] } |
| A2 | RunRepository | create(scope, domainId, domainVersion, input, steps?:StepState[]): Promise<RunSnapshot>; startStep(scope,runId,stepId):Promise<void>; finishStep(scope,runId,stepId,status:'failed'\|'skipped',errorCode?:string):Promise<void>; claim(scope, runId, deadlineAt): Promise<boolean>; commitStep(scope, runId, stepId, artifact): Promise<void>; finish(scope,runId,status,warnings): Promise<void>; get(scope,runId): Promise<RunSnapshot\|null>; cancel(scope,runId): Promise<void> |
| A2 | ArtifactRepository | get(scope, artifactId): Promise<Artifact<unknown>\|null>; list(scope, runId): Promise<Artifact<unknown>[]> |
| A2 | UploadRepository | put(scope, record: UploadRecord): Promise<void>; get(scope,id): Promise<UploadRecord\|null> |
| A2 | DatasetRepository | import(scope,source:SourceRef,columns:ColumnSpec[],rows:DataRow[]):Promise<DatasetRef>; read(scope,id,query:DatasetQuery):Promise<DatasetPage> |
| A2 | StoragePort | write(key:string,bytes:Uint8Array):Promise<void>; read(key:string):Promise<Uint8Array>; remove(key:string):Promise<void> |
| A2 | LlmPort | complete(request:LlmRequest,signal:AbortSignal):Promise<string>; features():GatewayFeatures |
| A2 | LlmRequest | { system: string; messages: {role:"user"\|"assistant";content:string}[]; responseSchema?:JsonValue; maxOutputTokens:number } |
| A2 | GatewayFeatures | { protocol:"openai-chat"\|"unsupported"; streaming:boolean; structuredJson:boolean; nativeTools:boolean; vision:boolean; embeddings:boolean; audio:boolean } |
| A2 | SourcePort | fetch(url:string,profile:SourceProfile,signal:AbortSignal):Promise<SourceDocument>; search(query:string,profile:SourceProfile,signal:AbortSignal):Promise<SearchHit[]> |
| A2 | ParserPort | parse(file:Uint8Array,mime:string):Promise<NormalizedDocument[]> |
| A2 | RunContext | {scope:Scope;runId:string;stepId:string;signal:AbortSignal;deadlineAt:number;budget:Budget;ports:RuntimePorts;expectedArtifact:{kind:string,version:number};artifactSchemas:ArtifactSchemaRegistry} |
| A2 | RuntimePorts | {runs,artifacts,uploads,datasets,storage,llm,sources,parsers}; each field implements corresponding port |
| A2 | ArtifactSchemaRegistry | register<T>(kind:string,version:number,schema:Schema<T>):void; has(kind:string,version:number):boolean; parse(artifact:unknown):Artifact<unknown> |
| A2 | Budget | consume(operation:"model"\|"repair"\|"fetch"\|"tool"):void; remainingMs():number; limits count total retries/repair |
| A2 | ColumnSpec / DataRow | {key,type:"string"\|"number"\|"boolean"\|"date",nullable,unit?:string}; {id:string;values:Record<string,string\|number\|boolean\|null>} |
| A2 | DatasetRef / DatasetPage | {id,sourceId,columns,rowCount}; {datasetId,columns,rows,total,offset,limit} |
| A2 | DatasetQuery | {offset:number;limit:number;sort?:{key:string;direction:"asc"\|"desc"};filters?:{key:string;op:"eq"\|"gt"\|"lt";value:string\|number\|boolean}[]} |
| A2 | SourceRef / SourceProfile | SourceRef: {id,kind:"upload"\|"url"\|"dataset",title,retrievedAt,contentHash,url?:string,publishedAt?:string}; SourceProfile: {id,adapterId,allowedDomains:string[],maxSources:number,maxBytes:number,fetchTimeoutMs:number,requireCitation:boolean} |
| A2 | SourceDocument / SearchHit | {source:SourceRef,document:NormalizedDocument}; {url:string,title:string,summary?:string} |
| A2 | NormalizedDocument | {id,sourceId,title,segments:{id,text,locator:SourceLocator}[],warnings:string[]} |
| A2 | SourceLocator | text:{type,start,end}; pdf:{type,page,start,end}; table:{type,sheet?:string,row,column?:string}; web:{type,section,start,end} |
| A2 | Evidence / Claim | Evidence:{id,sourceId,documentId?,locator,excerpt}; Claim:{id,text,kind:"fact"\|"inference"\|"calculation"\|"recommendation",evidenceIds:string[],support:"supported"\|"contradicted"\|"insufficient"\|"unchecked"} |
| A2 | AnalysisData / RecommendationData | {summary,claims:Claim[],findings:{id,title,claimIds:string[]}[]}; {items:{id,title,reasonClaimIds:string[],priority:"low"\|"medium"\|"high",actions:string[]}[]} |
| A2 | SourceCollectionData / EvidenceSetData | {sources:SourceRef[],documents:NormalizedDocument[]}; {evidence:Evidence[],claims:Claim[]} — canonical arrays in one primary artifact, other artifacts refer IDs |
| A2 | ReportData | {title:string,summary:string,claimIds:string[],metricArtifactIds:string[],recommendationIds:string[]} |
| A2 | DomainManifest | {id:string,version:number,title:string,description:string,branding:{name:string,accent:string,logoUrl?:string},surface:'workspace',inputFields:InputField[],examples:{label:string,input:JsonValue}[],toolNames:string[]} |
| A2 | InputField | {name:string,label:string,kind:'text'\|'textarea'\|'upload'\|'select'\|'url-list',required:boolean,options?:{label:string,value:string}[]} |
| A2 | ResultView | {runId,revision,title,status,blocks:UIBlock[]} |
| A2 | PresentationContext | {snapshot:RunSnapshot;get<T>(kind:string,schema:Schema<T>):Artifact<T>\|null;sources:SourceRef[];evidence:Evidence[]} |
| A3 | createMemoryRepositories | (): {runs:RunRepository;artifacts:ArtifactRepository;uploads:UploadRepository;datasets:DatasetRepository}, test-only adapter |
| A3 | createTestContext | (options:{scope?:Scope;ports?:Partial<RuntimePorts>;signal?:AbortSignal;deadlineAt?:number;expectedArtifact?:{kind:string,version:number};artifactSchemas?:ArtifactSchemaRegistry}):RunContext; defaults use fixtures, never external I/O |
| A4 | AI SDK facade | sdk-model.ts exports loadLiveGatewayConfig(env:NodeJS.ProcessEnv=process.env):GatewayConfig; createGatewayModel(config:GatewayConfig,fetcher:typeof fetch=fetch):LanguageModel; probeGateway(config):Promise<GatewayFeatures>. SDK types stay inside adapters. |
| A4 | createGateway | (config:GatewayConfig,fetcher?:typeof fetch):LlmPort; GatewayConfig:{baseUrl,apiKey,model,features:GatewayFeatures} |
| A5 | Capability<I,O> / executeCapability | {id,version,input:Schema<I>,output:Schema<O>,run(ctx,input):Promise<ArtifactDraft<O>>}; executeCapability(capability,input,ctx):Promise<Artifact<O>> |
| A5 | Step<I,O> / WorkflowDefinition | spec §7 plus artifactKind/version; workflow:{steps:AnyStep[],requiredArtifactKinds:string[]} |
| A5 | StepBindingContext | {input:JsonValue;get<T>(stepId:string,kind:string,schema:Schema<T>):Artifact<T>}; get rejects undeclared dependencies |
| A5 | defineWorkflow / validateWorkflow | defineWorkflow(def:WorkflowDefinition):WorkflowDefinition; validateWorkflow(def):void |
| A5 | runs service | createRun(scope,domainId,input):Promise<RunSnapshot>; executeRun(scope,runId,signal):Promise<RunSnapshot>; getRun(scope,runId):Promise<RunSnapshot>; cancelRun(scope,runId):Promise<void> |
| A6 | ingestUpload / ingestUrl | ingestUpload(scope,uploadId,signal):Promise<SourceDocument[]>; ingestUrl(scope,url,profile,signal):Promise<SourceDocument> |
| A6 | fetchAllowedUrl | (url,profile,{fetcher,resolveHost,signal}):Promise<{url:string;bytes:Uint8Array;contentType:string}> |
| A7 | extractStructured / validateEvidence | extractStructured<T>({documents,schema,instructions},ctx):Promise<T>; validateEvidence(evidence:Evidence[],documents:NormalizedDocument[]):Evidence[] |
| A7 | defineDomain | (definition:DomainDefinition):DomainDefinition; {manifest:DomainManifest,inputSchema:Schema<JsonValue>,workflow:WorkflowDefinition,requiredArtifactKinds:string[],systemPrompt:string,sources:string[],present:(ctx:PresentationContext)=>UIBlock[]}; sources stores profile IDs; sources.ts owns static override config passed through workflow bindings. |
| A8 | buildResultView | (domain:DomainDefinition,snapshot:RunSnapshot,sources:SourceRef[],evidence:Evidence[]):ResultView |
| A8 | getResult | (scope:Scope,runId:string):Promise<ResultView>; artifact/read lookups enforce scope |
| B1 | parseDataset | (bytes:Uint8Array,mime:string,sourceId:string):Promise<{columns:ColumnSpec[];rows:DataRow[]}> |
| B2 | analyzeDataset | (page:DatasetPage,query:AnalyticsQuery):AnalyticsData; pure deterministic computation |
| B2 | AnalyticsQuery / AnalyticsData | Query:{numericKeys:string[];groupBy?:string;dateKey?:string}; Data:{datasetId:string;metrics:{key,count,missing,sum,mean,min,max}[];outliers:{rowId,key,value,method:"iqr"}[];trends:{key:string,direction:'up'\|'down'\|'flat',slope:number,method:'linear-regression'}[];charts:ChartSpec[]} |
| B2 | loadDatasetForAnalytics | (scope:Scope,datasetId:string,signal:AbortSignal):Promise<DatasetPage>; capability gathers complete immutable dataset, max50000 rows/100 columns/1000000 cells; pure analyzeDataset rejects partial pages |
| B3 | McpClient / describeSchema | McpClient:{health(signal):Promise<void>;listTools(signal):Promise<McpTool[]>;call(name,args:JsonValue,signal):Promise<McpCallResult>}; describeSchema(scope,schema:string,signal):Promise<SchemaDescription> |
| B3 | normalizeQueryResult | (result:McpCallResult,metadata:{query:string;sourceIds:string[];maxRows:number}):QueryResultData; fields:{columns,rows,rowCount,truncated,executedAt,queryHash,sourceIds} |
| B3 | SchemaDescription / McpTool | {schema:string;tables:{name:string;columns:ColumnSpec[]}[]}; {name:string;inputSchema:JsonValue} |
| B3 | McpCallResult | {isError?:boolean;content:{type:"text";text:string}[];structuredContent?:JsonValue} |
| B4 | queryDataset | (scope,request:{datasetId:string;query:string},signal):Promise<Artifact<QueryResultData>>; creates scoped business run/step through executor |
| C1 | ToolDefinition<I,O> / dispatchTool | {name,description,input:Schema<I>,output:Schema<O>,trustedOnly:boolean,run(scope,input,signal):Promise<O>}; dispatchTool(scope,name,input:JsonValue,signal):Promise<JsonValue> |
| C2 | createAgentStream | adapter-only (request:AgentStreamRequest):ReturnType<typeof streamText>; SDK types stay inside adapters/agents |
| C2 | AgentStreamRequest | {scope:Scope;domainId:string;input:RunAgentInput;signal:AbortSignal}; validates context/server tool selection |
| C3 | projectAgentState | (scope,runId):Promise<{businessRunId,revision,artifactIds:string[],summary:string}> |
| D1 | researchSources | ({question:string,seedUrls:string[],profile:SourceProfile},ctx):Promise<{sources:SourceRef[];documents:NormalizedDocument[];warnings:string[]}> |
| D2 | scoreSignals | (signals:RiskSignal[],rules:RiskRules):RiskData; rule types specified in D2 |
| D4 | validateDomain / registerDomain | validateDomain(domain:DomainDefinition,catalog:DomainValidationCatalog):void; registerDomain(domain:DomainDefinition):void in server catalog |
| D4 | DomainValidationCatalog | {sourceProfileIds:ReadonlySet<string>,toolNames:ReadonlySet<string>,artifactSchemas:ArtifactSchemaRegistry}; server container injects it; validator imports no agents/adapters |
| D5 | scoped memory | MemoryEntry/MemoryRepository and getMemory/putMemory/removeMemory defined in phase04 D5 |
| D6 | rehearsal | Fresh starter runbook, all-P0 verification and new-domain rehearsal |

AnyStep/DomainDefinition use type-erased registry storage internally; every boundary validates using declared schemas. Do not export unknown payloads to UI. JsonValue includes only JSON values; schemas receive unknown at decode boundary and must parse.

## UI props ledger

Task A2 defines all 19 contract schemas. Task A8 renders document blocks; C4 fills the rest and creates fixtures. Fields below are required unless marked optional.

| Type | Props |
|---|---|
| metric | {label:string,value:number\|null,unit?:string,delta?:number,sourceIds:string[]} |
| chart | {title:string,kind:"bar"\|"line"\|"area"\|"pie"\|"scatter",datasetId:string,xKey:string,series:{key,label,unit?:string}[],aggregation:"none"\|"sum"\|"mean"\|"count",sourceIds:string[]} |
| table | {title:string,datasetId:string,columns:string[],pageSize:number} |
| insight | {title:string,claimIds:string[],severity:"info"\|"warning"\|"critical"} |
| recommendation | {title:string,reasonClaimIds:string[],priority:"low"\|"medium"\|"high",actionIds:string[]} |
| risk | {score:number\|null,min:number,max:number,direction:"higher-is-worse"\|"higher-is-better",level:"low"\|"medium"\|"high"\|"unknown",factorIds:string[],method:string,completeness:number} |
| warning | {title:string,message:string,severity:"info"\|"warning"\|"critical"} |
| source | {sourceIds:string[]} |
| evidence | {claimId:string,evidenceIds:string[]} |
| verdict | {claimId:string,support:"supported"\|"contradicted"\|"insufficient"\|"unchecked",reason:string} |
| timeline | {items:{id,title,description?,at?:string}[]} |
| progress | {stepIds:string[]} |
| action | {label:string,actionId:"export.markdown"\|"export.json"\|"retry-run"\|"focus-artifact",artifactId?:string} |
| map | {places:{id,name,lat:number,lng:number}[],available:boolean,reason?:string} |
| place | {name:string,lat:number,lng:number,description?:string,sourceIds:string[]} |
| comparison | {criteria:{key,label,unit?:string}[],options:{id,label,values:Record<string,string\|number\|null>}[]} |
| report-section | {title:string,blockIds:string[]} |
| markdown | {content:string} |
| media | {kind:"image"\|"audio"\|"video",storageKey?:string,url?:string,alt:string} |

UIBlock has {id,type,props}; z.discriminatedUnion("type", schemas) is canonical. Validate finite numbers/ranges, dataset column existence, block references without cycles and allowed media sources; model output is never executable JSX/SQL/UI function.

## Build decisions that fill design details

- Dataset P0 resource limits: 50000 rows, 100 columns, 1000000 nonempty cells; larger imports return resource_limit. Analytics gathers the complete immutable dataset before computing globals.
- Node version must meet Next.js and pinned SDK engines; record actual Node/Bun versions in docs/dependencies.md. No package version guessed from this plan.
- Vitest for pure/integration behavior; Playwright for end-to-end user flows. Import-boundary lint runs in check; tests do not mirror file layout.
- Postgres tables use text IDs generated server-side, UTC timestamps and indexed workspace_id. Sessions store token hashes; trusted-operator flag is server-owned.
- P0 extraction initially implements OpenAI chat-compatible AI transport only after doctor verifies that protocol. Unsupported protocol produces a typed unsupported error; implement another AI transport only if official gateway documentation confirms it is needed. Do not enable a fallback provider.
- Source search needs a permitted endpoint with a fixed JSON adapter contract. Seed URLs remain usable without search. Search unavailable is explicit, never replaced by fabricated links or model memory.
- Static map/voice unavailable states count as supported UI contract behavior; backend geo/voice remain P1.
- Commit commands have a fixed -C path; no step may operate Git in the competition repo.

## Coverage / acceptance matrix

| Design scope | Implemented by |
|---|---|
| Artifact/contracts, namespace/version, JSON-safe data | A2, A5 |
| Drizzle scope, sessions, metadata and datasets | A3, A8, B1 |
| gateway-only/probe/repair/budget | A4, A5, A7, C2 |
| Sequential workflow, duplicate execute, cancellation/partial/interrupted | A5, A8, A9 |
| PDF/DOCX/TXT/JSON/URL ingestion + evidence | A6, A7, A9 |
| CSV/XLSX + metrics/trend/outlier/chart | B1, B2, B4 |
| Local pgEdge, auth, role, tools, normalization | B3, B4, B5 |
| Document + dataset examples | A7–A9, B4–B5 |
| Shared chat/workflow/artifacts | C1–C3 |
| All 19 UI block contracts + playground | A2, A8, C4 |
| Research + source profiles | D1, D3 |
| Rules-based risk/recommendation/report archetypes | A7, D2–D3 |
| Domain authoring/template/catalog and 11 playbooks | D4 |
| Scoped memory and expiry | D5 |
| Docker/runbooks and rehearsal | A9, B5, D6 |
| P1 worker/queue/SSE/geo/voice/vector/export/advanced privacy | Explicitly outside baseline; disabled features expose unavailable state |

## Phase gates and execution handoff

- [ ] Gate 1: document demo run produces persisted artifact/result with valid evidence; optional gateway remains unavailable until explicitly configured.
- [ ] Gate 2: dataset numbers match expected values; pgEdge role cannot write/read private app data and MCP results become artifacts.
- [ ] Gate 3: chat and dashboard point to the same businessRunId/artifact IDs; 19 block fixtures render or show feature-unavailable.
- [ ] Gate 4: research/risk archetypes and domain validation pass; team can create a new pack using the authoring guide.

After every gate, record commands + observed outcome in docs/verification.md. Do not call mocked transport “live gateway verified”. If a real integration gate cannot run, preserve completed work and record the missing runtime prerequisite; do not mark that gate checked.

Execution modes offered after planning: inline executing-plans in this chat, or subagent-driven-development with task-level review. No code execution is authorized merely by choosing a filename in the plan.
