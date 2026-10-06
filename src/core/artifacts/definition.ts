import type { DomainResultPublicationCandidate, DomainResultPublication } from "@/contracts/domain-results";

/**
 * C02 implements this with one database transaction containing the result run,
 * artifact, scoped binding, immutable ResultView, and publication outbox reference.
 * The unique key is (workspaceId,userId,threadId,agentRunId,toolCallId,bindingId).
 * A matching key and semantic fingerprint MUST return the original publication
 * and IDs; a matching key with a changed fingerprint MUST reject with
 * `domain_result_publication_conflict`. No record may be written on conflict.
 */
export interface DomainResultPublicationPort {
  publish(candidate: DomainResultPublicationCandidate): Promise<DomainResultPublication>;
}
