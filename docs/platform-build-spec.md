# Platform build spec — phần mình xây

Đọc [ownership](build-ownership.md) để phân biệt platform với problem templates. File này là **backlog và acceptance contract**, không phải danh sách tính năng đã triển khai. Đợt cập nhật hiện tại chỉ thay đổi docs.

Slice triển khai kế tiếp được đề xuất là **Core P0**, chi tiết ở [spec](superpowers/specs/2026-10-05-core-p0-design.md) và [plan](superpowers/plans/2026-10-05-core-p0-implementation-plan.md). User đã ưu tiên core trước; các mục UI/capability dưới đây vẫn là backlog platform tổng thể. Core P0 chưa triển khai ingestion/analytics/model engines; demo deterministic chỉ chứng minh runner và persistence.

## Nhóm 1 — Generic UI / frontend blocks

Platform xây các component dưới `src/ui`. Bạn xây template sẽ compose chúng bằng props/context/callbacks, không phải tự dựng lại card.

| Module | Trách nhiệm và interface | Gate hoàn thành |
|---|---|---|
| `WorkspaceShell` | Layout chung cho input/result/agent, responsive regions và toolbar | Template thay children/slots được; không chứa rules/domain prompt |
| `ChatPanel` | Messages, streaming/progress, citations, tool/approval status | UI state tách khỏi business run state; dùng agent bridge, có unavailable state |
| `MetricCard`, `ChartCard`, `DataTable` | Render metric/chart/table contracts; dataset lookup, filters/pagination callbacks | Zero/null đúng, totals đúng, chart columns resolve, không tự tính business metrics |
| `InsightCard`, `RecommendationCard` | Claim/reason references và action callbacks | Resolve claims/actions; không tự suy luận hoặc rank |
| `RiskScoreCard`, `WarningCard` | Score range/direction/level/completeness/method, warnings | Không mặc định high/low theo score ngoài domain rules; thiếu dữ liệu hiển thị rõ |
| `EvidenceCard`, `SourceCard`, verdict block | Claim/evidence/source lookup và source drawer | Locator/excerpt đọc được; verdict dùng contract; URL qua shared HTTP(S) schema |
| `TimelineCard`, `ProgressCard`, `ActionCard` | Time/step status và allowlisted UI actions | Run/step IDs resolve; action unavailable bị disable hoặc báo rõ |
| `ComparisonCard`, `MapCard`, `PlaceCard` | Criteria/options, coordinates, geo availability | Data hợp lệ, selection callback; không phụ thuộc geo engine để render fixture |
| `UploadPanel` | Select/drop file, validation/progress, typed upload callback | Không tự parse tài liệu trong UI; limits lấy từ config/server contract |
| `ReportView` | Compose report sections và export actions | Block references đúng; sections không cycle; export chỉ bật khi provider có |
| Markdown/media renderers | Render hai block kinds còn lại trong canonical registry | Không evaluate model JSX/JS; media có supported/unavailable/error states |
| Loading/Empty/Error/Success/Partial/Unavailable | Shared states cho request/result/capability | Có retry khi thực sự được hỗ trợ; không dùng fake success |
| `BlockRenderer` + registry | Map 19 block types → typed component renderer | Exhaustive mapping; unknown block bị reject ở schema boundary |
| `/playground` | Preview từng block, state và interaction bằng fixtures | Gallery thực, dev/test only; không nhúng demo data vào production |

Nguồn props là `src/contracts/ui/blocks.ts`. `BlockRenderContext` cung cấp datasets, artifacts, claims, evidence, sources và UI callbacks. Presenter trả JSON; renderer mới trả React nodes. Formatter, chart library và visual theme không quyết định business rules.

## Nhóm 2 — Backend reusable capabilities

Mỗi implementation nhận typed input/context/ports và trả `ArtifactDraft`; executor validate, gắn metadata và persist. Domain-specific schema/prompt/rules được inject từ template/domain. Không giấu network call hoặc model call trong presenter.

