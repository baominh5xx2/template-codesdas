# Docs — bắt đầu ở đây

Phân công hiện hành là **platform dùng chung do mình xây; problem templates có FE và backend composition do bạn xây**. Những hướng dẫn cũ giao toàn bộ generic UI cho bạn được thay thế bởi bản chia việc này.

**Ưu tiên mới: core là app chat AI có lịch sử hội thoại.** Đọc [Core PRD](platform-build-spec.md) trước để xem scope, catalog features, trạng thái repo và acceptance. [CopilotKit ecosystem research](research/2026-10-05-copilotkit-chat-core.md) giải thích SDK/runtime/history và các điều kiện Intelligence. SDK chưa được cài vào app.

**UI đã chọn:** [bố cục ChatGPT, theme trắng](superpowers/specs/2026-10-05-chat-white-ui-design.md), có [UI implementation plan riêng](superpowers/plans/2026-10-05-chat-white-ui-implementation-plan.md) gồm 5 tasks. Plan này chi tiết hóa UI của C01, không phải thêm một core khác. C01 có sidebar shell và chat; history thật thuộc C02. Mình chỉ viết spec/plan, user tự triển khai code.

**Brainstorm từng phần:** mục 10 trong Core PRD chia C01 Chat Foundation → C02 History → C03 Tools/Context → C04 MCP local → C05 Domain bridge. Mỗi phần có vòng spec/plan riêng; extensions nằm trong hàng chờ. [Technical spec C01](superpowers/specs/2026-10-05-chat-foundation-design.md) đã được user cho chuyển sang [implementation plan C01](superpowers/plans/2026-10-05-chat-foundation-implementation-plan.md): 5 tasks, chưa execute.

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

Đợt cập nhật này chỉ là docs; chưa xây UI blocks, engines hay sáu problem templates. Bốn domain seeds và sales fixtures hiện có chỉ giúp kiểm tra shared contracts. Các master/skeleton implementation plans trước Core P0 ở `superpowers/` là tài liệu lịch sử/tham khảo; không coi chúng là backlog đã được triển khai.
