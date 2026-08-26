import { randomUUID } from "node:crypto";
import type { QualifiedExternalRecordPayload } from "@appts-restore-service/contracts";
import {
  deriveExternalDependencyControlPlan,
  type ExternalDependencyControlMapping,
} from "@appts-restore-service/runtime-d04";
import type { PersistenceClient, PersistencePool } from "@appts-restore-service/persistence";

export interface ExternalDependencyAppliedRefs {
  readonly dependencyContextId: string;
  readonly obligationId: string;
  readonly blockerId: string;
  readonly waitingId: string;
  readonly residualObligationId: string;
  readonly nextControlId: string;
  readonly runtimeEscalationId?: string;
}

export type ExternalDependencyApplyResult =
  | { readonly disposition: "APPLIED"; readonly refs: ExternalDependencyAppliedRefs; readonly responsibilityTransferred: false }
  | { readonly disposition: "IDEMPOTENT_REPLAY"; readonly refs: ExternalDependencyAppliedRefs; readonly responsibilityTransferred: false };

async function tx<T>(pool: PersistencePool, work: (client: PersistenceClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
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

async function replayRefs(client: PersistenceClient, qerId: string): Promise<ExternalDependencyAppliedRefs | undefined> {
  const dependency = await client.query<{ dependency_context_id: string }>(
    "SELECT dependency_context_id::text AS dependency_context_id FROM appts.dependency_context WHERE evidence_ref=$1 ORDER BY rebuilt_at LIMIT 1",
    [qerId],
  );
  if (dependency.rowCount !== 1) return undefined;
  const obligation = await client.query<{ obligation_id: string }>(
    "SELECT obligation_id::text AS obligation_id FROM appts.operational_obligation WHERE source_ref=$1 ORDER BY source_effective_at NULLS LAST LIMIT 1",
    [qerId],
  );
  const blocker = await client.query<{ blocker_id: string }>(
    "SELECT blocker_id::text AS blocker_id FROM appts.runtime_blocker WHERE evidence_ref=$1 ORDER BY started_at LIMIT 1",
    [qerId],
  );
  const residual = await client.query<{ residual_obligation_id: string }>(
    "SELECT residual_obligation_id::text AS residual_obligation_id FROM appts.residual_obligation WHERE evidence_ref=$1 ORDER BY residual_obligation_id LIMIT 1",
    [qerId],
  );
  if (obligation.rowCount !== 1 || blocker.rowCount !== 1 || residual.rowCount !== 1) throw new Error("EXTERNAL_DEPENDENCY_PARTIAL_DURABLE_STATE");
  const waiting = await client.query<{ waiting_id: string }>(
    "SELECT waiting_id::text AS waiting_id FROM appts.waiting_interval WHERE dependency_context_id=$1 AND obligation_id=$2 AND blocker_id=$3 ORDER BY started_at LIMIT 1",
    [dependency.rows[0]!.dependency_context_id, obligation.rows[0]!.obligation_id, blocker.rows[0]!.blocker_id],
  );
  const next = await client.query<{ next_control_id: string }>(
    "SELECT next_control_id::text AS next_control_id FROM appts.next_control WHERE source_obligation_ref=$1 ORDER BY effective_at LIMIT 1",
    [obligation.rows[0]!.obligation_id],
  );
  if (waiting.rowCount !== 1 || next.rowCount !== 1) throw new Error("EXTERNAL_DEPENDENCY_PARTIAL_DURABLE_STATE");
  const escalation = await client.query<{ runtime_escalation_id: string }>(
    "SELECT runtime_escalation_id::text AS runtime_escalation_id FROM appts.runtime_escalation WHERE ticket_id=(SELECT ticket_id FROM appts.dependency_context WHERE dependency_context_id=$1) AND evidence_ref=$2 ORDER BY runtime_escalation_id LIMIT 1",
    [dependency.rows[0]!.dependency_context_id, qerId],
  ).catch(async () => ({ rowCount: 0, rows: [] as { runtime_escalation_id: string }[] }));
  return Object.freeze({
    dependencyContextId: dependency.rows[0]!.dependency_context_id,
    obligationId: obligation.rows[0]!.obligation_id,
    blockerId: blocker.rows[0]!.blocker_id,
    waitingId: waiting.rows[0]!.waiting_id,
    residualObligationId: residual.rows[0]!.residual_obligation_id,
    nextControlId: next.rows[0]!.next_control_id,
    ...(escalation.rowCount === 1 ? { runtimeEscalationId: escalation.rows[0]!.runtime_escalation_id } : {}),
  });
}

export async function applyQualifiedExternalDependency(
  pool: PersistencePool,
  record: QualifiedExternalRecordPayload,
  mapping: ExternalDependencyControlMapping,
): Promise<ExternalDependencyApplyResult> {
  const plan = deriveExternalDependencyControlPlan(record, mapping);
  return tx(pool, async (client) => {
    const qer = await client.query<{ qualified_external_record_id: string }>(
      "SELECT qualified_external_record_id::text AS qualified_external_record_id FROM appts.qualified_external_record WHERE qualified_external_record_id=$1 AND source_system_ref_id=$2 AND currentness_ref='CURRENT'",
      [plan.sourceQualifiedExternalRecordRef, plan.sourceSystemRef],
    );
    if (qer.rowCount !== 1) throw new Error("INT_RUN_TD_01_D05_DURABLE_RECORD_REQUIRED");

    const ticket = await client.query<{ aggregate_version: string; current_state_code: string }>(
      "SELECT aggregate_version::text AS aggregate_version,current_state_code FROM appts.runtime_ticket WHERE ticket_id=$1",
      [plan.ticketId],
    );
    if (ticket.rowCount !== 1) throw new Error("EXTERNAL_DEPENDENCY_RUNTIME_TICKET_REQUIRED");
    if (ticket.rows[0]!.current_state_code === "CLOSED") throw new Error("EXTERNAL_DEPENDENCY_CLOSED_TICKET_REQUIRES_SEPARATE_ACCEPTED_PATH");

    const responsibility = await client.query<{ responsibility_id: string }>(
      "SELECT responsibility_id::text AS responsibility_id FROM appts.responsible_assignment WHERE responsibility_id=$1 AND ticket_id=$2 LIMIT 1",
      [plan.responsibilityId, plan.ticketId],
    );
    if (responsibility.rowCount !== 1) throw new Error("EXTERNAL_DEPENDENCY_RESPONSIBILITY_CONTEXT_REQUIRED");

    if (plan.escalation !== undefined) {
      const escalationSource = await client.query<{ escalation_id: string }>(
        "SELECT escalation_id::text AS escalation_id FROM appts.escalation_obligation_core WHERE escalation_id=$1 AND ticket_id=$2 AND responsibility_id=$3 LIMIT 1",
        [plan.escalation.sourceEscalationObligationRef, plan.ticketId, plan.responsibilityId],
      );
      if (escalationSource.rowCount !== 1) throw new Error("EXTERNAL_DEPENDENCY_ACCEPTED_ESCALATION_OBLIGATION_REQUIRED");
    }

    const replay = await replayRefs(client, plan.sourceQualifiedExternalRecordRef);
    if (replay !== undefined) return Object.freeze({ disposition: "IDEMPOTENT_REPLAY" as const, refs: replay, responsibilityTransferred: false as const });

    const dependencyContextId = randomUUID();
    const obligationId = randomUUID();
    const blockerId = randomUUID();
    const waitingId = randomUUID();
    const residualObligationId = randomUUID();
    const nextControlId = randomUUID();
    const runtimeEscalationId = plan.escalation === undefined ? undefined : randomUUID();

    await client.query(
      "INSERT INTO appts.dependency_context(projection_version,rebuilt_at,dependency_context_id,ticket_id,dependency_type_ref,external_or_internal_subject_ref,source_system_ref,source_version_ref,dependency_status_ref,waiting_since,currentness_ref,evidence_ref) VALUES(0,now(),$1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
      [dependencyContextId, plan.ticketId, plan.dependencyTypeRef, plan.dependencySubjectRef, plan.sourceSystemRef, plan.sourceVersionRef, plan.dependencyStatusRef, plan.effectiveAt, plan.currentnessRef, plan.sourceQualifiedExternalRecordRef],
    );
    await client.query(
      "INSERT INTO appts.operational_obligation(obligation_id,ticket_id,obligation_class_ref,owner_or_responsibility_ref,source_ref,source_effective_at,due_basis_ref,due_at,next_evaluation_at,status_ref) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'OPEN')",
      [obligationId, plan.ticketId, plan.obligationClassRef, plan.obligationOwnerRef, plan.sourceQualifiedExternalRecordRef, plan.effectiveAt, plan.dueBasisRef ?? null, plan.dueAt ?? null, plan.nextEvaluationAt ?? null],
    );
    await client.query(
      "INSERT INTO appts.runtime_blocker(blocker_id,ticket_id,blocked_work_ref,unmet_dependency_ref,blocker_reason_ref,owner_ref,started_at,expected_obligation_ref,evidence_ref,status_ref) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'OPEN')",
      [blockerId, plan.ticketId, plan.blockedWorkRef, plan.dependencyStatusRef, plan.blockerReasonRef, plan.blockerOwnerRef, plan.effectiveAt, obligationId, plan.sourceQualifiedExternalRecordRef],
    );
    await client.query(
      "INSERT INTO appts.waiting_interval(waiting_id,ticket_id,obligation_id,blocker_id,dependency_context_id,waiting_reason_ref_code,responsible_owner_ref,started_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
      [waitingId, plan.ticketId, obligationId, blockerId, dependencyContextId, plan.waitingReasonRef, plan.responsibilityId, plan.effectiveAt],
    );
    await client.query(
      "INSERT INTO appts.residual_obligation(residual_obligation_id,ticket_id,obligation_ref,disposition_status_ref,disposition_reason_ref,evidence_ref) VALUES($1,$2,$3,'OPEN',$4,$5)",
      [residualObligationId, plan.ticketId, obligationId, plan.dependencyStatusRef, plan.sourceQualifiedExternalRecordRef],
    );
    await client.query(
      "INSERT INTO appts.next_control(next_control_id,ticket_id,aggregate_version,control_class_ref,owner_or_responsibility_ref,source_obligation_ref,due_basis_ref,effective_at,currentness_ref) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
      [nextControlId, plan.ticketId, Number(ticket.rows[0]!.aggregate_version), plan.nextControlClassRef, plan.nextControlOwnerRef, obligationId, plan.dueBasisRef ?? null, plan.effectiveAt, plan.currentnessRef],
    );
    if (plan.escalation !== undefined && runtimeEscalationId !== undefined) {
      await client.query(
        "INSERT INTO appts.runtime_escalation(runtime_escalation_id,ticket_id,source_escalation_obligation_ref,current_level_or_route_ref_code,intervention_due_basis_ref,status_ref,evidence_ref) VALUES($1,$2,$3,$4,$5,'OPEN',$6)",
        [runtimeEscalationId, plan.ticketId, plan.escalation.sourceEscalationObligationRef, plan.escalation.routeRefCode, plan.escalation.interventionDueBasisRef ?? null, plan.sourceQualifiedExternalRecordRef],
      );
    }

    const refs: ExternalDependencyAppliedRefs = Object.freeze({
      dependencyContextId,
      obligationId,
      blockerId,
      waitingId,
      residualObligationId,
      nextControlId,
      ...(runtimeEscalationId === undefined ? {} : { runtimeEscalationId }),
    });
    return Object.freeze({ disposition: "APPLIED" as const, refs, responsibilityTransferred: false as const });
  });
}
