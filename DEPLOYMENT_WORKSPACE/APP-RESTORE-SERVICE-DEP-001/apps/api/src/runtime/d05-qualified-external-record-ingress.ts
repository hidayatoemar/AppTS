import type { QualifiedExternalRecordPayload } from "@appts-restore-service/contracts";
import { validateQualifiedExternalRecord } from "@appts-restore-service/contracts";
import { qualifyExternalRecord, resolveSource, type AdapterProfile, type SourceRegistryEntry } from "@appts-restore-service/adapters-d05";
import type { PersistenceClient, PersistencePool } from "@appts-restore-service/persistence";

export interface QualifiedExternalRecordPersistenceBinding {
  readonly disclosureLabelRef: string;
  readonly payloadJsonSchemaVersionRef: string;
}

export type QualifiedExternalRecordIngressResult =
  | { readonly disposition: "QUALIFIED_PERSISTED" | "IDEMPOTENT_REPLAY"; readonly record: QualifiedExternalRecordPayload }
  | { readonly disposition: "NO_EFFECT"; readonly reason: string };

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

async function sourceResolution(pool: PersistencePool, record: QualifiedExternalRecordPayload) {
  const sourceRow = await pool.query<{ currentness_ref: string }>(
    "SELECT currentness_ref FROM appts.authoritative_source_ref WHERE source_system_ref_id=$1 AND effective_from<=now() AND (effective_to IS NULL OR effective_to>now()) ORDER BY effective_from DESC LIMIT 1",
    [record.source_system_ref_id],
  );
  const source: SourceRegistryEntry | undefined = sourceRow.rowCount === 1
    ? Object.freeze({
        sourceSystemRefId: record.source_system_ref_id,
        status: sourceRow.rows[0]!.currentness_ref === "CURRENT" ? "ACTIVE" as const : "UNAVAILABLE" as const,
        currentnessRef: sourceRow.rows[0]!.currentness_ref,
      })
    : undefined;

  let profile: AdapterProfile | undefined;
  if (record.adapter_profile_ref_id !== undefined) {
    const profileRow = await pool.query<{ source_system_ref_id: string; adapter_profile_version: string }>(
      "SELECT source_system_ref_id::text AS source_system_ref_id,adapter_profile_version::text AS adapter_profile_version FROM appts.adapter_profile_ref WHERE adapter_profile_ref_id=$1 AND effective_from<=now() AND (effective_to IS NULL OR effective_to>now()) LIMIT 1",
      [record.adapter_profile_ref_id],
    );
    if (profileRow.rowCount === 1) {
      profile = Object.freeze({
        adapterProfileRefId: record.adapter_profile_ref_id,
        sourceSystemRefId: profileRow.rows[0]!.source_system_ref_id,
        version: profileRow.rows[0]!.adapter_profile_version,
        status: "ACTIVE" as const,
      });
    }
  }
  return resolveSource(source, profile);
}

export async function persistQualifiedExternalRecord(
  pool: PersistencePool,
  record: QualifiedExternalRecordPayload,
  binding: QualifiedExternalRecordPersistenceBinding,
): Promise<QualifiedExternalRecordIngressResult> {
  const qualification = qualifyExternalRecord(record, validateQualifiedExternalRecord(record), await sourceResolution(pool, record));
  if (qualification.status === "NO_EFFECT") return Object.freeze({ disposition: "NO_EFFECT" as const, reason: qualification.reason });

  return tx(pool, async (client) => {
    const prior = await client.query<{ qualified_external_record_id: string }>(
      "SELECT qualified_external_record_id::text AS qualified_external_record_id FROM appts.qualified_external_record WHERE source_system_ref_id=$1 AND external_record_identity=$2 AND external_record_version_ref=$3",
      [record.source_system_ref_id, record.external_record_identity, record.external_record_version_ref],
    );
    if (prior.rowCount === 1) {
      if (prior.rows[0]!.qualified_external_record_id !== record.qualified_external_record_id) throw new Error("QUALIFIED_EXTERNAL_RECORD_SOURCE_VERSION_CONFLICT");
      return Object.freeze({ disposition: "IDEMPOTENT_REPLAY" as const, record: qualification.record });
    }

    const isReference = typeof record.payload_or_reference_ref === "string";
    await client.query(
      `INSERT INTO appts.qualified_external_record(
        record_version,committed_at,disclosure_label_ref,qualified_external_record_id,
        source_system_ref_id,external_record_identity,external_record_version_ref,subject_ref,
        qualification_result_ref,source_time,received_at,payload_or_reference_ref_kind,
        payload_or_reference_ref_uri,payload_or_reference_ref_json,payload_or_reference_ref_json_schema_version,
        payload_hash,currentness_ref
      ) VALUES(0,now(),$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14,$15)`,
      [
        binding.disclosureLabelRef,
        record.qualified_external_record_id,
        record.source_system_ref_id,
        record.external_record_identity,
        record.external_record_version_ref,
        record.subject_ref,
        record.qualification_result_ref,
        record.source_time ?? null,
        record.received_at,
        isReference ? "URI" : "JSON",
        isReference ? record.payload_or_reference_ref : null,
        isReference ? null : JSON.stringify(record.payload_or_reference_ref),
        isReference ? null : binding.payloadJsonSchemaVersionRef,
        record.payload_hash ?? null,
        record.currentness_ref,
      ],
    );
    return Object.freeze({ disposition: "QUALIFIED_PERSISTED" as const, record: qualification.record });
  });
}
