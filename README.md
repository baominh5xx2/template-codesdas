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

## Tích hợp frontend

Đọc [tài liệu bàn giao frontend](docs/frontend-handoff.md), [API](docs/api-contracts.md), [bản đồ cấu trúc](docs/code-structure.md) và [kế hoạch làm song song](docs/parallel-work.md). `src/ui/README.md` đánh dấu khu vực do frontend sở hữu. Client component trong `src/app` dùng hậu tố `.client.ts` hoặc `.client.tsx`.

## Giới hạn của baseline

Bốn archetype hiện dùng chung một bộ dữ liệu sales synthetic và gallery fixture gồm 19 block để kiểm tra các hợp đồng renderer. Các fixture này không phải phân tích đại diện cho từng domain. Có thể bổ sung fixture riêng, đại diện hơn khi hành vi nghiệp vụ thực tế được xây dựng. Chưa có component UI, xử lý upload, lưu trữ, phân tích nghiệp vụ, ingestion, MCP hay gọi AI. API run cố ý trả unavailable cho đến khi một capability thật được đăng ký. Demo fixtures chỉ hoạt động trong development/test; production trả unavailable.
