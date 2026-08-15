/** D-03 relation ownership. SQL writers must remain inside this adapter boundary. */
export const coreD03Relations = [
  "evidence_object", "evidence_qualification", "evidence_correction",
  "claim_record", "interpretation_record", "claim_evidence_link",
  "contradiction_set", "contradiction_member", "evidence_set_version",
  "evidence_set_member", "verification_request", "verifier_eligibility_decision",
  "verification_result", "gate_evaluation", "gate_predicate_result",
  "progression_envelope", "progression_class", "terminal_disposition_assessment",
  "closure_readiness_assessment",
] as const;
