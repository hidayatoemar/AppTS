import test from "node:test";
import assert from "node:assert/strict";
import {
  validatePendingCaptureSyncSubmission,
  validatePendingCaptureSyncPendingAcceptance,
  validatePendingCaptureSyncOutcome,
} from "../../packages/contracts/src/pending-capture-sync.ts";
import { validatePendingBatch, type PendingCapture } from "../../packages/adapters-d05/src/pending-capture.ts";

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

const makePendingCapture = (localSequence: number): PendingCapture => ({
  clientCaptureId: `cid-${localSequence}`,
  localSequence,
  captureKindRef: "OBSERVATION",
  sourceSystemRef: "src-1",
  sourceLabelRef: "label-1",
  capturedByRef: "actor-1",
  deviceContextRef: "device-1",
  captureTime: "2026-08-14T09:00:00.000Z",
  timeConfidenceRef: "confidence-ref-1",
  provisionalPayload: { representationKind: "INLINE_STRUCT", inlineContent: {} },
  payloadHash: "hash-1",
  authorizationSnapshotRef: "auth-1",
  finalEffectClaimed: false,
});

// ── PC-V01 ────────────────────────────────────────────────────────────────────
test("PC-V01 schema identity: valid SUBMISSION passes", () => { assert.equal(validatePendingCaptureSyncSubmission(validSubmission()).ok, true); });
test("PC-V01 schema identity: wrong interface_identity fails", () => { assert.equal(validatePendingCaptureSyncSubmission({ ...validSubmission(), interface_identity: "WRONG.IDENTITY" }).ok, false); });

// ── PC-V02 ────────────────────────────────────────────────────────────────────
test("PC-V02 valid first submission passes contract validator", () => { assert.equal(validatePendingCaptureSyncSubmission(validSubmission()).ok, true); });
test("PC-V02 PENDING_ACCEPTANCE with PENDING_ACCEPTED and all required refs passes", () => { assert.equal(validatePendingCaptureSyncPendingAcceptance(validPendingAcceptance()).ok, true); });

// ── PC-V03 ────────────────────────────────────────────────────────────────────
test("PC-V03 provisional_payload INLINE_STRUCT with inline_content passes", () => { assert.equal(validatePendingCaptureSyncSubmission(validSubmission()).ok, true); });
test("PC-V03 provisional_payload DURABLE_REFERENCE with durable_reference passes", () => {
  const b = validSubmission();
  assert.equal(validatePendingCaptureSyncSubmission({ ...b, payload: { ...b.payload, provisional_payload: { representation_kind: "DURABLE_REFERENCE", durable_reference: "durable-ref-1" } } }).ok, true);
});
test("PC-V03 provisional_payload dual branch INLINE_STRUCT with durable_reference fails", () => {
  const b = validSubmission();
  assert.equal(validatePendingCaptureSyncSubmission({ ...b, payload: { ...b.payload, provisional_payload: { representation_kind: "INLINE_STRUCT", inline_content: { data: "x" }, durable_reference: "ref-1" } } }).ok, false);
});

// ── PC-V04 ────────────────────────────────────────────────────────────────────
test("PC-V04 envelope missing payload_hash fails", () => { const { payload_hash: _r, ...msg } = validSubmission(); assert.equal(validatePendingCaptureSyncSubmission(msg).ok, false); });

// ── PC-V05 ────────────────────────────────────────────────────────────────────
test("PC-V05 identity separation: client_capture_id and pending_capture_id are distinct named fields", () => {
  const b = validPendingAcceptance();
  assert.equal(validatePendingCaptureSyncPendingAcceptance(b).ok, true);
  assert.notEqual(b.payload.client_capture_id, b.payload.pending_capture_id);
});

