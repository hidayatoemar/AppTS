import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { evaluatePreTicketAdmission } from "../packages/core-d01/src/pre-ticket-admission.ts";
import { ADMISSION_PREDICATES } from "../packages/core-d01/src/admission.ts";
import { createPreTicketIntentDispatcher } from "../apps/api/src/routes/ui-intents.ts";
import { resolveTrialDisclosureLabelRef, TD_PRE_001_DISCLOSURE_CONTROL_REF, TD_PRE_001_TRIAL_CONTEXT } from "../apps/api/src/routes/trial-disclosure-binding.ts";

const OWNER_DOMAIN = "APPTS.CORE.D01.PRETICKET_ADMISSION.OWNER";
const CONTRACT = "APPTS.CORE.D01.PRETICKET_ADMISSION";
const VERSION = "1.0.0";
const PROFILE = "APPTS.CORE.D01.PRETICKET_ADMISSION.PROFILE.1.0.0";
const SUBMISSION = "APPTS.CORE.D01.PRETICKET_ADMISSION.SUBMISSION";
const FIXTURE_PATH = new URL("../../../../TD-SIM-001_RESTORE_SERVICE_Trial_Data_and_Simulation_Configuration_Pack_v0.1_WD/data/td-sim-001-fixtures.json", import.meta.url);

const pool = new Pool({ host: "127.0.0.1", port: 55432, user: "postgres", database: "postgres" });

const isoNow = () => new Date().toISOString();
const digest = (value) => createHash("sha256").update(value).digest("hex");
const byteDigest = (value) => createHash("sha256").update(value).digest();

async function fixtureInput() {
  const fixture = JSON.parse(await readFile(FIXTURE_PATH, "utf8"));
  const entry = fixture.pre_ticket_cases.find((item) => item.case_id === TD_PRE_001_TRIAL_CONTEXT);
  if (!entry) throw new Error("TD_PRE_001_FIXTURE_MISSING");
  return Object.freeze({
    fixture_reference_id: entry.case_id,
    source_type: entry.source_type,
    subject_id: entry.subject_id,
    source_currentness: entry.source_currentness,
    source_condition: entry.source_condition,
  });
}

async function systemIds() {
  return Object.freeze({
    subject: randomUUID(), actor: randomUUID(), authority: randomUUID(), qualification: randomUUID(),
    provenance: randomUUID(), responsibility: randomUUID(), purpose: randomUUID(), admission: randomUUID(),
  });
}

async function realizeTrialSourceBinding(ids) {
  const existing = await pool.query(
    "SELECT source_ref_id FROM appts.source_ref WHERE source_identity=$1 AND source_owner_ref=$2 ORDER BY source_ref_id LIMIT 1",
    ["MCR-TRIAL-SOURCE-TD-PRE-001-01", "MCR-TRIAL-SOURCE-TD-PRE-001-01"],
  );
  if (existing.rowCount === 1) return existing.rows[0].source_ref_id;
  const scope = {
    trial_context: TD_PRE_001_TRIAL_CONTEXT,
    source_version_basis: "TD-SIM-001:062535e07cbde17aaed6af0b190cab839672ffa741ae650e750762530c300e73",
    channel_ref: "MCR-TRIAL-CHANNEL-TD-PRE-001-01",
    provenance_ref: "MCR-TRIAL-PROV-TD-PRE-001-01",
    subject_ref: "MCR-TRIAL-SUBJECT-TD-PRE-001-01",
    holder_ref: "MCR-TRIAL-HOLDER-TD-PRE-001-01",
    assignment_ref: "MCR-TRIAL-ASSIGN-TD-PRE-001-01",
    responsibility_ref: "MCR-TRIAL-RESP-CONTEXT-TD-PRE-001-01",
    purpose_ref: "MCR-TRIAL-PURPOSE-TD-PRE-001-01",
    admission_ref: "MCR-TRIAL-ADMISSION-CONTEXT-TD-PRE-001-01",
    disclosure_control_ref: TD_PRE_001_DISCLOSURE_CONTROL_REF,
    mechanical_ids: ids,
  };
  const created = await pool.query(
    "INSERT INTO appts.source_ref(source_identity,source_owner_ref,source_class_ref,authoritative_scope_ref,authoritative_scope_ref_schema_version,effective_from) VALUES($1,$2,$3,$4::jsonb,$5,now()) RETURNING source_ref_id",
    ["MCR-TRIAL-SOURCE-TD-PRE-001-01", "MCR-TRIAL-SOURCE-TD-PRE-001-01", "NON_PRODUCTION_TRIAL_SOURCE", JSON.stringify(scope), "1.0.0"],
  );
  return created.rows[0].source_ref_id;
}

