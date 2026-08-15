import type { PresentationContextPayload, ValidationResult } from "@appts-restore-service/contracts";
export interface OperationalProjection { readonly projectionId: string; readonly ticketId: string; readonly sourceAggregateVersion: number; readonly currentnessRef: string; readonly disclosureProfileRef: string; readonly payload: Readonly<Record<string, unknown>>; readonly createsAuthority: false; }
export function buildProjection(context: PresentationContextPayload, validation: ValidationResult, permittedFields: readonly string[]): OperationalProjection {
  if (!validation.ok) throw new Error("INVALID_INT_RUN_TD_04");
  const raw = typeof context.projection_payload_ref === "string" ? { reference: context.projection_payload_ref } : context.projection_payload_ref;
  const payload = Object.fromEntries(Object.entries(raw).filter(([key]) => permittedFields.includes(key)));
  return Object.freeze({ projectionId: context.projection_id, ticketId: context.ticket_id, sourceAggregateVersion: context.source_aggregate_version, currentnessRef: context.currentness_ref, disclosureProfileRef: context.disclosure_profile_ref, payload: Object.freeze(payload), createsAuthority: false });
}
