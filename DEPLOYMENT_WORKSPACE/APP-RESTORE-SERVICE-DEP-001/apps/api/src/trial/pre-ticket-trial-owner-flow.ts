import { createHash, randomUUID } from "node:crypto";
import type { PersistenceClient, PersistencePool } from "@appts-restore-service/persistence";
import {
  ADMISSION_PREDICATES,
  evaluatePreTicketAdmission,
  type PredicateResult,
  type PreTicketAdmissionEvaluation,
  type PreTicketSubmission,
} from "@appts-restore-service/core-d01";
import { createPreTicketIntentDispatcher, type UiIntentDispatcher } from "../routes/ui-intents.ts";
import {
  resolveTrialDisclosureLabelRef,
  TD_PRE_001_DISCLOSURE_CONTROL_REF,
  TD_PRE_001_TRIAL_CONTEXT,
} from "../routes/trial-disclosure-binding.ts";

const OWNER_DOMAIN = "APPTS.CORE.D01.PRETICKET_ADMISSION.OWNER";
const CONTRACT = "APPTS.CORE.D01.PRETICKET_ADMISSION";
const VERSION = "1.0.0";
const PROFILE = "APPTS.CORE.D01.PRETICKET_ADMISSION.PROFILE.1.0.0";
const SUBMISSION = "APPTS.CORE.D01.PRETICKET_ADMISSION.SUBMISSION";
const TRIAL_SOURCE_IDENTITY = "MCR-TRIAL-SOURCE-TD-PRE-001-01";
const TRIAL_CHANNEL_REF = "MCR-TRIAL-CHANNEL-TD-PRE-001-01";
const TD_SIM_SOURCE_VERSION_BASIS = "TD-SIM-001:062535e07cbde17aaed6af0b190cab839672ffa741ae650e750762530c300e73";

/** Exact accepted TD-PRE-001 scenario values from TD-SIM-001. */
const TD_PRE_001_INPUT = Object.freeze({
  fixture_reference_id: TD_PRE_001_TRIAL_CONTEXT,
  source_type: "TRAINING_CUSTOMER_REPORT",
  subject_id: "TRN-SUBJECT-001",
  source_currentness: "CURRENT" as const,
  source_condition: "INCOMPLETE_MANDATORY_FACTS",
});

export interface TrialPreTicketIntentPayload {
  readonly messageId: string;
  readonly idempotencyKey: string;
  readonly correlationId: string;
  readonly conflictProbe?: boolean;
  readonly trialContext?: typeof TD_PRE_001_TRIAL_CONTEXT;
}

interface MechanicalIds {
  readonly subject: string;
  readonly actor: string;
  readonly authority: string;
  readonly qualification: string;
  readonly provenance: string;
  readonly responsibility: string;
  readonly purpose: string;
  readonly admission: string;
}

interface Ptx01Created {
  readonly disposition: "CREATED";
  readonly caseId: string;
  readonly cueId: string;
  readonly observationId: string;
}
interface Ptx01Replay { readonly disposition: "IDEMPOTENT_REPLAY"; readonly caseId: string; }
interface Ptx01Conflict { readonly disposition: "CONFLICT_HOLD"; }
type Ptx01Result = Ptx01Created | Ptx01Replay | Ptx01Conflict;

export type TrialOwnerFlowResult =
  | Ptx01Replay
  | Ptx01Conflict
  | (Ptx01Created & {
      readonly assessmentId: string;
      readonly decisionId: string;
      readonly assessmentResult: "ACCEPTABLE" | "NOT_ACCEPTABLE";
      readonly decision: "ACCEPTED_FOR_FORMATION" | "HOLD_AS_PRE_TICKET";
      readonly disclosure: string;
    });

const isoNow = (): string => new Date().toISOString();
const digest = (value: string): string => createHash("sha256").update(value).digest("hex");
const byteDigest = (value: string): Buffer => createHash("sha256").update(value).digest();

