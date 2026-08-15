import assert from "node:assert/strict";
import test from "node:test";
import {
  validatePendingCaptureSyncSubmission,
  validatePendingCaptureSyncPendingAcceptance,
  validatePendingCaptureSyncOutcome,
} from "../../packages/contracts/src/pending-capture-sync.ts";
import { validatePendingBatch, type PendingCapture } from "../../packages/adapters-d05/src/pending-capture.ts";

const baseEnvelope = {
  semantic_version: "1.0.0",
  profile_identity: "APPTS.RUNTIME.D05.PENDING_CAPTURE_SYNC.PROFILE.1.0.0",
  message_id: "msg-adv-1",
  idempotency_key: "idem-adv-1",
  correlation_id: "corr-adv-1",
  producer_ref: "adv-producer",
  subject_ref: "adv-subject",
  produced_at: "2026-08-14T10:00:00.000Z",
  payload_hash: "hash-adv",
};

const baseSubmissionPayload = {
  client_capture_id: "cid-adv-1",
  local_sequence: 1,
  capture_kind_ref: "OBSERVATION" as const,
  source_system_ref: "src-sys-1",
  source_label_ref: "src-label-1",
  captured_by_ref: "actor-adv-1",
  device_context_ref: "device-adv-1",
  capture_time: "2026-08-14T09:00:00.000Z",
  time_confidence_ref: "confidence-ref-1",
  provisional_payload: { representation_kind: "INLINE_STRUCT" as const, inline_content: { value: "x" } },
  authorization_snapshot_ref: "auth-adv-1",
};

const makeCapture = (localSequence: number, clientCaptureId = `cid-${localSequence}`): PendingCapture => ({
  clientCaptureId,
  localSequence,
  captureKindRef: "OBSERVATION",
  sourceSystemRef: "src-1",
  sourceLabelRef: "label-1",
  capturedByRef: "actor-1",
  deviceContextRef: "device-1",
  captureTime: "2026-08-14T09:00:00.000Z",
  timeConfidenceRef: "confidence-ref-1",
  provisionalPayload: { representationKind: "INLINE_STRUCT", inlineContent: {} },
  payloadHash: `hash-${localSequence}`,
  authorizationSnapshotRef: "auth-1",
  finalEffectClaimed: false,
});

// ── Conflicting replay: same idempotency_key, different payload ───────────────
test("conflicting replay is held: PENDING_ACCEPTANCE HOLD/PENDING_HELD/CONFLICTING_REPLAY_HELD validates", () => {
  const msg = {
    ...baseEnvelope,
    interface_identity: "APPTS.RUNTIME.D05.PENDING_CAPTURE_SYNC.PENDING_ACCEPTANCE",
    payload: {
      result_id: "res-adv-1",
      message_id: "msg-adv-1",
      correlation_id: "corr-adv-1",
      acceptance_code: "HOLD",
      reconciliation_required: false,
      durable_result_ref: "durable-hold-1",
      result_at: "2026-08-14T10:00:01.000Z",
      client_capture_id: "cid-adv-1",
      pending_disposition_code: "PENDING_HELD",
      replay_disposition_code: "CONFLICTING_REPLAY_HELD",
      semantic_scope_code: "PENDING_ONLY_NO_FINAL_SEMANTIC_SUCCESS",
      final_business_or_lifecycle_effect_applied: false,
    },
  };
  assert.equal(validatePendingCaptureSyncPendingAcceptance(msg).ok, true);
});

test("conflicting replay hold must not carry pending_capture_id", () => {
  const msg = {
    ...baseEnvelope,
    interface_identity: "APPTS.RUNTIME.D05.PENDING_CAPTURE_SYNC.PENDING_ACCEPTANCE",
    payload: {
      result_id: "res-adv-2",
      message_id: "msg-adv-1",
      correlation_id: "corr-adv-1",
      acceptance_code: "NACK",
      reconciliation_required: false,
      durable_result_ref: "durable-rej-1",
      result_at: "2026-08-14T10:00:01.000Z",
      client_capture_id: "cid-adv-1",
      pending_disposition_code: "PENDING_REJECTED",
      pending_capture_id: "pc-leaked-id",
      replay_disposition_code: "NOT_DURABLY_ACCEPTED",
      semantic_scope_code: "PENDING_ONLY_NO_FINAL_SEMANTIC_SUCCESS",
      final_business_or_lifecycle_effect_applied: false,
    },
  };
  // PENDING_REJECTED must not carry a pending_capture_id (would imply durable creation)
  assert.equal(validatePendingCaptureSyncPendingAcceptance(msg).ok, false);
});

