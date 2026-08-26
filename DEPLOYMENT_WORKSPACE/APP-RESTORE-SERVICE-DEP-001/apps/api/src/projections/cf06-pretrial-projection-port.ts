import type { PersistencePool } from "@appts-restore-service/persistence";
import type { UiProjectionPort, UiReadContext } from "../routes/ui-read.ts";
import { createTrialProjectionPort } from "./trial-projection-port.ts";

type Row = Readonly<Record<string, unknown>>;
type Envelope = Readonly<Record<string, unknown>> & { readonly data?: unknown };

function record(value: unknown): Row {
  return typeof value === "object" && value !== null ? value as Row : {};
}
function rows(value: readonly Row[]): readonly Row[] { return Object.freeze(value.map((row) => Object.freeze({ ...row }))); }
function text(value: unknown): string | undefined { return typeof value === "string" && value.length > 0 ? value : undefined; }
function integer(value: unknown): number | undefined { return typeof value === "number" && Number.isInteger(value) ? value : undefined; }
function iso(value: unknown): string | undefined { return value instanceof Date ? value.toISOString() : text(value); }
function ageSeconds(value: unknown): number | undefined {
  const stamp = iso(value); if (!stamp) return undefined;
  const parsed = Date.parse(stamp); if (!Number.isFinite(parsed)) return undefined;
  return Math.max(0, Math.floor((Date.now() - parsed) / 1000));
}
function envelope(base: Envelope, viewId: string, subjectRef: string, data: Row, currentnessRef?: string): Envelope {
  return Object.freeze({
    view_id: viewId,
    subject_ref: subjectRef,
    source_version_set_ref: text(base["source_version_set_ref"]) ?? `runtime_ticket:${subjectRef}`,
    generated_at: new Date().toISOString(),
    currentness_ref: currentnessRef ?? text(base["currentness_ref"]) ?? "CURRENT",
    data: Object.freeze(data),
  });
}
function withAge(row: Row, field: string): Row {
  const age = ageSeconds(row[field]);
  return Object.freeze({ ...row, ...(age === undefined ? {} : { derived_age_seconds: age }) });
}

async function readResponsibility(pool: PersistencePool, base: UiProjectionPort, ticketId: string, context?: UiReadContext): Promise<unknown> {
  const anchor = record(await base.read("UX-RS-03", ticketId, undefined, context)) as Envelope;
  const [responsibilityResult, handoverResult, runtimeHandoverResult] = await Promise.all([
    pool.query<Row>(`SELECT responsibility_id::text,domain_id::text,role_instance_ref::text,holder_ref::text,assignment_snapshot_id::text,effective_from,status_ref
      FROM appts.responsible_assignment WHERE ticket_id=$1::uuid AND effective_to IS NULL ORDER BY effective_from DESC LIMIT 1`, [ticketId]),
    pool.query<Row>(`SELECT hp.handover_proposal_id::text,hp.current_responsibility_id::text,hp.proposed_receiver_assignment_ref::text,hp.proposer_authority_ref::text,hp.proposed_effective_at,hp.committed_at,
      hr.handover_response_id::text,hr.receiver_assignment_ref::text,hr.response_code,hr.response_reason_ref,hr.responded_at
      FROM appts.handover_proposal hp
      LEFT JOIN LATERAL (SELECT handover_response_id,receiver_assignment_ref,response_code,response_reason_ref,responded_at FROM appts.handover_response WHERE handover_proposal_id=hp.handover_proposal_id ORDER BY responded_at DESC LIMIT 1) hr ON TRUE
      WHERE hp.ticket_id=$1::uuid ORDER BY hp.committed_at DESC LIMIT 20`, [ticketId]),
    pool.query<Row>(`SELECT runtime_handover_context_id::text,source_handover_ref::text,prior_responsibility_ref::text,proposed_or_successor_responsibility_ref::text,acceptance_status_ref,effective_at,currentness_ref
      FROM appts.runtime_handover_context WHERE ticket_id=$1::uuid ORDER BY effective_at DESC NULLS LAST,runtime_handover_context_id DESC LIMIT 20`, [ticketId]),
  ]);
  const current = responsibilityResult.rows[0];
  const runtimeHandover = runtimeHandoverResult.rows;
  const currentness = runtimeHandover.map((row) => text(row["currentness_ref"])).find((value) => value !== undefined) ?? text(anchor["currentness_ref"]);
  return envelope(anchor, "UX-RS-06", ticketId, {
    responsibility_meaning: "SINGULAR_CURRENT_RESPONSIBLE_ROLE",
    current_responsibility: current ? Object.freeze({
      responsibility_id: text(current["responsibility_id"]),
      role_instance_ref: text(current["role_instance_ref"]),
      holder_ref: text(current["holder_ref"]),
      assignment_snapshot_ref: text(current["assignment_snapshot_id"]),
      domain_ref: text(current["domain_id"]),
      status_ref: text(current["status_ref"]),
      effective_from: iso(current["effective_from"]),
    }) : null,
    handover_rule: "RESPONSIBILITY_CHANGES_ONLY_AFTER_VALID_RECEIVER_ACCEPTANCE",
    supporting_participation_transfers_responsibility: false,
    handover_proposals: rows(handoverResult.rows),
    runtime_handover_context: rows(runtimeHandover),
  }, currentness);
}

