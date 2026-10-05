import { ArtifactEnvelopeSchema, type Artifact } from "@/contracts/artifacts";
import type { Schema } from "@/contracts/common";
export interface ArtifactSchemaRegistry { register<T>(kind: string, version: number, schema: Schema<T>): void; has(kind: string, version: number): boolean; parse(artifact: unknown): Artifact<unknown> }
export function createArtifactRegistry(): ArtifactSchemaRegistry {
  const schemas = new Map<string, Schema<unknown>>();
  const key = (kind: string, version: number) => `${kind}@${version}`;
  return {
    register<T>(kind: string, version: number, schema: Schema<T>) {
      if (!kind || !Number.isInteger(version) || version < 1) throw new Error("artifact_schema_invalid");
      const k = key(kind, version); if (schemas.has(k)) throw new Error("artifact_schema_duplicate");
      schemas.set(k, schema as Schema<unknown>);
    },
    has: (kind, version) => schemas.has(key(kind, version)),
    parse(value) {
      const envelope = ArtifactEnvelopeSchema.parse(value);
      const schema = schemas.get(key(envelope.kind, envelope.version));
      if (!schema) throw new Error("artifact_schema_unregistered");
      return { ...envelope, data: schema.parse(envelope.data) };
    },
  };
}
