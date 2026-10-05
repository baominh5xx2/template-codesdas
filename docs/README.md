# Docs — bắt đầu ở đây

Phân công hiện hành là **platform dùng chung do mình xây; problem templates có FE và backend composition do bạn xây**. Những hướng dẫn cũ giao toàn bộ generic UI cho bạn được thay thế bởi bản chia việc này.

**Đọc trước cho lượt xây core:** [Core P0 spec](superpowers/specs/2026-10-05-core-p0-design.md) → [Core P0 implementation plan](superpowers/plans/2026-10-05-core-p0-implementation-plan.md). Hai tài liệu mới là đề xuất để review; chưa triển khai. P0 tập trung vào registry, executor, workflow, run/artifact persistence, services và BFF; không cần API key. Đã cài CopilotKit skills mới để thiết kế boundary, chưa cài SDK vào app.

| Đọc | Để làm gì |
|---|---|
| 1. [Build ownership](build-ownership.md) | Ai xây gì, thư mục nào thuộc ai, cách ghép |
| 2. [Problem templates](problem-templates.md) | Sáu packs ưu tiên, FE/BE flows, deliverables và acceptance |
| 3. [Platform build spec](platform-build-spec.md) | Bốn nhóm shared machinery và mười hạng mục xây trước |
| 4. [Frontend contracts](frontend-handoff.md) | 19 block types, props, renderer context và interactions |
| 5. [API contracts](api-contracts.md) | Fixture endpoints, pagination, errors và production gating |
| 6. [Parallel work](parallel-work.md) | Những việc hai owner làm cùng lúc và thứ tự tích hợp |
| [Code structure](code-structure.md) | Map current skeleton sang planned modules |
| [Dependencies](dependencies.md) | Pins và compatibility của toolchain hiện có |

Đợt cập nhật này chỉ là docs; chưa xây UI blocks, engines hay sáu problem templates. Bốn domain seeds và sales fixtures hiện có chỉ giúp kiểm tra shared contracts. Các master/skeleton implementation plans trước Core P0 ở `superpowers/` là tài liệu lịch sử/tham khảo; không coi chúng là backlog đã được triển khai.
