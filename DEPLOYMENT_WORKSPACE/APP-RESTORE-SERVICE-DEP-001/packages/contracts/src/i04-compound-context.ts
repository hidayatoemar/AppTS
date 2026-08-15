import { assertExactKeys, isRecord, issue, optionalNonEmptyString, requireArray, requireNonEmptyString, requireNonNegativeInteger, requireRecord, validateContract, type ContractEnvelope, type ContractId, type ContractReference, type ValidationIssue, type ValidationResult } from "./common/envelope.ts";

export const I04_INTERFACE_IDENTITY = "APPTS.RUNTIME.I04.COMPOUND_CONTEXT" as const;
export const I04_SEMANTIC_VERSION = "1.0.0" as const;
export const I04_COMPOUND_PROFILE_IDENTITY = "APPTS.RUNTIME.I04.COMPOUND.PROFILE.1.0.0" as const;
export const I04_FIELD_ACCESS_PROFILE_IDENTITY = "APPTS.RUNTIME.I04.FIELD_ACCESS.1.0.0" as const;
export const I04_ACCESS_D02 = "I04-ACCESS-D02-1.0.0" as const;
export const I04_ACCESS_D03 = "I04-ACCESS-D03-1.0.0" as const;
export const I04_ACCESS_SETS = [I04_ACCESS_D02, I04_ACCESS_D03] as const;
export const I04_LIFECYCLE_STATES = ["ACCEPTED", "ACTIVE", "TERMINAL_PROCESSING", "CLOSED"] as const;
export type I04AccessSet = (typeof I04_ACCESS_SETS)[number];
export type I04LifecycleState = (typeof I04_LIFECYCLE_STATES)[number];

export interface CompoundContextPayload {
  readonly compound_context_id: ContractId; readonly pairing_identity: ContractId | string; readonly ticket_id: ContractId;
  readonly context_version: number; readonly aggregate_version: number; readonly purpose_binding_id: ContractId; readonly domain_id: ContractId;
  readonly current_state_code: I04LifecycleState; readonly currentness_ref: ContractReference; readonly source_context_refs?: readonly ContractReference[];
  readonly paired_component_versions: readonly ContractReference[]; readonly access_set_identity: I04AccessSet;
  readonly access_set_payload: Readonly<Record<string, unknown>>; readonly predecessor_context_ref?: ContractReference; readonly supersedes_context_ref?: ContractReference;
}
export type CompoundContextMessage = ContractEnvelope<CompoundContextPayload>;
const KEYS = new Set(["compound_context_id", "pairing_identity", "ticket_id", "context_version", "aggregate_version", "purpose_binding_id", "domain_id", "current_state_code", "currentness_ref", "source_context_refs", "paired_component_versions", "access_set_identity", "access_set_payload", "predecessor_context_ref", "supersedes_context_ref"]);

function validatePayload(payload: unknown, expectedAccessSet: I04AccessSet): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!isRecord(payload)) return [issue("payload", "REQUIRED_STRUCT")];
  assertExactKeys(payload, KEYS, issues, "payload.");
  for (const key of ["compound_context_id", "pairing_identity", "ticket_id", "purpose_binding_id", "domain_id", "current_state_code", "currentness_ref", "access_set_identity"]) requireNonEmptyString(payload, key, issues, "payload.");
  requireNonNegativeInteger(payload, "context_version", issues, "payload."); requireNonNegativeInteger(payload, "aggregate_version", issues, "payload.");
  const paired = requireArray(payload, "paired_component_versions", issues, "payload.");
  paired?.forEach((value, index) => { if (typeof value !== "string" || value.length === 0) issues.push(issue(`payload.paired_component_versions[${index}]`, "REQUIRED_NON_EMPTY_REFERENCE")); });
  if (Object.prototype.hasOwnProperty.call(payload, "source_context_refs")) {
    const sources = requireArray(payload, "source_context_refs", issues, "payload.");
    sources?.forEach((value, index) => { if (typeof value !== "string" || value.length === 0) issues.push(issue(`payload.source_context_refs[${index}]`, "REQUIRED_NON_EMPTY_REFERENCE")); });
  }
  requireRecord(payload, "access_set_payload", issues, "payload.");
  optionalNonEmptyString(payload, "predecessor_context_ref", issues, "payload."); optionalNonEmptyString(payload, "supersedes_context_ref", issues, "payload.");
  if (!I04_LIFECYCLE_STATES.includes(payload.current_state_code as I04LifecycleState)) issues.push(issue("payload.current_state_code", "INVALID_LIFECYCLE_STATE"));
  if (payload.access_set_identity !== expectedAccessSet) issues.push(issue("payload.access_set_identity", "PAYLOAD_ACCESS_SET_MISMATCH"));
  return issues;
}

export function validateCompoundContext(input: unknown, expectedAccessSet: I04AccessSet): ValidationResult {
  return validateContract(input, { interfaceIdentity: I04_INTERFACE_IDENTITY, semanticVersion: I04_SEMANTIC_VERSION, profileIdentity: I04_COMPOUND_PROFILE_IDENTITY, accessSetMode: "required", accessSetIdentity: expectedAccessSet, requiredConditionalFields: ["source_sequence_or_version", "currentness_ref"] }, (payload) => validatePayload(payload, expectedAccessSet));
}