function idempotencyAdvisoryLockKey(idempotencyKey: string): string {
  return createHash("sha256")
    .update(OWNER_DOMAIN)
    .update("\0")
    .update(idempotencyKey)
    .digest()
    .readBigInt64BE(0)
    .toString();
}

function requireString(value: unknown, code: string): string {
  if (typeof value !== "string" || value.length === 0) throw new Error(code);
  return value;
}

function parsePayload(value: unknown): TrialPreTicketIntentPayload {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("TD_PRE_001_INTENT_PAYLOAD_REQUIRED");
  const record = value as Readonly<Record<string, unknown>>;
  const trialContext = record["trialContext"];
  if (trialContext !== undefined && trialContext !== TD_PRE_001_TRIAL_CONTEXT) throw new Error("TRIAL_DISCLOSURE_CONTEXT_NOT_AUTHORIZED");
  const conflictProbe = record["conflictProbe"];
  if (conflictProbe !== undefined && typeof conflictProbe !== "boolean") throw new Error("TD_PRE_001_CONFLICT_PROBE_INVALID");
  return Object.freeze({
    messageId: requireString(record["messageId"], "TD_PRE_001_MESSAGE_ID_REQUIRED"),
    idempotencyKey: requireString(record["idempotencyKey"], "TD_PRE_001_IDEMPOTENCY_KEY_REQUIRED"),
    correlationId: requireString(record["correlationId"], "TD_PRE_001_CORRELATION_ID_REQUIRED"),
    ...(conflictProbe === undefined ? {} : { conflictProbe }),
    ...(trialContext === undefined ? {} : { trialContext: TD_PRE_001_TRIAL_CONTEXT }),
  });
}

function systemIds(): MechanicalIds {
  return Object.freeze({
    subject: randomUUID(), actor: randomUUID(), authority: randomUUID(), qualification: randomUUID(),
    provenance: randomUUID(), responsibility: randomUUID(), purpose: randomUUID(), admission: randomUUID(),
  });
}

