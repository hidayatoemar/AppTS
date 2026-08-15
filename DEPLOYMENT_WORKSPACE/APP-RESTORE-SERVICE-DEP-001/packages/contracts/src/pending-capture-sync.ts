import {
  assertExactKeys, hasOwn, isRecord, issue, optionalNonEmptyString, optionalTimestamp,
  requireBoolean, requireNonEmptyString, requireNonNegativeInteger, requireRecord,
  requireTimestamp, resultFromIssues, validateContract, validateEnvelope,
  type ContractEnvelope, type ContractHash, type ContractId, type ContractReference,
  type ContractTime, type ValidationIssue, type ValidationResult,
} from "./common/envelope.ts";
import type { AcceptanceCode } from "./common/result.ts";

// ── Family ───────────────────────────────────────────────────────────────────
export const D05_PC_SYNC_FAMILY_IDENTITY = "APPTS.RUNTIME.D05.PENDING_CAPTURE_SYNC" as const;
export const D05_PC_SYNC_SEMANTIC_VERSION = "1.0.0" as const;
export const D05_PC_SYNC_PROFILE_IDENTITY = "APPTS.RUNTIME.D05.PENDING_CAPTURE_SYNC.PROFILE.1.0.0" as const;

// ── Message A: SUBMISSION ────────────────────────────────────────────────────
export const D05_SUBMISSION_INTERFACE_IDENTITY =
  "APPTS.RUNTIME.D05.PENDING_CAPTURE_SYNC.SUBMISSION" as const;

export type CaptureKindRef = "OBSERVATION" | "DRAFT_EVIDENCE";
export type RepresentationKind = "INLINE_STRUCT" | "DURABLE_REFERENCE";

export interface ProvisionalPayloadInline {
  readonly representation_kind: "INLINE_STRUCT";
  readonly inline_content: Record<string, unknown>;
  readonly durable_reference?: undefined;
}

export interface ProvisionalPayloadDurableRef {
  readonly representation_kind: "DURABLE_REFERENCE";
  readonly durable_reference: ContractReference;
  readonly inline_content?: undefined;
}

export type ProvisionalPayload = ProvisionalPayloadInline | ProvisionalPayloadDurableRef;

export interface PendingCaptureSyncSubmissionPayload {
  readonly client_capture_id: ContractId;
  readonly local_sequence: number;
  readonly capture_kind_ref: CaptureKindRef;
  readonly source_system_ref: ContractReference;
  readonly source_label_ref: ContractReference;
  readonly captured_by_ref: ContractReference;
  readonly device_context_ref: ContractReference;
  readonly capture_time: ContractTime;
  readonly source_offset?: string;
  readonly time_confidence_ref: ContractReference;
  readonly provisional_payload: ProvisionalPayload;
  readonly payload_representation_profile_ref?: string;
  readonly payload_representation_version?: string;
  readonly authorization_snapshot_ref: ContractReference;
  readonly supersedes_capture_ref?: ContractReference;
}

export type PendingCaptureSyncSubmissionMessage =
  ContractEnvelope<PendingCaptureSyncSubmissionPayload>;

// ── Message B: PENDING_ACCEPTANCE ────────────────────────────────────────────
export const D05_PENDING_ACCEPTANCE_INTERFACE_IDENTITY =
  "APPTS.RUNTIME.D05.PENDING_CAPTURE_SYNC.PENDING_ACCEPTANCE" as const;

export type PendingDispositionCode = "PENDING_ACCEPTED" | "PENDING_REJECTED" | "PENDING_HELD";
export type ReplayDispositionCode =
  | "NEW_DURABLE_ACCEPTANCE"
  | "IDENTICAL_REPLAY_REUSED"
  | "NOT_DURABLY_ACCEPTED"
  | "CONFLICTING_REPLAY_HELD";

