# Bản đồ cấu trúc code

Phân công và backlog hiện hành nằm ở [build-ownership.md](build-ownership.md), [platform-build-spec.md](platform-build-spec.md) và [problem-templates.md](problem-templates.md). Platform xây shared machinery; template owner xây problem-specific FE/BE composition.

Starter dùng một luồng rõ ràng: domain định nghĩa input và workflow; capability tương lai nhận `RunContext` và ports; artifacts giữ dữ liệu JSON có provenance; presenter biến dữ liệu thành `ResultView`; frontend render các `UIBlock` đã định kiểu. Contracts hiện hành trong `src/contracts` là nguồn sự thật cho kiểu dữ liệu. Không tạo bản sao type ở UI hay domain.

`src/domains/catalog.client.ts` xuất manifests an toàn cho client. `src/domains/catalog.server.ts` đăng ký definitions và gọi validator với source/tool/artifact catalogs được inject. `src/domains/_template` là điểm bắt đầu cho domain mới. Bốn thư mục trong `src/domains/examples` cho thấy các archetype: document review, dataset analysis, research report và risk analyzer. Workflow hiện rỗng; chưa có capability nghiệp vụ giả lập.

`src/demo` chứa schema của bundle, manifests và dữ liệu synthetic dùng chung. `/playground` giữ landing/fixture view; fixture APIs chỉ mở trong development theo contract. `src/ui/chat` hiện chứa C01 controller, shell/sidebar/header, message views, Copy, composer, workspace và error boundary. Theme trắng được scope bằng `data-chat-theme="light"`; code surfaces/tokens có override cho inline styles Streamdown/Shiki để vẫn đọc được khi browser ưu tiên dark. Generic cards/renderers nghiệp vụ, persistence và MCP còn là extensions.

`src/app/page.tsx` mở `ChatWorkspace`. Workspace kiểm tra `/api/chat/readiness`, mount SDK provider khi configured, và dùng một controller cho draft/transcript/run lifecycle. SDK giữ Markdown rendering và scroll pinning; app giữ composer, safe notice và layout. `src/adapters/agents/chat-client.ts` nối browser controller với SDK; `src/server/chat` kiểm tra config/request và mask errors trước runtime. `src/adapters/agents/chat-runtime.ts` và `src/adapters/llm/chat-model.ts` nối runtime tới model. Model config nằm ở server qua `CHAT_MODEL_BASE_URL`, `CHAT_MODEL_ID`, `CHAT_MODEL_API_KEY`; không gửi key xuống UI. Runtime schema resolution dùng `createRequire` từ installed package để hoạt động trong release bundle Next/Turbopack.

`tests/e2e` đo DOM/CSS và tương tác của SDK thật. `tests/helpers/chat-provider.ts` phát OpenAI-compatible chunks có kiểm soát; `chat-provider-server.ts` cung cấp loopback control plane, `chat-web-server.ts` cô lập configured dev app với release no-env app. Harness ports, commands và manual QA limits nằm ở [docs index](README.md#chạy-browser-acceptance). Thành công provider fixture không thay cho external-model smoke test.

C02 có thể gắn history repository/sidebar items và actions vào cùng shell, thông qua controller/composition boundary và contracts được chốt trong C02. C01 hiện chỉ giữ hội thoại trong memory của phiên; refresh không có durable history. Không tạo history hay account/project actions giả để lấp extension seam.

`src/problem-templates/<id>` là thư mục dự kiến cho template owner: input/artifact schemas, workflow config, presenter, manifest, custom tools nếu cần, representative fixtures và page-specific UI. Chưa tạo thư mục hoặc runtime contract mới trong đợt cập nhật docs này. `src/domains` dành cho topic customization và các seeds hiện có. Template composition sử dụng core contracts hiện hành; registration đi qua server composition root.

Artifact đi qua ranh giới phải parse schema artifact, sau đó parse `data` thành `JsonValue` trước khi chuyển đến presenter hoặc UI. Chỉ URL HTTP/HTTPS hoặc `storageKey` được chấp nhận cho media; không cho phép `javascript:` hay data URL.
