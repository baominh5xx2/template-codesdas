# Bàn giao frontend

Phân công hiện hành: owner platform xây generic UI blocks trong `src/ui`; bạn xây FE composition và BE workflow của problem templates. Đọc [build-ownership.md](build-ownership.md) rồi [problem-templates.md](problem-templates.md) trước. File này mô tả shared rendering contracts cho cả hai owner, không còn giao toàn bộ generic UI cho template owner.

Frontend có thể bắt đầu từ `/playground`, `GET /api/domains` và các fixture tại `GET /api/demo/:domainId`. Mỗi bundle chứa `view`, `snapshot`, `sources`, `evidence`, `claims`, và `datasets`; đây là các dữ liệu chung cho renderer, nguồn trích dẫn và phân trang. Đọc trực tiếp schema tại `src/contracts/ui/blocks.ts`, không khai báo lại props trong UI.

Bốn archetype hiện chia sẻ cùng một bộ dữ liệu sales synthetic và gallery fixture gồm 19 block để kiểm tra các hợp đồng renderer. Đây không phải các phân tích đại diện cho từng domain. Fixture riêng, đại diện hơn có thể được bổ sung khi hành vi nghiệp vụ thực tế được xây dựng.

## Hợp đồng renderer

```ts
type BlockRenderContext = {
  snapshot: RunSnapshot;
  sources: SourceRef[];
  evidence: Evidence[];
  claims: Claim[];
  datasets: Record<string, DatasetPage>;
  artifacts: Artifact<unknown>[];
  onAction: (actionId: "export.markdown" | "export.json" | "retry-run" | "focus-artifact", artifactId?: string) => void;
};
type BlockRenderer = (block: UIBlock, context: BlockRenderContext) => React.ReactNode;
```

Đây là handoff shape, các DTO bên trong vẫn import từ `src/contracts`. Derive props theo block bằng `Extract<UIBlock, { type: "chart" }>["props"]` thay vì chép interface. Renderer tra source/evidence theo ID để mở drawer; chart/table đọc `datasetId`, chart dùng `xKey` và `series.key`, table gửi `offset`/`limit` tới rows API và hiển thị `total`. `artifacts` lấy từ `snapshot.artifacts`. UI nhận block thuần JSON, không evaluate JSX hay code được sinh từ model.

## 19 block đã duyệt

| Block | Props chính |
|---|---|
| `metric` | label, value, unit?, delta?, sourceIds |
| `chart` | title, kind, datasetId, xKey, series, aggregation, sourceIds |
| `table` | title, datasetId, columns, pageSize |
| `insight` | title, claimIds, severity |
| `recommendation` | title, reasonClaimIds, priority, actionIds |
| `risk` | score, min, max, direction, level, factorIds, method, completeness |
| `warning` | title, message, severity |
| `source` | sourceIds |
| `evidence` | claimId, evidenceIds |
| `verdict` | claimId, support, reason |
| `timeline` | items: id, title, description?, at? |
| `progress` | stepIds |
| `action` | label, actionId, artifactId? |
| `map` | places, available, reason? |
| `place` | name, lat, lng, description?, sourceIds |
| `comparison` | criteria, options |
| `report-section` | title, blockIds |
| `markdown` | content |
| `media` | kind, storageKey? hoặc URL HTTP/HTTPS, alt |

Action allowlist hiện tại là `export.markdown`, `export.json`, `retry-run`, `focus-artifact`. UI kiểm tra allowlist; không chạy tên hàm tùy ý. State fixtures cho cả sáu trạng thái được API cung cấp bằng query `state`.

## Phạm vi sở hữu và tích hợp

Platform sở hữu `src/ui/{primitives,blocks,registry,renderers,agent,forms,shells,hooks,playground}`. Template owner compose các component đó, viết form/layout riêng trong proposed `src/problem-templates/<id>/ui` và thêm template pages theo quy ước `.client.ts[x]`. Thư mục problem templates chưa được scaffold; chưa có generic component implementations để import hôm nay.

Giữ `src/contracts` framework-free. Thay đổi shared schema cần phối hợp, cập nhật Zod/types/fixtures/API consumers cùng lúc. Template owner cũng viết input/artifact schemas riêng, workflow bindings và pure presenter; capability implementation, runner, adapters và infra thuộc platform. Không fetch/gọi model/ghi DB trong presenter hoặc generic card.
