export type ContractId = string;
export type ContractCode = string;
export type ContractVersion = number | string;
export type ContractTime = string;
export type ContractHash = string;
export type ContractReference = string;

export const COMMON_ENVELOPE_IDENTITY = "CF02-ENV-1.0.0" as const;

export interface ContractEnvelope<TPayload> {
  readonly interface_identity: ContractCode;
  readonly semantic_version: ContractCode;
  readonly profile_identity: ContractCode;
  readonly access_set_identity?: ContractCode;
  readonly message_id: ContractId;
  readonly idempotency_key: ContractId;
  readonly correlation_id: ContractId;
  readonly causation_id?: ContractId;
  readonly producer_ref: ContractReference;
  readonly producer_release_ref?: ContractReference;
  readonly subject_ref: ContractReference;
  readonly source_sequence_or_version?: ContractVersion;
  readonly produced_at: ContractTime;
  readonly effective_from?: ContractTime;
  readonly effective_to?: ContractTime;
  readonly currentness_ref?: ContractReference;
  readonly predecessor_message_or_record_ref?: ContractReference;
  readonly supersedes_message_or_record_ref?: ContractReference;
  readonly payload_hash: ContractHash;
  readonly integrity_envelope_id?: ContractId;
  readonly payload: TPayload;
}

export interface ValidationIssue {
  readonly path: string;
  readonly code: string;
}

export type ValidationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly issues: readonly ValidationIssue[] };

export interface EnvelopeSpecification {
  readonly interfaceIdentity: string;
  readonly semanticVersion: string;
  readonly profileIdentity: string;
  readonly accessSetIdentity?: string;
  readonly accessSetMode?: "forbidden" | "required" | "optional";
  readonly requiredConditionalFields?: readonly EnvelopeConditionalField[];
}

export type EnvelopeConditionalField =
  | "access_set_identity"
  | "producer_release_ref"
  | "source_sequence_or_version"
  | "effective_from"
  | "currentness_ref"
  | "integrity_envelope_id";

const ENVELOPE_KEYS = new Set([
  "interface_identity", "semantic_version", "profile_identity", "access_set_identity",
  "message_id", "idempotency_key", "correlation_id", "causation_id", "producer_ref",
  "producer_release_ref", "subject_ref", "source_sequence_or_version", "produced_at",
  "effective_from", "effective_to", "currentness_ref", "predecessor_message_or_record_ref",
  "supersedes_message_or_record_ref", "payload_hash", "integrity_envelope_id", "payload",
]);

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

export function issue(path: string, code: string): ValidationIssue { return { path, code }; }

export function requireNonEmptyString(record: Record<string, unknown>, key: string, issues: ValidationIssue[], pathPrefix = ""): void {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) issues.push(issue(`${pathPrefix}${key}`, "REQUIRED_NON_EMPTY_STRING"));
}

export function optionalNonEmptyString(record: Record<string, unknown>, key: string, issues: ValidationIssue[], pathPrefix = ""): void {
  if (hasOwn(record, key)) requireNonEmptyString(record, key, issues, pathPrefix);
}

export function requireNonNegativeInteger(record: Record<string, unknown>, key: string, issues: ValidationIssue[], pathPrefix = ""): void {
  const value = record[key];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) issues.push(issue(`${pathPrefix}${key}`, "REQUIRED_NON_NEGATIVE_INTEGER"));
}

export function requirePositiveInteger(record: Record<string, unknown>, key: string, issues: ValidationIssue[], pathPrefix = ""): void {
  const value = record[key];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) issues.push(issue(`${pathPrefix}${key}`, "REQUIRED_POSITIVE_INTEGER"));
}

export function requireBoolean(record: Record<string, unknown>, key: string, issues: ValidationIssue[], pathPrefix = ""): void {
  if (typeof record[key] !== "boolean") issues.push(issue(`${pathPrefix}${key}`, "REQUIRED_BOOLEAN"));
}

export function requireArray(record: Record<string, unknown>, key: string, issues: ValidationIssue[], pathPrefix = ""): readonly unknown[] | undefined {
  const value = record[key];
  if (!Array.isArray(value)) { issues.push(issue(`${pathPrefix}${key}`, "REQUIRED_ARRAY")); return undefined; }
  return value;
}

