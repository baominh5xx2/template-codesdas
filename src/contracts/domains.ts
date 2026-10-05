import { z } from "zod";
import { HttpUrlSchema, JsonValueSchema } from "./common";
export const InputFieldSchema = z.object({ name: z.string(), label: z.string(), kind: z.enum(["text", "textarea", "upload", "select", "url-list"]), required: z.boolean(), options: z.array(z.object({ label: z.string(), value: z.string() })).optional() });
export type InputField = z.infer<typeof InputFieldSchema>;
export const DomainManifestSchema = z.object({ id: z.string(), version: z.number().int().positive(), title: z.string(), description: z.string(), branding: z.object({ name: z.string(), accent: z.string(), logoUrl: HttpUrlSchema.optional() }), surface: z.literal("workspace"), inputFields: z.array(InputFieldSchema), examples: z.array(z.object({ label: z.string(), input: JsonValueSchema })), toolNames: z.array(z.string()) });
export type DomainManifest = z.infer<typeof DomainManifestSchema>;
