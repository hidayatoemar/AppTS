import { assertExactKeys, isRecord, issue, optionalNonEmptyString, requireArray, requireNonEmptyString, requireTimestamp, resultFromIssues, type ContractHash, type ContractId, type ContractReference, type ContractTime, type ValidationIssue, type ValidationResult } from "./common/envelope.ts";

export const DIAGNOSTIC_EFFECT_STATUSES = ["NO_EFFECT", "EFFECT_CONFIRMED", "EFFECT_UNCERTAIN_RECONCILIATION_REQUIRED"] as const;
export const ROOT_CAUSE_STATUSES = ["SUSPECTED", "CONFIRMED", "UNDETERMINED"] as const;
export const DIAGNOSTIC_CHANNEL_CLASSES = ["WHATSAPP", "EMAIL"] as const;
export const DIAGNOSTIC_ACKNOWLEDGMENT_CODES = ["RECEIVED", "ACKNOWLEDGED"] as const;
export type DiagnosticEffectStatus = (typeof DIAGNOSTIC_EFFECT_STATUSES)[number];
export type RootCauseStatus = (typeof ROOT_CAUSE_STATUSES)[number];
export type DiagnosticChannelClass = (typeof DIAGNOSTIC_CHANNEL_CLASSES)[number];
export type DiagnosticAcknowledgmentCode = (typeof DIAGNOSTIC_ACKNOWLEDGMENT_CODES)[number];

export type DiagnosticSubject =
  | { readonly subject_type_ref: string; readonly subject_ref_id: ContractId; readonly subject_ref_code?: never; readonly source_ref?: ContractReference; readonly source_version_ref?: ContractReference }
  | { readonly subject_type_ref: string; readonly subject_ref_id?: never; readonly subject_ref_code: string; readonly source_ref?: ContractReference; readonly source_version_ref?: ContractReference };

export interface DiagnosticEvent {
  readonly error_event_id: ContractId; readonly occurred_at: ContractTime; readonly correlation_id: ContractId; readonly causation_id?: ContractId;
  readonly trace_id?: string; readonly span_id?: string; readonly environment_ref: string; readonly application_ref: string; readonly service_ref?: string;
  readonly module_ref?: string; readonly component_ref: string; readonly build_version_ref: string; readonly source_revision_or_commit_ref: string;
  readonly configuration_version_ref: string; readonly configuration_snapshot_id?: ContractId; readonly operation_identity: string;
  readonly actor_ref?: ContractId; readonly role_or_assignment_ref?: ContractId; readonly affected_subjects?: readonly DiagnosticSubject[];
  readonly state_before_ref?: string; readonly attempted_action_or_transition_ref?: string; readonly resulting_state_or_effect_ref?: string;
  readonly mapping_entry_id: ContractId; readonly canonical_error_code: string; readonly error_category_ref: string; readonly severity_ref: string;
  readonly exception_type_ref?: string; readonly payload_fingerprint?: ContractHash; readonly transaction_commit_status_ref?: string;
  readonly diagnostic_effect_status: DiagnosticEffectStatus; readonly retryability_status_ref: string; readonly retryability_reason_ref?: string;
  readonly reconciliation_case_id?: ContractId; readonly root_cause_status: RootCauseStatus; readonly remediation_hint_or_runbook_ref?: ContractReference;
  readonly diagnostic_owner_or_queue_ref: string; readonly safe_user_reference_code: string; readonly safe_message_key: string; readonly committed_at: ContractTime;
  readonly disclosure_label_ref: ContractReference; readonly integrity_envelope_id?: ContractId; readonly secure_diagnostic_bundle_ref: ContractId;
}

