# UI ownership boundary

The UI implementation belongs to the parallel UI workstream. Start with [`docs/frontend-handoff.md`](../../docs/frontend-handoff.md) and the contracts in `src/contracts/ui`; demo fixtures belong outside this directory. UI code may call server features only through HTTP boundaries and must render validated `ResultView` data. Derive per-kind props from the shared union, for example `Extract<UIBlock, { type: "chart" }>["props"]`; do not copy those shapes into UI-local types. No reusable React cards or components are part of this starter baseline.