export interface PendingCaptureSyncPendingAcceptancePayload {
  readonly result_id: ContractId;
  readonly message_id: ContractId;
  readonly correlation_id: ContractId;
  readonly acceptance_code: AcceptanceCode;
  readonly reconciliation_required: boolean;
  readonly durable_result_ref: ContractReference;
  readonly reason_ref?: ContractReference;
  readonly result_at: ContractTime;
  readonly client_capture_id: ContractId;
  readonly pending_disposition_code: PendingDispositionCode;
  readonly pending_capture_id?: ContractId;
  readonly provisional_payload_ref?: ContractReference;
  readonly provisional_payload_hash?: ContractHash;
  readonly payload_representation_profile_ref?: string;
  readonly payload_representation_version?: string;
  readonly replay_disposition_code: ReplayDispositionCode;
  readonly semantic_scope_code: "PENDING_ONLY_NO_FINAL_SEMANTIC_SUCCESS";
  readonly final_business_or_lifecycle_effect_applied: false;
}

export type PendingCaptureSyncPendingAcceptanceMessage =
  ContractEnvelope<PendingCaptureSyncPendingAcceptancePayload>;

// ── Message C: OUTCOME ────────────────────────────────────────────────────────
export const D05_OUTCOME_INTERFACE_IDENTITY =
  "APPTS.RUNTIME.D05.PENDING_CAPTURE_SYNC.OUTCOME" as const;

export type OutcomeCode =
  | "QUALIFIED" | "PROMOTED" | "REJECTED" | "HELD"
  | "RECONCILIATION_REQUIRED" | "CORRECTED" | "SUPERSEDED";

export type OutcomeReasonCode =
  | "INVALID" | "UNAUTHORIZED" | "STALE" | "UNSUPPORTED"
  | "SOURCE_UNAVAILABLE" | "PAYLOAD_HASH_MISMATCH"
  | "UNRESOLVABLE_PAYLOAD_REFERENCE" | "UNRESOLVED_SOURCE_BINDING"
  | "CONFLICTING_REPLAY" | "CAPTURE_ID_CONFLICT" | "OUT_OF_ORDER_HELD"
  | "CONTRADICTION" | "OFFLINE_FINAL_EFFECT_PROHIBITED"
  | "UNKNOWN_OR_MISMATCHED_PROFILE";

export interface PendingCaptureSyncOutcomePayload {
  readonly client_capture_id: ContractId;
  readonly pending_capture_id: ContractId;
  readonly provisional_payload_ref: ContractReference;
  readonly outcome_code: OutcomeCode;
  readonly outcome_reason_code?: OutcomeReasonCode;
  readonly downstream_result_class_ref?: ContractReference;
  readonly downstream_result_ref?: ContractReference;
  readonly reconciliation_case_ref?: ContractReference;
  readonly successor_capture_ref?: ContractReference;
  readonly reason_ref?: ContractReference;
  readonly source_currentness_ref?: ContractReference;
  readonly outcome_at: ContractTime;
  readonly final_business_or_lifecycle_effect_asserted_by_this_message: false;
}

export type PendingCaptureSyncOutcomeMessage =
  ContractEnvelope<PendingCaptureSyncOutcomePayload>;

// ── Envelope specification (shared) ──────────────────────────────────────────
const makeSpec = (interfaceIdentity: string) => ({
  interfaceIdentity,
  semanticVersion: D05_PC_SYNC_SEMANTIC_VERSION,
  profileIdentity: D05_PC_SYNC_PROFILE_IDENTITY,
}) as const;

// ── Validators ────────────────────────────────────────────────────────────────

const SUBMISSION_PAYLOAD_KEYS = new Set([
  "client_capture_id", "local_sequence", "capture_kind_ref",
  "source_system_ref", "source_label_ref", "captured_by_ref",
  "device_context_ref", "capture_time", "source_offset",
  "time_confidence_ref", "provisional_payload",
  "payload_representation_profile_ref", "payload_representation_version",
  "authorization_snapshot_ref", "supersedes_capture_ref",
]);

const PROVISIONAL_PAYLOAD_KEYS = new Set(["representation_kind", "inline_content", "durable_reference"]);

const CAPTURE_KIND_REFS = new Set(["OBSERVATION", "DRAFT_EVIDENCE"]);