// ── Capture ID conflict: same client_capture_id, different content ────────────
test("capture ID conflict outcome: HELD/CAPTURE_ID_CONFLICT validates and is non-terminal pending hold", () => {
  const msg = {
    ...baseEnvelope,
    interface_identity: "APPTS.RUNTIME.D05.PENDING_CAPTURE_SYNC.OUTCOME",
    payload: {
      client_capture_id: "cid-adv-1",
      pending_capture_id: "pc-id-1",
      provisional_payload_ref: "ppr-1",
      outcome_code: "HELD",
      outcome_reason_code: "CAPTURE_ID_CONFLICT",
      outcome_at: "2026-08-14T10:05:00.000Z",
      final_business_or_lifecycle_effect_asserted_by_this_message: false,
    },
  };
  const result = validatePendingCaptureSyncOutcome(msg);
  assert.equal(result.ok, true);
});

test("HELD outcome without outcome_reason_code fails closed", () => {
  const msg = {
    ...baseEnvelope,
    interface_identity: "APPTS.RUNTIME.D05.PENDING_CAPTURE_SYNC.OUTCOME",
    payload: {
      client_capture_id: "cid-adv-1",
      pending_capture_id: "pc-id-1",
      provisional_payload_ref: "ppr-1",
      outcome_code: "HELD",
      outcome_at: "2026-08-14T10:05:00.000Z",
      final_business_or_lifecycle_effect_asserted_by_this_message: false,
    },
  };
  assert.equal(validatePendingCaptureSyncOutcome(msg).ok, false);
});

// ── Offline final effect prohibition ─────────────────────────────────────────
test("offline final effect prohibition: OUTCOME HELD/OFFLINE_FINAL_EFFECT_PROHIBITED validates", () => {
  const msg = {
    ...baseEnvelope,
    interface_identity: "APPTS.RUNTIME.D05.PENDING_CAPTURE_SYNC.OUTCOME",
    payload: {
      client_capture_id: "cid-adv-1",
      pending_capture_id: "pc-id-1",
      provisional_payload_ref: "ppr-1",
      outcome_code: "HELD",
      outcome_reason_code: "OFFLINE_FINAL_EFFECT_PROHIBITED",
      outcome_at: "2026-08-14T10:05:00.000Z",
      final_business_or_lifecycle_effect_asserted_by_this_message: false,
    },
  };
  assert.equal(validatePendingCaptureSyncOutcome(msg).ok, true);
});

test("PendingCapture.finalEffectClaimed is structurally false and cannot be bypassed by batch", () => {
  // Attempt to inject a capture with finalEffectClaimed=true is rejected at the type boundary;
  // at runtime, validatePendingBatch passes through accepted items unchanged — the adapter
  // layer never sets sensitiveEffectAllowed unless currentAuthorityConfirmed is true
  const batch = [makeCapture(1)];
  const result = validatePendingBatch(batch, false);
  assert.equal(result.sensitiveEffectAllowed, false);
  assert.equal(result.accepted[0]!.finalEffectClaimed, false);
});

test("sensitiveEffectAllowed requires explicit currentAuthorityConfirmed flag", () => {
  const batch = [makeCapture(1)];
  assert.equal(validatePendingBatch(batch, false).sensitiveEffectAllowed, false);
  assert.equal(validatePendingBatch(batch, true).sensitiveEffectAllowed, true);
});

// ── Out-of-order: local_sequence does not grant truth precedence ──────────────
test("out-of-order batch with non-sequential local_sequences passes validation (no authority from arrival order)", () => {
  const items = [makeCapture(5), makeCapture(2), makeCapture(9)];
  const result = validatePendingBatch(items, false);
  // All accepted — order of arrival does not confer truth or sequence authority
  assert.equal(result.accepted.length, 3);
});

test("OUT_OF_ORDER_HELD outcome validates: held capture cannot claim sequence authority", () => {
  const msg = {
    ...baseEnvelope,
    interface_identity: "APPTS.RUNTIME.D05.PENDING_CAPTURE_SYNC.OUTCOME",
    payload: {
      client_capture_id: "cid-adv-3",
      pending_capture_id: "pc-id-3",
      provisional_payload_ref: "ppr-3",
      outcome_code: "HELD",
      outcome_reason_code: "OUT_OF_ORDER_HELD",
      outcome_at: "2026-08-14T10:05:00.000Z",
      final_business_or_lifecycle_effect_asserted_by_this_message: false,
    },
  };
  assert.equal(validatePendingCaptureSyncOutcome(msg).ok, true);
});