// ── PC-V06 ────────────────────────────────────────────────────────────────────
test("PC-V06 PENDING_ACCEPTANCE with IDENTICAL_REPLAY_REUSED passes", () => {
  const b = validPendingAcceptance();
  assert.equal(validatePendingCaptureSyncPendingAcceptance({ ...b, payload: { ...b.payload, replay_disposition_code: "IDENTICAL_REPLAY_REUSED" } }).ok, true);
});

// ── PC-V07 ────────────────────────────────────────────────────────────────────
test("PC-V07 PENDING_ACCEPTANCE HOLD/PENDING_HELD/CONFLICTING_REPLAY_HELD passes", () => {
  const b = validPendingAcceptance();
  assert.equal(validatePendingCaptureSyncPendingAcceptance({ ...b, payload: { ...b.payload, acceptance_code: "HOLD", pending_disposition_code: "PENDING_HELD", replay_disposition_code: "CONFLICTING_REPLAY_HELD" } }).ok, true);
});

// ── PC-V08 ────────────────────────────────────────────────────────────────────
test("PC-V08 OUTCOME HELD with CAPTURE_ID_CONFLICT reason passes", () => {
  const b = validOutcome();
  assert.equal(validatePendingCaptureSyncOutcome({ ...b, payload: { ...b.payload, outcome_code: "HELD", outcome_reason_code: "CAPTURE_ID_CONFLICT" } }).ok, true);
});

// ── PC-V09 ────────────────────────────────────────────────────────────────────
test("PC-V09 PENDING_ACCEPTANCE with IDENTICAL_REPLAY_REUSED validates", () => {
  const b = validPendingAcceptance();
  assert.equal(validatePendingCaptureSyncPendingAcceptance({ ...b, payload: { ...b.payload, replay_disposition_code: "IDENTICAL_REPLAY_REUSED" } }).ok, true);
});

// ── PC-V10 ────────────────────────────────────────────────────────────────────
test("PC-V10 time provenance: capture_time and produced_at are distinct fields and may differ", () => {
  const b = validSubmission();
  // capture_time is in payload; produced_at is in envelope — both can have different values
  assert.notEqual(b.produced_at, b.payload.capture_time);
  assert.equal(validatePendingCaptureSyncSubmission(b).ok, true);
});

// ── PC-V11 ────────────────────────────────────────────────────────────────────
test("PC-V11 all actor/device/auth refs present passes", () => { assert.equal(validatePendingCaptureSyncSubmission(validSubmission()).ok, true); });
test("PC-V11 missing captured_by_ref fails", () => { const b = validSubmission(); const { captured_by_ref: _r, ...payload } = b.payload; assert.equal(validatePendingCaptureSyncSubmission({ ...b, payload }).ok, false); });

// ── PC-V12 ────────────────────────────────────────────────────────────────────
test("PC-V12 OUTCOME HELD with SOURCE_UNAVAILABLE passes", () => {
  const b = validOutcome();
  assert.equal(validatePendingCaptureSyncOutcome({ ...b, payload: { ...b.payload, outcome_code: "HELD", outcome_reason_code: "SOURCE_UNAVAILABLE" } }).ok, true);
});

// ── PC-V13 ────────────────────────────────────────────────────────────────────
test("PC-V13 OUTCOME PROMOTED with downstream refs passes", () => {
  const b = validOutcome();
  assert.equal(validatePendingCaptureSyncOutcome({ ...b, payload: { ...b.payload, outcome_code: "PROMOTED", downstream_result_class_ref: "class-ref-1", downstream_result_ref: "result-ref-1" } }).ok, true);
});
test("PC-V13 OUTCOME PROMOTED without downstream refs fails", () => {
  const b = validOutcome();
  assert.equal(validatePendingCaptureSyncOutcome({ ...b, payload: { ...b.payload, outcome_code: "PROMOTED" } }).ok, false);
});

