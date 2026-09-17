import type {
  ExternalExecutionObservation,
  ExternalReconciliationEvidence,
  ExternalReconciliationResult,
} from "../contracts/b8.js";
import type { ScopeRef } from "../contracts/ce-di.js";

const sameScope = (a: ScopeRef, b: ScopeRef): boolean =>
  a.situationId === b.situationId &&
  a.subjectType === b.subjectType &&
  a.subjectId === b.subjectId &&
  (a.parentScopeRef ?? "") === (b.parentScopeRef ?? "") &&
  (a.relationRef ?? "") === (b.relationRef ?? "");

const evidenceUsable = (
  currentness: { status: string },
  integrity: { sufficient: boolean; conflict: boolean },
): boolean => currentness.status === "CURRENT" && integrity.sufficient && !integrity.conflict;

export function holdUncertainExternalEffect(
  observation: ExternalExecutionObservation,
): ExternalReconciliationResult {
  return {
    interactionRef: observation.interactionRef,
    requestIdentityRef: observation.requestIdentityRef,
    scopeRef: observation.scopeRef,
    materialEffectEstablished: false,
    retryHeld: true,
    reconciliationRequired: true,
    requiresGateEnableAndLawfulActionReevaluation: false,
    retryAuthorized: false,
    providerEvidenceRefs: [...observation.requestEvidenceRefs, ...observation.responseEvidenceRefs],
    reconciliationEvidenceRefs: [],
    dependencyProgressEvidenceRefs: [...observation.responseEvidenceRefs],
    internalRestorationEstablished: false,
    serviceVerificationEstablished: false,
    closureEstablished: false,
    reasons: ["external_effect_not_established", "reconciliation_required", "automatic_retry_held"],
  };
}

export function reconcileExternalEffect(
  observation: ExternalExecutionObservation,
  reconciliation: ExternalReconciliationEvidence,
): ExternalReconciliationResult {
  const base = holdUncertainExternalEffect(observation);
  const reasons: string[] = [];

  if (reconciliation.requestIdentityRef !== observation.requestIdentityRef) reasons.push("request_identity_mismatch");
  if (!sameScope(reconciliation.scopeRef, observation.scopeRef)) reasons.push("scope_mismatch");
  if (!evidenceUsable(reconciliation.currentness, reconciliation.integrity)) reasons.push("reconciliation_evidence_not_usable");
  if (reconciliation.evidenceRefs.length === 0) reasons.push("reconciliation_evidence_missing");
  if (reconciliation.effectEstablishedByGovernedEvidence && reconciliation.noEffectEstablishedByGovernedEvidence) {
    reasons.push("reconciliation_conclusion_conflict");
  }

  const exact = reasons.length === 0;
  if (!exact) {
    return {
      ...base,
      reconciliationEvidenceRefs: [...reconciliation.evidenceRefs],
      providerEvidenceRefs: [...base.providerEvidenceRefs, ...reconciliation.evidenceRefs],
      reasons: [...base.reasons, ...reasons],
    };
  }

  if (reconciliation.effectEstablishedByGovernedEvidence) {
    return {
      ...base,
      materialEffectEstablished: true,
      retryHeld: true,
      reconciliationRequired: false,
      reconciliationEvidenceRefs: [...reconciliation.evidenceRefs],
      providerEvidenceRefs: [...base.providerEvidenceRefs, ...reconciliation.evidenceRefs],
      dependencyProgressEvidenceRefs: [...base.dependencyProgressEvidenceRefs, ...reconciliation.evidenceRefs],
      reasons: ["external_material_effect_established_by_governed_reconciliation_evidence"],
    };
  }

  if (reconciliation.noEffectEstablishedByGovernedEvidence) {
    return {
      ...base,
      materialEffectEstablished: false,
      retryHeld: false,
      reconciliationRequired: false,
      requiresGateEnableAndLawfulActionReevaluation: true,
      reconciliationEvidenceRefs: [...reconciliation.evidenceRefs],
      providerEvidenceRefs: [...base.providerEvidenceRefs, ...reconciliation.evidenceRefs],
      dependencyProgressEvidenceRefs: [...base.dependencyProgressEvidenceRefs, ...reconciliation.evidenceRefs],
      reasons: [
        "external_no_effect_established_by_governed_reconciliation_evidence",
        "lawful_action_reevaluation_required_before_retry",
      ],
    };
  }

  return {
    ...base,
    reconciliationEvidenceRefs: [...reconciliation.evidenceRefs],
    providerEvidenceRefs: [...base.providerEvidenceRefs, ...reconciliation.evidenceRefs],
    reasons: ["reconciliation_evidence_does_not_establish_effect_or_no_effect", "automatic_retry_held"],
  };
}

export function recordProviderCompletionEvidence(
  observation: ExternalExecutionObservation,
): ExternalReconciliationResult {
  const result = holdUncertainExternalEffect(observation);
  return {
    ...result,
    reasons: ["provider_completion_evidence_recorded", "internal_truth_not_inferred"],
  };
}
