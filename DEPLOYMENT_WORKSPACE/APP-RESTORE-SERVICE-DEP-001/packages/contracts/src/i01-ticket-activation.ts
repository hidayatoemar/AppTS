import { assertExactKeys, isRecord, issue, optionalNonEmptyString, requireNonEmptyString, requireNonNegativeInteger, requireTimestamp, validateContract, type ContractEnvelope, type ContractId, type ContractReference, type ContractTime, type ValidationIssue, type ValidationResult } from "./common/envelope.ts";

export const I01_INTERFACE_IDENTITY = "APPTS.CORE.I01.TICKET_ACTIVATION" as const;
export const I01_SEMANTIC_VERSION = "1.0.0" as const;
export const I01_PROFILE_IDENTITY = "APPTS.CORE.I01.PROFILE.1.0.0" as const;
export const I01_ACTIVATION_CODE = "ACTIVATE" as const;

export interface TicketActivationPayload {
  readonly activation_id: ContractId;
  readonly ticket_id: ContractId;
  readonly entity_ref: ContractReference;
  readonly purpose_binding_id: ContractId;
  readonly purpose_identity: string;
  readonly purpose_version: string;
  readonly package_identity: string;
  readonly package_version: string;
  readonly domain_id: ContractId;
  readonly intake_decision_id: ContractId;
  readonly responsible_assignment_ref: ContractReference;
  readonly formation_evidence_set_ref: ContractReference;
  readonly producer_aggregate_version: number;
  readonly effective_at: ContractTime;
  readonly activation_code: typeof I01_ACTIVATION_CODE;
  readonly predecessor_activation_ref?: ContractReference;
  readonly supersedes_activation_ref?: ContractReference;
}

export type TicketActivationMessage = ContractEnvelope<TicketActivationPayload>;
const KEYS = new Set(["activation_id", "ticket_id", "entity_ref", "purpose_binding_id", "purpose_identity", "purpose_version", "package_identity", "package_version", "domain_id", "intake_decision_id", "responsible_assignment_ref", "formation_evidence_set_ref", "producer_aggregate_version", "effective_at", "activation_code", "predecessor_activation_ref", "supersedes_activation_ref"]);

function validatePayload(payload: unknown): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!isRecord(payload)) return [issue("payload", "REQUIRED_STRUCT")];
  assertExactKeys(payload, KEYS, issues, "payload.");
  for (const key of ["activation_id", "ticket_id", "entity_ref", "purpose_binding_id", "purpose_identity", "purpose_version", "package_identity", "package_version", "domain_id", "intake_decision_id", "responsible_assignment_ref", "formation_evidence_set_ref", "activation_code"]) requireNonEmptyString(payload, key, issues, "payload.");
  requireNonNegativeInteger(payload, "producer_aggregate_version", issues, "payload.");
  requireTimestamp(payload, "effective_at", issues, "payload.");
  optionalNonEmptyString(payload, "predecessor_activation_ref", issues, "payload.");
  optionalNonEmptyString(payload, "supersedes_activation_ref", issues, "payload.");
  if (payload.activation_code !== I01_ACTIVATION_CODE) issues.push(issue("payload.activation_code", "ACTIVATE_REQUIRED"));
  return issues;
}

export function validateTicketActivation(input: unknown): ValidationResult {
  return validateContract(input, { interfaceIdentity: I01_INTERFACE_IDENTITY, semanticVersion: I01_SEMANTIC_VERSION, profileIdentity: I01_PROFILE_IDENTITY, requiredConditionalFields: ["source_sequence_or_version", "currentness_ref"] }, validatePayload);
}
