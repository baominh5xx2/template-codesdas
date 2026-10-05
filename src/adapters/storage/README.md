# Object storage adapter

Future input/output: `StoragePort` (`write`, `read`, `remove`) from `src/core/ports/definition.ts`. Owns storage provider configuration and byte operations. It must not choose business artifact formats; no storage implementation is bound here.