function ownerPredicates(input) {
  const admitted = new Set(["APPLICABILITY", "SUBJECT_BOUNDARY", "CONSISTENCY", "DUPLICATE_CORRELATION", "AUTHORITY", "EVIDENCE", "PURPOSE_BINDING", "RESPONSIBILITY"]);
  return ADMISSION_PREDICATES.map((predicate) => {
    if (predicate === "COMPLETENESS") return input.source_condition === "INCOMPLETE_MANDATORY_FACTS"
      ? { predicate, status: "MISSING", reasonRef: input.source_condition }
      : { predicate, status: "UNKNOWN", reasonRef: "SOURCE_CONDITION_NOT_ADMITTED" };
    if (predicate === "CURRENTNESS") return input.source_currentness === "CURRENT"
      ? { predicate, status: "SATISFIED" }
      : { predicate, status: "UNKNOWN", reasonRef: "CURRENTNESS_NOT_ADMITTED" };
    return admitted.has(predicate) ? { predicate, status: "SATISFIED" } : { predicate, status: "UNKNOWN", reasonRef: "TRIAL_BINDING_ABSENT" };
  });
}

async function inTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

async function audit(client, event, subjectId, submission, ids, disclosure) {
  await client.query(
    "INSERT INTO appts.audit_event(event_identity,subject_type,subject_id,actor_ref,authority_ref,message_id,correlation_id,source_ref_id,occurred_at,committed_at,disclosure_label_ref) VALUES($1,'PRE_TICKET_CASE',$2,$3,$4,$5,$6,$7,now(),now(),$8)",
    [event, subjectId, ids.actor, ids.authority, submission.messageId, submission.correlationId, submission.sourceRef, disclosure],
  );
}

async function ptx01(submission, ids, disclosure) {
  return inTransaction(async (client) => {
    const prior = await client.query("SELECT payload_hash,durable_result_ref FROM appts.idempotency_ledger WHERE owner_domain_ref=$1 AND idempotency_key=$2 FOR UPDATE", [OWNER_DOMAIN, submission.idempotencyKey]);
    if (prior.rowCount === 1) {
      const ledger = prior.rows[0];
      if (ledger.payload_hash !== submission.payloadDigest) {
        return { disposition: "CONFLICT_HOLD" };
      }
      return { disposition: "IDEMPOTENT_REPLAY", caseId: ledger.durable_result_ref };
    }
    const cueId = randomUUID(), observationId = randomUUID(), caseId = randomUUID();
    await client.query("INSERT INTO appts.intake_cue(committed_at,actor_ref,authority_ref,qualification_ref,disclosure_label_ref,cue_id,source_ref_id,received_at,subject_ref_id,channel_ref_code,correlation_id) VALUES(now(),$1,$2,$3,$4,$5,$6,now(),$7,$8,$9)", [ids.actor, ids.authority, ids.qualification, disclosure, cueId, submission.sourceRef, ids.subject, "MCR-TRIAL-CHANNEL-TD-PRE-001-01", submission.correlationId]);
    await client.query("INSERT INTO appts.source_observation(committed_at,actor_ref,authority_ref,disclosure_label_ref,correlation_id,observation_id,cue_id,source_content_ref_kind,source_content_ref_text,subject_ref,channel_ref,source_time,provenance_ref,qualification_ref,content_digest) VALUES(now(),$1,$2,$3,$4,$5,$6,'TEXT',$7,$8,$9,now(),$10,$11,$12)", [ids.actor, ids.authority, disclosure, submission.correlationId, observationId, cueId, submission.submittedSourceContent, ids.subject, "MCR-TRIAL-CHANNEL-TD-PRE-001-01", ids.provenance, ids.qualification, byteDigest(submission.submittedSourceContent)]);
    await client.query("INSERT INTO appts.pre_ticket_case(projection_version,currentness_ref,rebuilt_at,case_id,governing_observation_ref,case_status_ref) VALUES(0,$1,now(),$2,$3,'HOLD_AS_PRE_TICKET')", [submission.currentness, caseId, observationId]);
    const marker = await client.query("INSERT INTO appts.commit_marker(owner_domain_ref,aggregate_or_subject_ref,expected_version,resulting_version,transaction_identity,committed_at,result_hash) VALUES($1,$2,0,0,$3,now(),$4) RETURNING commit_marker_id", [OWNER_DOMAIN, caseId, "PTX-01", submission.payloadDigest]);
    await client.query("INSERT INTO appts.idempotency_ledger(owner_domain_ref,idempotency_key,command_or_message_identity,payload_hash,durable_result_ref,first_seen_at,last_seen_at,conflict_status_ref) VALUES($1,$2,$3,$4,$5,now(),now(),'DURABLE')", [OWNER_DOMAIN, submission.idempotencyKey, SUBMISSION, submission.payloadDigest, caseId]);
    await client.query("INSERT INTO appts.inbox_entry(interface_identity,semantic_version,profile_identity,message_id,idempotency_key,correlation_id,producer_ref_id,producer_ref_code,subject_ref,produced_at,received_at,payload_hash,durable_result_ref,state_code,accepted_at,validation_result_ref,processing_result_ref) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,now(),now(),$10,$11,'ACCEPTED',now(),'VALID',$12)", [CONTRACT, VERSION, PROFILE, submission.messageId, submission.idempotencyKey, submission.correlationId, ids.actor, "MCR-TRIAL-HOLDER-TD-PRE-001-01", ids.subject, byteDigest(submission.payloadDigest), caseId, marker.rows[0].commit_marker_id]);
    await audit(client, "APPTS.CORE.D01.PRETICKET_ADMISSION.PTX-01", caseId, submission, ids, disclosure);
    return { disposition: "CREATED", caseId, cueId, observationId };
  });
}

