import { assertExactKeys, isRecord, issue, optionalNonEmptyString, optionalTimestamp, requireArray, requireNonEmptyString, requireTimestamp, validateContract, type ContractEnvelope, type ContractId, type ContractReference, type ContractTime, type ValidationIssue, type ValidationResult } from "./common/envelope.ts";

export const I02_INTERFACE_IDENTITY = "APPTS.CORE.I02.AUTHORITY_RESOLUTION" as const;
export const I02_SEMANTIC_VERSION = "1.0.0" as const;
export const I02_PROFILE_IDENTITY = "APPTS.CORE.I02.PROFILE.1.0.0" as const;

export interface AuthorityAction { readonly action_class_ref: string; readonly permission_code: string; readonly restriction_reason_ref?: ContractReference; }
export interface AuthorityResolutionPayload {
  readonly authority_result_id: ContractId; readonly ticket_id: ContractId; readonly entity_ref?: ContractReference; readonly domain_id: ContractId;
  readonly actor_holder_ref?: ContractReference; readonly acting_role_instance_ref?: ContractReference; readonly acting_assignment_ref?: ContractReference; readonly authority_basis_ref?: ContractReference;
  readonly context_ref: ContractReference | Readonly<Record<string, unknown>>;
  readonly assignment_snapshot_refs: readonly ContractReference[];
  readonly responsibility_id?: ContractId; readonly responsible_assignment_ref?: ContractReference;
  readonly authority_actions: readonly AuthorityAction[]; readonly sod_decision_ref?: ContractReference;
  readonly result_status_ref: ContractReference; readonly currentness_ref: ContractReference;
  readonly effective_from: ContractTime; readonly effective_to?: ContractTime; readonly refresh_lineage_ref?: ContractReference;
  readonly no_valid_refresh_ref?: ContractReference; readonly predecessor_authority_result_ref?: ContractReference;
  readonly supersedes_authority_result_ref?: ContractReference;
}
export type AuthorityResolutionMessage = ContractEnvelope<AuthorityResolutionPayload>;
const KEYS = new Set(["authority_result_id", "ticket_id", "entity_ref", "domain_id", "actor_holder_ref", "acting_role_instance_ref", "acting_assignment_ref", "authority_basis_ref", "context_ref", "assignment_snapshot_refs", "responsibility_id", "responsible_assignment_ref", "authority_actions", "sod_decision_ref", "result_status_ref", "currentness_ref", "effective_from", "effective_to", "refresh_lineage_ref", "no_valid_refresh_ref", "predecessor_authority_result_ref", "supersedes_authority_result_ref"]);
const ACTION_KEYS = new Set(["action_class_ref", "permission_code", "restriction_reason_ref"]);

function validatePayload(payload: unknown): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!isRecord(payload)) return [issue("payload", "REQUIRED_STRUCT")];
  assertExactKeys(payload, KEYS, issues, "payload.");
  for (const key of ["authority_result_id", "ticket_id", "entity_ref", "domain_id", "actor_holder_ref", "acting_role_instance_ref", "acting_assignment_ref", "authority_basis_ref", "result_status_ref", "currentness_ref"]) requireNonEmptyString(payload, key, issues, "payload.");
  if (!(typeof payload.context_ref === "string" && payload.context_ref.length > 0) && !isRecord(payload.context_ref)) issues.push(issue("payload.context_ref", "REQUIRED_REF_OR_STRUCT"));
  const snapshots = requireArray(payload, "assignment_snapshot_refs", issues, "payload.");
  snapshots?.forEach((value, index) => { if (typeof value !== "string" || value.length === 0) issues.push(issue(`payload.assignment_snapshot_refs[${index}]`, "REQUIRED_NON_EMPTY_REFERENCE")); });
  const actions = requireArray(payload, "authority_actions", issues, "payload.");
  actions?.forEach((value, index) => {
    if (!isRecord(value)) { issues.push(issue(`payload.authority_actions[${index}]`, "REQUIRED_STRUCT")); return; }
    assertExactKeys(value, ACTION_KEYS, issues, `payload.authority_actions[${index}].`);
    requireNonEmptyString(value, "action_class_ref", issues, `payload.authority_actions[${index}].`);
    requireNonEmptyString(value, "permission_code", issues, `payload.authority_actions[${index}].`);
    optionalNonEmptyString(value, "restriction_reason_ref", issues, `payload.authority_actions[${index}].`);
  });
  requireTimestamp(payload, "effective_from", issues, "payload."); optionalTimestamp(payload, "effective_to", issues, "payload.");
  for (const key of ["responsibility_id", "responsible_assignment_ref", "sod_decision_ref", "refresh_lineage_ref", "no_valid_refresh_ref", "predecessor_authority_result_ref", "supersedes_authority_result_ref"]) optionalNonEmptyString(payload, key, issues, "payload.");
  const hasResponsibility = Object.prototype.hasOwnProperty.call(payload, "responsibility_id");
  const hasAssignment = Object.prototype.hasOwnProperty.call(payload, "responsible_assignment_ref");
  if (hasResponsibility !== hasAssignment) issues.push(issue("payload.responsibility_id", "RESPONSIBILITY_PAIR_REQUIRED"));
  if (hasAssignment && payload.responsible_assignment_ref !== payload.acting_assignment_ref) issues.push(issue("payload.responsible_assignment_ref", "ACTING_ASSIGNMENT_MISMATCH"));
  return issues;
}

export function validateAuthorityResolution(input: unknown): ValidationResult {
  return validateContract(input, { interfaceIdentity: I02_INTERFACE_IDENTITY, semanticVersion: I02_SEMANTIC_VERSION, profileIdentity: I02_PROFILE_IDENTITY, requiredConditionalFields: ["source_sequence_or_version", "currentness_ref", "effective_from"] }, validatePayload);
}