// ── PC-V14 ────────────────────────────────────────────────────────────────────
test("PC-V14 OUTCOME RECONCILIATION_REQUIRED with reconciliation_case_ref passes", () => {
  const b = validOutcome();
  assert.equal(validatePendingCaptureSyncOutcome({ ...b, payload: { ...b.payload, outcome_code: "RECONCILIATION_REQUIRED", outcome_reason_code: "CONTRADICTION", reconciliation_case_ref: "case-1" } }).ok, true);
});
test("PC-V14 OUTCOME RECONCILIATION_REQUIRED without reconciliation_case_ref fails", () => {
  const b = validOutcome();
  assert.equal(validatePendingCaptureSyncOutcome({ ...b, payload: { ...b.payload, outcome_code: "RECONCILIATION_REQUIRED", outcome_reason_code: "CONTRADICTION" } }).ok, false);
});

// ── PC-V15 ────────────────────────────────────────────────────────────────────
test("PC-V15 OUTCOME CORRECTED with successor_capture_ref passes", () => {
  const b = validOutcome();
  assert.equal(validatePendingCaptureSyncOutcome({ ...b, payload: { ...b.payload, outcome_code: "CORRECTED", successor_capture_ref: "succ-ref-1" } }).ok, true);
});

// ── PC-V16 ────────────────────────────────────────────────────────────────────
test("PC-V16 local_sequence=0 is valid non-negative integer", () => { const b = validSubmission(); assert.equal(validatePendingCaptureSyncSubmission({ ...b, payload: { ...b.payload, local_sequence: 0 } }).ok, true); });
test("PC-V16 negative local_sequence fails", () => { const b = validSubmission(); assert.equal(validatePendingCaptureSyncSubmission({ ...b, payload: { ...b.payload, local_sequence: -1 } }).ok, false); });

// ── PC-V17 ────────────────────────────────────────────────────────────────────
test("PC-V17 PENDING_ACCEPTANCE final_business_or_lifecycle_effect_applied=true fails", () => {
  const b = validPendingAcceptance();
  assert.equal(validatePendingCaptureSyncPendingAcceptance({ ...b, payload: { ...b.payload, final_business_or_lifecycle_effect_applied: true as unknown as false } }).ok, false);
});
test("PC-V17 OUTCOME final_business_or_lifecycle_effect_asserted_by_this_message=true fails", () => {
  const b = validOutcome();
  assert.equal(validatePendingCaptureSyncOutcome({ ...b, payload: { ...b.payload, final_business_or_lifecycle_effect_asserted_by_this_message: true as unknown as false } }).ok, false);
});

// ── PC-V18 ────────────────────────────────────────────────────────────────────
test("PC-V18 PENDING_ACCEPTANCE HOLD with CONFLICTING_REPLAY_HELD passes", () => {
  const b = validPendingAcceptance();
  assert.equal(validatePendingCaptureSyncPendingAcceptance({ ...b, payload: { ...b.payload, acceptance_code: "HOLD", pending_disposition_code: "PENDING_HELD", replay_disposition_code: "CONFLICTING_REPLAY_HELD" } }).ok, true);
});

// ── PC-V19 ────────────────────────────────────────────────────────────────────
test("PC-V19 validatePendingBatch with empty array succeeds", () => {
  const result = validatePendingBatch([], false);
  assert.equal(result.accepted.length, 0);
});
test("PC-V19 validatePendingBatch with 251 items throws PENDING_CAPTURE_LIMIT_EXCEEDED", () => {
  const items = Array.from({ length: 251 }, (_, i) => makePendingCapture(i));
  assert.throws(() => validatePendingBatch(items, false), /PENDING_CAPTURE_LIMIT_EXCEEDED/);
});

// ── PC-V20 ────────────────────────────────────────────────────────────────────
test("PC-V20 validatePendingBatch with duplicate local_sequence throws DUPLICATE_LOCAL_SEQUENCE", () => {
  assert.throws(() => validatePendingBatch([makePendingCapture(1), makePendingCapture(1)], false), /DUPLICATE_LOCAL_SEQUENCE/);
});