| Capability/service | Input → output | Ưu tiên / gate |
|---|---|---|
| Ingestion | PDF/DOCX/TXT/CSV/XLSX/JSON/URL → normalized documents hoặc typed dataset | P0; formats bật theo adapter readiness, limits/resource errors rõ |
| Structured Extraction | Documents + Zod schema + instructions → schema-valid structured data | P0; validation/repair có budget; không coi raw model text là valid JSON |
| Evidence/Citation | Claims + documents/sources → evidence links, locators và support | P0; excerpt/locator traceable, insufficient khi không đủ evidence |
| Analysis Engine | Typed input/artifacts + analysis config → findings/claims/summary | P0; phân biệt fact/inference/calculation/recommendation |
| Risk/Score Engine | Signals + rules + optional model enrichment → score/factors/method/completeness | P0; deterministic rules có tests, range/direction domain-owned |
| Dataset Analytics | Typed dataset + query → stats/trends/anomalies | P0; deterministic, thiếu dữ liệu và partial pages có policy rõ |
| ChartSpec Generator | Dataset metadata + analytics + intent → validated chart specification | P0; x/series columns tồn tại, aggregation rõ; dùng shared chart contract |
| Report Generator | Validated artifacts/evidence + report config → sections/exportable report data | P0; giữ provenance, không tạo claim/source không có evidence |
| Research | Query/seeds + source profile → search/fetch/clean/dedupe/rank collection | P0 sau input guard; allowlists/deadlines/limits, search unavailable rõ |
| Recommendation Engine | Candidates/preferences/criteria → ranked options/reasons/actions | P0 tiếp theo; hard constraints, tie/no-match cases rõ |
| Planner/Optimizer | Goal/options/constraints → plan/timeline/constraint violations | P0 tiếp theo; validate hard constraints, không gọi heuristic là optimum được chứng minh |
| Retrieval/Indexing | Documents/database content → chunks/index; query → relevant evidence | Prerequisite của Knowledge Assistant; abstraction trước implementation, vectors optional |
| Verification Engine | Claim + evidence collection → support/verdict/explanation | P1; không đồng nhất thiếu evidence với false |
| Geo utilities | Coordinates/location query → normalized places/distance/geo results | P2; optional provider, giới hạn và unavailable rõ |
| Memory service | Scoped facts/preferences/history → explicit entries | P2; workspace/session access và lifecycle rõ |
| Privacy/Redaction | Documents/structured data + policy → redacted output/findings | P2; không ghi raw sensitive content vào logs |
| Voice STT/TTS abstraction | Audio/text → transcript/audio metadata | P2; provider/consent/availability rõ, không bắt buộc để boot |

Retrieval/indexing là extension cần bổ sung để RAG hoạt động thật; nó chưa có implementation trong skeleton. ChartSpec có thể là output của analytics hoặc một capability riêng, nhưng không tạo hai schema khác nhau cho cùng chart data. Memory/verification/planning folders hiện chỉ có boundary docs; các modules bổ sung sẽ được scaffold khi implementation được giao.

## Nhóm 3 — Core orchestration

| Module | Platform cung cấp |
|---|---|
| `Capability<Input, Output>` | Schema validation, version, context/ports và artifact-draft output |
| `Artifact<Data>` | Kind/schema version, run/step/workspace IDs, provenance và JSON validation sau transform |
| `UIBlock<Type, Props>` | Canonical 19-type discriminated union, safe data/reference validation |
| Workflow runner | Sequential collect/analyze/verify/recommend/report steps, bind deps, budgets, abort, retries và honest partial/failed states |
| Tool Registry | Typed allowlisted tools, scope/trusted-operator gates, bridge chung cho chat và workflows |
| Domain Pack contract | Manifest/schema/workflow/sources/rules/prompt/presenter và injected validation catalogs |
| Presenter boundary | Pure artifact → block projection; shared business result giữa dashboard/report/chat |
| Run/session state | Server-owned identity, snapshots/revisions, persisted artifacts; UI selection tách riêng |
| Approval/HITL | Explicit approval trước tool có external side effect; pending/approved/rejected lifecycle |
| Gateway adapter | Generic configured gateway; optional BTC binding khi chủ động tích hợp provider/protocol đã xác nhận |
| Model router + cost guard | Approved model selection, input/output/token/call budgets, cancellation; không tự fallback sang provider ngoài config |
| Source profiles | Legal/VBPL, government/statistics, tourism, education, public/company web, news/search, uploaded documents |
| Feature flags | RAG/voice/crawler/geo/MCP/provider readiness; unavailable khi flag/provider chưa sẵn |

