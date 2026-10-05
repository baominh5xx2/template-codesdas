# Source adapter

Future input/output: `SourcePort.fetch(url, profile, signal)` and `search(query, profile, signal)` from `src/core/ports/definition.ts`. Owns HTTP/source-provider integration under an injected `SourceProfile`; the catalog is empty by default and no fetcher is bound.
