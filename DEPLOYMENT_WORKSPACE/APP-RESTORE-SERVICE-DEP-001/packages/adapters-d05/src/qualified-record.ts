import type { QualifiedExternalRecordPayload, ValidationResult } from "@appts-restore-service/contracts";
import type { SourceResolution } from "./source-registry.ts";
export type QualificationResult = { readonly status: "QUALIFIED"; readonly record: QualifiedExternalRecordPayload } | { readonly status: "NO_EFFECT"; readonly reason: string };
export function qualifyExternalRecord(record: QualifiedExternalRecordPayload, contractValidation: ValidationResult, source: SourceResolution): QualificationResult {
  if (!contractValidation.ok) return { status: "NO_EFFECT", reason: "INVALID_INT_RUN_TD_01" };
  if (source.status !== "RESOLVED") return { status: "NO_EFFECT", reason: source.reason };
  if (record.source_system_ref_id !== source.source.sourceSystemRefId || record.adapter_profile_ref_id !== source.profile.adapterProfileRefId) return { status: "NO_EFFECT", reason: "SOURCE_PROFILE_RECORD_MISMATCH" };
  return { status: "QUALIFIED", record: Object.freeze({ ...record }) };
}
