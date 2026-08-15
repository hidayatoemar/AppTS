import test from "node:test";
import assert from "node:assert/strict";
import {
  validatePendingCaptureSyncSubmission,
  validatePendingCaptureSyncPendingAcceptance,
  validatePendingCaptureSyncOutcome,
} from "../../packages/contracts/src/pending-capture-sync.ts";

const validSubmission = () => ({
  interface_identity: "APPTS.RUNTIME.D05.PENDING_CAPTURE_SYNC.SUBMISSION",
  semantic_version: "1.0.0",
  profile_identity: "APPTS.RUNTIME.D05.PENDING_CAPTURE_SYNC.PROFILE.1.0.0",
  message_id: "msg-1",
  idempotency_key: "idem-1",
  correlation_id: "corr-1",
  producer_ref: "client-app-ref",
  subject_ref: "subject-ref-1",
  produced_at: "2026-08-14T10:00:00.000Z",
  payload_hash: "hash-abc",
  payload: {
    client_capture_id: "cid-1",
    local_sequence: 1,
    capture_kind_ref: "OBSERVATION",
    source_system_ref: "src-sys-1",
    source_label_ref: "src-label-1",
    captured_by_ref: "actor-ref-1",
    device_context_ref: "device-ref-1",
    capture_time: "2026-08-14T09:00:00.000Z",
    time_confidence_ref: "confidence-ref-1",
    provisional_payload: { representation_kind: "INLINE_STRUCT", inline_content: { data: "value" } },
    authorization_snapshot_ref: "auth-snap-1",
  },
});

const validPendingAcceptance = () => ({
  interface_identity: "APPTS.RUNTIME.D05.PENDING_CAPTURE_SYNC.PENDING_ACCEPTANCE",
  semantic_version: "1.0.0",
  profile_identity: "APPTS.RUNTIME.D05.PENDING_CAPTURE_SYNC.PROFILE.1.0.0",
  message_id: "msg-2",
  idempotency_key: "idem-1",
  correlation_id: "corr-1",
  producer_ref: "d05-server",
  subject_ref: "subject-ref-1",
  produced_at: "2026-08-14T10:00:01.000Z",
  payload_hash: "hash-def",
  payload: {
    result_id: "res-1",
    message_id: "msg-2",
    correlation_id: "corr-1",
    acceptance_code: "ACK",
    reconciliation_required: false,
    durable_result_ref: "durable-ref-1",
    result_at: "2026-08-14T10:00:01.000Z",
    client_capture_id: "cid-1",
    pending_disposition_code: "PENDING_ACCEPTED",
    pending_capture_id: "pc-id-1",
    provisional_payload_ref: "ppr-1",
    provisional_payload_hash: "hash-abc",
    replay_disposition_code: "NEW_DURABLE_ACCEPTANCE",
    semantic_scope_code: "PENDING_ONLY_NO_FINAL_SEMANTIC_SUCCESS",
    final_business_or_lifecycle_effect_applied: false,
  },
});

const validOutcome = () => ({
  interface_identity: "APPTS.RUNTIME.D05.PENDING_CAPTURE_SYNC.OUTCOME",
  semantic_version: "1.0.0",
  profile_identity: "APPTS.RUNTIME.D05.PENDING_CAPTURE_SYNC.PROFILE.1.0.0",
  message_id: "msg-3",
  idempotency_key: "idem-2",
  correlation_id: "corr-2",
  producer_ref: "d05-server",
  subject_ref: "subject-ref-1",
  produced_at: "2026-08-14T10:05:00.000Z",
  payload_hash: "hash-ghi",
  payload: {
    client_capture_id: "cid-1",
    pending_capture_id: "pc-id-1",
    provisional_payload_ref: "ppr-1",
    outcome_code: "QUALIFIED",
    outcome_at: "2026-08-14T10:05:00.000Z",
    final_business_or_lifecycle_effect_asserted_by_this_message: false,
  },
});