export interface SafeErrorEnvelope { readonly canonical_error_code: string; readonly safe_user_reference_code: string; readonly correlation_id: ContractId; readonly diagnostic_effect_status: DiagnosticEffectStatus; readonly retryability_status_ref?: string; readonly safe_message_key: string; readonly safe_message_parameters?: Readonly<Record<string, unknown>>; }
export interface SecureDiagnosticRetrievalInput { readonly lookup_identity: ContractId | string; readonly requester_or_principal_ref: ContractReference; readonly authority_context_ref: ContractReference | Readonly<Record<string, unknown>>; }
export interface SecureDiagnosticRetrievalOutput { readonly diagnostic_bundle_id: ContractId; readonly error_event_id: ContractId; readonly permitted_chronology_ref: ContractReference; readonly permitted_component_or_owner_ref: ContractReference; readonly permitted_state_and_action_ref: ContractReference; readonly dependency_evidence_ref: ContractReference; readonly transaction_or_effect_evidence_ref: ContractReference; readonly retry_duplicate_compensation_reconciliation_ref: ContractReference; readonly redacted_reproduction_material_ref: ContractReference; readonly build_source_configuration_ref: ContractReference; readonly correction_or_supersession_lineage_ref: ContractReference; }
export interface DiagnosticRegistryVersion { readonly registry_version_id: ContractId; readonly registry_identity: string; readonly registry_version: string; readonly configuration_snapshot_id: ContractId; readonly effective_from: ContractTime; readonly effective_to?: ContractTime; readonly currentness_ref: ContractReference; readonly status_ref: string; }
export interface DiagnosticMappingEntry { readonly mapping_entry_id: ContractId; readonly registry_version_id: ContractId; readonly implementation_failure_identity: string; readonly canonical_error_code: string; readonly error_category_ref: string; readonly severity_ref: string; readonly effect_classification_rule_ref: string; readonly retryability_rule_ref: string; readonly reconciliation_rule_ref: string; readonly safe_user_message_key: string; readonly diagnostic_owner_or_queue_ref: string; readonly required_evidence_set_ref: string; readonly required_test_vector_ref: string; }
export interface DiagnosticNotification { readonly notification_id: ContractId; readonly error_event_id: ContractId; readonly diagnostic_bundle_id: ContractId; readonly correlation_id: ContractId; readonly channel_class: DiagnosticChannelClass; readonly routing_configuration_snapshot_id: ContractId; readonly resolved_role_or_queue_ref: string; readonly sanitized_payload_evidence_id: ContractId; readonly outbox_entry_id: ContractId; readonly aggregation_group_id?: ContractId; readonly fallback_from_notification_id?: ContractId; readonly produced_at: ContractTime; readonly queued_at: ContractTime; }
export interface DiagnosticNotificationAttempt { readonly notification_attempt_id: ContractId; readonly notification_id: ContractId; readonly attempt_sequence: number; readonly provider_adapter_ref?: string; readonly delivery_correlation_id: ContractId; readonly initiated_at: ContractTime; readonly issued_at?: ContractTime; readonly timeout_basis_configuration_snapshot_id?: ContractId; readonly retry_of_attempt_id?: ContractId; }
export interface DiagnosticNotificationDeliveryResult { readonly notification_result_id: ContractId; readonly notification_attempt_id: ContractId; readonly delivery_result_class_ref: string; readonly provider_or_transport_result_ref?: string; readonly result_at: ContractTime; readonly evidence_id?: ContractId; readonly retry_disposition_ref?: string; readonly fallback_or_escalation_ref?: string; readonly routing_configuration_snapshot_id?: ContractId; }
export interface DiagnosticNotificationDeadLetter { readonly dead_letter_id: ContractId; readonly notification_id: ContractId; readonly notification_attempt_id: ContractId; readonly notification_result_id: ContractId; readonly reason_ref: string; readonly evidence_id?: ContractId; readonly recorded_at: ContractTime; }
export interface DiagnosticAlertAcknowledgment { readonly diagnostic_notification_ack_id: ContractId; readonly notification_id: ContractId; readonly notification_attempt_id?: ContractId; readonly notification_result_id?: ContractId; readonly acknowledgment_code: DiagnosticAcknowledgmentCode; readonly acknowledged_by_ref?: ContractReference; readonly acknowledged_at: ContractTime; readonly evidence_id?: ContractId; readonly correlation_id: ContractId; }
export interface DiagnosticAggregationGroup { readonly aggregation_group_id: ContractId; readonly diagnostic_fingerprint: ContractHash; readonly storm_control_configuration_snapshot_id: ContractId; readonly first_seen_at: ContractTime; readonly latest_seen_at: ContractTime; readonly occurrence_count: number; readonly current_summary_evidence_id?: ContractId; readonly updated_at: ContractTime; }
export interface DiagnosticAggregationMember { readonly aggregation_member_id: ContractId; readonly aggregation_group_id: ContractId; readonly error_event_id: ContractId; readonly included_at: ContractTime; }
export interface DiagnosticStormDecision { readonly storm_control_decision_id: ContractId; readonly error_event_id: ContractId; readonly aggregation_group_id?: ContractId; readonly configuration_snapshot_id: ContractId; readonly decision_class_ref: string; readonly reason_ref: string; readonly evidence_id?: ContractId; readonly decided_at: ContractTime; }
export interface DiagnosticAdapterFailureLink { readonly notification_failure_link_id: ContractId; readonly failed_notification_attempt_id: ContractId; readonly parent_error_event_id: ContractId; readonly child_error_event_id: ContractId; readonly root_error_event_id: ContractId; readonly recursion_depth: number; readonly storm_control_configuration_snapshot_id: ContractId; readonly storm_control_decision_id?: ContractId; readonly linked_at: ContractTime; }
export interface DiagnosticEventCorrection { readonly diagnostic_event_correction_id: ContractId; readonly original_error_event_id: ContractId; readonly corrected_scope_ref: string; readonly predecessor_bundle_id: ContractId; readonly successor_bundle_id: ContractId; readonly reason_ref: string; readonly evidence_id: ContractId; readonly predecessor_correction_id?: ContractId; readonly committed_at: ContractTime; }