async function readConditions(pool: PersistencePool, base: UiProjectionPort, ticketId: string, context?: UiReadContext): Promise<unknown> {
  const anchor = record(await base.read("UX-RS-03", ticketId, undefined, context)) as Envelope;
  const anchorData = record(anchor.data);
  const aggregateVersion = integer(anchorData["aggregate_version"]);
  const nextControlParams: unknown[] = aggregateVersion === undefined ? [ticketId] : [ticketId, aggregateVersion];
  const nextControlSql = aggregateVersion === undefined
    ? `SELECT next_control_id::text,aggregate_version,control_class_ref,owner_or_responsibility_ref,source_obligation_ref::text,due_basis_ref,effective_at,currentness_ref FROM appts.next_control WHERE ticket_id=$1::uuid ORDER BY aggregate_version DESC,effective_at DESC LIMIT 20`
    : `SELECT next_control_id::text,aggregate_version,control_class_ref,owner_or_responsibility_ref,source_obligation_ref::text,due_basis_ref,effective_at,currentness_ref FROM appts.next_control WHERE ticket_id=$1::uuid AND aggregate_version=$2::bigint ORDER BY effective_at DESC LIMIT 20`;
  const [waitingResult, blockerResult, dependencyResult, obligationResult, nextControlResult, escalationResult] = await Promise.all([
    pool.query<Row>(`SELECT waiting_id::text,obligation_id::text,blocker_id::text,dependency_context_id::text,waiting_reason_ref_id::text,waiting_reason_ref_code,responsible_owner_ref,external_party_ref::text,started_at,ended_at,expected_obligation_ref::text,request_evidence_ref::text,acceptance_or_rejection_evidence_ref::text,fulfillment_or_exception_evidence_ref::text
      FROM appts.waiting_interval WHERE ticket_id=$1::uuid AND ended_at IS NULL ORDER BY started_at ASC`, [ticketId]),
    pool.query<Row>(`SELECT blocker_id::text,blocked_work_ref::text,unmet_dependency_ref,blocker_reason_ref,owner_ref,started_at,cleared_at,expected_obligation_ref::text,downstream_impact_ref::text,escalation_ref::text,evidence_ref::text,status_ref
      FROM appts.runtime_blocker WHERE ticket_id=$1::uuid AND cleared_at IS NULL ORDER BY started_at ASC`, [ticketId]),
    pool.query<Row>(`SELECT dependency_context_id::text,dependency_type_ref,external_or_internal_subject_ref::text,source_system_ref::text,source_version_ref,dependency_status_ref,waiting_since,currentness_ref,evidence_ref::text,projection_version,rebuilt_at
      FROM appts.dependency_context WHERE ticket_id=$1::uuid ORDER BY rebuilt_at DESC LIMIT 50`, [ticketId]),
    pool.query<Row>(`SELECT obligation_id::text,obligation_class_ref,owner_or_responsibility_ref,source_ref::text,source_effective_at,due_basis_ref,due_at,next_evaluation_at,status_ref,fulfillment_evidence_ref::text,predecessor_obligation_id::text
      FROM appts.operational_obligation WHERE ticket_id=$1::uuid ORDER BY next_evaluation_at DESC NULLS LAST,source_effective_at DESC NULLS LAST LIMIT 50`, [ticketId]),
    pool.query<Row>(nextControlSql, nextControlParams),
    pool.query<Row>(`SELECT re.runtime_escalation_id::text,re.source_escalation_obligation_ref::text,re.current_level_or_route_ref_id::text,re.current_level_or_route_ref_code,re.intervention_due_basis_ref,re.status_ref,re.evidence_ref::text,re.predecessor_runtime_escalation_id::text,
      eo.responsibility_id::text,eo.escalation_role_ref::text,eo.intervention_scope_ref,eo.intervention_scope_ref_schema_version,eo.created_reason_ref,eo.effective_from,eo.acknowledgment_ref::text,eo.intervention_result_ref,eo.successor_escalation_id::text
      FROM appts.runtime_escalation re LEFT JOIN appts.escalation_obligation_core eo ON eo.escalation_id=re.source_escalation_obligation_ref
      WHERE re.ticket_id=$1::uuid ORDER BY eo.effective_from DESC NULLS LAST,re.runtime_escalation_id DESC LIMIT 20`, [ticketId]),
  ]);
  const openWaiting = waitingResult.rows.map((row) => withAge(row, "started_at"));
  const openBlockers = blockerResult.rows.map((row) => withAge(row, "started_at"));
  const dependencies = dependencyResult.rows.map((row) => withAge(row, "waiting_since"));
  const currentness = [
    ...nextControlResult.rows.map((row) => text(row["currentness_ref"])),
    ...dependencyResult.rows.map((row) => text(row["currentness_ref"])),
    text(anchor["currentness_ref"]),
  ].find((value) => value !== undefined);
  const openConditionPresent = openWaiting.length > 0 || openBlockers.length > 0;
  return envelope(anchor, "UX-RS-07", ticketId, {
    lifecycle_state: text(anchorData["current_state"]),
    aggregate_version: aggregateVersion,
    waiting_is_lifecycle_state: false,
    open_waiting: Object.freeze(openWaiting),
    open_blockers: Object.freeze(openBlockers),
    dependencies: Object.freeze(dependencies),
    operational_obligations: rows(obligationResult.rows),
    next_controls: rows(nextControlResult.rows),
    escalations: rows(escalationResult.rows),
    escalation_transfers_responsibility: false,
    closure_impact: Object.freeze({
      open_condition_present: openConditionPresent,
      posture: openConditionPresent ? "OPEN_WAITING_OR_BLOCKER_WITHHOLDS_CLOSURE" : "NO_OPEN_WAITING_OR_BLOCKER_OBSERVED_NOT_A_CLOSURE_READINESS_DECISION",
    }),
  }, currentness);
}

