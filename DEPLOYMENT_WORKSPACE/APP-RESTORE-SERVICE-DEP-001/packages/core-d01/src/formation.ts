import type { TicketActivationPayload } from "@appts-restore-service/contracts";
import type { AdmissionAssessment } from "./admission.ts";
import type { PurposeBinding } from "./purpose-binding.ts";
export interface TicketFormationRecord { readonly formationId: string; readonly ticketId: string; readonly admissionAssessmentId: string; readonly activation: TicketActivationPayload; }
export interface FormationInput { readonly formationId: string; readonly ticketId: string; readonly entityRef?: string; readonly domainId: string; readonly intakeDecisionId: string; readonly responsibleAssignmentRef: string; readonly formationEvidenceSetRef: string; readonly aggregateVersion: number; readonly effectiveAt: string; readonly binding: PurposeBinding; }
export function formTicket(assessment: AdmissionAssessment, input: FormationInput): TicketFormationRecord {
  if (assessment.result !== "ACCEPTABLE") throw new Error("ADMISSION_NOT_ACCEPTABLE");
  if (!input.entityRef || !input.responsibleAssignmentRef || !input.formationEvidenceSetRef) throw new Error("FORMATION_PREREQUISITE_MISSING");
  const activation: TicketActivationPayload = Object.freeze({ activation_id: input.formationId, ticket_id: input.ticketId, entity_ref: input.entityRef, purpose_binding_id: input.binding.purposeBindingId, purpose_identity: input.binding.purposeIdentity, purpose_version: input.binding.purposeVersion, package_identity: input.binding.packageIdentity, package_version: input.binding.packageVersion, domain_id: input.domainId, intake_decision_id: input.intakeDecisionId, responsible_assignment_ref: input.responsibleAssignmentRef, formation_evidence_set_ref: input.formationEvidenceSetRef, producer_aggregate_version: input.aggregateVersion, effective_at: input.effectiveAt, activation_code: "ACTIVATE" });
  return Object.freeze({ formationId: input.formationId, ticketId: input.ticketId, admissionAssessmentId: assessment.assessmentId, activation });
}
