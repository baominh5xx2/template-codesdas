# Docs — bắt đầu ở đây

Phân công hiện hành là **platform dùng chung do mình xây; problem templates có FE và backend composition do bạn xây**. Những hướng dẫn cũ giao toàn bộ generic UI cho bạn được thay thế bởi bản chia việc này.

**Core là app chat AI; durable history thuộc C02.** Đọc [Core PRD](platform-build-spec.md) trước để xem scope, catalog features, trạng thái repo và acceptance. C01 đã có CopilotKit v2 UI/runtime, configured model adapter và kiểm chứng bằng controlled OpenAI provider. [CopilotKit ecosystem research](research/2026-10-05-copilotkit-chat-core.md) giải thích SDK/runtime/history và các điều kiện Intelligence.

**UI đã triển khai:** [bố cục ChatGPT, theme trắng](superpowers/specs/2026-10-05-chat-white-ui-design.md), theo [UI implementation plan](superpowers/plans/2026-10-05-chat-white-ui-implementation-plan.md). C01 có sidebar shell, stream, Stop, manual Retry và New chat. Transcript/runner chỉ giữ trong phiên; reload reset. History thật thuộc C02.

**Brainstorm từng phần:** mục 10 trong Core PRD chia C01 Chat Foundation → C02 History → C03 Tools/Context → C04 MCP local → C05 Domain bridge. Mỗi phần có vòng spec/plan riêng; extensions nằm trong hàng chờ. [Technical spec C01](superpowers/specs/2026-10-05-chat-foundation-design.md) và [implementation plan C01](superpowers/plans/2026-10-05-chat-foundation-implementation-plan.md) đã được triển khai; chưa đăng ký tools/MCP vào chat.

[Core P0 spec](superpowers/specs/2026-10-05-core-p0-design.md) và [plan](superpowers/plans/2026-10-05-core-p0-implementation-plan.md) trước đó **chưa triển khai và cần sắp lại theo ưu tiên chat**. Không execute plan workflow-first này như backlog hiện hành. [Agent plan 03](superpowers/plans/2026-10-05-03-agent-playground.md) có phần runtime/chat dùng để tham khảo nhưng cũng cần cập nhật durable history.

| Đọc | Để làm gì |
|---|---|
| 1. [Build ownership](build-ownership.md) | Ai xây gì, thư mục nào thuộc ai, cách ghép |
| 2. [Problem templates](problem-templates.md) | Sáu packs ưu tiên, FE/BE flows, deliverables và acceptance |
| 3. [Core PRD](platform-build-spec.md) | Chat/history/agent/tools/MCP/memory, SDK vs app, inventory và release gates; giữ platform extensions |
| 4. [Frontend contracts](frontend-handoff.md) | 19 block types, props, renderer context và interactions |
| 5. [API contracts](api-contracts.md) | Fixture endpoints, pagination, errors và production gating |
| 6. [Parallel work](parallel-work.md) | Những việc hai owner làm cùng lúc và thứ tự tích hợp |
| [Code structure](code-structure.md) | Map current skeleton sang planned modules |
| [Dependencies](dependencies.md) | Pins và compatibility của toolchain hiện có |

UI blocks, engines và sáu problem templates vẫn chưa xây. Bốn domain seeds và sales fixtures hiện có giúp kiểm tra shared contracts. Các master/skeleton implementation plans trước Core P0 ở `superpowers/` là tài liệu lịch sử/tham khảo.

## Kiểm tra C01

`bun run check`, `bun run test`, `bun run domain:validate`, `bun run build`, `bun run playwright test --project=chat-no-env --project=chat-live --project=chat-production`, rồi `bun run e2e --project=baseline`. Harness tự chạy provider 4310 và app servers 3000/3100/3101/3102, từ chối port đã bị chiếm. `bun run chat:smoke` kiểm tra server đang chạy qua `CHAT_SMOKE_URL` (mặc định 3100).

Ngày 2026-10-06: check, 123 unit/integration tests, domain validation, build, 21 chat browser cases và 1 baseline case đạt. Máy local có Docker chiếm 3100 nên browser validation dùng config tạm chỉ đổi no-env sang 3190; defaults trong repo giữ nguyên. Chưa kiểm tra live external model. Xem [API contracts](api-contracts.md) và [code structure](code-structure.md) để cấu hình và tiếp nối runner durable ở C02.
