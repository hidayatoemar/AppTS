import { createHash, randomUUID } from "node:crypto";
import type { PersistenceClient, PersistencePool } from "@appts-restore-service/persistence";
import {
  ADMISSION_PREDICATES,
  evaluatePreTicketAdmission,
  formTicket,
  type PredicateResult,
  type PreTicketSubmission,
} from "@appts-restore-service/core-d01";
import {
  activateRuntime,
  deriveAvailableActions,
  executeLifecycleEffect,
  type DurableEffectResult,
  type RuntimeAggregate,
  type RuntimeEffectStore,
} from "@appts-restore-service/runtime-d04";
import {
  I01_INTERFACE_IDENTITY,
  I01_PROFILE_IDENTITY,
  I01_SEMANTIC_VERSION,
  INT_RUN_TD_05_IDENTITY,
  validateActionIntent,
  validateTicketActivation,
  type ActionIntentPayload,
  type AuthorityResolutionPayload,
  type EvidenceGateResultPayload,
  type TicketActivationMessage,
} from "@appts-restore-service/contracts";
import type { UiIntentDispatcher } from "../routes/ui-intents.ts";

export const TLS_DAY1_GOLDEN_CONTEXT = "TLS-DAY1-GOLDEN" as const;

const PRE_TICKET_INTENT = "APPTS.CORE.D01.PRETICKET_ADMISSION.SUBMISSION / 1.0.0";
const OWNER_DOMAIN = "APPTS.TLS.DAY1.GOLDEN.OWNER";
const DISCLOSURE = "6f79da70-412f-469e-bcf7-f544f81b8aa7";
const SOURCE_REF = "51010000-0000-4000-8000-000000000001";
const SOURCE_VERSION_REF = "51010000-0000-4000-8000-000000000002";
const PURPOSE_BINDING = "51010000-0000-4000-8000-000000000005";
const ASSIGNMENT_SNAPSHOT = "51010000-0000-4000-8000-000000000006";
const DOMAIN = "51010000-0000-4000-8000-000000000007";
const ROLE_INSTANCE = "51010000-0000-4000-8000-000000000009";
const HOLDER = "51010000-0000-4000-8000-00000000000a";
const ASSIGNMENT_REF = "51010000-0000-4000-8000-00000000000b";
const AUTHORIZATION_BASIS = "51010000-0000-4000-8000-00000000000c";
const QUALIFICATION_REF = "51010000-0000-4000-8000-00000000000d";
const SUBJECT = "51020000-0000-4000-8000-000000000001";
const PROVENANCE = "51020000-0000-4000-8000-000000000002";

const PURPOSE = Object.freeze({
  purposeBindingId: PURPOSE_BINDING,
  purposeIdentity: "RESTORE_SERVICE",
  purposeVersion: "1.0.0",
  packageIdentity: "APP-RESTORE-SERVICE",
  packageVersion: "1.0.0",
  coreBindingRef: "1.0.0",
  hookBindingRef: "1.0.0",
});

interface GoldenRequest {
  readonly messageId: string;
  readonly idempotencyKey: string;
  readonly correlationId: string;
  readonly trialContext: typeof TLS_DAY1_GOLDEN_CONTEXT;
}

interface GoldenCreated {
  readonly disposition: "CREATED";
  readonly caseId: string;
  readonly ticketId: string;
  readonly assessmentResult: "ACCEPTABLE";
  readonly decision: "ACCEPTED_FOR_FORMATION";
  readonly state: "ACCEPTED";
  readonly aggregateVersion: 0;
}

type GoldenResult = GoldenCreated
  | { readonly disposition: "IDEMPOTENT_REPLAY"; readonly ticketId: string }
  | { readonly disposition: "CONFLICT_HOLD"; readonly ticketId: string };

interface ActionContext {
  readonly current_state_code: RuntimeAggregate["state"];
  readonly aggregate_version: string;
  readonly responsibility_id: string;
  readonly holder_ref: string;
  readonly assignment_ref: string;
  readonly authority_result_id: string;
  readonly gate_evaluation_id: string;
  readonly authority_projection_id: string;
  readonly gate_projection_id: string;
  readonly authority_currentness: string;
  readonly gate_currentness: string;
  readonly authorityActions: readonly { readonly action_class_ref: string; readonly permission_code: string }[];
  readonly progressionClasses: readonly string[];
  readonly presentedActions: readonly string[];
}

const hash = (value: string): string => createHash("sha256").update(value).digest("hex");
const lockKey = (key: string): string => createHash("sha256").update(OWNER_DOMAIN).update("\0").update(key).digest().readBigInt64BE(0).toString();
const now = (): string => new Date().toISOString();

function parseGoldenRequest(payload: unknown): GoldenRequest {
  if (!payload || typeof payload !== "object") throw new Error("TLS_DAY1_REQUIRED_PAYLOAD");
  const value = payload as Readonly<Record<string, unknown>>;
  for (const key of ["messageId", "idempotencyKey", "correlationId"] as const) {
    if (typeof value[key] !== "string" || value[key].length === 0) throw new Error(`TLS_DAY1_REQUIRED_${key}`);
  }
  if (value["trialContext"] !== TLS_DAY1_GOLDEN_CONTEXT) throw new Error("TLS_DAY1_CONTEXT_MISMATCH");
  return Object.freeze({
    messageId: value["messageId"] as string,
    idempotencyKey: value["idempotencyKey"] as string,
    correlationId: value["correlationId"] as string,
    trialContext: TLS_DAY1_GOLDEN_CONTEXT,
  });
}

