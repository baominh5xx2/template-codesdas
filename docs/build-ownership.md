# Xây gì, ai xây và ghép như thế nào

Đây là bản chia việc hiện hành. Nó thay thế cách chia trước đây là bạn làm toàn bộ `src/ui`. Hai người làm hai tầng khác nhau: **owner platform xây UI blocks, reusable capabilities, core và infra; owner problem templates xây trải nghiệm theo dạng bài toán, gồm FE composition và BE workflow**.

## Đọc theo thứ tự

1. File này: hiểu phạm vi và quyền sửa.
2. [Problem templates](problem-templates.md): bạn chọn template và biết phải giao những gì.
3. [Platform build spec](platform-build-spec.md): biết những module dùng chung sẽ được platform cung cấp.
4. [Frontend contracts](frontend-handoff.md) và [API contracts](api-contracts.md): dùng đúng schemas và fixtures đang có.

## Hai tầng sản phẩm

```text
Domain/topic cụ thể: tourism, scam, privacy, finance, education...
  schema + prompt + sources + rules + branding + custom tools
                              ↓
Problem template: dashboard, document analyzer, risk, research...
  input form + page composition + workflow config + presenter
                              ↓
Platform dùng chung
  UI blocks + capabilities + runner + tools + storage + adapters
```

Problem template mô tả một dạng bài toán; domain pack tùy biến nó cho đề thi. Ví dụ `risk-analyzer` dùng chung cho scam và food safety, nhưng mỗi domain có schema, signals, rules, sources và prompt riêng. Không gom rules của tất cả domain vào RiskScoreCard hoặc scoring engine.

## Ownership

| Owner platform — mình xây | Owner problem templates — bạn xây |
|---|---|
| `src/contracts`: JSON/Zod DTOs, artifact và block schemas | Input/artifact schema riêng của template, dựa trên shared contracts |
| `src/ui`: primitives, generic cards, forms, shells, renderer, registry, chat và state components | Layout, input form và interaction riêng theo bài toán; compose các block có sẵn |
| `src/core`: capability contract, runner, tools, domain validation, run/session và approval | Workflow definition: chọn capability, bind input, dependencies, rules và presenter |
| `src/capabilities`: ingestion, extraction, analytics, research, scoring... | 1–2 custom tools khi bài toán cần; đăng ký qua Tool Registry |
| `src/adapters`, `src/agents`, `src/server`, `src/sources` | Fixture riêng và acceptance scenarios cho từng template |
| Generic BFF routes, persistence, infra và operational scripts | Page/routes hiển thị template và domain packs thử nghiệm |

Owner template không cần tự viết parser PDF, crawler, database client, model client hay card generic. Nếu thiếu shared capability/block, ghi yêu cầu cho owner platform; không âm thầm tạo bản sao. Custom tool của template dùng injected ports, `Scope` và `AbortSignal`; không tự lách session, budgets hoặc gateway.

## Ranh giới thư mục

Các path `src/problem-templates` và `src/app/(templates)` dưới đây là **quy ước dự kiến, chưa scaffold**. Shared schemas hiện hành vẫn là nguồn sự thật; binding template vào domain catalog sẽ được hai owner tích hợp qua server composition root.

```text
src/
  contracts/                     PLATFORM: shared DTOs
  ui/                            PLATFORM: generic reusable UI
  core/                          PLATFORM: orchestration + ports
  capabilities/                  PLATFORM: reusable operations
  adapters/ agents/ server/       PLATFORM: concrete integrations
  sources/                       PLATFORM: source profile catalog
  problem-templates/             TEMPLATE OWNER: dự kiến
    risk-analyzer/
      manifest.client.ts         client-safe metadata
      input.ts                   input Zod schema
      artifacts.ts               namespaced artifact schemas
      workflow.ts                capability composition + bindings
      presenter.ts               artifacts → UIBlock[]
      definition.server.ts       assemble server definition
      tools.ts                   optional custom tools
      ui/                        page-specific forms/layouts
      fixtures/                  representative synthetic examples
      README.md                  flow, dependencies, acceptance
  domains/                       topic customization / existing seeds
  app/
    api/                         PLATFORM: generic BFF
    (templates)/                 TEMPLATE OWNER: planned template pages
```