export function requireRecord(record: Record<string, unknown>, key: string, issues: ValidationIssue[], pathPrefix = ""): Record<string, unknown> | undefined {
  const value = record[key];
  if (!isRecord(value)) { issues.push(issue(`${pathPrefix}${key}`, "REQUIRED_STRUCT")); return undefined; }
  return value;
}

export function requireTimestamp(record: Record<string, unknown>, key: string, issues: ValidationIssue[], pathPrefix = ""): void {
  const value = record[key];
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || Number.isNaN(Date.parse(value))) {
    issues.push(issue(`${pathPrefix}${key}`, "REQUIRED_TIMEZONE_AWARE_INSTANT"));
  }
}

export function optionalTimestamp(record: Record<string, unknown>, key: string, issues: ValidationIssue[], pathPrefix = ""): void {
  if (hasOwn(record, key)) requireTimestamp(record, key, issues, pathPrefix);
}

export function assertExactKeys(record: Record<string, unknown>, allowedKeys: ReadonlySet<string>, issues: ValidationIssue[], pathPrefix = ""): void {
  for (const key of Object.keys(record)) if (!allowedKeys.has(key)) issues.push(issue(`${pathPrefix}${key}`, "UNRECOGNIZED_FIELD"));
}

export function resultFromIssues(issues: readonly ValidationIssue[]): ValidationResult {
  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}

export function validateEnvelope(input: unknown, specification: EnvelopeSpecification): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!isRecord(input)) return [issue("$", "REQUIRED_ENVELOPE_STRUCT")];
  assertExactKeys(input, ENVELOPE_KEYS, issues);
  for (const key of ["interface_identity", "semantic_version", "profile_identity", "message_id", "idempotency_key", "correlation_id", "producer_ref", "subject_ref", "payload_hash"]) requireNonEmptyString(input, key, issues);
  requireTimestamp(input, "produced_at", issues);
  if (!hasOwn(input, "payload") || !isRecord(input.payload)) issues.push(issue("payload", "REQUIRED_STRUCT"));
  for (const key of ["causation_id", "producer_release_ref", "currentness_ref", "predecessor_message_or_record_ref", "supersedes_message_or_record_ref", "integrity_envelope_id"]) optionalNonEmptyString(input, key, issues);
  optionalTimestamp(input, "effective_from", issues);
  optionalTimestamp(input, "effective_to", issues);
  if (hasOwn(input, "source_sequence_or_version")) {
    const value = input.source_sequence_or_version;
    if (!((typeof value === "number" && Number.isSafeInteger(value) && value >= 0) || (typeof value === "string" && value.length > 0))) issues.push(issue("source_sequence_or_version", "INVALID_VERSION_OR_CODE"));
  }
  if (input.interface_identity !== specification.interfaceIdentity) issues.push(issue("interface_identity", "IDENTITY_MISMATCH"));
  if (input.semantic_version !== specification.semanticVersion) issues.push(issue("semantic_version", "VERSION_MISMATCH"));
  if (input.profile_identity !== specification.profileIdentity) issues.push(issue("profile_identity", "PROFILE_MISMATCH"));
  const accessMode = specification.accessSetMode ?? "forbidden";
  if (accessMode === "forbidden" && hasOwn(input, "access_set_identity")) issues.push(issue("access_set_identity", "ACCESS_SET_FORBIDDEN"));
  else if (accessMode === "required") requireNonEmptyString(input, "access_set_identity", issues);
  else optionalNonEmptyString(input, "access_set_identity", issues);
  if (specification.accessSetIdentity !== undefined && input.access_set_identity !== specification.accessSetIdentity) issues.push(issue("access_set_identity", "ACCESS_SET_MISMATCH"));
  for (const field of specification.requiredConditionalFields ?? []) if (!hasOwn(input, field)) issues.push(issue(field, "REQUIRED_BY_CONTRACT_CONDITION"));
  return issues;
}

export function validateContract(input: unknown, specification: EnvelopeSpecification, payloadValidator: (payload: unknown) => readonly ValidationIssue[]): ValidationResult {
  const issues = [...validateEnvelope(input, specification)];
  if (isRecord(input) && hasOwn(input, "payload")) issues.push(...payloadValidator(input.payload));
  return resultFromIssues(issues);
}
