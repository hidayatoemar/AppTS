import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { createPersistencePool } from "../packages/persistence/dist/index.js";
import { createTlsDay1GoldenDispatcher, TLS_DAY1_GOLDEN_CONTEXT } from "../apps/api/dist/trial/tls-day1-golden-flow.js";
import { establishArc011AiVerificationBindings, ARC011_AI_VERIFICATION_CONTEXT, ARC011_AI_VERIFICATION_MAPPING_PROFILE } from "../apps/api/dist/trial/arc011-ai-verification-context.js";
import { persistQualifiedExternalRecord } from "../apps/api/dist/runtime/d05-qualified-external-record-ingress.js";
import { applyQualifiedExternalDependency } from "../apps/api/dist/runtime/d04-external-dependency-owner.js";
import { createCf06PreTrialProjectionPort } from "../apps/api/dist/projections/cf06-pretrial-projection-port.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL_REQUIRED");
const disclosureLabelRef = process.env.APPTS_TRIAL_DISCLOSURE_LABEL_REF;
if (!disclosureLabelRef) throw new Error("APPTS_TRIAL_DISCLOSURE_LABEL_REF_REQUIRED");

const pool = createPersistencePool({ connectionString: databaseUrl });
const fallback = Object.freeze({
  async dispatch() { throw new Error("ARC011_FALLBACK_DISPATCH_NOT_EXPECTED"); },
  async capture() { throw new Error("ARC011_FALLBACK_CAPTURE_NOT_EXPECTED"); },
});

