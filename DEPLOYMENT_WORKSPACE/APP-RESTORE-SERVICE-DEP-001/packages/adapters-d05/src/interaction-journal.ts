import type { BoundedInteractionRequestPayload, InteractionResultPayload, InteractionStateCode, ValidationResult } from "@appts-restore-service/contracts";
export interface InteractionJournal { readonly interactionIdentity: string; readonly journalId: string; readonly payloadHash: string; readonly attemptCount: number; readonly state: InteractionStateCode; readonly lastTransitionAt: string; readonly reconciliationCaseId?: string; }
export function openInteraction(request: BoundedInteractionRequestPayload, validation: ValidationResult, journalId: string, payloadHash: string): InteractionJournal {
  if (!validation.ok) throw new Error("INVALID_INT_RUN_TD_02");
  return Object.freeze({ interactionIdentity: String(request.interaction_identity), journalId, payloadHash, attemptCount: 0, state: "REQUESTED", lastTransitionAt: request.requested_at });
}
export function transitionInteraction(journal: InteractionJournal, state: InteractionStateCode, at: string, reconciliationCaseId?: string): InteractionJournal {
  if ((state === "UNCERTAIN" || state === "RECONCILIATION_PENDING") && !reconciliationCaseId) throw new Error("RECONCILIATION_CASE_REQUIRED");
  return Object.freeze({ ...journal, state, lastTransitionAt: at, attemptCount: state === "SENT" ? journal.attemptCount + 1 : journal.attemptCount, ...(reconciliationCaseId ? { reconciliationCaseId } : {}) });
}
export function toInteractionResult(journal: InteractionJournal): InteractionResultPayload { return Object.freeze({ interaction_identity: journal.interactionIdentity, interaction_journal_id: journal.journalId, state_code: journal.state, attempt_count: journal.attemptCount, last_transition_at: journal.lastTransitionAt, ...(journal.reconciliationCaseId ? { reconciliation_case_id: journal.reconciliationCaseId } : {}) }); }
export function isSemanticSuccess(journal: InteractionJournal): boolean { return journal.state === "QUALIFIED_RESULT" || journal.state === "RECONCILED"; }