async function attentionByTicket(pool: PersistencePool, ticketIds: readonly string[]): Promise<ReadonlyMap<string, Row>> {
  if (ticketIds.length === 0) return new Map();
  const result = await pool.query<Row>(`SELECT rt.ticket_id::text,
    (SELECT count(*)::int FROM appts.waiting_interval wi WHERE wi.ticket_id=rt.ticket_id AND wi.ended_at IS NULL) AS open_waiting_count,
    (SELECT count(*)::int FROM appts.runtime_blocker rb WHERE rb.ticket_id=rt.ticket_id AND rb.cleared_at IS NULL) AS open_blocker_count,
    (SELECT count(*)::int FROM appts.runtime_escalation re WHERE re.ticket_id=rt.ticket_id) AS escalation_count,
    (SELECT nc.control_class_ref FROM appts.next_control nc WHERE nc.ticket_id=rt.ticket_id AND nc.aggregate_version=rt.aggregate_version ORDER BY nc.effective_at DESC LIMIT 1) AS next_control_class_ref,
    (SELECT nc.owner_or_responsibility_ref FROM appts.next_control nc WHERE nc.ticket_id=rt.ticket_id AND nc.aggregate_version=rt.aggregate_version ORDER BY nc.effective_at DESC LIMIT 1) AS next_control_owner_ref
    FROM appts.runtime_ticket rt WHERE rt.ticket_id=ANY($1::uuid[])`, [ticketIds]);
  return new Map(result.rows.map((row) => [text(row["ticket_id"]) ?? "", Object.freeze({ ...row })]));
}

async function augmentWorkQueue(pool: PersistencePool, value: unknown): Promise<unknown> {
  const base = record(value) as Envelope; const data = record(base.data);
  const ticketsValue = data["tickets"]; if (!Array.isArray(ticketsValue)) return value;
  const tickets = ticketsValue.map(record); const ids = tickets.map((row) => text(row["ticket_id"])).filter((id): id is string => id !== undefined);
  const attention = await attentionByTicket(pool, ids);
  const enriched = tickets.map((ticket) => {
    const id = text(ticket["ticket_id"]); const operational = id ? attention.get(id) : undefined;
    return Object.freeze({ ...ticket, ...(operational ? { operational_attention: operational } : {}) });
  });
  return Object.freeze({ ...base, data: Object.freeze({ ...data, tickets: Object.freeze(enriched) }) });
}

async function augmentTicketConsole(pool: PersistencePool, value: unknown): Promise<unknown> {
  const base = record(value) as Envelope; const data = record(base.data); const id = text(data["ticket_id"]);
  if (!id) return value;
  const attention = await attentionByTicket(pool, [id]);
  return Object.freeze({ ...base, data: Object.freeze({ ...data, operational_attention: attention.get(id) ?? null, responsibility_view_ref: "responsibility", conditions_view_ref: "conditions" }) });
}

export function createCf06PreTrialProjectionPort(pool: PersistencePool): UiProjectionPort {
  const base = createTrialProjectionPort(pool);
  return Object.freeze({
    async read(viewId: string, subjectRef?: string, concern?: string, context?: UiReadContext): Promise<unknown> {
      if (viewId === "UX-RS-06") { if (!subjectRef) throw new Error("UI_SUBJECT_REQUIRED"); return readResponsibility(pool, base, subjectRef, context); }
      if (viewId === "UX-RS-07") { if (!subjectRef) throw new Error("UI_SUBJECT_REQUIRED"); return readConditions(pool, base, subjectRef, context); }
      const value = await base.read(viewId, subjectRef, concern, context);
      if (viewId === "UX-RS-01") return augmentWorkQueue(pool, value);
      if (viewId === "UX-RS-03") return augmentTicketConsole(pool, value);
      return value;
    },
  });
}