async function tx<T>(pool: PersistencePool, work: (client: PersistenceClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
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

function predicates(): readonly PredicateResult[] {
  return Object.freeze(ADMISSION_PREDICATES.map((predicate) => Object.freeze({ predicate, status: "SATISFIED" as const })));
}

function submission(request: GoldenRequest, at: string): PreTicketSubmission {
  const submittedSourceContent = JSON.stringify({
    fixture: TLS_DAY1_GOLDEN_CONTEXT,
    source: "CONTROLLED_SIMULATOR",
    subject: SUBJECT,
    mandatoryFacts: "COMPLETE",
  });
  return Object.freeze({
    contractRef: "APPTS.CORE.D01.PRETICKET_ADMISSION",
    semanticVersion: "1.0.0",
    profileRef: "APPTS.CORE.D01.PRETICKET_ADMISSION.PROFILE.1.0.0",
    messageId: request.messageId,
    idempotencyKey: request.idempotencyKey,
    correlationId: request.correlationId,
    receivedAt: at,
    sourceRef: SOURCE_REF,
    subjectRef: SUBJECT,
    payloadDigest: hash(submittedSourceContent),
    submittedSourceContent,
    sourceObservedAt: at,
    qualification: "CONFIRMED",
    currentness: "CURRENT",
    actorRef: HOLDER,
    authorityRef: AUTHORIZATION_BASIS,
    responsibilityContextRef: ASSIGNMENT_SNAPSHOT,
    purposeBindingRef: PURPOSE_BINDING,
    admissionContextRef: TLS_DAY1_GOLDEN_CONTEXT,
    disclosureControlRef: DISCLOSURE,
  });
}

function activationMessage(formation: ReturnType<typeof formTicket>, request: GoldenRequest, at: string): TicketActivationMessage {
  return Object.freeze({
    interface_identity: I01_INTERFACE_IDENTITY,
    semantic_version: I01_SEMANTIC_VERSION,
    profile_identity: I01_PROFILE_IDENTITY,
    message_id: randomUUID(),
    idempotency_key: request.idempotencyKey,
    correlation_id: request.correlationId,
    producer_ref: "APPTS.CORE.D01",
    subject_ref: formation.ticketId,
    source_sequence_or_version: String(formation.activation.producer_aggregate_version),
    produced_at: at,
    effective_from: at,
    currentness_ref: "CURRENT",
    payload_hash: hash(JSON.stringify(formation.activation)),
    payload: formation.activation,
  });
}

async function createGolden(pool: PersistencePool, payload: unknown): Promise<GoldenResult> {
  const request = parseGoldenRequest(payload);
  const payloadHash = hash(JSON.stringify(request));
  return tx(pool, async (client) => {
    await client.query("SELECT pg_advisory_xact_lock($1::bigint)", [lockKey(request.idempotencyKey)]);
    const prior = await client.query<{ payload_hash: string; durable_result_ref: string | null }>(
      "SELECT payload_hash,durable_result_ref FROM appts.idempotency_ledger WHERE owner_domain_ref=$1 AND idempotency_key=$2",
      [OWNER_DOMAIN, request.idempotencyKey],
    );
    if (prior.rowCount) {
      const row = prior.rows[0]!;
      if (!row.durable_result_ref) throw new Error("TLS_DAY1_LEDGER_RESULT_MISSING");
      return row.payload_hash === payloadHash
        ? { disposition: "IDEMPOTENT_REPLAY", ticketId: row.durable_result_ref }
        : { disposition: "CONFLICT_HOLD", ticketId: row.durable_result_ref };
    }

    const at = now();
    const sourceSubmission = submission(request, at);
    const ids = {
      intakeCueId: randomUUID(), observationId: randomUUID(), preTicketCaseId: randomUUID(),
      assessmentId: randomUUID(), decisionId: randomUUID(),
    };
    const evaluation = evaluatePreTicketAdmission(sourceSubmission, ids, predicates());
    if (evaluation.assessment.result !== "ACCEPTABLE" || evaluation.decision !== "ACCEPTED_FOR_FORMATION") {
      throw new Error("TLS_DAY1_POSITIVE_ADMISSION_NOT_ACCEPTED");
    }

    await client.query(
      "INSERT INTO appts.intake_cue(record_version,domain_id,purpose_binding_id,source_version_ref_id,observed_at,committed_at,actor_ref,authority_ref,qualification_ref,disclosure_label_ref,cue_id,source_ref_id,received_at,subject_ref_id,channel_ref_code,correlation_id) VALUES(1,$1,$2,$3,$4,$4,$5,$6,$7,$8,$9,$10,$4,$11,'TLS_DAY1_SIMULATOR',$12)",
      [DOMAIN, PURPOSE_BINDING, SOURCE_VERSION_REF, at, HOLDER, AUTHORIZATION_BASIS, QUALIFICATION_REF, DISCLOSURE, ids.intakeCueId, SOURCE_REF, SUBJECT, request.correlationId],
    );
    await client.query(
      "INSERT INTO appts.source_observation(record_version,domain_id,purpose_binding_id,source_ref_id,source_version_ref_id,observed_at,received_at,committed_at,actor_ref,authority_ref,disclosure_label_ref,correlation_id,observation_id,cue_id,source_content_ref_kind,source_content_ref_json,source_content_ref_json_schema_version,subject_ref,channel_ref,source_time,provenance_ref,qualification_ref,content_digest) VALUES(1,$1,$2,$3,$4,$5,$5,$5,$6,$7,$8,$9,$10,$11,'JSON',$12::jsonb,'1.0.0',$13,'TLS_DAY1_SIMULATOR',$5,$14,$15,decode($16,'hex'))",
      [DOMAIN, PURPOSE_BINDING, SOURCE_REF, SOURCE_VERSION_REF, at, HOLDER, AUTHORIZATION_BASIS, DISCLOSURE, request.correlationId, ids.observationId, ids.intakeCueId, sourceSubmission.submittedSourceContent, SUBJECT, PROVENANCE, QUALIFICATION_REF, sourceSubmission.payloadDigest],
    );
    await client.query(
      "INSERT INTO appts.pre_ticket_case(projection_version,currentness_ref,rebuilt_at,case_id,governing_observation_ref,deficiency_set_version,case_status_ref) VALUES(1,'CURRENT',$1,$2,$3,0,'ASSESSING')",
      [at, ids.preTicketCaseId, ids.observationId],
    );
    await client.query(
      "INSERT INTO appts.admission_assessment(record_version,domain_id,purpose_binding_id,source_ref_id,source_version_ref_id,observed_at,received_at,committed_at,actor_ref,authority_ref,qualification_ref,disclosure_label_ref,correlation_id,assessment_id,case_id,assessed_against_case_version,overall_result_ref,evaluated_at) VALUES(1,$1,$2,$3,$4,$5,$5,$5,$6,$7,$8,$9,$10,$11,$12,1,'ACCEPTABLE',$5)",
      [DOMAIN, PURPOSE_BINDING, SOURCE_REF, SOURCE_VERSION_REF, at, HOLDER, AUTHORIZATION_BASIS, QUALIFICATION_REF, DISCLOSURE, request.correlationId, ids.assessmentId, ids.preTicketCaseId],
    );
    for (const predicate of predicates()) {
      await client.query(
        "INSERT INTO appts.admission_predicate_result(record_version,domain_id,purpose_binding_id,source_ref_id,observed_at,received_at,committed_at,actor_ref,authority_ref,qualification_ref,disclosure_label_ref,correlation_id,predicate_result_id,assessment_id,predicate_identity,result_code,source_version_ref_id) VALUES(1,$1,$2,$3,$4,$4,$4,$5,$6,$7,$8,$9,$10,$11,$12,'SATISFIED',$13)",
        [DOMAIN, PURPOSE_BINDING, SOURCE_REF, at, HOLDER, AUTHORIZATION_BASIS, QUALIFICATION_REF, DISCLOSURE, request.correlationId, randomUUID(), ids.assessmentId, predicate.predicate, SOURCE_VERSION_REF],
      );
    }
    await client.query(
      "INSERT INTO appts.intake_decision(record_version,domain_id,purpose_binding_id,source_ref_id,source_version_ref_id,observed_at,received_at,committed_at,actor_ref,authority_ref,qualification_ref,disclosure_label_ref,correlation_id,decision_id,case_id,assessment_id,decision_code,decided_at) VALUES(1,$1,$2,$3,$4,$5,$5,$5,$6,$7,$8,$9,$10,$11,$12,$13,'ACCEPTED_FOR_FORMATION',$5)",
      [DOMAIN, PURPOSE_BINDING, SOURCE_REF, SOURCE_VERSION_REF, at, HOLDER, AUTHORIZATION_BASIS, QUALIFICATION_REF, DISCLOSURE, request.correlationId, ids.decisionId, ids.preTicketCaseId, ids.assessmentId],
    );
    await client.query(
      "UPDATE appts.pre_ticket_case SET current_assessment_id=$1,current_decision_id=$2,case_status_ref='ACCEPTED_FOR_FORMATION',rebuilt_at=$3 WHERE case_id=$4",
      [ids.assessmentId, ids.decisionId, at, ids.preTicketCaseId],
    );

    const ticketId = randomUUID();
    const formationId = randomUUID();
    const responsibilityId = randomUUID();
    const evidenceSetId = randomUUID();
    const formationMarker = randomUUID();
    const formation = formTicket(evaluation.assessment, {
      formationId, ticketId, domainId: DOMAIN, intakeDecisionId: ids.decisionId,
      responsibleAssignmentRef: responsibilityId, formationEvidenceSetRef: evidenceSetId,
      aggregateVersion: 0, effectiveAt: at, binding: PURPOSE,
    });
    const i01 = activationMessage(formation, request, at);
    const activation = activateRuntime(undefined, i01, validateTicketActivation(i01));
    if (activation.status !== "ACTIVATED" || activation.aggregate.state !== "ACCEPTED" || activation.aggregate.aggregateVersion !== 0) {
      throw new Error("TLS_DAY1_I01_ACTIVATION_POSTCONDITION_FAILED");
    }

    await client.query("SET CONSTRAINTS ALL DEFERRED");
    await client.query(
      "INSERT INTO appts.ticket_identity(record_version,domain_id,source_ref_id,source_version_ref_id,observed_at,received_at,committed_at,actor_ref,authority_ref,qualification_ref,disclosure_label_ref,correlation_id,ticket_id,formation_id,purpose_binding_id,primary_domain_id,formed_at) VALUES(1,$1,$2,$3,$4,$4,$4,$5,$6,$7,$8,$9,$10,$11,$12,$1,$4)",
      [DOMAIN, SOURCE_REF, SOURCE_VERSION_REF, at, HOLDER, AUTHORIZATION_BASIS, QUALIFICATION_REF, DISCLOSURE, request.correlationId, ticketId, formationId, PURPOSE_BINDING],
    );
    await client.query(
      "INSERT INTO appts.responsible_assignment(record_version,purpose_binding_id,source_ref_id,source_version_ref_id,observed_at,received_at,committed_at,actor_ref,authority_ref,qualification_ref,disclosure_label_ref,correlation_id,responsibility_id,ticket_id,domain_id,role_instance_ref,holder_ref,assignment_snapshot_id,effective_from,status_ref) VALUES(1,$1,$2,$3,$4,$4,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$4,'ACTIVE')",
      [PURPOSE_BINDING, SOURCE_REF, SOURCE_VERSION_REF, at, HOLDER, AUTHORIZATION_BASIS, QUALIFICATION_REF, DISCLOSURE, request.correlationId, responsibilityId, ticketId, DOMAIN, ROLE_INSTANCE, HOLDER, ASSIGNMENT_SNAPSHOT],
    );
    await client.query(
      "INSERT INTO appts.evidence_set_version(record_version,domain_id,purpose_binding_id,source_ref_id,source_version_ref_id,observed_at,received_at,committed_at,actor_ref,authority_ref,qualification_ref,disclosure_label_ref,correlation_id,evidence_set_version_id,ticket_id,scope_ref,scope_ref_schema_version,set_version,created_for_ref_code) VALUES(1,$1,$2,$3,$4,$5,$5,$5,$6,$7,$8,$9,$10,$11,$12,'{\"scope\":\"TLS_DAY1_FORMATION\"}'::jsonb,'1.0.0',1,'FORMATION')",
      [DOMAIN, PURPOSE_BINDING, SOURCE_REF, SOURCE_VERSION_REF, at, HOLDER, AUTHORIZATION_BASIS, QUALIFICATION_REF, DISCLOSURE, request.correlationId, evidenceSetId, ticketId],
    );
    await client.query(
      "INSERT INTO appts.commit_marker(commit_marker_id,owner_domain_ref,aggregate_or_subject_ref,expected_version,resulting_version,transaction_identity,committed_at,result_hash) VALUES($1,'APPTS.CORE.D01.FORMATION',$2,0,0,$3,$4,$5)",
      [formationMarker, ticketId, `TLS-DAY1-FORMATION:${formationId}`, at, hash(ticketId)],
    );
    await client.query(
      "INSERT INTO appts.ticket_formation_record(record_version,domain_id,source_ref_id,source_version_ref_id,observed_at,received_at,committed_at,actor_ref,authority_ref,qualification_ref,disclosure_label_ref,correlation_id,formation_id,ticket_id,intake_decision_id,purpose_binding_id,responsible_assignment_ref,formation_evidence_set_ref,idempotency_key,producer_aggregate_version,activation_record_ref,commit_marker_id) VALUES(1,$1,$2,$3,$4,$4,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,0,$10,$17)",
      [DOMAIN, SOURCE_REF, SOURCE_VERSION_REF, at, HOLDER, AUTHORIZATION_BASIS, QUALIFICATION_REF, DISCLOSURE, request.correlationId, formationId, ticketId, ids.decisionId, PURPOSE_BINDING, responsibilityId, evidenceSetId, request.idempotencyKey, formationMarker],
    );

    // Controlled Trial source facts bind one existing accepted action class.
    // D-04 remains the action-set and lifecycle-effect owner.
    const authorityId = randomUUID();
    const gateId = randomUUID();
    const progressionId = randomUUID();
    await client.query(
      "INSERT INTO appts.authority_envelope(record_version,domain_id,purpose_binding_id,source_ref_id,source_version_ref_id,observed_at,received_at,committed_at,actor_ref,authority_ref,qualification_ref,disclosure_label_ref,correlation_id,authority_result_id,ticket_id,context_ref_json,context_ref_json_schema_version,assignment_snapshot_set_ref,responsibility_id,effective_from,result_status_ref,currentness_ref_code) VALUES(1,$1,$2,$3,$4,$5,$5,$5,$6,$7,$8,$9,$10,$11,$12,'{\"trial\":\"TLS-DAY1-GOLDEN\"}'::jsonb,'1.0.0',$13,$14,$5,'AUTHORIZED','CURRENT')",
      [DOMAIN, PURPOSE_BINDING, SOURCE_REF, SOURCE_VERSION_REF, at, HOLDER, AUTHORIZATION_BASIS, QUALIFICATION_REF, DISCLOSURE, request.correlationId, authorityId, ticketId, ASSIGNMENT_SNAPSHOT, responsibilityId],
    );
    await client.query("INSERT INTO appts.authority_action(authority_result_id,action_class_ref,permission_code) VALUES($1,'ACTIVATE','ALLOW')", [authorityId]);
    await client.query(
      "INSERT INTO appts.gate_evaluation(record_version,domain_id,purpose_binding_id,source_ref_id,source_version_ref_id,observed_at,received_at,committed_at,actor_ref,authority_ref,qualification_ref,disclosure_label_ref,correlation_id,gate_evaluation_id,ticket_id,gate_identity,input_version_set_ref_json,input_version_set_ref_json_schema_version,evidence_set_version_id,authority_result_ref,overall_result_ref,evaluated_at) VALUES(1,$1,$2,$3,$4,$5,$5,$5,$6,$7,$8,$9,$10,$11,$12,'TLS_DAY1_INITIAL_ACTIVATION','{\"aggregate_version\":0}'::jsonb,'1.0.0',$13,$14,'PASS',$5)",
      [DOMAIN, PURPOSE_BINDING, SOURCE_REF, SOURCE_VERSION_REF, at, HOLDER, AUTHORIZATION_BASIS, QUALIFICATION_REF, DISCLOSURE, request.correlationId, gateId, ticketId, evidenceSetId, authorityId],
    );
    await client.query(
      "INSERT INTO appts.progression_envelope(record_version,domain_id,purpose_binding_id,source_ref_id,source_version_ref_id,observed_at,received_at,committed_at,actor_ref,authority_ref,qualification_ref,disclosure_label_ref,correlation_id,envelope_id,gate_evaluation_id,ticket_id,effective_from,currentness_ref) VALUES(1,$1,$2,$3,$4,$5,$5,$5,$6,$7,$8,$9,$10,$11,$12,$13,$5,'CURRENT')",
      [DOMAIN, PURPOSE_BINDING, SOURCE_REF, SOURCE_VERSION_REF, at, HOLDER, AUTHORIZATION_BASIS, QUALIFICATION_REF, DISCLOSURE, request.correlationId, progressionId, gateId, ticketId],
    );
    await client.query("INSERT INTO appts.progression_class(envelope_id,progression_class_ref) VALUES($1,'ACTIVATE')", [progressionId]);

    const authorityPayload: AuthorityResolutionPayload = Object.freeze({
      authority_result_id: authorityId, ticket_id: ticketId, domain_id: DOMAIN,
      context_ref: { trial: TLS_DAY1_GOLDEN_CONTEXT }, assignment_snapshot_refs: [ASSIGNMENT_SNAPSHOT],
      responsibility_id: responsibilityId, responsible_assignment_ref: ASSIGNMENT_REF,
      authority_actions: [{ action_class_ref: "ACTIVATE", permission_code: "ALLOW" }],
      result_status_ref: "AUTHORIZED", currentness_ref: "CURRENT", effective_from: at,
    });
    const gatePayload: EvidenceGateResultPayload = Object.freeze({
      gate_result_id: gateId, ticket_id: ticketId, gate_identity: "TLS_DAY1_INITIAL_ACTIVATION",
      gate_evaluation_id: gateId, input_version_set_ref: { aggregate_version: 0 },
      evidence_set_version_id: evidenceSetId, gate_predicate_results: [],
      progression_envelope_id: progressionId, permitted_progression_classes: ["ACTIVATE"],
      currentness_ref: "CURRENT", effective_from: at,
    });
    const actions = deriveAvailableActions(authorityPayload, gatePayload, []);
    if (actions.length !== 1 || actions[0] !== "ACTIVATE") throw new Error("TLS_DAY1_ACTION_DERIVATION_FAILED");

    const authorityProjection = randomUUID();
    const gateProjection = randomUUID();
    const actionSnapshot = randomUUID();

    // runtime_ticket is the FK parent of authority/gate projections. Create the
    // runtime aggregate first, then bind its current projection pointers after
    // those dependent rows exist. This preserves the frozen schema unchanged.
    await client.query(
      "INSERT INTO appts.runtime_ticket(ticket_id,current_state_code,aggregate_version,activation_record_ref,purpose_binding_id,current_context_version,updated_at) VALUES($1,'ACCEPTED',0,$2,$3,1,$4)",
      [ticketId, formationId, PURPOSE_BINDING, at],
    );
    await client.query(
      "INSERT INTO appts.runtime_context(ticket_id,context_version,purpose_binding_id,domain_id,source_context_refs_json,source_context_refs_json_schema_version,currentness_ref,committed_at) VALUES($1,1,$2,$3,'{\"trial\":\"TLS-DAY1-GOLDEN\"}'::jsonb,'1.0.0','CURRENT',$4)",
      [ticketId, PURPOSE_BINDING, DOMAIN, at],
    );
    await client.query(
      "INSERT INTO appts.authority_projection(projection_version,rebuilt_at,authority_projection_id,ticket_id,source_authority_result_id,source_version_ref,permitted_action_set_ref,permitted_action_set_ref_schema_version,responsible_assignment_ref,effective_from,currentness_ref) VALUES(1,$1,$2,$3,$4,$5,'[\"ACTIVATE\"]'::jsonb,'1.0.0',$6,$1,'CURRENT')",
      [at, authorityProjection, ticketId, authorityId, SOURCE_VERSION_REF, ASSIGNMENT_REF],
    );
    await client.query(
      "INSERT INTO appts.gate_projection(projection_version,rebuilt_at,gate_projection_id,ticket_id,source_gate_result_id,source_version_ref,progression_envelope_ref,effective_from,currentness_ref) VALUES(1,$1,$2,$3,$4,$5,$6,$1,'CURRENT')",
      [at, gateProjection, ticketId, gateId, SOURCE_VERSION_REF, progressionId],
    );
    await client.query(
      "INSERT INTO appts.action_set_snapshot(projection_version,currentness_ref,rebuilt_at,action_set_snapshot_id,ticket_id,aggregate_version,authority_projection_id,gate_projection_id,derived_at) VALUES(1,'CURRENT',$1,$2,$3,0,$4,$5,$1)",
      [at, actionSnapshot, ticketId, authorityProjection, gateProjection],
    );
    await client.query("INSERT INTO appts.action_set_member(action_set_snapshot_id,action_class_ref,availability_result_ref) VALUES($1,'ACTIVATE','AVAILABLE')", [actionSnapshot]);
    await client.query(
      "UPDATE appts.runtime_ticket SET current_authority_projection_id=$1,current_gate_projection_id=$2,updated_at=$3 WHERE ticket_id=$4",
      [authorityProjection, gateProjection, at, ticketId],
    );
    await client.query(
      "INSERT INTO appts.idempotency_ledger(owner_domain_ref,idempotency_key,command_or_message_identity,payload_hash,durable_result_ref,first_seen_at,last_seen_at,conflict_status_ref) VALUES($1,$2,$3,$4,$5,$6,$6,'NONE')",
      [OWNER_DOMAIN, request.idempotencyKey, request.messageId, payloadHash, ticketId, at],
    );

    return Object.freeze({ disposition: "CREATED", caseId: ids.preTicketCaseId, ticketId,
      assessmentResult: "ACCEPTABLE", decision: "ACCEPTED_FOR_FORMATION", state: "ACCEPTED", aggregateVersion: 0 });
  });
}

async function actionContext(client: PersistenceClient, ticketId: string): Promise<ActionContext> {
  const context = await client.query<{
    current_state_code: RuntimeAggregate["state"]; aggregate_version: string; responsibility_id: string;
    holder_ref: string; assignment_ref: string; authority_result_id: string; gate_evaluation_id: string;
    authority_projection_id: string; gate_projection_id: string; authority_currentness: string;
    gate_currentness: string; progression_envelope_ref: string;
  }>(
    "SELECT rt.current_state_code,rt.aggregate_version::text,ra.responsibility_id::text,ra.holder_ref::text,ap.responsible_assignment_ref::text AS assignment_ref,ae.authority_result_id::text,ge.gate_evaluation_id::text,ap.authority_projection_id::text,gp.gate_projection_id::text,ap.currentness_ref AS authority_currentness,gp.currentness_ref AS gate_currentness,gp.progression_envelope_ref::text FROM appts.runtime_ticket rt JOIN appts.responsible_assignment ra ON ra.ticket_id=rt.ticket_id AND ra.effective_to IS NULL JOIN appts.authority_envelope ae ON ae.ticket_id=rt.ticket_id AND ae.effective_to IS NULL JOIN appts.gate_evaluation ge ON ge.ticket_id=rt.ticket_id JOIN appts.authority_projection ap ON ap.authority_projection_id=rt.current_authority_projection_id JOIN appts.gate_projection gp ON gp.gate_projection_id=rt.current_gate_projection_id WHERE rt.ticket_id=$1 ORDER BY ge.evaluated_at DESC LIMIT 1",
    [ticketId],
  );
  if (!context.rowCount) throw new Error("TLS_DAY1_ACTION_CONTEXT_NOT_FOUND");
  const row = context.rows[0]!;
  const authorityActions = await client.query<{ action_class_ref: string; permission_code: string }>(
    "SELECT action_class_ref,permission_code FROM appts.authority_action WHERE authority_result_id=$1 ORDER BY action_class_ref", [row.authority_result_id]);
  const progressionClasses = await client.query<{ progression_class_ref: string }>(
    "SELECT progression_class_ref FROM appts.progression_class WHERE envelope_id=$1 ORDER BY progression_class_ref", [row.progression_envelope_ref]);
  const presented = await client.query<{ action_class_ref: string }>(
    "SELECT m.action_class_ref FROM appts.action_set_snapshot s JOIN appts.action_set_member m ON m.action_set_snapshot_id=s.action_set_snapshot_id WHERE s.ticket_id=$1 AND s.aggregate_version=$2 AND s.currentness_ref='CURRENT' AND m.availability_result_ref='AVAILABLE' ORDER BY s.derived_at DESC,m.action_class_ref",
    [ticketId, Number(row.aggregate_version)],
  );
  return Object.freeze({ ...row,
    authorityActions: Object.freeze(authorityActions.rows.map((item) => Object.freeze({ ...item }))),
    progressionClasses: Object.freeze(progressionClasses.rows.map((item) => item.progression_class_ref)),
    presentedActions: Object.freeze(presented.rows.map((item) => item.action_class_ref)),
  });
}

async function findDurableEffectResult(pool: PersistencePool, commandId: string): Promise<DurableEffectResult | undefined> {
  const result = await pool.query<{
    command_id: string; result_hash: string | null; effect_disposition_code: string; reason_ref: string | null;
    resulting_aggregate_version: string | null; current_state_code: RuntimeAggregate["state"];
  }>(
    "SELECT request.command_id::text,marker.result_hash,effect.effect_disposition_code,effect.reason_ref,effect.resulting_aggregate_version::text,runtime.current_state_code FROM appts.lifecycle_effect_request request JOIN appts.lifecycle_effect_result effect ON effect.effect_request_id=request.effect_request_id JOIN appts.commit_marker marker ON marker.commit_marker_id=effect.durable_commit_marker_id JOIN appts.runtime_ticket runtime ON runtime.ticket_id=request.ticket_id WHERE request.command_id=$1",
    [commandId],
  );
  if (!result.rowCount) return undefined;
  const row = result.rows[0]!;
  return Object.freeze({ commandId: row.command_id, payloadHash: row.result_hash ?? "",
    disposition: row.effect_disposition_code as DurableEffectResult["disposition"], reason: row.reason_ref ?? "",
    aggregateVersion: Number(row.resulting_aggregate_version ?? 0), state: row.current_state_code, auditRef: `audit:${commandId}` });
}

function sqlEffectStore(pool: PersistencePool, context: {
  readonly actor: string; readonly correlation: string; readonly authorityProjection: string;
  readonly gateProjection: string; readonly authorityResult: string; readonly gateResult: string;
}): RuntimeEffectStore {
  return Object.freeze({
    async loadAggregate(ticketId: string): Promise<RuntimeAggregate | undefined> {
      const result = await pool.query<{
        ticket_id: string; current_state_code: RuntimeAggregate["state"]; aggregate_version: string;
        purpose_binding_id: string; activation_record_ref: string;
      }>(
        "SELECT ticket_id::text,current_state_code,aggregate_version::text,purpose_binding_id::text,activation_record_ref::text FROM appts.runtime_ticket WHERE ticket_id=$1",
        [ticketId],
      );
      if (!result.rowCount) return undefined;
      const row = result.rows[0]!;
      if (row.purpose_binding_id !== PURPOSE_BINDING) throw new Error("TLS_DAY1_RUNTIME_PURPOSE_BINDING_MISMATCH");
      return Object.freeze({ ticketId: row.ticket_id, purposeBindingId: row.purpose_binding_id,
        purposeIdentity: PURPOSE.purposeIdentity, purposeVersion: PURPOSE.purposeVersion,
        packageIdentity: PURPOSE.packageIdentity, packageVersion: PURPOSE.packageVersion,
        activationId: row.activation_record_ref, state: row.current_state_code, aggregateVersion: Number(row.aggregate_version) });
    },
    async findCommandResult(commandId: string): Promise<DurableEffectResult | undefined> {
      return findDurableEffectResult(pool, commandId);
    },
    async commitEffect(expectedVersion: number, next: RuntimeAggregate, result: DurableEffectResult) {
      return tx(pool, async (client) => {
        const current = await client.query<{ aggregate_version: string; current_state_code: RuntimeAggregate["state"] }>(
          "SELECT aggregate_version::text,current_state_code FROM appts.runtime_ticket WHERE ticket_id=$1 FOR UPDATE", [next.ticketId]);
        if (!current.rowCount || Number(current.rows[0]!.aggregate_version) !== expectedVersion) return { status: "VERSION_CONFLICT" as const };

        const at = now();
        const requestId = randomUUID();
        const resultId = randomUUID();
        const transitionId = randomUUID();
        const markerId = randomUUID();
        await client.query(
          "INSERT INTO appts.lifecycle_effect_request(record_version,domain_id,purpose_binding_id,source_ref_id,source_version_ref_id,observed_at,received_at,committed_at,authority_ref,qualification_ref,disclosure_label_ref,correlation_id,effect_request_id,ticket_id,requested_effect_class,expected_aggregate_version,authority_result_ref,gate_result_ref,actor_ref,command_id,idempotency_key,requested_at) VALUES(1,$1,$2,$3,$4,$5,$5,$5,$6,$7,$8,$9,$10,$11,'ACTIVATE',$12,$13,$14,$15,$16,$16,$5)",
          [DOMAIN, PURPOSE_BINDING, SOURCE_REF, SOURCE_VERSION_REF, at, AUTHORIZATION_BASIS, QUALIFICATION_REF, DISCLOSURE, context.correlation, requestId, next.ticketId, expectedVersion, context.authorityResult, context.gateResult, context.actor, result.commandId],
        );
        await client.query(
          "INSERT INTO appts.commit_marker(commit_marker_id,owner_domain_ref,aggregate_or_subject_ref,expected_version,resulting_version,transaction_identity,committed_at,result_hash) VALUES($1,'APPTS.RUNTIME.D04.EFFECT',$2,$3,$4,$5,$6,$7)",
          [markerId, next.ticketId, expectedVersion, next.aggregateVersion, `TLS-DAY1-EFFECT:${result.commandId}`, at, result.payloadHash],
        );
        await client.query(
          "INSERT INTO appts.lifecycle_effect_result(record_version,domain_id,purpose_binding_id,source_ref_id,source_version_ref_id,observed_at,received_at,committed_at,actor_ref,authority_ref,qualification_ref,disclosure_label_ref,correlation_id,effect_result_id,effect_request_id,ticket_id,result_code,effect_disposition_code,reason_ref,prior_aggregate_version,resulting_aggregate_version,durable_commit_marker_id,outbox_result_ref) VALUES(1,$1,$2,$3,$4,$5,$5,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)",
          [DOMAIN, PURPOSE_BINDING, SOURCE_REF, SOURCE_VERSION_REF, at, context.actor, AUTHORIZATION_BASIS, QUALIFICATION_REF, DISCLOSURE, context.correlation, resultId, requestId, next.ticketId, result.disposition, result.disposition, result.reason, expectedVersion, next.aggregateVersion, markerId, result.outboxRef ?? null],
        );
        await client.query(
          "INSERT INTO appts.runtime_state_transition(transition_id,ticket_id,from_state_code,to_state_code,lifecycle_effect_request_id,lifecycle_effect_result_id,authority_projection_ref,gate_projection_ref,actor_ref,reason_ref,effective_at,committed_at,prior_aggregate_version,resulting_aggregate_version,correlation_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11,$12,$13,$14)",
          [transitionId, next.ticketId, current.rows[0]!.current_state_code, next.state, requestId, resultId, context.authorityProjection, context.gateProjection, context.actor, result.reason, at, expectedVersion, next.aggregateVersion, context.correlation],
        );
        await client.query(
          "UPDATE appts.runtime_ticket SET current_state_code=$1,aggregate_version=$2,current_state_transition_id=$3,last_effect_result_id=$4,updated_at=$5 WHERE ticket_id=$6 AND aggregate_version=$7",
          [next.state, next.aggregateVersion, transitionId, resultId, at, next.ticketId, expectedVersion],
        );
        const failClosedSnapshot = randomUUID();
        await client.query(
          "INSERT INTO appts.action_set_snapshot(projection_version,currentness_ref,rebuilt_at,action_set_snapshot_id,ticket_id,aggregate_version,authority_projection_id,gate_projection_id,restriction_profile_ref,derived_at) VALUES(1,'CURRENT',$1,$2,$3,$4,$5,$6,'POST_ACTIVATION_REFRESH_REQUIRED',$1)",
          [at, failClosedSnapshot, next.ticketId, next.aggregateVersion, context.authorityProjection, context.gateProjection],
        );
        return { status: "COMMITTED" as const, result };
      });
    },
  });
}

async function performAction(pool: PersistencePool, payload: unknown): Promise<unknown> {
  const validation = validateActionIntent(payload);
  if (!validation.ok) throw new Error(`INVALID_ACTION_INTENT:${validation.issues.map((issue) => issue.code).join(",")}`);
  const intent = payload as ActionIntentPayload;
  if (intent.requested_action_class !== "ACTIVATE") throw new Error("TLS_DAY1_ACTION_NOT_BOUND");

  const prior = await findDurableEffectResult(pool, intent.action_intent_id);
  const intentHash = hash(JSON.stringify(intent));
  if (prior) {
    const durable = prior.payloadHash === intentHash ? prior : Object.freeze({ ...prior, disposition: "NO_EFFECT" as const, reason: "CONFLICTING_REPLAY" });
    return Object.freeze({ result: durable.disposition, durable: true, ticketId: intent.ticket_id,
      action: intent.requested_action_class, state: durable.state, aggregateVersion: durable.aggregateVersion, reason: durable.reason });
  }

  const context = await tx(pool, async (client) => actionContext(client, intent.ticket_id));
  if (context.holder_ref !== intent.actor_ref || context.assignment_ref !== intent.role_assignment_ref) throw new Error("TLS_DAY1_ACTOR_ROLE_BINDING_MISMATCH");
  if (Number(context.aggregate_version) !== intent.expected_aggregate_version) throw new Error("TLS_DAY1_STALE_AGGREGATE");
  if (context.authority_currentness !== "CURRENT" || context.gate_currentness !== "CURRENT") throw new Error("TLS_DAY1_NONCURRENT_AUTHORITY_OR_GATE");
  if (!context.presentedActions.includes(intent.requested_action_class)) throw new Error("TLS_DAY1_ACTION_NOT_PRESENTED");

  const authority: AuthorityResolutionPayload = Object.freeze({
    authority_result_id: context.authority_result_id, ticket_id: intent.ticket_id, domain_id: DOMAIN,
    context_ref: { trial: TLS_DAY1_GOLDEN_CONTEXT }, assignment_snapshot_refs: [ASSIGNMENT_SNAPSHOT],
    responsibility_id: context.responsibility_id, responsible_assignment_ref: context.assignment_ref,
    authority_actions: context.authorityActions, result_status_ref: "AUTHORIZED",
    currentness_ref: context.authority_currentness, effective_from: intent.intent_time,
  });
  const gate: EvidenceGateResultPayload = Object.freeze({
    gate_result_id: context.gate_evaluation_id, ticket_id: intent.ticket_id,
    gate_identity: "TLS_DAY1_INITIAL_ACTIVATION", gate_evaluation_id: context.gate_evaluation_id,
    input_version_set_ref: { aggregate_version: intent.expected_aggregate_version }, gate_predicate_results: [],
    permitted_progression_classes: context.progressionClasses, currentness_ref: context.gate_currentness,
    effective_from: intent.intent_time,
  });
  const availableActions = deriveAvailableActions(authority, gate, []);
  if (!availableActions.includes(intent.requested_action_class)) throw new Error("TLS_DAY1_REDERIVATION_WITHHELD_ACTION");

  await pool.query(
    "INSERT INTO appts.action_intent(action_intent_id,ticket_id,actor_ref,role_assignment_ref,requested_action_class,presented_source_version_ref,expected_aggregate_version,intent_time,correlation_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (action_intent_id) DO NOTHING",
    [intent.action_intent_id, intent.ticket_id, intent.actor_ref, intent.role_assignment_ref, intent.requested_action_class, intent.presented_source_version_ref, intent.expected_aggregate_version, intent.intent_time, randomUUID()],
  );

  const effect = await executeLifecycleEffect(sqlEffectStore(pool, {
    actor: intent.actor_ref, correlation: randomUUID(), authorityProjection: context.authority_projection_id,
    gateProjection: context.gate_projection_id, authorityResult: context.authority_result_id, gateResult: context.gate_evaluation_id,
  }), {
    commandId: intent.action_intent_id, payloadHash: intentHash, ticketId: intent.ticket_id,
    expectedAggregateVersion: intent.expected_aggregate_version, actionClass: "ACTIVATE", targetState: "ACTIVE",
    availableActions, currentness: "CURRENT",
  });
  return Object.freeze({ result: effect.disposition,
    durable: effect.disposition !== "EFFECT_UNCERTAIN_RECONCILIATION_REQUIRED",
    ticketId: intent.ticket_id, action: "ACTIVATE", state: effect.state,
    aggregateVersion: effect.aggregateVersion, reason: effect.reason });
}

export function createTlsDay1GoldenDispatcher(pool: PersistencePool, fallback: UiIntentDispatcher): UiIntentDispatcher {
  return Object.freeze({
    async dispatch(contractRef: string, payload: unknown): Promise<unknown> {
      if (contractRef === PRE_TICKET_INTENT && payload && typeof payload === "object"
        && (payload as Readonly<Record<string, unknown>>)["trialContext"] === TLS_DAY1_GOLDEN_CONTEXT) {
        return createGolden(pool, payload);
      }
      if (contractRef === INT_RUN_TD_05_IDENTITY) return performAction(pool, payload);
      return fallback.dispatch(contractRef, payload);
    },
    async capture(payload: unknown): Promise<unknown> { return fallback.capture(payload); },
  });
}