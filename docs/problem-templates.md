# Problem templates — phần bạn xây

Đọc [ownership](build-ownership.md) trước. Bạn sở hữu trải nghiệm theo dạng bài toán, gồm FE và BE composition. Shared cards và capability implementations do platform cung cấp. Mỗi template phải có representative fixtures riêng, không dùng sales gallery làm bằng chứng engine hoạt động.

## Chốt sáu packs ưu tiên

| Pack P0 | FE bạn xây | BE flow bạn cấu hình | Shared capabilities cần |
|---|---|---|---|
| `data-dashboard` | Upload → chọn columns/filter → KPI → charts/table → insights → report | ingest dataset → infer/validate schema → stats/trend/anomaly → chart specs → analysis → report | ingestion, analytics, chart spec, analysis, report |
| `document-analyzer` | Upload → document preview → extracted fields → highlights/evidence → summary → recommendations | parse → schema extraction → classify/analyze → evidence linking → recommendations → report | ingestion, extraction, evidence, analysis, recommendation, report |
| `risk-analyzer` | Text/link/file input → risk score → factors → evidence → recommended actions | ingest → extract signals → rules/model scoring → evidence verification → recommendation → report | ingestion, extraction, scoring, evidence, verification, recommendation |
| `research-intelligence` | Query/source settings → progress → sources → findings → comparison → report | query planning → search/fetch → clean/dedupe/rank → evidence extraction → synthesis → report | planning, research, extraction, evidence, analysis, report |
| `recommendation-planner` | Preferences/constraints → candidates → comparison → recommended choice → editable plan/timeline | filter → score/rank → explain → plan under constraints → validate/adjust | recommendation, scoring, planning, evidence, report |
| `knowledge-assistant` | Knowledge upload/source selection → chat → citations → follow-up | ingest → chunk/index → retrieve → grounded answer → citation validation → follow-up | ingestion, retrieval/indexing extension, evidence, analysis + agent bridge |

P0 nghĩa là ưu tiên xây, không có nghĩa đã hoạt động. Recommendation và Planning được ghép một pack ban đầu để giảm scope; có thể tách khi hai flow cần UX/workflow khác nhau. RAG không bắt buộc pgvector từ đầu; retrieval abstraction và citation contract phải có trước khi chọn implementation.

## Mỗi template phải giao gì

- Manifest và input schema: field names, constraints, examples và tool names thống nhất với workflow.
- Namespaced artifact schemas: output có kiểu rõ, không phải object tùy ý.
- Workflow config và bindings: capability IDs/version, dependency, rules/prompt/source profile IDs; không copy engine.
- Pure presenter: output → `UIBlock[]` và các shared metadata references.
- FE page: form, layout, interactions và generic block composition. Form-specific UI đặt trong template; card dùng chung vẫn ở `src/ui`.
- Representative fixtures: success/loading/empty/error/partial/unavailable; source/evidence/dataset references phải resolve.
- Acceptance scenarios và README: dependencies sẵn/chưa sẵn, demo/live behavior, inputs/outputs, cách tích hợp.
- Custom tools nếu cần: injected ports, scoped access, typed schema, budget/abort; đăng ký qua core.

## Acceptance cho sáu packs

| Pack | Gate khi platform dependencies đã sẵn |
|---|---|
| Dashboard | CSV/XLSX hợp lệ → metric đúng bằng deterministic calculation; filter/chart/table nhất quán; report giữ source IDs. Có empty/nonnumeric/bad-file cases. |
| Document | Fields validate theo schema; highlight trỏ tới page/range có thật; thiếu evidence hiển thị insufficient. Có unsupported/oversized/malformed input cases. |
| Risk | Score có range, direction, rules/method, factors và completeness; giải thích theo signals/evidence. Thiếu dữ liệu không tự coi là low risk. |
| Research | Source provenance, dedupe và limits rõ; claim truy về evidence; search unavailable hiển thị unavailable. Không bịa source để hoàn tất report. |
| Recommendation/Planner | Ranking có tiêu chí, lý do và constraints; plan vi phạm hard constraint bị đánh dấu; đổi preferences có kết quả cập nhật nhất quán. |
| Knowledge Assistant | Answer có citations về retrieved chunks; không tìm được evidence thì trả trạng thái thiếu dữ liệu; session/workspace không đọc chéo knowledge. |

