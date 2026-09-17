import type { DependencyEvaluation, DependencyWaitingRecord } from "../contracts/b6.js";

export function evaluateDependencyWaiting(record: DependencyWaitingRecord): DependencyEvaluation {
  const reasons: string[] = [];
  if (record.currentness.status !== "CURRENT") reasons.push("dependency_basis_not_current");
  if (!record.satisfied) reasons.push("required_condition_unsatisfied");
  if (record.satisfied && record.satisfactionEvidenceRefs.length === 0) reasons.push("satisfaction_evidence_missing");

  return {
    dependencyRef: record.dependencyRef,
    blocked: reasons.length > 0,
    blockedActionIds: [...record.blockedActionIds],
    requiredCapabilityOrAuthorityRefs: [...record.requiredCapabilityOrAuthorityRefs],
    alternateLawfulPathRefs: [...record.alternateLawfulPathRefs],
    escalationObligationRefs: [...record.escalationObligationRefs],
    communicationObligationRefs: [...record.communicationObligationRefs],
    reasons,
  };
}

export function dependencyCanRelease(record: DependencyWaitingRecord): boolean {
  return record.currentness.status === "CURRENT" && record.satisfied && record.satisfactionEvidenceRefs.length > 0;
}
