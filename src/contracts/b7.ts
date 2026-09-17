import type { GovernedConditionAssessment, ScopeRef } from "./ce-di.js";
import type { Ref } from "./ids.js";

export interface VerificationClosureInput {
  scopeRef: ScopeRef;
  workCompleted: boolean;
  materialRestorationEstablished: boolean;
  serviceVerification: GovernedConditionAssessment;
  customerVerification: GovernedConditionAssessment;
  closureEligibility: GovernedConditionAssessment;
  closureDecisionAuthorization: GovernedConditionAssessment;
  residualObligationRefs: Ref[];
}

export interface VerificationClosureEvaluation {
  scopeRef: ScopeRef;
  workCompleted: boolean;
  materialRestorationEstablished: boolean;
  serviceVerified: boolean;
  customerVerified: boolean;
  closureEligible: boolean;
  closureDecisionAuthorized: boolean;
  residualObligationRefs: Ref[];
  prohibitedInferences: string[];
}
