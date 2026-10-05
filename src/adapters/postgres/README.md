# PostgreSQL adapter

Future input/output: `RunRepository`, `ArtifactRepository`, `UploadRepository`, and `DatasetRepository` from `src/core/ports/definition.ts`. Owns SQL schema, scoped queries, transactions, and mapping persisted rows into canonical DTOs. No database implementation is bound here.
