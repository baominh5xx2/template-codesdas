import { DomainManifestSchema } from "@/contracts/domains";
import { domains } from "@/domains/catalog.server";

export function GET(): Response {
  const manifests = domains.map(domain => DomainManifestSchema.parse(domain.manifest));
  return Response.json({ domains: manifests });
}
