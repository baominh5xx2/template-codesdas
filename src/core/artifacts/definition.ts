import type { DomainResultPublicationCandidate, DomainResultPublication } from "@/contracts/domain-results";

/** Implementations must persist every candidate record atomically and enforce key/fingerprint idempotency. */
export interface DomainResultPublicationPort {
  publish(candidate: DomainResultPublicationCandidate): Promise<DomainResultPublication>;
}
