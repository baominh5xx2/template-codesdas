# Capability extension contracts

Concrete capabilities implement `Capability<I,O>` from `src/core/capabilities/definition.ts`; they receive `RunContext`, validate input and output through declared schemas, and return `ArtifactDraft<O>`. The folders below document ownership and data boundaries only; none contains a placeholder algorithm. `memory`, `verification`, and `planning` are optional extension points beyond the nine baseline capabilities.

- `ingestion`: source/upload references in; `SourceCollectionData` artifact out.
- `extraction`: normalized documents in; structured JSON artifact out.
- `research`: question and source profile IDs in; source collection artifact out.
- `evidence`: normalized documents in; `EvidenceSetData` artifact out.
- `analysis`: dataset/evidence references in; `AnalysisData` artifact out.
- `scoring`: validated signals/rules in; typed score artifact out.
- `recommendation`: claim references in; `RecommendationData` artifact out.
- `analytics`: complete dataset pages and analytics query in; deterministic metrics artifact out.
- `report`: artifact references in; `ReportData` artifact out.
- `memory` (optional): scoped memory query in; validated memory artifact out.
- `verification` (optional): candidate claims and evidence IDs in; verification result artifact out.
- `planning` (optional): user input and domain manifest in; proposed typed plan artifact out.
