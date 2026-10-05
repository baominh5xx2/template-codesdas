# Hackathon Starter Kit

**Execution update — user directive 2026-10-05:** Starter độc lập. Build/test/demo không cần API key hoặc tài liệu của BTC; không đọc repo thi hay cấu hình của họ. Demo adapter là default rõ nhãn cho local development; optional generic gateway adapter để cắm sau, không có live-AI gate bắt buộc trong baseline. Thiếu external gateway là unavailable, không phải lý do dừng triển khai. Production vẫn không tự bật fixture.

Repo chuẩn bị độc lập cho một bộ khung AI app có thể ráp theo đề thi.

Trạng thái: **design/spec v0.3 + implementation plans**. Repo hiện chứa tài liệu kiến trúc và kế hoạch; chưa có app chạy được.

Đọc [spec kiến trúc plug-and-play](docs/superpowers/specs/2026-10-05-hackathon-plug-and-play-design.md).

Đọc [master implementation plan](docs/superpowers/plans/2026-10-05-hackathon-starter-master-plan.md), gồm 24 tasks theo bốn phase:

1. [Document foundation](docs/superpowers/plans/2026-10-05-01-document-foundation.md) — contracts, storage, AI, workflow, upload và report.
2. [Dataset + pgEdge local](docs/superpowers/plans/2026-10-05-02-dataset-pgedge.md) — CSV/XLSX, analytics, MCP và chart/table.
3. [Agent + UI playground](docs/superpowers/plans/2026-10-05-03-agent-playground.md) — chat dùng cùng engine/artifacts, đủ 19 UI block types.
4. [Research + risk + domain authoring](docs/superpowers/plans/2026-10-05-04-research-risk-domain-authoring.md) — source profiles, rules, template, memory, 11 playbooks và rehearsal.

Mỗi task ghi files, interfaces, tests, lệnh RED/GREEN và local commit. Lệnh trong plan dành cho execution; chưa chạy scaffold, Docker hay live integration ở lượt planning.

Stack mục tiêu: Next.js + TypeScript + Next.js BFF + CopilotKit runtime + Postgres Docker + Drizzle + optional AI Gateway + [pgEdge Postgres MCP](https://github.com/pgedge/pgedge-postgres-mcp) host local.

pgEdge MCP là service local được chọn cho agent khám phá schema/truy vấn dữ liệu qua backend. Drizzle quản lý migrations và ghi dữ liệu ứng dụng. Tắt LLM proxy/embedding của pgEdge để mọi model call tiếp tục qua optional AI Gateway.

Nguyên tắc kiến trúc: **Domain Pack → workflow tuần tự → capability → typed artifacts → presenter → UI blocks**. Route và agent dùng chung `core/services/`.

Mỗi domain chủ yếu là schema, prompt, workflow, source profiles, presenter và branding; rules/custom tools chỉ thêm khi cần. Chuẩn bị problem archetypes thay vì nhiều domain dự đoán. UI có 19 block types cố định và playground bằng fixture.

P0 chạy workflow trong request được await, lưu trạng thái và artifacts sau từng step. Worker, queue và resume bền vững là P1.

## Client component boundary

Client components placed under `src/app` must use the `.client.ts` or
`.client.tsx` suffix so the ESLint import boundary applies to them. Other App
Router files follow the server component default. Shared UI code belongs under
`src/ui`.

Repo này tách biệt với repo nộp bài của AI. Việc chuyển source sang repo nộp bài cần một yêu cầu riêng của người dùng. Không cấu hình remote tự động.
