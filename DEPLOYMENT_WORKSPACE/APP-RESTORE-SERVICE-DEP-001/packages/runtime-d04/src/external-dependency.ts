import type { QualifiedExternalRecordPayload } from "@appts-restore-service/contracts";

export const EXTERNAL_DEPENDENCY_ADVERSE_STATUSES = Object.freeze([
  "FAILURE",
  "CANCELLATION",
  "NO_SHOW",
  "ACCESS_DENIAL",
  "EXTERNAL_WAITING",
] as const);

export type ExternalDependencyAdverseStatus = (typeof EXTERNAL_DEPENDENCY_ADVERSE_STATUSES)[number];

export interface ExternalDependencyEscalationContext {
  readonly sourceEscalationObligationRef: string;
  readonly routeRefCode: string;
  readonly interventionDueBasisRef?: string;
}

export interface ExternalDependencyControlMapping {
  readonly mappingProfileRef: string;
  readonly ticketId: string;
  readonly dependencyTypeRef: string;
  readonly dependencyStatusRef: ExternalDependencyAdverseStatus;
  readonly responsibilityId: string;
  readonly obligationOwnerRef: string;
  readonly blockerOwnerRef: string;
  readonly nextControlOwnerRef: string;
  readonly blockedWorkRef: string;
  readonly waitingReasonRef: string;
  readonly blockerReasonRef: string;
  readonly obligationClassRef: string;
  readonly nextControlClassRef: string;
  readonly dueBasisRef?: string;
  readonly dueAt?: string;
  readonly nextEvaluationAt?: string;
  readonly escalation?: ExternalDependencyEscalationContext;
}

export interface ExternalDependencyControlPlan {
  readonly ticketId: string;
  readonly sourceQualifiedExternalRecordRef: string;
  readonly sourceSystemRef: string;
  readonly sourceVersionRef: string;
  readonly dependencySubjectRef: string;
  readonly dependencyTypeRef: string;
  readonly dependencyStatusRef: ExternalDependencyAdverseStatus;
  readonly effectiveAt: string;
  readonly responsibilityId: string;
  readonly responsibilityTransferred: false;
  readonly obligationOwnerRef: string;
  readonly blockerOwnerRef: string;
  readonly nextControlOwnerRef: string;
  readonly blockedWorkRef: string;
  readonly waitingReasonRef: string;
  readonly blockerReasonRef: string;
  readonly obligationClassRef: string;
  readonly nextControlClassRef: string;
  readonly dueBasisRef?: string;
  readonly dueAt?: string;
  readonly nextEvaluationAt?: string;
  readonly currentnessRef: "CURRENT";
  readonly mappingProfileRef: string;
  readonly escalation?: ExternalDependencyEscalationContext;
}

function requireNonEmpty(value: string, code: string): void {
  if (value.length === 0) throw new Error(code);
}

function isAdverseStatus(value: string): value is ExternalDependencyAdverseStatus {
  return (EXTERNAL_DEPENDENCY_ADVERSE_STATUSES as readonly string[]).includes(value);
}

/**
 * D-04 realization of the accepted SG-RUN rule for qualified adverse
 * external-dependency updates. Source-native interpretation remains controlled
 * configuration; this function creates no source mapping, Product policy, or
 * responsibility transfer.
 */