## Một template cụ thể: Risk Analyzer

Ví dụ domain thử nghiệm là scam detection; có thể đổi sang food safety/privacy bằng schema, sources và rules khác.

```text
FE do bạn compose:
RiskInputForm
  → WorkspaceShell + ProgressCard
  → RiskScoreCard + WarningCard
  → signal table + EvidenceCard/SourceCard
  → RecommendationCard + ReportView

BE do bạn định nghĩa:
input schema
  → ingestion capability
  → extraction capability (ScamSignalsSchema + domain prompt)
  → scoring capability (domain rules + optional model enrichment)
  → evidence/verification capability
  → recommendation capability
  → report capability
  → presenter → shared UIBlock[]
```

Ví dụ artifact kinds: `scam/signals`, `scam/risk`, `scam/recommendations`. Platform cung cấp parse/extract/score primitives và execution; bạn định nghĩa signal taxonomy, weights/thresholds, evidence policy và cách ghép màn hình. Không mặc định kết hợp rule và model bằng phép cộng; score phải có phương pháp được domain quy định. Không có model/source thì flow chỉ chạy phần được hỗ trợ và báo partial/unavailable đúng capability.

## Danh sách 15 dạng bài toán

| Dạng bài toán | Priority / pack | Sản phẩm cần thêm |
|---|---|---|
| 1. Data Dashboard / Visual Analytics | P0 dashboard | Dataset exploration, filtering, KPI/chart/table/report |
| 2. Document Analyzer | P0 document | Extraction/classification/highlights/recommendations |
| 3. Risk / Safety Analyzer | P0 risk | Signals/score/evidence/actions |
| 4. Research Intelligence | P0 research | Sources/comparison/synthesis/report |
| 5. Recommendation Engine | P0 recommendation-planner | Candidate ranking và explainable choice |
| 6. Planning / Optimization | P0 recommendation-planner | Constraints/timeline/adjustment; tách pack nếu cần |
| 7. Knowledge Assistant / RAG | P0 knowledge | Retrieval/chat/citations/follow-up |
| 8. Verification / Fact-checking | P1 | Claim breakdown/evidence/verdict/explanation |
| 9. Workflow Agent | P1 | Goal → tools → approval khi có side effect → result |
| 10. Awareness / Education Experience | P1 | Lesson/quiz/scenario/feedback/score |
| 11. Geo / Local Explorer | P2 | Map/local search/nearby ranking |
| 12. Comparison / Decision Support | P2 | Criteria/options/trade-offs/decision explanation |
| 13. Case Management / Investigation | P2 | Case records/evidence/timeline/status |
| 14. Personalized Coach | P2 | Goals/history/check-ins/plan adjustment |
| 15. Content/Campaign Generator | P2 | Brief/variants/editor/preview/review/export |

Lesson/quiz, case records, coach history và content editor có thể cần shared contracts mới. Bạn đề xuất nhu cầu cho platform; không tự thêm executable block types hoặc bypass registry. Geo/voice/vector retrieval phụ thuộc feature readiness, không bật chỉ vì template có tên tương ứng.

## Thứ tự bạn bắt đầu

1. Data Dashboard: có dataset/chart/table fixtures để compose ngay.
2. Document Analyzer và Risk Analyzer: dùng chung evidence/source/report surfaces.
3. Research Intelligence: tái dùng surfaces trên, thêm source collection/comparison.
4. Recommendation/Planner: thêm preference/constraint interaction.
5. Knowledge Assistant: ghép khi retrieval và agent bridge có contract/provider usable.

Bạn có thể viết fixtures, form và presenter trước capability live. Chỉ đánh dấu template hoàn thành end-to-end sau khi generic run API thực thi được workflow và acceptance cases pass. Catalog registration ở server được phối hợp với owner platform; không import server definition vào client page.
