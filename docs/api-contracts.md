# API demo

Các response thành công dùng đúng Zod DTO trong `src/contracts`. Demo chỉ có dữ liệu synthetic và không thực hiện network fetch, model call hay truy vấn database. Trong production, fixture endpoints trả `503 feature_unavailable`.

| Method và path | Kết quả |
|---|---|
| `GET /api/domains` | `{ domains: DomainManifest[] }` |
| `GET /api/demo/:domainId?state=success` | `DemoBundle`: nhãn demo, `ResultView`, `RunSnapshot`, sources, evidence, claims và datasets |
| `GET /api/demo/datasets/:datasetId/rows?offset=0&limit=25` | `DatasetPage`; offset từ 0, limit từ 1 đến 100, tổng số dòng giữ nguyên |
| `POST /api/runs` | `501 feature_unavailable`; không tạo bản ghi hoặc giả vờ đã enqueue |

Các state fixture: `loading`, `empty`, `error`, `success`, `partial`, `unavailable`. Domain hoặc dataset không tồn tại trả `404 not_found`; query/state sai trả `400 invalid_request`. Mọi lỗi có dạng `{error:{code,message,retryable,traceId}}` và không đưa exception nội bộ ra response.

`DemoBundle` không định nghĩa lại contracts. Zod kiểm tra schema từng thành phần và các ID liên kết giữa block, dataset/columns, source, evidence, claim, step, action và report section.
