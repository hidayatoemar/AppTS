import assert from "node:assert/strict";
import test from "node:test";
import { createDiagnosticEvent, createDiagnosticNotification, affectsBusinessTransaction, recordAlertAcknowledgment, linkAdapterFailure, type TrappedFailure } from "../../packages/diagnostics/src/index.ts";
import type { DiagnosticMappingEntry } from "../../packages/contracts/src/index.ts";

const mapping: DiagnosticMappingEntry = { mapping_entry_id: "m", registry_version_id: "rv", implementation_failure_identity: "FAIL", canonical_error_code: "ADAPTER_FAIL", error_category_ref: "ADAPTER", severity_ref: "ERROR", effect_classification_rule_ref: "NO_EFFECT", retryability_rule_ref: "CONTROLLED", reconciliation_rule_ref: "REQUIRED_IF_UNCERTAIN", safe_user_message_key: "safe.adapter", diagnostic_owner_or_queue_ref: "techlead", required_evidence_set_ref: "e", required_test_vector_ref: "t" };
const failure: TrappedFailure = { errorEventId: "err", occurredAt: "2026-08-11T01:00:00Z", committedAt: "2026-08-11T01:00:01Z", correlationId: "corr", environmentRef: "env", applicationRef: "app", componentRef: "adapter", buildVersionRef: "build", sourceRevisionRef: "commit", configurationVersionRef: "cfg", operationIdentity: "notify", effectStatus: "NO_EFFECT", rootCauseStatus: "UNDETERMINED", secureBundleRef: "bundle", disclosureLabelRef: "restricted" };

test("diagnostic notification requires controlled routing and remains downstream evidence", () => {
  const event = createDiagnosticEvent(failure, mapping);
  assert.throws(() => createDiagnosticNotification(event, undefined, { notificationId: "n", sanitizedPayloadEvidenceId: "safe", outboxEntryId: "out", producedAt: failure.occurredAt, queuedAt: failure.committedAt }), /NO_DEFAULT/);
  const notification = createDiagnosticNotification(event, { configurationSnapshotId: "routing-v", channelClass: "EMAIL", resolvedRoleOrQueueRef: "techlead" }, { notificationId: "n", sanitizedPayloadEvidenceId: "safe", outboxEntryId: "out", producedAt: failure.occurredAt, queuedAt: failure.committedAt });
  assert.equal(notification.channel_class, "EMAIL");
  assert.equal(affectsBusinessTransaction(), false);
});

test("alert acknowledgment and recursive adapter failure cannot create authority", () => {
  const effect = recordAlertAcknowledgment({ diagnostic_notification_ack_id: "ack", notification_id: "n", acknowledgment_code: "ACKNOWLEDGED", acknowledged_at: "2026-08-11T02:00:00Z", correlation_id: "corr" });
  assert.equal(effect.ticketClosed, false); assert.equal(effect.retryAuthorized, false); assert.equal(effect.authorityWidened, false);
  assert.throws(() => linkAdapterFailure({ notification_failure_link_id: "l", failed_notification_attempt_id: "a", parent_error_event_id: "same", child_error_event_id: "same", root_error_event_id: "same", recursion_depth: 1, storm_control_configuration_snapshot_id: "storm", linked_at: "2026-08-11T02:00:00Z" }, 3), /SELF_RECURSIVE/);
});
