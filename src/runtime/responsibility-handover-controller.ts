import type { ResponsibilityContext } from "../contracts/ce-di.js";
import type { ResponsibilityHandoverEvaluation, ResponsibilityHandoverRecord } from "../contracts/b6.js";

export function evaluateResponsibilityHandover(
  current: ResponsibilityContext,
  handover: ResponsibilityHandoverRecord,
): ResponsibilityHandoverEvaluation {
  const reasons: string[] = [];
  if (handover.fromResponsibilityRef !== current.responsibilityRef) reasons.push("handover_source_mismatch");
  if (!handover.accepted) reasons.push("handover_not_accepted");
  if (!handover.confirmedEffective) reasons.push("handover_not_confirmed_effective");
  if (!handover.effectiveTime) reasons.push("handover_effective_time_missing");
  if (handover.failedOrTimedOut) reasons.push("handover_failed_or_timed_out");
  if (
    handover.scopeRef.situationId !== current.scopeRef.situationId ||
    handover.scopeRef.subjectType !== current.scopeRef.subjectType ||
    handover.scopeRef.subjectId !== current.scopeRef.subjectId
  ) reasons.push("handover_scope_mismatch");

  if (reasons.length > 0) {
    return {
      kind: "RESPONSIBILITY_UNCHANGED",
      current,
      interventionObligation: handover.failedOrTimedOut,
      reasons,
    };
  }

  const next: ResponsibilityContext = {
    responsibilityRef: `${current.responsibilityRef}@${handover.handoverRef}`,
    scopeRef: current.scopeRef,
    holderPersonRef: handover.proposedHolderPersonRef,
    roleRef: handover.proposedRoleRef,
    assignmentRef: handover.proposedAssignmentRef,
    dutyRef: handover.proposedDutyRef,
    availabilityRef: handover.proposedAvailabilityRef,
    authorityBasisRef: handover.proposedAuthorityBasisRef,
    effectiveTime: handover.effectiveTime!,
    currentness: { status: "CURRENT", basisRef: handover.handoverRef },
    provenance: { sourceRefs: [...handover.evidenceRefs], chainRefs: [current.responsibilityRef] },
  };

  return {
    kind: "TRANSFER_EFFECT",
    previous: current,
    next,
    handoverRef: handover.handoverRef,
    evidenceRefs: handover.evidenceRefs,
  };
}