async function ptx02And03(submission, ids, disclosure, caseId, evaluation) {
  const assessmentId = randomUUID();
  await inTransaction(async (client) => {
    await client.query("INSERT INTO appts.admission_assessment(committed_at,actor_ref,authority_ref,qualification_ref,disclosure_label_ref,correlation_id,assessment_id,case_id,assessed_against_case_version,overall_result_ref,evaluated_at) VALUES(now(),$1,$2,$3,$4,$5,$6,$7,0,$8,now())", [ids.actor, ids.authority, ids.qualification, disclosure, submission.correlationId, assessmentId, caseId, evaluation.assessment.result]);
    for (const item of evaluation.assessment.predicates) await client.query("INSERT INTO appts.admission_predicate_result(committed_at,actor_ref,authority_ref,qualification_ref,disclosure_label_ref,correlation_id,assessment_id,predicate_identity,result_code,reason_ref_code) VALUES(now(),$1,$2,$3,$4,$5,$6,$7,$8,$9)", [ids.actor, ids.authority, ids.qualification, disclosure, submission.correlationId, assessmentId, item.predicate, item.status, item.reasonRef ?? null]);
    await client.query("UPDATE appts.pre_ticket_case SET current_assessment_id=$1,projection_version=1,rebuilt_at=now() WHERE case_id=$2 AND projection_version=0", [assessmentId, caseId]);
    await client.query("INSERT INTO appts.commit_marker(owner_domain_ref,aggregate_or_subject_ref,expected_version,resulting_version,transaction_identity,committed_at,result_hash) VALUES($1,$2,0,1,'PTX-02',now(),$3)", [OWNER_DOMAIN, caseId, digest(JSON.stringify(evaluation.assessment))]);
    await audit(client, "APPTS.CORE.D01.PRETICKET_ADMISSION.PTX-02", caseId, submission, ids, disclosure);
  });
  const decisionId = randomUUID();
  await inTransaction(async (client) => {
    const deficiencies = evaluation.assessment.predicates.filter((item) => item.status !== "SATISFIED");
    await client.query("INSERT INTO appts.intake_decision(committed_at,actor_ref,authority_ref,qualification_ref,disclosure_label_ref,correlation_id,decision_id,case_id,assessment_id,decision_code,reason_ref,deficiency_set_ref,deficiency_set_ref_schema_version,decided_at) VALUES(now(),$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,'1.0.0',now())", [ids.actor, ids.authority, ids.qualification, disclosure, submission.correlationId, decisionId, caseId, assessmentId, evaluation.decision, evaluation.assessment.result, JSON.stringify(deficiencies)]);
    const updated = await client.query("UPDATE appts.pre_ticket_case SET current_decision_id=$1,projection_version=2,case_status_ref=$2,rebuilt_at=now() WHERE case_id=$3 AND projection_version=1", [decisionId, evaluation.decision, caseId]);
    if (updated.rowCount !== 1) throw new Error("PTX_03_CASE_VERSION_CONFLICT");
    await client.query("INSERT INTO appts.commit_marker(owner_domain_ref,aggregate_or_subject_ref,expected_version,resulting_version,transaction_identity,committed_at,result_hash) VALUES($1,$2,1,2,'PTX-03',now(),$3)", [OWNER_DOMAIN, caseId, digest(JSON.stringify({ assessmentId, decisionId, decision: evaluation.decision }))]);
    await audit(client, "APPTS.CORE.D01.PRETICKET_ADMISSION.PTX-03", caseId, submission, ids, disclosure);
  });
  return { assessmentId, decisionId };
}