Runner P0 chạy tuần tự và chỉ phụ thuộc step trước đó. Workers, parallel DAG, durable resume và business SSE chưa thuộc baseline. Approval không cần bật cho các tools chỉ đọc; khi thêm side effect phải đi qua core approval boundary.

## Nhóm 4 — Infra / vận hành thi đấu

| Hạng mục | Phạm vi platform |
|---|---|
| Next.js App Router + BFF | Shared endpoints, request validation, errors/session, client/server boundaries |
| CopilotKit runtime | Chat/tool bridge tới cùng core services; không tạo một workflow engine riêng |
| Postgres Docker + Drizzle | Migrations/repositories, transaction boundaries, workspace scope; project/ports/volumes riêng |
| pgvector | Optional khi retrieval implementation cần và compatibility đã kiểm tra |
| pgEdge MCP local | Optional scoped read/query tools; raw SQL chỉ trusted local operator; không expose unrestricted SQL cho client |
| `AGENTS.md` | Repo conventions, ownership và framework guidance; không chứa secrets |
| Codex/provider config | Optional cấu hình riêng khi được yêu cầu; tách khỏi app config và không là prerequisite của starter |
| `preflight` | Kiểm tra deps/contracts/features/provider readiness và services đang bật |
| `pre-submit` | Build/tests/smoke/fixture-production gate và readiness report |
| Secret scan | Scan phần repository được phép, không đọc secrets/repo thi bên ngoài |
| Network/provider verification | Chỉ endpoints đã config/cho phép, không dò provider khác; optional model integration gate |
| Smoke tests | No-env skeleton; rồi input → run → artifacts → presenter → UI khi live engines có |
| Git checklist | Exact paths, clean status, đúng origin/branch; không thao tác repo thi |
| Cost/token monitor | Per run/step/call budgets và usage metadata, tránh log secret/raw sensitive payload |

Starter tiếp tục độc lập: không cần API key, tài liệu BTC hoặc cấu hình repo thi để chạy demo/tests/build. BTC Gateway và Codex routing là integration tùy chọn sau này. Kiểm tra network/provider không được biến thành điều kiện boot khi feature đó chưa bật.

## Mười hạng mục platform làm trước

1. WorkspaceShell.
2. ChatPanel UI với states/provider boundary.
3. UI Block Renderer/registry và generic cards tối thiểu.
4. Generic Gateway adapter boundary; live provider chỉ khi được config.
5. Tool Registry.
6. Sequential Workflow Runner + run lifecycle.
7. Ingestion, bắt đầu CSV/XLSX/TXT/JSON rồi mở rộng documents/URL.
8. Structured Extraction + evidence boundary.
9. Deterministic Analytics / Analysis / Scoring primitives.
10. Dashboard/Report renderer + report generation/export.

Thứ tự trên là delivery slices, không có nghĩa chat live hoàn thành trước runner/gateway/tools. Chat UI có thể preview bằng fixture trước; live chat chỉ bật sau shared services. Dashboard là integration slice đầu tiên vì calculation có thể kiểm chứng mà không cần model. Research/Recommendation/Planner/RAG theo sau khi dependencies của từng template sẵn sàng.

## Definition of done

- Shared module có typed contract, implementation/provider thật khi được đánh dấu live, meaningful tests và error/availability semantics.
- Template dùng cùng services/capabilities qua runner; chat/dashboard/report không chạy ba pipeline khác nhau.
- Artifact schema/version/provenance và UI references được validate.
- Demo provider có nhãn; production không auto fallback sang fixtures.
- Component generic được preview; template có representative fixtures và acceptance scenarios riêng.
- Build/test/preflight checks chỉ yêu cầu các integrations được bật, không đòi secrets của người khác.

## Có gì hôm nay, còn gì phải xây

Đã có: Next bootstrap, 19 block schemas, artifact registry/validators, workflow/domain validation, port/service declarations, manifests/seeds và fixture APIs. Chưa có: generic UI components, capability algorithms, workflow execution, tool dispatch, storage/database implementations, live chat/model/MCP, operational scripts nói trên. Docs này không thay đổi trạng thái implementation đó.