function validateSubmissionPayload(payload: unknown): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!isRecord(payload)) return [issue("payload", "REQUIRED_STRUCT")];
  assertExactKeys(payload, SUBMISSION_PAYLOAD_KEYS, issues, "payload.");
  for (const key of [
    "client_capture_id", "capture_kind_ref", "source_system_ref",
    "source_label_ref", "captured_by_ref", "device_context_ref",
    "time_confidence_ref", "authorization_snapshot_ref",
  ]) requireNonEmptyString(payload, key, issues, "payload.");
  requireTimestamp(payload, "capture_time", issues, "payload.");
  requireNonNegativeInteger(payload, "local_sequence", issues, "payload.");
  optionalNonEmptyString(payload, "source_offset", issues, "payload.");
  optionalNonEmptyString(payload, "payload_representation_profile_ref", issues, "payload.");
  optionalNonEmptyString(payload, "payload_representation_version", issues, "payload.");
  optionalNonEmptyString(payload, "supersedes_capture_ref", issues, "payload.");
  if (!CAPTURE_KIND_REFS.has(payload.capture_kind_ref as string)) {
    issues.push(issue("payload.capture_kind_ref", "UNSUPPORTED_CAPTURE_KIND"));
  }
  // V-PC-001: validate provisional_payload branch
  const pp = requireRecord(payload, "provisional_payload", issues, "payload.");
  if (pp !== undefined) {
    assertExactKeys(pp, PROVISIONAL_PAYLOAD_KEYS, issues, "payload.provisional_payload.");
    requireNonEmptyString(pp, "representation_kind", issues, "payload.provisional_payload.");
    const kind = pp.representation_kind;
    if (kind === "INLINE_STRUCT") {
      if (!isRecord(pp.inline_content)) issues.push(issue("payload.provisional_payload.inline_content", "REQUIRED_STRUCT"));
      if (hasOwn(pp, "durable_reference") && pp.durable_reference !== undefined)
        issues.push(issue("payload.provisional_payload.durable_reference", "MUST_BE_ABSENT_FOR_INLINE_STRUCT"));
    } else if (kind === "DURABLE_REFERENCE") {
      requireNonEmptyString(pp, "durable_reference", issues, "payload.provisional_payload.");
      if (hasOwn(pp, "inline_content") && pp.inline_content !== undefined)
        issues.push(issue("payload.provisional_payload.inline_content", "MUST_BE_ABSENT_FOR_DURABLE_REFERENCE"));
    } else if (typeof kind === "string") {
      issues.push(issue("payload.provisional_payload.representation_kind", "UNRECOGNIZED_REPRESENTATION_KIND"));
    }
  }
  // payload_representation_version requires profile
  if (hasOwn(payload, "payload_representation_version") && payload.payload_representation_version !== undefined) {
    if (!hasOwn(payload, "payload_representation_profile_ref") || !payload.payload_representation_profile_ref)
      issues.push(issue("payload.payload_representation_profile_ref", "REQUIRED_WHEN_VERSION_PRESENT"));
  }
  return issues;
}

export function validatePendingCaptureSyncSubmission(input: unknown): ValidationResult {
  return validateContract(input, makeSpec(D05_SUBMISSION_INTERFACE_IDENTITY), validateSubmissionPayload);
}

// ── PENDING_ACCEPTANCE validator ──────────────────────────────────────────────

const PENDING_ACCEPTANCE_PAYLOAD_KEYS = new Set([
  "result_id", "message_id", "correlation_id", "acceptance_code",
  "reconciliation_required", "durable_result_ref", "reason_ref", "result_at",
  "client_capture_id", "pending_disposition_code", "pending_capture_id",
  "provisional_payload_ref", "provisional_payload_hash",
  "payload_representation_profile_ref", "payload_representation_version",
  "replay_disposition_code", "semantic_scope_code",
  "final_business_or_lifecycle_effect_applied",
]);

const ACCEPTANCE_CODES = new Set(["ACK", "NACK", "HOLD"]);
const PENDING_DISPOSITION_CODES = new Set(["PENDING_ACCEPTED", "PENDING_REJECTED", "PENDING_HELD"]);
const REPLAY_DISPOSITION_CODES = new Set([
  "NEW_DURABLE_ACCEPTANCE", "IDENTICAL_REPLAY_REUSED",
  "NOT_DURABLY_ACCEPTED", "CONFLICTING_REPLAY_HELD",
]);