// ── V-PC-001 ──────────────────────────────────────────────────────────────────
test("V-PC-001 valid SUBMISSION with all required fields passes", () => { assert.equal(validatePendingCaptureSyncSubmission(validSubmission()).ok, true); });
test("V-PC-001 SUBMISSION missing envelope field fails", () => { const { payload_hash: _r, ...msg } = validSubmission(); assert.equal(validatePendingCaptureSyncSubmission(msg).ok, false); });
test("V-PC-001 SUBMISSION missing payload field fails", () => { const b = validSubmission(); const { client_capture_id: _r, ...payload } = b.payload; assert.equal(validatePendingCaptureSyncSubmission({ ...b, payload }).ok, false); });

// ── V-PC-002 ──────────────────────────────────────────────────────────────────
test("V-PC-002 capture_kind_ref DRAFT_EVIDENCE passes", () => { const b = validSubmission(); assert.equal(validatePendingCaptureSyncSubmission({ ...b, payload: { ...b.payload, capture_kind_ref: "DRAFT_EVIDENCE" } }).ok, true); });
test("V-PC-002 unknown capture_kind_ref fails with UNSUPPORTED_CAPTURE_KIND", () => { const b = validSubmission(); const r = validatePendingCaptureSyncSubmission({ ...b, payload: { ...b.payload, capture_kind_ref: "SOURCE" } }); assert.equal(r.ok, false); assert.ok(!r.ok && r.issues.some(i => i.code === "UNSUPPORTED_CAPTURE_KIND")); });

// ── V-PC-003 ──────────────────────────────────────────────────────────────────
test("V-PC-003 SUBMISSION missing source_system_ref fails", () => { const b = validSubmission(); const { source_system_ref: _r, ...payload } = b.payload; assert.equal(validatePendingCaptureSyncSubmission({ ...b, payload }).ok, false); });
test("V-PC-003 SUBMISSION missing source_label_ref fails", () => { const b = validSubmission(); const { source_label_ref: _r, ...payload } = b.payload; assert.equal(validatePendingCaptureSyncSubmission({ ...b, payload }).ok, false); });

// ── V-PC-004 ──────────────────────────────────────────────────────────────────
test("V-PC-004 envelope missing payload_hash fails", () => { const { payload_hash: _r, ...msg } = validSubmission(); assert.equal(validatePendingCaptureSyncSubmission(msg).ok, false); });

// ── V-PC-005 ──────────────────────────────────────────────────────────────────
test("V-PC-005 valid complete PENDING_ACCEPTANCE with PENDING_ACCEPTED passes", () => { assert.equal(validatePendingCaptureSyncPendingAcceptance(validPendingAcceptance()).ok, true); });

// ── V-PC-006 ──────────────────────────────────────────────────────────────────
test("V-PC-006 PENDING_ACCEPTANCE with IDENTICAL_REPLAY_REUSED passes", () => { const b = validPendingAcceptance(); assert.equal(validatePendingCaptureSyncPendingAcceptance({ ...b, payload: { ...b.payload, replay_disposition_code: "IDENTICAL_REPLAY_REUSED" } }).ok, true); });

// ── V-PC-007 ──────────────────────────────────────────────────────────────────
test("V-PC-007 PENDING_ACCEPTANCE HOLD/PENDING_HELD/CONFLICTING_REPLAY_HELD passes", () => {
  const b = validPendingAcceptance();
  assert.equal(validatePendingCaptureSyncPendingAcceptance({ ...b, payload: { ...b.payload, acceptance_code: "HOLD", pending_disposition_code: "PENDING_HELD", replay_disposition_code: "CONFLICTING_REPLAY_HELD" } }).ok, true);
});

// ── V-PC-008 ──────────────────────────────────────────────────────────────────
test("V-PC-008 PENDING_ACCEPTED missing pending_capture_id fails", () => {
  const b = validPendingAcceptance();
  const { pending_capture_id: _r, ...payload } = b.payload;
  assert.equal(validatePendingCaptureSyncPendingAcceptance({ ...b, payload }).ok, false);
});

// ── V-PC-009 ──────────────────────────────────────────────────────────────────
test("V-PC-009 PENDING_REJECTED with NACK passes", () => {
  const b = validPendingAcceptance();
  const { pending_capture_id: _a, provisional_payload_ref: _b, provisional_payload_hash: _c, ...rest } = b.payload;
  assert.equal(validatePendingCaptureSyncPendingAcceptance({ ...b, payload: { ...rest, acceptance_code: "NACK", pending_disposition_code: "PENDING_REJECTED", replay_disposition_code: "NOT_DURABLY_ACCEPTED" } }).ok, true);
});
test("V-PC-009 PENDING_REJECTED with pending_capture_id present fails", () => {
  const b = validPendingAcceptance();
  assert.equal(validatePendingCaptureSyncPendingAcceptance({ ...b, payload: { ...b.payload, acceptance_code: "NACK", pending_disposition_code: "PENDING_REJECTED", replay_disposition_code: "NOT_DURABLY_ACCEPTED" } }).ok, false);
});

