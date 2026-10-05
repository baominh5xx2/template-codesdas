# Chia việc song song

Frontend bắt đầu bằng renderer và playground dựa trên contracts/fixtures, độc lập với engine. Engine/backend sau đó có thể thay fixture provider bằng `RunService` và các ports mà không đổi props block. Adapter AI, source, parser, storage, Postgres và MCP là phần tích hợp riêng.

Thứ tự ghép: (1) giữ nguyên DTO và dùng fixture API; (2) hoàn thiện registry/renderers và xác minh mọi block/state; (3) đăng ký capability cùng artifact schema và ports; (4) nối presenter/runtime vào API runs; (5) thay fixture theo từng endpoint, giữ error envelope và shape response. Domain mới dùng template và phải qua `pnpm domain:validate`.

Không sửa `src/ui` từ phía backend. Không nhân bản contracts để frontend chạy nhanh hơn. Nếu cần đổi DTO, thống nhất trước rồi cập nhật Zod schema, types suy ra, fixture và API cùng lúc. Dữ liệu demo không đại diện cho kết quả engine thật.