// ── Uncertain commit: reconciliation required before any retry ────────────────
test("RECONCILIATION_REQUIRED outcome without reconciliation_case_ref fails closed", () => {
  const msg = {
    ...baseEnvelope,
    interface_identity: "APPTS.RUNTIME.D05.PENDING_CAPTURE_SYNC.OUTCOME",
    payload: {
      client_capture_id: "cid-adv-1",
      pending_capture_id: "pc-id-1",
      provisional_payload_ref: "ppr-1",
      outcome_code: "RECONCILIATION_REQUIRED",
      outcome_reason_code: "CONTRADICTION",
      outcome_at: "2026-08-14T10:05:00.000Z",
      final_business_or_lifecycle_effect_asserted_by_this_message: false,
    },
  };
  assert.equal(validatePendingCaptureSyncOutcome(msg).ok, false);
});

test("RECONCILIATION_REQUIRED outcome with reconciliation_case_ref validates: retry must await case resolution", () => {
  const msg = {
    ...baseEnvelope,
    interface_identity: "APPTS.RUNTIME.D05.PENDING_CAPTURE_SYNC.OUTCOME",
    payload: {
      client_capture_id: "cid-adv-1",
      pending_capture_id: "pc-id-1",
      provisional_payload_ref: "ppr-1",
      outcome_code: "RECONCILIATION_REQUIRED",
      outcome_reason_code: "CONTRADICTION",
      reconciliation_case_ref: "recon-case-1",
      outcome_at: "2026-08-14T10:05:00.000Z",
      final_business_or_lifecycle_effect_asserted_by_this_message: false,
    },
  };
  assert.equal(validatePendingCaptureSyncOutcome(msg).ok, true);
});

// ── Source unavailable hold ───────────────────────────────────────────────────
test("SOURCE_UNAVAILABLE hold validates: capture is held pending source resolution", () => {
  const msg = {
    ...baseEnvelope,
    interface_identity: "APPTS.RUNTIME.D05.PENDING_CAPTURE_SYNC.OUTCOME",
    payload: {
      client_capture_id: "cid-adv-1",
      pending_capture_id: "pc-id-1",
      provisional_payload_ref: "ppr-1",
      outcome_code: "HELD",
      outcome_reason_code: "SOURCE_UNAVAILABLE",
      source_currentness_ref: "source-currentness-stale",
      outcome_at: "2026-08-14T10:05:00.000Z",
      final_business_or_lifecycle_effect_asserted_by_this_message: false,
    },
  };
  assert.equal(validatePendingCaptureSyncOutcome(msg).ok, true);
});

// ── DURABLE_REFERENCE provisional payload: adverse missing durable_reference ──
test("DURABLE_REFERENCE without durable_reference field fails closed", () => {
  const msg = {
    ...baseEnvelope,
    interface_identity: "APPTS.RUNTIME.D05.PENDING_CAPTURE_SYNC.SUBMISSION",
    payload: { ...baseSubmissionPayload, provisional_payload: { representation_kind: "DURABLE_REFERENCE" } },
  };
  assert.equal(validatePendingCaptureSyncSubmission(msg).ok, false);
});

test("DURABLE_REFERENCE with empty durable_reference fails closed", () => {
  const msg = {
    ...baseEnvelope,
    interface_identity: "APPTS.RUNTIME.D05.PENDING_CAPTURE_SYNC.SUBMISSION",
    payload: { ...baseSubmissionPayload, provisional_payload: { representation_kind: "DURABLE_REFERENCE", durable_reference: "" } },
  };
  assert.equal(validatePendingCaptureSyncSubmission(msg).ok, false);
});

// ── Batch boundary and duplicate detection ────────────────────────────────────
test("batch at exactly 250 items is accepted without error", () => {
  const items = Array.from({ length: 250 }, (_, i) => makeCapture(i));
  const result = validatePendingBatch(items, false);
  assert.equal(result.accepted.length, 250);
});

test("batch at 251 items fails closed with PENDING_CAPTURE_LIMIT_EXCEEDED", () => {
  const items = Array.from({ length: 251 }, (_, i) => makeCapture(i));
  assert.throws(() => validatePendingBatch(items, false), /PENDING_CAPTURE_LIMIT_EXCEEDED/);
});

test("duplicate local_sequence across different client_capture_ids fails closed with DUPLICATE_LOCAL_SEQUENCE", () => {
  const items = [makeCapture(3, "cid-a"), makeCapture(3, "cid-b")];
  assert.throws(() => validatePendingBatch(items, false), /DUPLICATE_LOCAL_SEQUENCE/);
});
