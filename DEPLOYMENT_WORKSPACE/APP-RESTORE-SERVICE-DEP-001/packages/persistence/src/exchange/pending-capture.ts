import type { Pool } from "pg";
import { runTransaction } from "../transaction.js";
import type { TransactionContext } from "../transaction.js";

export interface ProvisionalPayloadResource {
  readonly provisional_payload_ref: string;
  readonly representation_kind: "INLINE_STRUCT" | "DURABLE_REFERENCE";
  readonly inline_content: Record<string, unknown> | null;
  readonly durable_reference: string | null;
  readonly payload_hash: Buffer;
  readonly payload_representation_profile_ref: string | null;
  readonly payload_representation_version: string | null;
  readonly integrity_envelope_id: string | null;
  readonly resource_committed_at: Date;
}

export interface PendingCaptureRow {
  readonly pending_capture_id: string;
  readonly source_system_ref_id: string;
  readonly subject_ref: string;
  readonly captured_by_ref: string;
  readonly capture_time: Date;
  readonly source_label_ref: string;
  readonly provisional_payload_ref: string;
  readonly sync_status_ref: string;
  readonly reconciliation_case_id: string | null;
  readonly producer_ref: string;
  readonly client_capture_id: string;
  readonly device_context_ref: string;
  readonly local_sequence: string;
  readonly capture_kind_ref: string;
  readonly capture_time_source_offset_minutes: number | null;
  readonly time_confidence_ref: string;
  readonly authorization_snapshot_ref: string;
  readonly supersedes_capture_ref: string | null;
  readonly predecessor_pending_capture_id: string | null;
}

export interface IdempotencyBinding {
  readonly idempotency_binding_id: string;
  readonly producer_ref: string;
  readonly device_context_ref: string;
  readonly idempotency_key: string;
  readonly client_capture_id: string;
  readonly pending_capture_id: string;
  readonly provisional_payload_ref: string;
  readonly durable_result_ref: string;
  readonly first_message_id: string;
  readonly correlation_id: string;
  readonly bound_at: Date;
}

export interface SyncResultRow {
  readonly sync_result_id: string;
  readonly result_phase_ref: string | null;
  readonly client_capture_id: string | null;
  readonly pending_capture_id: string | null;
  readonly provisional_payload_ref: string | null;
  readonly acceptance_code: string | null;
  readonly pending_disposition_code: string | null;
  readonly replay_disposition_code: string | null;
  readonly semantic_scope_code: string | null;
  readonly final_effect_asserted: boolean | null;
  readonly outcome_code: string | null;
  readonly outcome_reason_code: string | null;
  readonly downstream_result_class_ref: string | null;
  readonly downstream_result_ref: string | null;
  readonly reconciliation_case_id: string | null;
  readonly successor_pending_capture_id: string | null;
  readonly source_currentness_ref: string | null;
  readonly outcome_at: Date | null;
}

export interface InsertProvisionalPayloadResourceInput {
  readonly provisional_payload_ref: string;
  readonly representation_kind: "INLINE_STRUCT" | "DURABLE_REFERENCE";
  readonly inline_content: Record<string, unknown> | null;
  readonly durable_reference: string | null;
  readonly payload_hash: Buffer;
  readonly payload_representation_profile_ref: string | null;
  readonly payload_representation_version: string | null;
  readonly integrity_envelope_id: string | null;
}

export interface InsertPendingCaptureInput {
  readonly pending_capture_id: string;
  readonly source_system_ref_id: string;
  readonly subject_ref: string;
  readonly captured_by_ref: string;
  readonly capture_time: Date;
  readonly source_label_ref: string;
  readonly provisional_payload_ref: string;
  readonly sync_status_ref: string;
  readonly producer_ref: string;
  readonly client_capture_id: string;
  readonly device_context_ref: string;
  readonly local_sequence: number;
  readonly capture_kind_ref: string;
  readonly capture_time_source_offset_minutes: number | null;
  readonly time_confidence_ref: string;
  readonly authorization_snapshot_ref: string;
  readonly supersedes_capture_ref: string | null;
  readonly predecessor_pending_capture_id: string | null;
}

export interface InsertSyncResultPendingAcceptanceInput {
  readonly sync_result_id: string;
  readonly sync_batch_id: string;
  readonly pending_capture_or_external_record_ref: string;
  readonly result_code: string;
  readonly processed_at: Date;
  readonly result_phase_ref: "PENDING_ACCEPTANCE";
  readonly client_capture_id: string;
  readonly pending_capture_id: string;
  readonly provisional_payload_ref: string;
  readonly acceptance_code: "ACK" | "NACK" | "HOLD";
  readonly pending_disposition_code: "PENDING_ACCEPTED" | "PENDING_REJECTED" | "PENDING_HELD";
  readonly replay_disposition_code: "NEW_DURABLE_ACCEPTANCE" | "IDENTICAL_REPLAY_REUSED" | "NOT_DURABLY_ACCEPTED" | "CONFLICTING_REPLAY_HELD";
  readonly semantic_scope_code: "PENDING_ONLY_NO_FINAL_SEMANTIC_SUCCESS";
  readonly final_effect_asserted: false;
}