const SAFE_KEYS = new Set(["canonical_error_code", "safe_user_reference_code", "correlation_id", "diagnostic_effect_status", "retryability_status_ref", "safe_message_key", "safe_message_parameters"]);
const FORBIDDEN_SAFE_FIELDS = new Set(["stack", "stack_trace", "secret", "credential", "token", "raw_payload", "database_dump", "topology_secret"]);
export function validateSafeErrorEnvelope(input: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (!isRecord(input)) return { ok: false, issues: [issue("$", "REQUIRED_STRUCT")] };
  assertExactKeys(input, SAFE_KEYS, issues);
  for (const key of ["canonical_error_code", "safe_user_reference_code", "correlation_id", "diagnostic_effect_status", "safe_message_key"]) requireNonEmptyString(input, key, issues);
  optionalNonEmptyString(input, "retryability_status_ref", issues);
  if (!DIAGNOSTIC_EFFECT_STATUSES.includes(input.diagnostic_effect_status as DiagnosticEffectStatus)) issues.push(issue("diagnostic_effect_status", "INVALID_DIAGNOSTIC_EFFECT_STATUS"));
  if (Object.prototype.hasOwnProperty.call(input, "safe_message_parameters")) {
    if (!isRecord(input.safe_message_parameters)) issues.push(issue("safe_message_parameters", "REQUIRED_STRUCT"));
    else for (const key of Object.keys(input.safe_message_parameters)) if (FORBIDDEN_SAFE_FIELDS.has(key.toLowerCase())) issues.push(issue(`safe_message_parameters.${key}`, "PROTECTED_DETAIL_FORBIDDEN"));
  }
  return resultFromIssues(issues);
}
const EVENT_KEYS = new Set(["error_event_id", "occurred_at", "correlation_id", "causation_id", "trace_id", "span_id", "environment_ref", "application_ref", "service_ref", "module_ref", "component_ref", "build_version_ref", "source_revision_or_commit_ref", "configuration_version_ref", "configuration_snapshot_id", "operation_identity", "actor_ref", "role_or_assignment_ref", "affected_subjects", "state_before_ref", "attempted_action_or_transition_ref", "resulting_state_or_effect_ref", "mapping_entry_id", "canonical_error_code", "error_category_ref", "severity_ref", "exception_type_ref", "payload_fingerprint", "transaction_commit_status_ref", "diagnostic_effect_status", "retryability_status_ref", "retryability_reason_ref", "reconciliation_case_id", "root_cause_status", "remediation_hint_or_runbook_ref", "diagnostic_owner_or_queue_ref", "safe_user_reference_code", "safe_message_key", "committed_at", "disclosure_label_ref", "integrity_envelope_id", "secure_diagnostic_bundle_ref"]);
export function validateDiagnosticEvent(input: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (!isRecord(input)) return { ok: false, issues: [issue("$", "REQUIRED_STRUCT")] };
  assertExactKeys(input, EVENT_KEYS, issues);
  for (const key of ["error_event_id", "correlation_id", "environment_ref", "application_ref", "component_ref", "build_version_ref", "source_revision_or_commit_ref", "configuration_version_ref", "operation_identity", "mapping_entry_id", "canonical_error_code", "error_category_ref", "severity_ref", "diagnostic_effect_status", "retryability_status_ref", "root_cause_status", "diagnostic_owner_or_queue_ref", "safe_user_reference_code", "safe_message_key", "disclosure_label_ref", "secure_diagnostic_bundle_ref"]) requireNonEmptyString(input, key, issues);
  requireTimestamp(input, "occurred_at", issues); requireTimestamp(input, "committed_at", issues);
  if (!DIAGNOSTIC_EFFECT_STATUSES.includes(input.diagnostic_effect_status as DiagnosticEffectStatus)) issues.push(issue("diagnostic_effect_status", "INVALID_DIAGNOSTIC_EFFECT_STATUS"));
  if (!ROOT_CAUSE_STATUSES.includes(input.root_cause_status as RootCauseStatus)) issues.push(issue("root_cause_status", "INVALID_ROOT_CAUSE_STATUS"));
  if (input.diagnostic_effect_status === "EFFECT_UNCERTAIN_RECONCILIATION_REQUIRED" && typeof input.reconciliation_case_id !== "string") issues.push(issue("reconciliation_case_id", "REQUIRED_FOR_UNCERTAIN_EFFECT"));
  if (Object.prototype.hasOwnProperty.call(input, "affected_subjects")) requireArray(input, "affected_subjects", issues);
  return resultFromIssues(issues);
}
