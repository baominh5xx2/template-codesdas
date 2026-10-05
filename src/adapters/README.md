# Adapter boundary

Adapters implement the ports declared in `src/core/ports/definition.ts` and are wired by the server container. Keep provider SDKs, network clients, database details, and parser dependencies inside this layer. This starter binds no external engines; each adapter README states the future port and ownership boundary.
