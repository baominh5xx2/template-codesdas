import { expect, it } from "vitest";
import { DomainManifestSchema } from "@/contracts/domains";
import { SearchHitSchema, SourceRefSchema } from "@/contracts/sources";

const source = {
  id: "source-1",
  kind: "url",
  title: "Example source",
  retrievedAt: "2026-10-05T00:00:00.000Z",
  contentHash: "sha256:example",
};

const manifest = {
  id: "example-domain",
  version: 1,
  title: "Example",
  description: "Example domain manifest",
  branding: { name: "Example", accent: "#123456" },
  surface: "workspace",
  inputFields: [{ name: "query", label: "Query", kind: "text", required: true }],
  examples: [{ label: "Example query", input: { query: "hello" } }],
  toolNames: [],
};

it("keeps source and branding URL fields optional", () => {
  expect(SourceRefSchema.safeParse(source).success).toBe(true);
  expect(SearchHitSchema.safeParse({ title: "Example search result" }).success).toBe(false);
  expect(DomainManifestSchema.safeParse(manifest).success).toBe(true);
});

it("accepts HTTP and HTTPS URLs for source, search, and branding links", () => {
  for (const url of ["http://example.test/source", "https://example.test/source"]) {
    expect(SourceRefSchema.safeParse({ ...source, url }).success).toBe(true);
    expect(SearchHitSchema.safeParse({ url, title: "Example search result" }).success).toBe(true);
    expect(DomainManifestSchema.safeParse({ ...manifest, branding: { ...manifest.branding, logoUrl: url } }).success).toBe(true);
  }
});

it("rejects unsafe and malformed source, search, and branding URLs", () => {
  for (const url of ["javascript:alert(1)", "data:text/html,hello", "file:///tmp/source", "not a URL"]) {
    expect(SourceRefSchema.safeParse({ ...source, url }).success).toBe(false);
    expect(SearchHitSchema.safeParse({ url, title: "Example search result" }).success).toBe(false);
    expect(DomainManifestSchema.safeParse({ ...manifest, branding: { ...manifest.branding, logoUrl: url } }).success).toBe(false);
  }
});
