# Chia việc song song

Phân công hiện hành: **mình xây platform dùng chung, bạn xây problem templates có cả FE và backend composition**. Đọc [build-ownership.md](build-ownership.md) trước; file đó thay thế cách chia cũ là bạn sở hữu toàn bộ generic UI.

| Platform làm | Template owner làm song song |
|---|---|
| Shared cards, WorkspaceShell, ChatPanel, renderer/registry và state UI | Input forms, page-specific layouts/interactions và representative fixtures |
| Reusable ingestion/extraction/analytics/evidence/scoring/report capabilities | Input/artifact schemas, workflow config/bindings, prompt/rules/source selection |
| Runner, Tool Registry, BFF, persistence, gateway và agent bridge | Pure presenter, domain customizations và optional scoped custom tools |
| Shared contracts + readiness/error semantics | Template acceptance scenarios và provider demo/live integration |

Thứ tự ghép: chốt contract → platform generic UI + bạn template fixture → reusable capabilities + template workflow → runner/BFF thật → end-to-end acceptance → thay demo provider. Domain registration phải validate ở server; không import server catalog vào client.

`src/ui` thuộc platform; proposed `src/problem-templates/*/ui` thuộc template owner. Shared code/schema thay đổi cần phối hợp, không fork types hoặc copy parser/crawler/model client. Template chưa có live dependencies vẫn hiển thị demo có nhãn; không fake business success. Sáu packs và outputs cụ thể nằm ở [problem-templates.md](problem-templates.md); platform backlog ở [platform-build-spec.md](platform-build-spec.md).
