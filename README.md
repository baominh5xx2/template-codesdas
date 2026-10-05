# Hackathon Starter Kit

Đây là baseline Next.js/TypeScript chạy độc lập để frontend bắt đầu tích hợp ngay. Domain manifests, hợp đồng JSON, fixture và API demo không cần `.env`, database, model, API key hay dịch vụ ngoài. Mọi kết quả demo đều ghi rõ là dữ liệu synthetic; route chạy workflow trả `501 feature_unavailable` cho đến khi engine thật được tích hợp.

## Bắt đầu

Cài **Bun 1.4.2** và **Node 24 LTS**. Bun quản lý dependencies và chạy scripts; `bun.lock` là lockfile duy nhất của repo. Next.js và Vitest vẫn chạy trên Node qua các scripts hiện có.

```sh
bun install --frozen-lockfile
bun run dev
```

Mở `/playground` để xem bốn fixture và các API liên quan. Kiểm tra baseline bằng:

```sh
bun run domain:validate
bun run check
bun run test
bun run build
```

Thêm dependencies bằng `bun add --exact <package>` hoặc `bun add --dev --exact <package>`. Chạy unit tests bằng `bun run test` để dùng Vitest theo cấu hình repo.

## Docker local: app + PostgreSQL + pgEdge MCP

```sh
bun run docker:setup
bun run docker:up
bun run docker:check
```

App mở tại [localhost:3100](http://127.0.0.1:3100); DB ở `127.0.0.1:55432`, MCP tại `http://127.0.0.1:18080/mcp/v1`. Setup tự tạo credentials riêng trong `.env.docker` được gitignore. Xem [hướng dẫn Docker](docs/docker-local.md) cho roles, local model, lifecycle và giới hạn tích hợp. MCP tools/history chưa được nối vào chat chỉ bằng việc bật Compose.

## Tích hợp frontend

Đọc [tài liệu bàn giao frontend](docs/frontend-handoff.md), [API](docs/api-contracts.md), [bản đồ cấu trúc](docs/code-structure.md) và [kế hoạch làm song song](docs/parallel-work.md). `src/ui/README.md` đánh dấu khu vực do frontend sở hữu. Client component trong `src/app` dùng hậu tố `.client.ts` hoặc `.client.tsx`.

## Giới hạn của baseline

Bốn archetype hiện dùng chung một bộ dữ liệu sales synthetic và gallery fixture gồm 19 block để kiểm tra các hợp đồng renderer. Các fixture này không phải phân tích đại diện cho từng domain. Có thể bổ sung fixture riêng, đại diện hơn khi hành vi nghiệp vụ thực tế được xây dựng. Các domain cards, xử lý upload, lưu trữ history/artifacts, phân tích nghiệp vụ và ingestion chưa có trong baseline fixture. Compose đã cung cấp DB/MCP local; nối MCP tools vào agent và durable history là phần tích hợp tiếp theo. API run cố ý trả unavailable cho đến khi một capability thật được đăng ký. Demo fixtures chỉ hoạt động trong development/test; production trả unavailable.
