import type { VerificationClosureEvaluation, VerificationClosureInput } from "../contracts/b7.js";

export function evaluateVerificationClosure(input: VerificationClosureInput): VerificationClosureEvaluation {
  const prohibitedInferences: string[] = [];
  if (input.workCompleted && !input.materialRestorationEstablished) prohibitedInferences.push("work_completed_does_not_establish_restoration");
  if (input.materialRestorationEstablished && !input.serviceVerification.satisfied) prohibitedInferences.push("restoration_does_not_establish_service_verification");
  if (input.serviceVerification.satisfied && !input.customerVerification.satisfied) prohibitedInferences.push("service_verification_does_not_establish_customer_verification");
  if (input.customerVerification.satisfied && !input.closureEligibility.satisfied) prohibitedInferences.push("customer_verification_does_not_establish_closure_eligibility");
  if (input.closureEligibility.satisfied && !input.closureDecisionAuthorization.satisfied) prohibitedInferences.push("closure_eligibility_does_not_establish_closure_decision");

  return {
    scopeRef: input.scopeRef,
    workCompleted: input.workCompleted,
    materialRestorationEstablished: input.materialRestorationEstablished,
    serviceVerified: input.serviceVerification.satisfied,
    customerVerified: input.customerVerification.satisfied,
    closureEligible: input.closureEligibility.satisfied,
    closureDecisionAuthorized: input.closureDecisionAuthorization.satisfied,
    residualObligationRefs: [...input.residualObligationRefs],
    prohibitedInferences,
  };
}