export interface InsertIdempotencyBindingInput {
  readonly idempotency_binding_id: string;
  readonly producer_ref: string;
  readonly device_context_ref: string;
  readonly idempotency_key: string;
  readonly client_capture_id: string;
  readonly pending_capture_id: string;
  readonly provisional_payload_ref: string;
  readonly durable_result_ref: string;
  readonly first_message_id: string;
  readonly correlation_id: string;
}

export interface InsertSyncResultOutcomeInput {
  readonly sync_result_id: string;
  readonly sync_batch_id: string;
  readonly pending_capture_or_external_record_ref: string;
  readonly result_code: string;
  readonly processed_at: Date;
  readonly result_phase_ref: "OUTCOME";
  readonly client_capture_id: string;
  readonly pending_capture_id: string;
  readonly provisional_payload_ref: string;
  readonly outcome_code: string;
  readonly outcome_reason_code: string | null;
  readonly downstream_result_class_ref: string | null;
  readonly downstream_result_ref: string | null;
  readonly reconciliation_case_id: string | null;
  readonly successor_pending_capture_id: string | null;
  readonly source_currentness_ref: string | null;
  readonly outcome_at: Date;
}

export interface FirstDurableAcceptanceInput {
  readonly resource: InsertProvisionalPayloadResourceInput;
  readonly pendingCapture: InsertPendingCaptureInput;
  readonly syncResult: InsertSyncResultPendingAcceptanceInput;
  readonly idempotencyBinding: InsertIdempotencyBindingInput;
}

export interface FirstDurableAcceptanceResult {
  readonly pendingCaptureId: string;
  readonly provisionalPayloadRef: string;
  readonly syncResultId: string;
  readonly idempotencyBindingId: string;
}

export async function findIdempotencyBinding(
  pool: Pool,
  producerRef: string,
  deviceContextRef: string,
  idempotencyKey: string,
): Promise<IdempotencyBinding | null> {
  const result = await pool.query<IdempotencyBinding>(
    `SELECT idempotency_binding_id, producer_ref, device_context_ref, idempotency_key,
            client_capture_id, pending_capture_id, provisional_payload_ref, durable_result_ref,
            first_message_id, correlation_id, bound_at
     FROM appts.pending_capture_idempotency_binding
     WHERE producer_ref = $1 AND device_context_ref = $2 AND idempotency_key = $3`,
    [producerRef, deviceContextRef, idempotencyKey],
  );
  return result.rows[0] ?? null;
}