function validatePendingAcceptancePayload(payload: unknown): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!isRecord(payload)) return [issue("payload", "REQUIRED_STRUCT")];
  assertExactKeys(payload, PENDING_ACCEPTANCE_PAYLOAD_KEYS, issues, "payload.");
  for (const key of [
    "result_id", "message_id", "correlation_id", "acceptance_code",
    "durable_result_ref", "client_capture_id", "pending_disposition_code",
    "replay_disposition_code", "semantic_scope_code",
  ]) requireNonEmptyString(payload, key, issues, "payload.");
  requireBoolean(payload, "reconciliation_required", issues, "payload.");
  requireTimestamp(payload, "result_at", issues, "payload.");
  optionalNonEmptyString(payload, "reason_ref", issues, "payload.");
  optionalNonEmptyString(payload, "pending_capture_id", issues, "payload.");
  optionalNonEmptyString(payload, "provisional_payload_ref", issues, "payload.");
  optionalNonEmptyString(payload, "provisional_payload_hash", issues, "payload.");
  optionalNonEmptyString(payload, "payload_representation_profile_ref", issues, "payload.");
  optionalNonEmptyString(payload, "payload_representation_version", issues, "payload.");
  if (!ACCEPTANCE_CODES.has(payload.acceptance_code as string))
    issues.push(issue("payload.acceptance_code", "INVALID_ACCEPTANCE_CODE"));
  if (!PENDING_DISPOSITION_CODES.has(payload.pending_disposition_code as string))
    issues.push(issue("payload.pending_disposition_code", "INVALID_PENDING_DISPOSITION_CODE"));
  if (!REPLAY_DISPOSITION_CODES.has(payload.replay_disposition_code as string))
    issues.push(issue("payload.replay_disposition_code", "INVALID_REPLAY_DISPOSITION_CODE"));
  if (payload.semantic_scope_code !== "PENDING_ONLY_NO_FINAL_SEMANTIC_SUCCESS")
    issues.push(issue("payload.semantic_scope_code", "INVALID_SEMANTIC_SCOPE_CODE"));
  if (payload.final_business_or_lifecycle_effect_applied !== false)
    issues.push(issue("payload.final_business_or_lifecycle_effect_applied", "MUST_BE_FALSE"));
  // Conditional: PENDING_ACCEPTED requires pending_capture_id + provisional_payload_ref + provisional_payload_hash
  if (payload.pending_disposition_code === "PENDING_ACCEPTED") {
    if (!payload.pending_capture_id)
      issues.push(issue("payload.pending_capture_id", "REQUIRED_FOR_PENDING_ACCEPTED"));
    if (!payload.provisional_payload_ref)
      issues.push(issue("payload.provisional_payload_ref", "REQUIRED_FOR_PENDING_ACCEPTED"));
    if (!payload.provisional_payload_hash)
      issues.push(issue("payload.provisional_payload_hash", "REQUIRED_FOR_PENDING_ACCEPTED"));
  }
  // Conditional: PENDING_REJECTED must not have newly created pending ids
  if (payload.pending_disposition_code === "PENDING_REJECTED") {
    if (payload.pending_capture_id)
      issues.push(issue("payload.pending_capture_id", "MUST_BE_ABSENT_FOR_PENDING_REJECTED"));
    if (payload.provisional_payload_ref)
      issues.push(issue("payload.provisional_payload_ref", "MUST_BE_ABSENT_FOR_PENDING_REJECTED"));
  }
  return issues;
}

export function validatePendingCaptureSyncPendingAcceptance(input: unknown): ValidationResult {
  return validateContract(
    input,
    makeSpec(D05_PENDING_ACCEPTANCE_INTERFACE_IDENTITY),
    validatePendingAcceptancePayload,
  );
}

// ── OUTCOME validator ─────────────────────────────────────────────────────────

const OUTCOME_PAYLOAD_KEYS = new Set([
  "client_capture_id", "pending_capture_id", "provisional_payload_ref",
  "outcome_code", "outcome_reason_code", "downstream_result_class_ref",
  "downstream_result_ref", "reconciliation_case_ref", "successor_capture_ref",
  "reason_ref", "source_currentness_ref", "outcome_at",
  "final_business_or_lifecycle_effect_asserted_by_this_message",
]);

const OUTCOME_CODES = new Set([
  "QUALIFIED", "PROMOTED", "REJECTED", "HELD",
  "RECONCILIATION_REQUIRED", "CORRECTED", "SUPERSEDED",
]);