try {
  const day1 = createTlsDay1GoldenDispatcher(pool, fallback);
  const formed = await day1.dispatch("APPTS.CORE.D01.PRETICKET_ADMISSION.SUBMISSION / 1.0.0", {
    messageId: randomUUID(),
    idempotencyKey: randomUUID(),
    correlationId: randomUUID(),
    trialContext: TLS_DAY1_GOLDEN_CONTEXT,
  });
  assert.equal(typeof formed, "object");
  assert.ok(formed !== null);
  const formation = formed;
  assert.equal(formation.disposition, "CREATED");
  assert.equal(typeof formation.ticketId, "string");
  const ticketId = formation.ticketId;

  const bindings = await establishArc011AiVerificationBindings(pool, ticketId, disclosureLabelRef);
  const at = new Date().toISOString();
  const qerId = randomUUID();
  const payload = Object.freeze({
    verification_context: ARC011_AI_VERIFICATION_CONTEXT,
    synthetic: true,
    non_production: true,
    non_factual: true,
    source_event: "EXTERNAL_WAITING",
    external_subject_ref: bindings.externalSubjectRef,
    simulator_creates_world_only: true,
    appts_truth_written_by: "D05_TO_D04_ACCEPTED_INGRESS",
  });
  const payloadHash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  const record = Object.freeze({
    qualified_external_record_id: qerId,
    source_system_ref_id: bindings.sourceSystemRefId,
    adapter_profile_ref_id: bindings.adapterProfileRefId,
    external_record_identity: `ARC011-EXT-WAIT-${randomUUID()}`,
    external_record_version_ref: "1",
    subject_ref: bindings.externalSubjectRef,
    qualification_result_ref: "QUALIFIED",
    source_time: at,
    received_at: at,
    payload_or_reference_ref: payload,
    payload_hash: payloadHash,
    currentness_ref: "CURRENT",
  });

  const d05 = await persistQualifiedExternalRecord(pool, record, {
    disclosureLabelRef,
    payloadJsonSchemaVersionRef: "ARC011_AI_VERIFICATION_WORLD_V1",
  });
  assert.equal(d05.disposition, "QUALIFIED_PERSISTED");

  const mapping = Object.freeze({
    mappingProfileRef: ARC011_AI_VERIFICATION_MAPPING_PROFILE,
    ticketId,
    dependencyTypeRef: "EXTERNAL_DEPENDENCY",
    dependencyStatusRef: "EXTERNAL_WAITING",
    responsibilityId: bindings.responsibilityId,
    obligationOwnerRef: bindings.supportingAssignmentRef,
    blockerOwnerRef: bindings.supportingAssignmentRef,
    nextControlOwnerRef: bindings.supportingAssignmentRef,
    blockedWorkRef: bindings.blockedWorkRef,
    waitingReasonRef: "EXTERNAL_WAITING",
    blockerReasonRef: "UNRESOLVED_DEPENDENCY",
    obligationClassRef: "DEPENDENCY_RESOLUTION",
    nextControlClassRef: "DEPENDENCY_REVIEW",
    dueBasisRef: "ARC011_AI_VERIFICATION_SCENARIO_TRIGGER_ONLY",
    dueAt: at,
    nextEvaluationAt: at,
    escalation: Object.freeze({
      sourceEscalationObligationRef: bindings.escalationObligationRef,
      routeRefCode: bindings.escalationRouteRefCode,
      interventionDueBasisRef: "ARC011_AI_VERIFICATION_SCENARIO_TRIGGER_ONLY",
    }),
  });

  const applied = await applyQualifiedExternalDependency(pool, d05.record, mapping);
  assert.equal(applied.disposition, "APPLIED");
  assert.equal(applied.responsibilityTransferred, false);

  const d05Replay = await persistQualifiedExternalRecord(pool, record, {
    disclosureLabelRef,
    payloadJsonSchemaVersionRef: "ARC011_AI_VERIFICATION_WORLD_V1",
  });
  assert.equal(d05Replay.disposition, "IDEMPOTENT_REPLAY");
  const d04Replay = await applyQualifiedExternalDependency(pool, d05Replay.record, mapping);
  assert.equal(d04Replay.disposition, "IDEMPOTENT_REPLAY");
  assert.deepEqual(d04Replay.refs, applied.refs);

  const counts = await pool.query(`SELECT
    (SELECT count(*)::int FROM appts.qualified_external_record WHERE qualified_external_record_id=$1) AS qer_count,
    (SELECT count(*)::int FROM appts.dependency_context WHERE ticket_id=$2 AND evidence_ref=$1 AND dependency_status_ref='EXTERNAL_WAITING') AS dependency_count,
    (SELECT count(*)::int FROM appts.operational_obligation WHERE ticket_id=$2 AND source_ref=$1 AND status_ref='OPEN') AS obligation_count,
    (SELECT count(*)::int FROM appts.runtime_blocker WHERE ticket_id=$2 AND evidence_ref=$1 AND cleared_at IS NULL AND status_ref='OPEN') AS blocker_count,
    (SELECT count(*)::int FROM appts.waiting_interval WHERE ticket_id=$2 AND ended_at IS NULL) AS waiting_count,
    (SELECT count(*)::int FROM appts.residual_obligation WHERE ticket_id=$2 AND evidence_ref=$1 AND disposition_status_ref='OPEN') AS residual_count,
    (SELECT count(*)::int FROM appts.next_control WHERE ticket_id=$2 AND source_obligation_ref=$3) AS next_control_count,
    (SELECT count(*)::int FROM appts.runtime_escalation WHERE ticket_id=$2 AND source_escalation_obligation_ref=$4 AND status_ref='OPEN') AS escalation_count,
    (SELECT count(*)::int FROM appts.responsibility_change WHERE ticket_id=$2) AS responsibility_change_count,
    (SELECT aggregate_version::int FROM appts.runtime_ticket WHERE ticket_id=$2) AS aggregate_version,
    (SELECT current_state_code FROM appts.runtime_ticket WHERE ticket_id=$2) AS lifecycle_state`,
    [qerId, ticketId, applied.refs.obligationId, bindings.escalationObligationRef]);
  const durable = counts.rows[0];
  for (const key of ["qer_count", "dependency_count", "obligation_count", "blocker_count", "waiting_count", "residual_count", "next_control_count", "escalation_count"]) assert.equal(durable[key], 1, key);
  assert.equal(durable.responsibility_change_count, 0);
  assert.equal(durable.aggregate_version, 0);
  assert.equal(durable.lifecycle_state, "ACCEPTED");

  const projection = createCf06PreTrialProjectionPort(pool);
  const ux = await projection.read("UX-RS-07", ticketId, undefined, { trainerOnly: true, alias: "arc011.ai.verify" });
  assert.equal(typeof ux, "object");
  assert.ok(ux !== null);
  const uxData = ux.data;
  assert.ok(Array.isArray(uxData.open_waiting) && uxData.open_waiting.length === 1);
  assert.ok(Array.isArray(uxData.open_blockers) && uxData.open_blockers.length === 1);
  assert.ok(Array.isArray(uxData.dependencies) && uxData.dependencies.length === 1);
  assert.ok(Array.isArray(uxData.operational_obligations) && uxData.operational_obligations.length === 1);
  assert.ok(Array.isArray(uxData.next_controls) && uxData.next_controls.length === 1);
  assert.ok(Array.isArray(uxData.escalations) && uxData.escalations.length === 1);
  assert.equal(uxData.waiting_is_lifecycle_state, false);
  assert.equal(uxData.escalation_transfers_responsibility, false);
  assert.equal(uxData.closure_impact.open_condition_present, true);

  process.stdout.write(JSON.stringify({
    classification: "D2",
    context: ARC011_AI_VERIFICATION_CONTEXT,
    ticket_id: ticketId,
    qer_id: qerId,
    d05: d05.disposition,
    d04: applied.disposition,
    replay: d04Replay.disposition,
    responsibility_transferred: false,
    lifecycle_state: durable.lifecycle_state,
    aggregate_version: durable.aggregate_version,
    durable_counts: durable,
    ux_rs_07: {
      open_waiting: uxData.open_waiting.length,
      open_blockers: uxData.open_blockers.length,
      dependencies: uxData.dependencies.length,
      obligations: uxData.operational_obligations.length,
      next_controls: uxData.next_controls.length,
      escalations: uxData.escalations.length,
      closure_impact: uxData.closure_impact,
    },
  }, null, 2));
  process.stdout.write("\n");
} finally {
  await pool.end();
}
