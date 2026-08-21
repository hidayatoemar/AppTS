import { evaluateAdmission, type AdmissionAssessment, type PredicateResult } from "./admission.ts";
import { captureIntake, type PreTicketCase } from "./intake.ts";

/** Exact CF-02 construction-facing identity. */
export const PRE_TICKET_ADMISSION_CONTRACT = "APPTS.CORE.D01.PRETICKET_ADMISSION" as const;
export const PRE_TICKET_ADMISSION_VERSION = "1.0.0" as const;
export const PRE_TICKET_ADMISSION_PROFILE = "APPTS.CORE.D01.PRETICKET_ADMISSION.PROFILE.1.0.0" as const;
export const PRE_TICKET_SUBMISSION = "APPTS.CORE.D01.PRETICKET_ADMISSION.SUBMISSION" as const;

export interface PreTicketSubmission {
  readonly contractRef: typeof PRE_TICKET_ADMISSION_CONTRACT;
  readonly semanticVersion: typeof PRE_TICKET_ADMISSION_VERSION;
  readonly profileRef: typeof PRE_TICKET_ADMISSION_PROFILE;
  readonly messageId: string;
  readonly idempotencyKey: string;
  readonly correlationId: string;
  readonly receivedAt: string;
  readonly sourceRef: string;
  readonly subjectRef: string;
  readonly payloadDigest: string;
  readonly submittedSourceContent: string;
  readonly sourceObservedAt: string;
  readonly qualification: "CONFIRMED" | "UNCONFIRMED" | "DISPUTED";
  readonly currentness: "CURRENT" | "STALE" | "UNKNOWN";
  readonly actorRef: string;
  readonly authorityRef: string;
  readonly responsibilityContextRef: string;
  readonly purposeBindingRef: string;
  readonly admissionContextRef: string;
  readonly disclosureControlRef?: string;
}

export interface PreTicketOwnerIds {
  readonly intakeCueId: string;
  readonly observationId: string;
  readonly preTicketCaseId: string;
  readonly assessmentId: string;
  readonly decisionId: string;
}

export interface PreTicketAdmissionEvaluation {
  readonly intake: PreTicketCase;
  readonly assessment: AdmissionAssessment;
  readonly decision: "ACCEPTED_FOR_FORMATION" | "HOLD_AS_PRE_TICKET";
}

/**
 * Implements the existing D-01 owner calculation only. Predicate values are
 * supplied by the admitted configuration/binding layer; this function never
 * derives operational truth from fixture labels or expected observations.
 */
export function evaluatePreTicketAdmission(
  submission: PreTicketSubmission,
  ids: PreTicketOwnerIds,
  predicateResults: readonly PredicateResult[],
): PreTicketAdmissionEvaluation {
  assertSubmission(submission, ids);
  const intake = captureIntake(
    {
      intakeCueId: ids.intakeCueId,
      sourceRef: submission.sourceRef,
      receivedAt: submission.receivedAt,
      payloadDigest: submission.payloadDigest,
      correlationRef: submission.correlationId,
    },
    {
      observationId: ids.observationId,
      intakeCueId: ids.intakeCueId,
      observedAt: submission.sourceObservedAt,
      qualification: submission.qualification,
      currentness: submission.currentness,
    },
    ids.preTicketCaseId,
  );
  const assessment = evaluateAdmission(ids.assessmentId, ids.preTicketCaseId, predicateResults);
  return Object.freeze({
    intake,
    assessment,
    decision: assessment.result === "ACCEPTABLE" ? "ACCEPTED_FOR_FORMATION" : "HOLD_AS_PRE_TICKET",
  });
}

function assertSubmission(submission: PreTicketSubmission, ids: PreTicketOwnerIds): void {
  if (
    submission.contractRef !== PRE_TICKET_ADMISSION_CONTRACT ||
    submission.semanticVersion !== PRE_TICKET_ADMISSION_VERSION ||
    submission.profileRef !== PRE_TICKET_ADMISSION_PROFILE
  ) throw new Error("PRETICKET_CONTRACT_IDENTITY_MISMATCH");
  for (const value of [
    submission.messageId, submission.idempotencyKey, submission.correlationId,
    submission.receivedAt, submission.sourceRef, submission.subjectRef,
    submission.payloadDigest, submission.submittedSourceContent, submission.sourceObservedAt,
    submission.actorRef, submission.authorityRef, submission.responsibilityContextRef,
    submission.purposeBindingRef, submission.admissionContextRef,
    ids.intakeCueId, ids.observationId, ids.preTicketCaseId, ids.assessmentId, ids.decisionId,
  ]) if (!value) throw new Error("PRETICKET_REQUIRED_BINDING_MISSING");
}