async function ownerFlow(payload) {
  const disclosure = resolveTrialDisclosureLabelRef(TD_PRE_001_TRIAL_CONTEXT);
  const input = await fixtureInput();
  const ids = await systemIds();
  const sourceRef = await realizeTrialSourceBinding(ids);
  // The conflict probe is never admitted to D-01 evaluation. It changes only
  // the submitted material before PTX-01 detects the reused idempotency key.
  const sourceContent = payload.conflictProbe === true
    ? JSON.stringify({ ...input, source_condition: "CONFLICT_PROBE_NOT_ADMITTED" })
    : JSON.stringify(input);
  const submission = Object.freeze({ contractRef: CONTRACT, semanticVersion: VERSION, profileRef: PROFILE, messageId: payload.messageId, idempotencyKey: payload.idempotencyKey, correlationId: payload.correlationId, receivedAt: isoNow(), sourceRef, subjectRef: ids.subject, payloadDigest: digest(sourceContent), submittedSourceContent: sourceContent, sourceObservedAt: isoNow(), qualification: "CONFIRMED", currentness: input.source_currentness, actorRef: ids.actor, authorityRef: ids.authority, responsibilityContextRef: ids.responsibility, purposeBindingRef: ids.purpose, admissionContextRef: ids.admission, disclosureControlRef: TD_PRE_001_DISCLOSURE_CONTROL_REF });
  const result = await ptx01(submission, ids, disclosure);
  if (result.disposition !== "CREATED") return result;
  const evaluation = evaluatePreTicketAdmission(submission, { intakeCueId: result.cueId, observationId: result.observationId, preTicketCaseId: result.caseId, assessmentId: randomUUID(), decisionId: randomUUID() }, ownerPredicates(input));
  const downstream = await ptx02And03(submission, ids, disclosure, result.caseId, evaluation);
  return { ...result, ...downstream, assessmentResult: evaluation.assessment.result, decision: evaluation.decision, disclosure };
}

try {
  const dispatcher = createPreTicketIntentDispatcher(ownerFlow);
  const idempotencyKey = process.env.TD_PRE_001_IDEMPOTENCY_KEY ?? randomUUID();
  if (process.env.TD_PRE_001_REPLAY_MODE === "CONFLICT_ONLY") {
    const conflict = await dispatcher.dispatch(`${SUBMISSION} / ${VERSION}`, { messageId: randomUUID(), idempotencyKey, correlationId: randomUUID(), conflictProbe: true });
    console.log(JSON.stringify({ conflict }));
  } else {
  const first = await dispatcher.dispatch(`${SUBMISSION} / ${VERSION}`, { messageId: randomUUID(), idempotencyKey, correlationId: randomUUID() });
  const replay = await dispatcher.dispatch(`${SUBMISSION} / ${VERSION}`, { messageId: randomUUID(), idempotencyKey, correlationId: randomUUID() });
  const conflict = await dispatcher.dispatch(`${SUBMISSION} / ${VERSION}`, { messageId: randomUUID(), idempotencyKey, correlationId: randomUUID(), conflictProbe: true });
  console.log(JSON.stringify({ first, replay, conflict }));
  }
} finally { await pool.end(); }
