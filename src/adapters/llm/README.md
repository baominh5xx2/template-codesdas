# Model adapter

Future input/output: `LlmPort.complete(LlmRequest, AbortSignal)` and `GatewayFeatures` from `src/core/ports/definition.ts`. Owns provider request mapping, response handling, and feature reporting. No model SDK or credentials are loaded in the starter.