export function deriveExternalDependencyControlPlan(
  record: QualifiedExternalRecordPayload,
  mapping: ExternalDependencyControlMapping,
): ExternalDependencyControlPlan {
  if (record.qualification_result_ref !== "QUALIFIED") throw new Error("INT_RUN_TD_01_NOT_QUALIFIED");
  if (record.currentness_ref !== "CURRENT") throw new Error("INT_RUN_TD_01_NOT_CURRENT");
  if (record.contradiction_ref !== undefined) throw new Error("INT_RUN_TD_01_CONTRADICTED");
  if (!isAdverseStatus(mapping.dependencyStatusRef)) throw new Error("EXTERNAL_DEPENDENCY_STATUS_NOT_ACCEPTED_ADVERSE_CLASS");
  if (record.subject_ref.length === 0) throw new Error("EXTERNAL_DEPENDENCY_SUBJECT_REQUIRED");

  for (const [value, code] of [
    [mapping.mappingProfileRef, "EXTERNAL_DEPENDENCY_MAPPING_PROFILE_REQUIRED"],
    [mapping.ticketId, "EXTERNAL_DEPENDENCY_TICKET_REQUIRED"],
    [mapping.dependencyTypeRef, "EXTERNAL_DEPENDENCY_TYPE_REQUIRED"],
    [mapping.responsibilityId, "EXTERNAL_DEPENDENCY_RESPONSIBILITY_REQUIRED"],
    [mapping.obligationOwnerRef, "EXTERNAL_DEPENDENCY_OBLIGATION_OWNER_REQUIRED"],
    [mapping.blockerOwnerRef, "EXTERNAL_DEPENDENCY_BLOCKER_OWNER_REQUIRED"],
    [mapping.nextControlOwnerRef, "EXTERNAL_DEPENDENCY_NEXT_CONTROL_OWNER_REQUIRED"],
    [mapping.blockedWorkRef, "EXTERNAL_DEPENDENCY_BLOCKED_WORK_REQUIRED"],
    [mapping.waitingReasonRef, "EXTERNAL_DEPENDENCY_WAITING_REASON_REQUIRED"],
    [mapping.blockerReasonRef, "EXTERNAL_DEPENDENCY_BLOCKER_REASON_REQUIRED"],
    [mapping.obligationClassRef, "EXTERNAL_DEPENDENCY_OBLIGATION_CLASS_REQUIRED"],
    [mapping.nextControlClassRef, "EXTERNAL_DEPENDENCY_NEXT_CONTROL_CLASS_REQUIRED"],
  ] as const) requireNonEmpty(value, code);

  if (mapping.escalation !== undefined) {
    requireNonEmpty(mapping.escalation.sourceEscalationObligationRef, "EXTERNAL_DEPENDENCY_ESCALATION_OBLIGATION_REQUIRED");
    requireNonEmpty(mapping.escalation.routeRefCode, "EXTERNAL_DEPENDENCY_ESCALATION_ROUTE_REQUIRED");
  }

  const effectiveAt = record.source_time ?? record.received_at;
  return Object.freeze({
    ticketId: mapping.ticketId,
    sourceQualifiedExternalRecordRef: record.qualified_external_record_id,
    sourceSystemRef: record.source_system_ref_id,
    sourceVersionRef: record.external_record_version_ref,
    dependencySubjectRef: record.subject_ref,
    dependencyTypeRef: mapping.dependencyTypeRef,
    dependencyStatusRef: mapping.dependencyStatusRef,
    effectiveAt,
    responsibilityId: mapping.responsibilityId,
    responsibilityTransferred: false as const,
    obligationOwnerRef: mapping.obligationOwnerRef,
    blockerOwnerRef: mapping.blockerOwnerRef,
    nextControlOwnerRef: mapping.nextControlOwnerRef,
    blockedWorkRef: mapping.blockedWorkRef,
    waitingReasonRef: mapping.waitingReasonRef,
    blockerReasonRef: mapping.blockerReasonRef,
    obligationClassRef: mapping.obligationClassRef,
    nextControlClassRef: mapping.nextControlClassRef,
    ...(mapping.dueBasisRef === undefined ? {} : { dueBasisRef: mapping.dueBasisRef }),
    ...(mapping.dueAt === undefined ? {} : { dueAt: mapping.dueAt }),
    ...(mapping.nextEvaluationAt === undefined ? {} : { nextEvaluationAt: mapping.nextEvaluationAt }),
    currentnessRef: "CURRENT" as const,
    mappingProfileRef: mapping.mappingProfileRef,
    ...(mapping.escalation === undefined ? {} : { escalation: mapping.escalation }),
  });
}