const OUTCOME_REASON_CODES = new Set([
  "INVALID", "UNAUTHORIZED", "STALE", "UNSUPPORTED",
  "SOURCE_UNAVAILABLE", "PAYLOAD_HASH_MISMATCH",
  "UNRESOLVABLE_PAYLOAD_REFERENCE", "UNRESOLVED_SOURCE_BINDING",
  "CONFLICTING_REPLAY", "CAPTURE_ID_CONFLICT", "OUT_OF_ORDER_HELD",
  "CONTRADICTION", "OFFLINE_FINAL_EFFECT_PROHIBITED",
  "UNKNOWN_OR_MISMATCHED_PROFILE",
]);

const OUTCOME_REASON_REQUIRED = new Set(["REJECTED", "HELD", "RECONCILIATION_REQUIRED"]);

function validateOutcomePayload(payload: unknown): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!isRecord(payload)) return [issue("payload", "REQUIRED_STRUCT")];
  assertExactKeys(payload, OUTCOME_PAYLOAD_KEYS, issues, "payload.");
  for (const key of [
    "client_capture_id", "pending_capture_id", "provisional_payload_ref", "outcome_code",
  ]) requireNonEmptyString(payload, key, issues, "payload.");
  requireTimestamp(payload, "outcome_at", issues, "payload.");
  optionalNonEmptyString(payload, "outcome_reason_code", issues, "payload.");
  optionalNonEmptyString(payload, "downstream_result_class_ref", issues, "payload.");
  optionalNonEmptyString(payload, "downstream_result_ref", issues, "payload.");
  optionalNonEmptyString(payload, "reconciliation_case_ref", issues, "payload.");
  optionalNonEmptyString(payload, "successor_capture_ref", issues, "payload.");
  optionalNonEmptyString(payload, "reason_ref", issues, "payload.");
  optionalNonEmptyString(payload, "source_currentness_ref", issues, "payload.");
  if (!OUTCOME_CODES.has(payload.outcome_code as string))
    issues.push(issue("payload.outcome_code", "INVALID_OUTCOME_CODE"));
  if (hasOwn(payload, "outcome_reason_code") && payload.outcome_reason_code !== undefined) {
    if (!OUTCOME_REASON_CODES.has(payload.outcome_reason_code as string))
      issues.push(issue("payload.outcome_reason_code", "INVALID_OUTCOME_REASON_CODE"));
  }
  if (payload.final_business_or_lifecycle_effect_asserted_by_this_message !== false)
    issues.push(issue("payload.final_business_or_lifecycle_effect_asserted_by_this_message", "MUST_BE_FALSE"));
  // Conditional: outcome_reason_code required for REJECTED, HELD, RECONCILIATION_REQUIRED
  if (OUTCOME_REASON_REQUIRED.has(payload.outcome_code as string) && !payload.outcome_reason_code)
    issues.push(issue("payload.outcome_reason_code", "REQUIRED_FOR_OUTCOME_CODE"));
  // Conditional: PROMOTED requires downstream_result_class_ref + downstream_result_ref
  if (payload.outcome_code === "PROMOTED") {
    if (!payload.downstream_result_class_ref)
      issues.push(issue("payload.downstream_result_class_ref", "REQUIRED_FOR_PROMOTED"));
    if (!payload.downstream_result_ref)
      issues.push(issue("payload.downstream_result_ref", "REQUIRED_FOR_PROMOTED"));
  }
  // Conditional: RECONCILIATION_REQUIRED requires reconciliation_case_ref
  if (payload.outcome_code === "RECONCILIATION_REQUIRED" && !payload.reconciliation_case_ref)
    issues.push(issue("payload.reconciliation_case_ref", "REQUIRED_FOR_RECONCILIATION_REQUIRED"));
  return issues;
}

export function validatePendingCaptureSyncOutcome(input: unknown): ValidationResult {
  return validateContract(
    input,
    makeSpec(D05_OUTCOME_INTERFACE_IDENTITY),
    validateOutcomePayload,
  );
}

// ── Identity guard (for routing) ──────────────────────────────────────────────
export function isPendingCaptureSyncFamily(interfaceIdentity: unknown): boolean {
  return (
    interfaceIdentity === D05_SUBMISSION_INTERFACE_IDENTITY ||
    interfaceIdentity === D05_PENDING_ACCEPTANCE_INTERFACE_IDENTITY ||
    interfaceIdentity === D05_OUTCOME_INTERFACE_IDENTITY
  );
}
