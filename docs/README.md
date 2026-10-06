# Docs — bắt đầu ở đây

Phân công hiện hành là **platform dùng chung do mình xây; problem templates có FE và backend composition do bạn xây**. Những hướng dẫn cũ giao toàn bộ generic UI cho bạn được thay thế bởi bản chia việc này.

**Core hiện có: app chat AI văn bản.** Đọc [Core PRD](platform-build-spec.md) để xem scope, catalog features và acceptance. [CopilotKit ecosystem research](research/2026-10-05-copilotkit-chat-core.md) giải thích SDK/runtime/history và các điều kiện Intelligence. C01 đã tích hợp CopilotKit v2 và endpoint model tương thích OpenAI; lịch sử bền vững thuộc C02.

**UI hiện có:** [bố cục ChatGPT, theme trắng](superpowers/specs/2026-10-05-chat-white-ui-design.md) tại `/`, với sidebar/drawer, transcript SDK, Copy, composer và một notice kết nối. [UI implementation plan](superpowers/plans/2026-10-05-chat-white-ui-implementation-plan.md) chi tiết hóa C01. Các browser checks dùng SDK/runtime thật với controlled provider trong tests; đây không phải external-model smoke test.

**Brainstorm từng phần:** mục 10 trong Core PRD chia C01 Chat Foundation → C02 History → C03 Tools/Context → C04 MCP local → C05 Domain bridge. [Technical spec C01](superpowers/specs/2026-10-05-chat-foundation-design.md) và [implementation plan C01](superpowers/plans/2026-10-05-chat-foundation-implementation-plan.md) mô tả nền tảng chat hiện có; các extensions tiếp theo còn trong hàng chờ.

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

Các UI blocks nghiệp vụ, engines và sáu problem templates còn là backlog. Bốn domain seeds và sales fixtures tại `/playground` giúp kiểm tra shared contracts. Các master/skeleton implementation plans trước Core P0 ở `superpowers/` là tài liệu lịch sử/tham khảo.

## Chạy browser acceptance

Cài browser theo version Playwright đã pin bằng `bun x playwright install chromium`, rồi chạy:

```powershell
bun run check
bun run test
bun run domain:validate
bun run build
bun run e2e --project=chat-no-env --project=chat-live --project=chat-production
bun run e2e --project=baseline
```

Harness tự mở configured dev app ở `http://localhost:3211` với `.next-e2e-live`, và release app không có model config ở `http://localhost:3212` với `.next`. `chat-no-env` và `chat-production` dùng cùng release server; `baseline` dùng dev server để kiểm tra fixture endpoints. Controlled provider ở loopback 4320, control plane chỉ trong tests ở 4321. Browser app URLs dùng `localhost` để khớp Origin với Request URL do Next tạo. Không cần model key thật; không tái sử dụng server đang chạy trên những ports này. Các ports đã đổi do dịch vụ có sẵn trên 3100/3101/3102/4310; no-env dev riêng đã bỏ sau lỗi hết disk khi giữ hai dev caches.

Acceptance kiểm tra dark preference trên 390×844, 768×1024, 1440×900 và 1920×1080; SDK Markdown/code/table DOM và contrast; drawer Tab/Escape/focus; Enter/Shift+Enter/IME; clipboard; composer 48–200px/8000 ký tự; streaming scroll; lỗi provider/boundary và một notice; production gating và `/playground`. Mobile emulation với visualViewport resize đã được kiểm tra, nhưng bàn phím phần mềm trên thiết bị thật và browser zoom 200% còn cần manual QA. `deviceScaleFactor` không được dùng làm bằng chứng browser zoom.

Evidence ngày 2026-10-06: `check` pass; 143 unit/integration tests pass (21 files); 4 domain definitions validate; release build pass; 24 chat browser cases pass (5 no-env, 15 live/failure, 4 production); `/playground` baseline pass. Fixture production gate vẫn trả `503 feature_unavailable`, với links được ẩn trong release playground. Browser screenshots/traces chỉ lưu khi test fail và không trở thành product fixtures.