Tên thư mục mới không có nghĩa là đã có `ProblemTemplate` runtime contract. MVP dùng `DomainDefinition`, `WorkflowDefinition`, `PresentationContext` và `UIBlock` hiện có; chỉ thêm abstraction mới khi có ít nhất hai consumer thật và hai owner thống nhất.

**Chat-first C05 design — 2026-10-06:** [Domain Plug-in & Artifact Bridge spec](superpowers/specs/2026-10-06-domain-artifact-bridge-design.md) đề xuất mở rộng DomainDefinition hiện có: workflow optional, C03 business tool registrations, requirements/rules và typed result binding. Platform sở hữu resolution/policy/publication/read APIs; template owner vẫn viết schema/prompt/tools/presenter và FE composition. Spec đang chờ review, không phải code đã có. C05 chỉ dựng minimal result handoff cho pack mẫu; full 19 generic blocks thuộc X07.

**C05 integration gate — 2026-10-06:** C05's publication builder validates C03 tool output and pack-derived values before calling `DomainResultPublicationPort`; C03/model receives the original tool output unchanged after successful publication. C02 must provide the thread-pinned pack identity and authoritative scope/run/tool-call correlation, then implement that port as one atomic run/artifact/binding/ResultView/outbox transaction with publication-key idempotency. C02 also owns transcript/history, event delivery/replay, and scoped read routes. The current C05 checkout has no C02 persistence/thread adapter, so routes and history hydration remain gated on that integration. Technical pre-commit failure is projected to the exact chat text `Chưa kết nối`. See [domain handoff](../src/core/domains/README.md) and [artifact publication boundary](../src/core/artifacts/README.md).

## Làm song song ngay bây giờ

| Platform làm | Bạn làm |
|---|---|
| Chốt block props, xây WorkspaceShell + renderer + generic cards | Chọn Data Dashboard đầu tiên; viết input form, layout và fixture riêng |
| Xây ingestion CSV/XLSX và deterministic analytics | Viết input/artifact schemas, workflow bindings, presenter của dashboard |
| Xây Tool Registry, runner, BFF và report/export | Định nghĩa filter/report interaction và các acceptance scenarios |
| Nối services/ports thật vào composition root | Thay fixture provider bằng run API, kiểm tra flow end-to-end |

Không cần đợi platform hoàn chỉnh mới bắt đầu template. Khi capability chưa có implementation, template dùng provider demo có nhãn rõ; workflow production vẫn unavailable. Không đưa fixture vào capability live hoặc trả success cho step chưa chạy.

## Quy tắc ghép

1. Contract change: thống nhất schema và semantics; owner platform cập nhật shared contract, fixtures và API consumers cùng nhau.
2. Artifact kind riêng dùng namespace, ví dụ `risk-analyzer/signals`; registry kiểm tra kind/version và JSON sau transform.
3. FE gọi BFF hoặc nhận typed props; không import server catalogs, adapters hoặc capability implementations.
4. Workflow khai báo dependencies trước đó và gọi capability qua runner. Domain-specific rules/prompt nằm trong template/domain.
5. Presenter thuần: đọc artifacts, trả block JSON; không fetch, gọi model, ghi DB hoặc sinh JSX.
6. Template merge gate: representative fixtures + schema validation + presenter tests + end-to-end flow khi dependencies sẵn sàng.

## Trạng thái hiện tại

Repo có bootstrap, shared schemas cho 19 blocks, port declarations, pure validators, domain seeds và fixture APIs. `src/ui` mới có README; workflow seeds rỗng; ingestion, AI, storage, runner, CopilotKit và MCP chưa được triển khai. Bốn seeds hiện chia sẻ một sales gallery synthetic; đây chưa phải sáu problem templates chạy thật.

Mục tiêu khi nhận đề: chọn problem template rồi viết **schema + prompt + workflow + sources + rules + presenter + 1–2 custom tools + branding**. Đây là mục tiêu roadmap, chưa phải năng lực của skeleton hiện tại.
