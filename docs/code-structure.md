# Bản đồ cấu trúc code

Phân công và backlog hiện hành nằm ở [build-ownership.md](build-ownership.md), [platform-build-spec.md](platform-build-spec.md) và [problem-templates.md](problem-templates.md). Platform xây shared machinery; template owner xây problem-specific FE/BE composition.

Starter dùng một luồng rõ ràng: domain định nghĩa input và workflow; capability tương lai nhận `RunContext` và ports; artifacts giữ dữ liệu JSON có provenance; presenter biến dữ liệu thành `ResultView`; frontend render các `UIBlock` đã định kiểu. Contracts hiện hành trong `src/contracts` là nguồn sự thật cho kiểu dữ liệu. Không tạo bản sao type ở UI hay domain.

`src/domains/catalog.client.ts` xuất manifests an toàn cho client. `src/domains/catalog.server.ts` đăng ký definitions và gọi validator với source/tool/artifact catalogs được inject. `src/domains/_template` là điểm bắt đầu cho domain mới. Bốn thư mục trong `src/domains/examples` cho thấy các archetype: document review, dataset analysis, research report và risk analyzer. Workflow hiện rỗng; chưa có capability nghiệp vụ giả lập.

`src/demo` chứa schema của bundle, manifests và dữ liệu synthetic dùng chung. `src/app/api` cung cấp fixtures cùng chat readiness/runtime BFF. `src/ui/chat` sở hữu shell trắng, responsive sidebar/drawer, composer, notice và controller; `WhiteChatView` dùng SDK message/scroll renderers. Generic cards/renderers vẫn thuộc backlog platform.

C01 đi qua `/` → readiness → CopilotKit v2/CopilotChat → `/api/copilotkit` → BuiltInAgent → `src/adapters/llm/chat-model.ts`. Config/HTTP validation/masking ở `src/server/chat`, lifecycle/concurrency/deadline ở `src/adapters/agents`. Controller là owner duy nhất của transcript/draft/IDs; Stop, Retry checkpoint và New chat dùng SDK bridge, không gọi model từ UI.

C01 dùng `InMemoryAgentRunner`; hội thoại chỉ có trong phiên và reset khi reload, server restart mất runner state. **C02** thay runner qua `createChatRuntime({ runner })` và bổ sung repository/history APIs/sidebar thật. **C03/C04** bổ sung tools/context/MCP qua adapter boundaries; hiện chat text không có tools hay MCP. Docker infra có tài liệu riêng, không bắt buộc để boot C01.

`tests/helpers/chat-provider.ts` cung cấp OpenAI streaming fixture dùng chung unit/integration/browser. `chat-provider-server.ts` mở bounded test control routes ở process riêng; application không import fixture và production registry không chứa provider test. Playwright sở hữu các child servers, dùng distDirs riêng cho dev và `.next` cho built production; không reuse hay kill process ngoài test run.

`src/problem-templates/<id>` là thư mục dự kiến cho template owner: input/artifact schemas, workflow config, presenter, manifest, custom tools nếu cần, representative fixtures và page-specific UI. Chưa tạo thư mục hoặc runtime contract mới trong đợt cập nhật docs này. `src/domains` dành cho topic customization và các seeds hiện có. Template composition sử dụng core contracts hiện hành; registration đi qua server composition root.

Artifact đi qua ranh giới phải parse schema artifact, sau đó parse `data` thành `JsonValue` trước khi chuyển đến presenter hoặc UI. Chỉ URL HTTP/HTTPS hoặc `storageKey` được chấp nhận cho media; không cho phép `javascript:` hay data URL.