async function realizeTrialSourceBinding(pool: PersistencePool, ids: MechanicalIds): Promise<string> {
  const existing = await pool.query<{ source_ref_id: string }>(
    "SELECT source_ref_id::text AS source_ref_id FROM appts.source_ref WHERE source_identity=$1 AND source_owner_ref=$2 ORDER BY source_ref_id LIMIT 1",
    [TRIAL_SOURCE_IDENTITY, TRIAL_SOURCE_IDENTITY],
  );
  if (existing.rowCount === 1) return existing.rows[0]!.source_ref_id;
  const scope = {
    trial_context: TD_PRE_001_TRIAL_CONTEXT,
    source_version_basis: TD_SIM_SOURCE_VERSION_BASIS,
    channel_ref: TRIAL_CHANNEL_REF,
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
  const created = await pool.query<{ source_ref_id: string }>(
    "INSERT INTO appts.source_ref(source_identity,source_owner_ref,source_class_ref,authoritative_scope_ref,authoritative_scope_ref_schema_version,effective_from) VALUES($1,$2,$3,$4::jsonb,$5,now()) RETURNING source_ref_id::text AS source_ref_id",
    [TRIAL_SOURCE_IDENTITY, TRIAL_SOURCE_IDENTITY, "NON_PRODUCTION_TRIAL_SOURCE", JSON.stringify(scope), "1.0.0"],
  );
  return created.rows[0]!.source_ref_id;
}

function ownerPredicates(): readonly PredicateResult[] {
  const admitted = new Set(["APPLICABILITY", "SUBJECT_BOUNDARY", "CONSISTENCY", "DUPLICATE_CORRELATION", "AUTHORITY", "EVIDENCE", "PURPOSE_BINDING", "RESPONSIBILITY"]);
  return ADMISSION_PREDICATES.map((predicate): PredicateResult => {
    if (predicate === "COMPLETENESS") return { predicate, status: "MISSING", reasonRef: TD_PRE_001_INPUT.source_condition };
    if (predicate === "CURRENTNESS") return { predicate, status: "SATISFIED" };
    return admitted.has(predicate) ? { predicate, status: "SATISFIED" } : { predicate, status: "UNKNOWN", reasonRef: "TRIAL_BINDING_ABSENT" };
  });
}

type TransactionIsolation = "SERIALIZABLE" | "READ COMMITTED";

async function inTransaction<Result>(pool: PersistencePool, work: (client: PersistenceClient) => Promise<Result>, isolation: TransactionIsolation = "SERIALIZABLE"): Promise<Result> {
  const client = await pool.connect();
  try {
    await client.query(`BEGIN ISOLATION LEVEL ${isolation}`);
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function audit(client: PersistenceClient, event: string, subjectId: string, submission: PreTicketSubmission, ids: MechanicalIds, disclosure: string): Promise<void> {
  await client.query(
    "INSERT INTO appts.audit_event(event_identity,subject_type,subject_id,actor_ref,authority_ref,message_id,correlation_id,source_ref_id,occurred_at,committed_at,disclosure_label_ref) VALUES($1,'PRE_TICKET_CASE',$2,$3,$4,$5,$6,$7,now(),now(),$8)",
    [event, subjectId, ids.actor, ids.authority, submission.messageId, submission.correlationId, submission.sourceRef, disclosure],
  );
}

async function ptx01(pool: PersistencePool, submission: PreTicketSubmission, ids: MechanicalIds, disclosure: string): Promise<Ptx01Result> {
  return inTransaction(pool, async (client) => {
    await client.query("SELECT pg_advisory_xact_lock($1::bigint)", [idempotencyAdvisoryLockKey(submission.idempotencyKey)]);
    const prior = await client.query<{ payload_hash: string; durable_result_ref: string }>(
      "SELECT payload_hash,durable_result_ref::text AS durable_result_ref FROM appts.idempotency_ledger WHERE owner_domain_ref=$1 AND idempotency_key=$2",
      [OWNER_DOMAIN, submission.idempotencyKey],
    );
    if (prior.rowCount === 1) {
      const ledger = prior.rows[0]!;
      if (ledger.payload_hash !== submission.payloadDigest) return { disposition: "CONFLICT_HOLD" };
      return { disposition: "IDEMPOTENT_REPLAY", caseId: ledger.durable_result_ref };
    }

    const cueId = randomUUID();
    const observationId = randomUUID();
    const caseId = randomUUID();
    await client.query(
      "INSERT INTO appts.intake_cue(committed_at,actor_ref,authority_ref,qualification_ref,disclosure_label_ref,cue_id,source_ref_id,received_at,subject_ref_id,channel_ref_code,correlation_id) VALUES(now(),$1,$2,$3,$4,$5,$6,now(),$7,$8,$9)",
      [ids.actor, ids.authority, ids.qualification, disclosure, cueId, submission.sourceRef, ids.subject, TRIAL_CHANNEL_REF, submission.correlationId],
    );
    await client.query(
      "INSERT INTO appts.source_observation(committed_at,actor_ref,authority_ref,disclosure_label_ref,correlation_id,observation_id,cue_id,source_content_ref_kind,source_content_ref_text,subject_ref,channel_ref,source_time,provenance_ref,qualification_ref,content_digest) VALUES(now(),$1,$2,$3,$4,$5,$6,'TEXT',$7,$8,$9,now(),$10,$11,$12)",
      [ids.actor, ids.authority, disclosure, submission.correlationId, observationId, cueId, submission.submittedSourceContent, ids.subject, TRIAL_CHANNEL_REF, ids.provenance, ids.qualification, byteDigest(submission.submittedSourceContent)],
    );
    await client.query(
      "INSERT INTO appts.pre_ticket_case(projection_version,currentness_ref,rebuilt_at,case_id,governing_observation_ref,case_status_ref) VALUES(0,$1,now(),$2,$3,'HOLD_AS_PRE_TICKET')",
      [submission.currentness, caseId, observationId],
    );
    const marker = await client.query<{ commit_marker_id: string }>(
      "INSERT INTO appts.commit_marker(owner_domain_ref,aggregate_or_subject_ref,expected_version,resulting_version,transaction_identity,committed_at,result_hash) VALUES($1,$2,0,0,$3,now(),$4) RETURNING commit_marker_id::text AS commit_marker_id",
      [OWNER_DOMAIN, caseId, "PTX-01", submission.payloadDigest],
    );
    await client.query(
      "INSERT INTO appts.idempotency_ledger(owner_domain_ref,idempotency_key,command_or_message_identity,payload_hash,durable_result_ref,first_seen_at,last_seen_at,conflict_status_ref) VALUES($1,$2,$3,$4,$5,now(),now(),'DURABLE')",
      [OWNER_DOMAIN, submission.idempotencyKey, SUBMISSION, submission.payloadDigest, caseId],
    );
    await client.query(
      "INSERT INTO appts.inbox_entry(interface_identity,semantic_version,profile_identity,message_id,idempotency_key,correlation_id,producer_ref_id,producer_ref_code,subject_ref,produced_at,received_at,payload_hash,durable_result_ref,state_code,accepted_at,validation_result_ref,processing_result_ref) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,now(),now(),$10,$11,'ACCEPTED',now(),'VALID',$12)",
      [CONTRACT, VERSION, PROFILE, submission.messageId, submission.idempotencyKey, submission.correlationId, ids.actor, "MCR-TRIAL-HOLDER-TD-PRE-001-01", ids.subject, byteDigest(submission.payloadDigest), caseId, marker.rows[0]!.commit_marker_id],
    );
    await audit(client, "APPTS.CORE.D01.PRETICKET_ADMISSION.PTX-01", caseId, submission, ids, disclosure);
    return { disposition: "CREATED", caseId, cueId, observationId };
  }, "READ COMMITTED");
}

async function ptx02And03(pool: PersistencePool, submission: PreTicketSubmission, ids: MechanicalIds, disclosure: string, caseId: string, evaluation: PreTicketAdmissionEvaluation): Promise<{ readonly assessmentId: string; readonly decisionId: string }> {
  const assessmentId = randomUUID();
  await inTransaction(pool, async (client) => {
    await client.query(
      "INSERT INTO appts.admission_assessment(committed_at,actor_ref,authority_ref,qualification_ref,disclosure_label_ref,correlation_id,assessment_id,case_id,assessed_against_case_version,overall_result_ref,evaluated_at) VALUES(now(),$1,$2,$3,$4,$5,$6,$7,0,$8,now())",
      [ids.actor, ids.authority, ids.qualification, disclosure, submission.correlationId, assessmentId, caseId, evaluation.assessment.result],
    );
    for (const item of evaluation.assessment.predicates) {
      await client.query(
        "INSERT INTO appts.admission_predicate_result(committed_at,actor_ref,authority_ref,qualification_ref,disclosure_label_ref,correlation_id,assessment_id,predicate_identity,result_code,reason_ref_code) VALUES(now(),$1,$2,$3,$4,$5,$6,$7,$8,$9)",
        [ids.actor, ids.authority, ids.qualification, disclosure, submission.correlationId, assessmentId, item.predicate, item.status, item.reasonRef ?? null],
      );
    }
    await client.query("UPDATE appts.pre_ticket_case SET current_assessment_id=$1,projection_version=1,rebuilt_at=now() WHERE case_id=$2 AND projection_version=0", [assessmentId, caseId]);
    await client.query(
      "INSERT INTO appts.commit_marker(owner_domain_ref,aggregate_or_subject_ref,expected_version,resulting_version,transaction_identity,committed_at,result_hash) VALUES($1,$2,0,1,'PTX-02',now(),$3)",
      [OWNER_DOMAIN, caseId, digest(JSON.stringify(evaluation.assessment))],
    );
    await audit(client, "APPTS.CORE.D01.PRETICKET_ADMISSION.PTX-02", caseId, submission, ids, disclosure);
  });

  const decisionId = randomUUID();
  await inTransaction(pool, async (client) => {
    const deficiencies = evaluation.assessment.predicates.filter((item) => item.status !== "SATISFIED");
    await client.query(
      "INSERT INTO appts.intake_decision(committed_at,actor_ref,authority_ref,qualification_ref,disclosure_label_ref,correlation_id,decision_id,case_id,assessment_id,decision_code,reason_ref,deficiency_set_ref,deficiency_set_ref_schema_version,decided_at) VALUES(now(),$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,'1.0.0',now())",
      [ids.actor, ids.authority, ids.qualification, disclosure, submission.correlationId, decisionId, caseId, assessmentId, evaluation.decision, evaluation.assessment.result, JSON.stringify(deficiencies)],
    );
    const updated = await client.query(
      "UPDATE appts.pre_ticket_case SET current_decision_id=$1,projection_version=2,case_status_ref=$2,rebuilt_at=now() WHERE case_id=$3 AND projection_version=1",
      [decisionId, evaluation.decision, caseId],
    );
    if (updated.rowCount !== 1) throw new Error("PTX_03_CASE_VERSION_CONFLICT");
    await client.query(
      "INSERT INTO appts.commit_marker(owner_domain_ref,aggregate_or_subject_ref,expected_version,resulting_version,transaction_identity,committed_at,result_hash) VALUES($1,$2,1,2,'PTX-03',now(),$3)",
      [OWNER_DOMAIN, caseId, digest(JSON.stringify({ assessmentId, decisionId, decision: evaluation.decision }))],
    );
    await audit(client, "APPTS.CORE.D01.PRETICKET_ADMISSION.PTX-03", caseId, submission, ids, disclosure);
  });
  return { assessmentId, decisionId };
}

export function createTrialPreTicketOwnerFlow(pool: PersistencePool): (payload: unknown) => Promise<TrialOwnerFlowResult> {
  return async (rawPayload: unknown): Promise<TrialOwnerFlowResult> => {
    const payload = parsePayload(rawPayload);
    const disclosure = resolveTrialDisclosureLabelRef(TD_PRE_001_TRIAL_CONTEXT);
    const ids = systemIds();
    const sourceRef = await realizeTrialSourceBinding(pool, ids);
    const sourceContent = payload.conflictProbe === true
      ? JSON.stringify({ ...TD_PRE_001_INPUT, source_condition: "CONFLICT_PROBE_NOT_ADMITTED" })
      : JSON.stringify(TD_PRE_001_INPUT);
    const submission: PreTicketSubmission = Object.freeze({
      contractRef: CONTRACT,
      semanticVersion: VERSION,
      profileRef: PROFILE,
      messageId: payload.messageId,
      idempotencyKey: payload.idempotencyKey,
      correlationId: payload.correlationId,
      receivedAt: isoNow(),
      sourceRef,
      subjectRef: ids.subject,
      payloadDigest: digest(sourceContent),
      submittedSourceContent: sourceContent,
      sourceObservedAt: isoNow(),
      qualification: "CONFIRMED",
      currentness: TD_PRE_001_INPUT.source_currentness,
      actorRef: ids.actor,
      authorityRef: ids.authority,
      responsibilityContextRef: ids.responsibility,
      purposeBindingRef: ids.purpose,
      admissionContextRef: ids.admission,
      disclosureControlRef: TD_PRE_001_DISCLOSURE_CONTROL_REF,
    });
    const first = await ptx01(pool, submission, ids, disclosure);
    if (first.disposition !== "CREATED") return first;
    const evaluation = evaluatePreTicketAdmission(
      submission,
      { intakeCueId: first.cueId, observationId: first.observationId, preTicketCaseId: first.caseId, assessmentId: randomUUID(), decisionId: randomUUID() },
      ownerPredicates(),
    );
    const downstream = await ptx02And03(pool, submission, ids, disclosure, first.caseId, evaluation);
    return Object.freeze({ ...first, ...downstream, assessmentResult: evaluation.assessment.result, decision: evaluation.decision, disclosure });
  };
}

export function createTrialPreTicketIntentDispatcher(pool: PersistencePool): UiIntentDispatcher {
  return createPreTicketIntentDispatcher(createTrialPreTicketOwnerFlow(pool));
}
