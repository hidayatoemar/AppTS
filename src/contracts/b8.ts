import type { Currentness, IntegrityAssessment, ScopeRef } from "./ce-di.js";
import type { IsoInstant, Ref } from "./ids.js";

export interface ExternalExecutionObservation {
  interactionRef: Ref;
  requestIdentityRef: Ref;
  scopeRef: ScopeRef;
  providerRef: Ref;
  requestEvidenceRefs: Ref[];
  responseEvidenceRefs: Ref[];
  currentness: Currentness;
  integrity: IntegrityAssessment;
  observationTime?: IsoInstant;
  receivedTime: IsoInstant;
}

export interface ExternalReconciliationEvidence {
  reconciliationRef: Ref;
  requestIdentityRef: Ref;
  scopeRef: ScopeRef;
  evidenceRefs: Ref[];
  currentness: Currentness;
  integrity: IntegrityAssessment;
  effectEstablishedByGovernedEvidence: boolean;
  noEffectEstablishedByGovernedEvidence: boolean;
  observationTime?: IsoInstant;
  receivedTime: IsoInstant;
}

export interface ExternalReconciliationResult {
  interactionRef: Ref;
  requestIdentityRef: Ref;
  scopeRef: ScopeRef;
  materialEffectEstablished: boolean;
  retryHeld: boolean;
  reconciliationRequired: boolean;
  requiresGateEnableAndLawfulActionReevaluation: boolean;
  retryAuthorized: false;
  providerEvidenceRefs: Ref[];
  reconciliationEvidenceRefs: Ref[];
  dependencyProgressEvidenceRefs: Ref[];
  internalRestorationEstablished: false;
  serviceVerificationEstablished: false;
  closureEstablished: false;
  reasons: string[];
}
