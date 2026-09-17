import type {
  ActionExecutionRecord,
  ActingContextCandidate,
  EvidenceProvenanceRef,
  MaterialEffectRecord,
  ResponsibilityContext,
  ScopeRef,
} from "../contracts/ce-di.js";
import type {
  DependencyWaitingRecord,
  FieldWorkRecord,
  ResponsibilityHandoverRecord,
} from "../contracts/b6.js";
import type { VerificationClosureEvaluation } from "../contracts/b7.js";
import type {
  ExternalExecutionObservation,
  ExternalReconciliationEvidence,
  ExternalReconciliationResult,
} from "../contracts/b8.js";
import type { Ref } from "../contracts/ids.js";

export type AuthoritativeP01ToP10Record =
  | { family: "P07_FIELD_WORK"; record: FieldWorkRecord }
  | { family: "P08_EXTERNAL_EXECUTION_OBSERVATION"; record: ExternalExecutionObservation }
  | { family: "P08_EXTERNAL_RECONCILIATION_EVIDENCE"; record: ExternalReconciliationEvidence }
  | { family: "P08_EXTERNAL_RECONCILIATION_RESULT"; record: ExternalReconciliationResult };

export interface ScopeSnapshot {
  scopeRef: ScopeRef;
  version: number;
  truthRefs: Ref[];
  evidenceRefs: Ref[];
  responsibility: ResponsibilityContext;
  actingContextCandidates: ActingContextCandidate[];
  dependencyRefs: Ref[];
  actionExecutions: ActionExecutionRecord[];
  materialEffects: MaterialEffectRecord[];
  evidenceProvenance: EvidenceProvenanceRef[];
  responsibilityHandoverEffects: ResponsibilityHandoverRecord[];
  dependencyWaitingUpdates: DependencyWaitingRecord[];
  residualObligationRefs: Ref[];
  verificationClosureEffects: VerificationClosureEvaluation[];
  otherAuthoritativeP01ToP10Records: AuthoritativeP01ToP10Record[];
}

export const scopeKey = (scope: ScopeRef): string =>
  [scope.situationId, scope.subjectType, scope.subjectId, scope.parentScopeRef ?? "", scope.relationRef ?? ""].join("|");
