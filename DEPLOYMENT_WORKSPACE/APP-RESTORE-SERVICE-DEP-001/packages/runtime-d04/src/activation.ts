import type { TicketActivationMessage, ValidationResult } from "@appts-restore-service/contracts";

export type LifecycleState = "ACCEPTED" | "ACTIVE" | "TERMINAL_PROCESSING" | "CLOSED";
export interface RuntimeAggregate { readonly ticketId: string; readonly entityRef: string; readonly state: LifecycleState; readonly aggregateVersion: number; readonly purposeBindingId: string; readonly purposeIdentity: string; readonly purposeVersion: string; readonly packageIdentity: string; readonly packageVersion: string; readonly activationId: string; }
export type ActivationResult = { readonly status: "ACTIVATED"; readonly aggregate: RuntimeAggregate } | { readonly status: "REPLAY"; readonly aggregate: RuntimeAggregate } | { readonly status: "HELD_CONFLICT" | "NO_EFFECT"; readonly reason: string };

export function activateRuntime(existing: RuntimeAggregate | undefined, message: TicketActivationMessage, validation: ValidationResult): ActivationResult {
  if (!validation.ok) return { status: "NO_EFFECT", reason: "INVALID_I01" };
  if (existing) return existing.activationId === message.payload.activation_id && existing.ticketId === message.payload.ticket_id && existing.entityRef === message.payload.entity_ref ? { status: "REPLAY", aggregate: existing } : { status: "HELD_CONFLICT", reason: "CONFLICTING_ACTIVATION" };
  return { status: "ACTIVATED", aggregate: Object.freeze({ ticketId: message.payload.ticket_id, entityRef: message.payload.entity_ref, state: "ACCEPTED", aggregateVersion: 0, purposeBindingId: message.payload.purpose_binding_id, purposeIdentity: message.payload.purpose_identity, purposeVersion: message.payload.purpose_version, packageIdentity: message.payload.package_identity, packageVersion: message.payload.package_version, activationId: message.payload.activation_id }) };
}
