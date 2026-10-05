# Bản đồ cấu trúc code

Starter dùng một luồng rõ ràng: domain định nghĩa input và workflow; capability tương lai nhận `RunContext` và ports; artifacts giữ dữ liệu JSON có provenance; presenter biến dữ liệu thành `ResultView`; frontend render các `UIBlock` đã định kiểu. Contracts hiện hành trong `src/contracts` là nguồn sự thật cho kiểu dữ liệu. Không tạo bản sao type ở UI hay domain.

`src/domains/catalog.client.ts` xuất manifests an toàn cho client. `src/domains/catalog.server.ts` đăng ký definitions và gọi validator với source/tool/artifact catalogs được inject. `src/domains/_template` là điểm bắt đầu cho domain mới. Bốn thư mục trong `src/domains/examples` cho thấy các archetype: document review, dataset analysis, research report và risk analyzer. Workflow hiện rỗng; chưa có capability nghiệp vụ giả lập.

`src/demo` chứa schema của bundle, manifests và dữ liệu synthetic dùng chung. `src/app/api` chỉ cung cấp read-only fixtures và các endpoint đã có contract. `src/ui` thuộc phạm vi frontend và hiện chỉ có README. Adapters, capabilities, persistence, model và MCP được để trống cho phần tích hợp sau.

Artifact đi qua ranh giới phải parse schema artifact, sau đó parse `data` thành `JsonValue` trước khi chuyển đến presenter hoặc UI. Chỉ URL HTTP/HTTPS hoặc `storageKey` được chấp nhận cho media; không cho phép `javascript:` hay data URL.