// ── V-PC-010 ──────────────────────────────────────────────────────────────────
test("V-PC-010 OUTCOME HELD with SOURCE_UNAVAILABLE and final=false passes", () => {
  const b = validOutcome();
  assert.equal(validatePendingCaptureSyncOutcome({ ...b, payload: { ...b.payload, outcome_code: "HELD", outcome_reason_code: "SOURCE_UNAVAILABLE" } }).ok, true);
});

// ── V-PC-011 ──────────────────────────────────────────────────────────────────
test("V-PC-011 OUTCOME QUALIFIED passes", () => { assert.equal(validatePendingCaptureSyncOutcome(validOutcome()).ok, true); });

// ── V-PC-012 ──────────────────────────────────────────────────────────────────
test("V-PC-012 OUTCOME RECONCILIATION_REQUIRED without reconciliation_case_ref fails", () => { const b = validOutcome(); assert.equal(validatePendingCaptureSyncOutcome({ ...b, payload: { ...b.payload, outcome_code: "RECONCILIATION_REQUIRED", outcome_reason_code: "CONTRADICTION" } }).ok, false); });
test("V-PC-012 OUTCOME RECONCILIATION_REQUIRED with reconciliation_case_ref passes", () => { const b = validOutcome(); assert.equal(validatePendingCaptureSyncOutcome({ ...b, payload: { ...b.payload, outcome_code: "RECONCILIATION_REQUIRED", outcome_reason_code: "CONTRADICTION", reconciliation_case_ref: "case-1" } }).ok, true); });

// ── V-PC-013 ──────────────────────────────────────────────────────────────────
test("V-PC-013 OUTCOME CORRECTED with successor_capture_ref passes", () => { const b = validOutcome(); assert.equal(validatePendingCaptureSyncOutcome({ ...b, payload: { ...b.payload, outcome_code: "CORRECTED", successor_capture_ref: "succ-ref-1" } }).ok, true); });

// ── V-PC-014 ──────────────────────────────────────────────────────────────────
test("V-PC-014 OUTCOME REJECTED without outcome_reason_code fails", () => { const b = validOutcome(); assert.equal(validatePendingCaptureSyncOutcome({ ...b, payload: { ...b.payload, outcome_code: "REJECTED" } }).ok, false); });
test("V-PC-014 OUTCOME REJECTED with OUT_OF_ORDER_HELD passes", () => { const b = validOutcome(); assert.equal(validatePendingCaptureSyncOutcome({ ...b, payload: { ...b.payload, outcome_code: "REJECTED", outcome_reason_code: "OUT_OF_ORDER_HELD" } }).ok, true); });

// ── V-PC-015 ──────────────────────────────────────────────────────────────────
test("V-PC-015 OUTCOME REJECTED with OFFLINE_FINAL_EFFECT_PROHIBITED passes", () => { const b = validOutcome(); assert.equal(validatePendingCaptureSyncOutcome({ ...b, payload: { ...b.payload, outcome_code: "REJECTED", outcome_reason_code: "OFFLINE_FINAL_EFFECT_PROHIBITED" } }).ok, true); });

// ── V-PC-016 ──────────────────────────────────────────────────────────────────
test("V-PC-016 wrong semantic_version fails", () => { assert.equal(validatePendingCaptureSyncSubmission({ ...validSubmission(), semantic_version: "2.0.0" }).ok, false); });
test("V-PC-016 wrong profile_identity fails", () => { assert.equal(validatePendingCaptureSyncSubmission({ ...validSubmission(), profile_identity: "WRONG.PROFILE" }).ok, false); });
test("V-PC-016 wrong interface_identity fails", () => { assert.equal(validatePendingCaptureSyncSubmission({ ...validSubmission(), interface_identity: "WRONG.IDENTITY" }).ok, false); });
