import { assertExactKeys, isRecord, issue, optionalNonEmptyString, optionalTimestamp, requireArray, requireNonEmptyString, requireTimestamp, validateContract, type ContractEnvelope, type ContractId, type ContractReference, type ContractTime, type ValidationIssue, type ValidationResult } from "./common/envelope.ts";

export const I03_INTERFACE_IDENTITY = "APPTS.CORE.I03.EVIDENCE_GATE_RESULT" as const;
export const I03_SEMANTIC_VERSION = "1.0.0" as const;
export const I03_PROFILE_IDENTITY = "APPTS.CORE.I03.PROFILE.1.0.0" as const;

export interface GatePredicateResult { readonly predicate_identity: string; readonly result_code: string; readonly reason_ref?: ContractReference; readonly input_record_ref?: ContractReference; }
export interface EvidenceGateResultPayload {
  readonly gate_result_id: ContractId; readonly ticket_id: ContractId; readonly entity_ref?: ContractReference; readonly gate_identity: string; readonly gate_evaluation_id: ContractId;
  readonly actor_holder_ref?: ContractReference; readonly acting_role_instance_ref?: ContractReference; readonly acting_assignment_ref?: ContractReference; readonly authority_basis_ref?: ContractReference;
  readonly input_version_set_ref: ContractReference | Readonly<Record<string, unknown>>; readonly evidence_set_version_id?: ContractId;
  readonly verification_result_ref?: ContractReference; readonly communication_status_ref?: ContractReference; readonly blocker_dependency_status_ref?: ContractReference;
  readonly policy_binding_ref?: ContractReference; readonly contradiction_status_ref?: ContractReference; readonly evidence_sufficiency_ref?: ContractReference;
  readonly gate_predicate_results: readonly GatePredicateResult[]; readonly progression_envelope_id?: ContractId;
  readonly permitted_progression_classes: readonly string[]; readonly terminal_disposition_eligibility_ref?: ContractReference;
  readonly closure_eligibility_ref?: ContractReference; readonly currentness_ref: ContractReference; readonly effective_from: ContractTime;
  readonly effective_to?: ContractTime; readonly predecessor_gate_result_ref?: ContractReference; readonly supersedes_gate_result_ref?: ContractReference;
}
export type EvidenceGateResultMessage = ContractEnvelope<EvidenceGateResultPayload>;
const KEYS = new Set(["gate_result_id", "ticket_id", "entity_ref", "gate_identity", "gate_evaluation_id", "actor_holder_ref", "acting_role_instance_ref", "acting_assignment_ref", "authority_basis_ref", "input_version_set_ref", "evidence_set_version_id", "verification_result_ref", "communication_status_ref", "blocker_dependency_status_ref", "policy_binding_ref", "contradiction_status_ref", "evidence_sufficiency_ref", "gate_predicate_results", "progression_envelope_id", "permitted_progression_classes", "terminal_disposition_eligibility_ref", "closure_eligibility_ref", "currentness_ref", "effective_from", "effective_to", "predecessor_gate_result_ref", "supersedes_gate_result_ref"]);
const PREDICATE_KEYS = new Set(["predicate_identity", "result_code", "reason_ref", "input_record_ref"]);

function validatePayload(payload: unknown): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!isRecord(payload)) return [issue("payload", "REQUIRED_STRUCT")];
  assertExactKeys(payload, KEYS, issues, "payload.");
  for (const key of ["gate_result_id", "ticket_id", "entity_ref", "gate_identity", "gate_evaluation_id", "actor_holder_ref", "acting_role_instance_ref", "acting_assignment_ref", "authority_basis_ref", "currentness_ref"]) requireNonEmptyString(payload, key, issues, "payload.");
  if (!(typeof payload.input_version_set_ref === "string" && payload.input_version_set_ref.length > 0) && !isRecord(payload.input_version_set_ref)) issues.push(issue("payload.input_version_set_ref", "REQUIRED_REF_OR_STRUCT"));
  const predicates = requireArray(payload, "gate_predicate_results", issues, "payload.");
  predicates?.forEach((value, index) => {
    if (!isRecord(value)) { issues.push(issue(`payload.gate_predicate_results[${index}]`, "REQUIRED_STRUCT")); return; }
    assertExactKeys(value, PREDICATE_KEYS, issues, `payload.gate_predicate_results[${index}].`);
    requireNonEmptyString(value, "predicate_identity", issues, `payload.gate_predicate_results[${index}].`);
    requireNonEmptyString(value, "result_code", issues, `payload.gate_predicate_results[${index}].`);
    optionalNonEmptyString(value, "reason_ref", issues, `payload.gate_predicate_results[${index}].`); optionalNonEmptyString(value, "input_record_ref", issues, `payload.gate_predicate_results[${index}].`);
  });
  const progressions = requireArray(payload, "permitted_progression_classes", issues, "payload.");
  progressions?.forEach((value, index) => { if (typeof value !== "string" || value.length === 0) issues.push(issue(`payload.permitted_progression_classes[${index}]`, "REQUIRED_NON_EMPTY_CODE")); });
  requireTimestamp(payload, "effective_from", issues, "payload."); optionalTimestamp(payload, "effective_to", issues, "payload.");
  for (const key of ["evidence_set_version_id", "verification_result_ref", "communication_status_ref", "blocker_dependency_status_ref", "policy_binding_ref", "contradiction_status_ref", "evidence_sufficiency_ref", "progression_envelope_id", "terminal_disposition_eligibility_ref", "closure_eligibility_ref", "predecessor_gate_result_ref", "supersedes_gate_result_ref"]) optionalNonEmptyString(payload, key, issues, "payload.");
  return issues;
}

export function validateEvidenceGateResult(input: unknown): ValidationResult {
  return validateContract(input, { interfaceIdentity: I03_INTERFACE_IDENTITY, semanticVersion: I03_SEMANTIC_VERSION, profileIdentity: I03_PROFILE_IDENTITY, requiredConditionalFields: ["source_sequence_or_version", "currentness_ref", "effective_from"] }, validatePayload);
}