async function insertProvisionalPayloadResource(
  ctx: TransactionContext,
  input: InsertProvisionalPayloadResourceInput,
): Promise<void> {
  await ctx.query(
    `INSERT INTO appts.provisional_capture_payload_resource (
       provisional_payload_ref, representation_kind, inline_content, durable_reference,
       payload_hash, payload_representation_profile_ref, payload_representation_version,
       integrity_envelope_id, resource_committed_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
    [
      input.provisional_payload_ref,
      input.representation_kind,
      input.inline_content,
      input.durable_reference,
      input.payload_hash,
      input.payload_representation_profile_ref,
      input.payload_representation_version,
      input.integrity_envelope_id,
    ],
  );
}

async function insertPendingCapture(
  ctx: TransactionContext,
  input: InsertPendingCaptureInput,
): Promise<void> {
  await ctx.query(
    `INSERT INTO appts.pending_capture (
       pending_capture_id, source_system_ref_id, subject_ref, captured_by_ref,
       capture_time, source_label_ref, provisional_payload_ref, sync_status_ref,
       producer_ref, client_capture_id, device_context_ref, local_sequence,
       capture_kind_ref, capture_time_source_offset_minutes, time_confidence_ref,
       authorization_snapshot_ref, supersedes_capture_ref, predecessor_pending_capture_id
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
    [
      input.pending_capture_id,
      input.source_system_ref_id,
      input.subject_ref,
      input.captured_by_ref,
      input.capture_time,
      input.source_label_ref,
      input.provisional_payload_ref,
      input.sync_status_ref,
      input.producer_ref,
      input.client_capture_id,
      input.device_context_ref,
      input.local_sequence,
      input.capture_kind_ref,
      input.capture_time_source_offset_minutes,
      input.time_confidence_ref,
      input.authorization_snapshot_ref,
      input.supersedes_capture_ref,
      input.predecessor_pending_capture_id,
    ],
  );
}

async function insertSyncResultPendingAcceptance(
  ctx: TransactionContext,
  input: InsertSyncResultPendingAcceptanceInput,
): Promise<void> {
  await ctx.query(
    `INSERT INTO appts.sync_result (
       sync_result_id, sync_batch_id, pending_capture_or_external_record_ref, result_code,
       processed_at, result_phase_ref, client_capture_id, pending_capture_id,
       provisional_payload_ref, acceptance_code, pending_disposition_code,
       replay_disposition_code, semantic_scope_code, final_effect_asserted
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
    [
      input.sync_result_id,
      input.sync_batch_id,
      input.pending_capture_or_external_record_ref,
      input.result_code,
      input.processed_at,
      input.result_phase_ref,
      input.client_capture_id,
      input.pending_capture_id,
      input.provisional_payload_ref,
      input.acceptance_code,
      input.pending_disposition_code,
      input.replay_disposition_code,
      input.semantic_scope_code,
      input.final_effect_asserted,
    ],
  );
}

async function insertIdempotencyBinding(
  ctx: TransactionContext,
  input: InsertIdempotencyBindingInput,
): Promise<void> {
  await ctx.query(
    `INSERT INTO appts.pending_capture_idempotency_binding (
       idempotency_binding_id, producer_ref, device_context_ref, idempotency_key,
       client_capture_id, pending_capture_id, provisional_payload_ref, durable_result_ref,
       first_message_id, correlation_id, bound_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
    [
      input.idempotency_binding_id,
      input.producer_ref,
      input.device_context_ref,
      input.idempotency_key,
      input.client_capture_id,
      input.pending_capture_id,
      input.provisional_payload_ref,
      input.durable_result_ref,
      input.first_message_id,
      input.correlation_id,
    ],
  );
}

export async function insertFirstDurableAcceptance(
  pool: Pool,
  input: FirstDurableAcceptanceInput,
): Promise<FirstDurableAcceptanceResult> {
  return runTransaction(pool, "SERIALIZABLE", async (ctx: TransactionContext) => {
    await insertProvisionalPayloadResource(ctx, input.resource);
    await insertPendingCapture(ctx, input.pendingCapture);
    await insertSyncResultPendingAcceptance(ctx, input.syncResult);
    await insertIdempotencyBinding(ctx, input.idempotencyBinding);

    return {
      pendingCaptureId: input.pendingCapture.pending_capture_id,
      provisionalPayloadRef: input.resource.provisional_payload_ref,
      syncResultId: input.syncResult.sync_result_id,
      idempotencyBindingId: input.idempotencyBinding.idempotency_binding_id,
    };
  });
}

export async function insertPendingOutcome(
  pool: Pool,
  input: InsertSyncResultOutcomeInput,
): Promise<string> {
  const result = await pool.query<{ sync_result_id: string }>(
    `INSERT INTO appts.sync_result (
       sync_result_id, sync_batch_id, pending_capture_or_external_record_ref, result_code,
       processed_at, result_phase_ref, client_capture_id, pending_capture_id,
       provisional_payload_ref, outcome_code, outcome_reason_code,
       downstream_result_class_ref, downstream_result_ref, reconciliation_case_id,
       successor_pending_capture_id, source_currentness_ref, outcome_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
     RETURNING sync_result_id`,
    [
      input.sync_result_id,
      input.sync_batch_id,
      input.pending_capture_or_external_record_ref,
      input.result_code,
      input.processed_at,
      input.result_phase_ref,
      input.client_capture_id,
      input.pending_capture_id,
      input.provisional_payload_ref,
      input.outcome_code,
      input.outcome_reason_code,
      input.downstream_result_class_ref,
      input.downstream_result_ref,
      input.reconciliation_case_id,
      input.successor_pending_capture_id,
      input.source_currentness_ref,
      input.outcome_at,
    ],
  );
  return result.rows[0]!.sync_result_id;
}

export async function findPendingCaptureByClientCapture(
  pool: Pool,
  producerRef: string,
  deviceContextRef: string,
  clientCaptureId: string,
): Promise<PendingCaptureRow | null> {
  const result = await pool.query<PendingCaptureRow>(
    `SELECT pending_capture_id, source_system_ref_id, subject_ref, captured_by_ref,
            capture_time, source_label_ref, provisional_payload_ref, sync_status_ref,
            reconciliation_case_id, producer_ref, client_capture_id, device_context_ref,
            local_sequence, capture_kind_ref, capture_time_source_offset_minutes,
            time_confidence_ref, authorization_snapshot_ref, supersedes_capture_ref,
            predecessor_pending_capture_id
     FROM appts.pending_capture
     WHERE producer_ref = $1 AND device_context_ref = $2 AND client_capture_id = $3`,
    [producerRef, deviceContextRef, clientCaptureId],
  );
  return result.rows[0] ?? null;
}
