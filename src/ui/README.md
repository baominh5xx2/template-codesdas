# UI ownership boundary

The UI implementation belongs to the parallel UI workstream. Shared serialized block and result-view props are defined in `src/contracts/ui`; demo fixtures belong outside this directory. UI code may call server features only through HTTP boundaries and must render validated `ResultView` data. No reusable React cards or components are part of this starter baseline.
