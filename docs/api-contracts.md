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

## Chat C01

| Method và path | Contract |
|---|---|
| `GET /api/chat/readiness` | `{ available: boolean, agentId: "default" }`; chỉ báo config hợp lệ, không probe model hoặc trả credentials |
| `GET /api/copilotkit/info` | CopilotKit v2 discovery khi có config; nếu unavailable trả `503 {code:"chat_unavailable",message:"Chưa kết nối"}` |
| `POST /api/copilotkit/agent/default/run` | AG-UI RunAgentInput với UUID thread/run/message IDs; trả stream qua runtime/BuiltInAgent/model adapter |
| `POST /api/copilotkit/agent/default/stop` | SDK stop transport cho run đang chạy |

Chat chỉ dùng `CHAT_MODEL_BASE_URL`, `CHAT_MODEL_ID`, và optional `CHAT_MODEL_API_KEY` ở server. Mutation yêu cầu same-origin. Request giới hạn 256 KiB, user input 8000 ký tự, một run đồng thời, deadline 120 giây, tối đa 1 model step/2048 output tokens, không tự retry. Không có provider/demo fallback.

Mọi lỗi kỹ thuật được mask bằng copy **`Chưa kết nối`** trong response/stream và một notice trong chat. Diagnostics chỉ giữ code, phase, trace/run ID và duration; không giữ credentials, prompt/model output hoặc provider error. Readiness false không khởi động SDK run và draft vẫn nhập được. Production giữ demo APIs ở `503` và business `/api/runs` ở `501`.

`bun run chat:smoke` kiểm tra server đang chạy; `CHAT_SMOKE_URL` mặc định `http://127.0.0.1:3100`. Script không boot provider hay lấy credentials từ app; summary chỉ readiness/result/check count. Browser acceptance dùng provider OpenAI wire fixture trong test process riêng ở loopback 4310, không phải live public model.
