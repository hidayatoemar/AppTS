import type { LifecycleState, RuntimeAggregate } from "./activation.ts";

export interface EffectCommand { readonly commandId: string; readonly payloadHash: string; readonly ticketId: string; readonly entityRef: string; readonly actorHolderRef: string; readonly actingRoleInstanceRef: string; readonly actingAssignmentRef: string; readonly authorityBasisRef: string; readonly expectedAggregateVersion: number; readonly actionClass: string; readonly targetState: LifecycleState; readonly availableActions: readonly string[]; readonly currentness: "CURRENT" | "STALE" | "UNKNOWN"; }
export interface DurableEffectResult { readonly commandId: string; readonly payloadHash: string; readonly entityRef: string; readonly actorHolderRef: string; readonly actingRoleInstanceRef: string; readonly actingAssignmentRef: string; readonly authorityBasisRef: string; readonly disposition: "EFFECT_APPLIED" | "NO_EFFECT" | "EFFECT_UNCERTAIN_RECONCILIATION_REQUIRED"; readonly reason: string; readonly aggregateVersion: number; readonly state: LifecycleState; readonly auditRef: string; readonly outboxRef?: string; }
export type CommitOutcome = { readonly status: "COMMITTED"; readonly result: DurableEffectResult } | { readonly status: "VERSION_CONFLICT" } | { readonly status: "UNCERTAIN"; readonly reconciliationRef: string };
export interface RuntimeEffectStore {
  loadAggregate(ticketId: string): Promise<RuntimeAggregate | undefined>;
  findCommandResult(commandId: string): Promise<DurableEffectResult | undefined>;
  commitEffect(expectedVersion: number, next: RuntimeAggregate, result: DurableEffectResult): Promise<CommitOutcome>;
}
const NEXT: Readonly<Record<LifecycleState, readonly LifecycleState[]>> = { ACCEPTED: ["ACTIVE"], ACTIVE: ["TERMINAL_PROCESSING"], TERMINAL_PROCESSING: ["CLOSED"], CLOSED: [] };
const noEffect = (command: EffectCommand, aggregate: RuntimeAggregate, reason: string): DurableEffectResult => Object.freeze({ commandId: command.commandId, payloadHash: command.payloadHash, entityRef: command.entityRef, actorHolderRef: command.actorHolderRef, actingRoleInstanceRef: command.actingRoleInstanceRef, actingAssignmentRef: command.actingAssignmentRef, authorityBasisRef: command.authorityBasisRef, disposition: "NO_EFFECT", reason, aggregateVersion: aggregate.aggregateVersion, state: aggregate.state, auditRef: `audit:${command.commandId}` });
const completeAttribution = (command: EffectCommand): boolean => [command.entityRef, command.actorHolderRef, command.actingRoleInstanceRef, command.actingAssignmentRef, command.authorityBasisRef].every((value) => typeof value === "string" && value.length > 0);

export async function executeLifecycleEffect(store: RuntimeEffectStore, command: EffectCommand): Promise<DurableEffectResult> {
  const prior = await store.findCommandResult(command.commandId);
  if (prior) return prior.payloadHash === command.payloadHash ? prior : Object.freeze({ ...prior, disposition: "NO_EFFECT", reason: "CONFLICTING_REPLAY" });
  const aggregate = await store.loadAggregate(command.ticketId);
  if (!aggregate) throw new Error("RUNTIME_AGGREGATE_NOT_FOUND");
  if (!completeAttribution(command)) return noEffect(command, aggregate, "MISSING_ENTITY_AUTHORITY_CONTEXT");
  if (command.entityRef !== aggregate.entityRef) return noEffect(command, aggregate, "WRONG_ENTITY_NO_EFFECT");
  if (command.currentness !== "CURRENT") return noEffect(command, aggregate, "STALE_OR_UNKNOWN_CURRENTNESS");
  if (aggregate.state === "CLOSED") return noEffect(command, aggregate, "CLOSED_NORMAL_EFFECT_REJECTED");
  if (aggregate.aggregateVersion !== command.expectedAggregateVersion) return noEffect(command, aggregate, "AGGREGATE_VERSION_MISMATCH");
  if (!command.availableActions.includes(command.actionClass)) return noEffect(command, aggregate, "ACTION_NOT_AVAILABLE");
  if (!NEXT[aggregate.state].includes(command.targetState)) return noEffect(command, aggregate, "INVALID_LIFECYCLE_TRANSITION");
  const next = Object.freeze({ ...aggregate, state: command.targetState, aggregateVersion: aggregate.aggregateVersion + 1 });
  const proposed: DurableEffectResult = Object.freeze({ commandId: command.commandId, payloadHash: command.payloadHash, entityRef: command.entityRef, actorHolderRef: command.actorHolderRef, actingRoleInstanceRef: command.actingRoleInstanceRef, actingAssignmentRef: command.actingAssignmentRef, authorityBasisRef: command.authorityBasisRef, disposition: "EFFECT_APPLIED", reason: "AUTHORIZED_GATE_PERMITTED_EFFECT", aggregateVersion: next.aggregateVersion, state: next.state, auditRef: `audit:${command.commandId}`, outboxRef: `outbox:${command.commandId}` });
  const commit = await store.commitEffect(command.expectedAggregateVersion, next, proposed);
  if (commit.status === "COMMITTED") return commit.result;
  if (commit.status === "VERSION_CONFLICT") return noEffect(command, aggregate, "CONCURRENT_VERSION_CONFLICT_RECONCILE");
  return Object.freeze({ ...noEffect(command, aggregate, "UNCERTAIN_COMMIT_RECONCILIATION_REQUIRED"), disposition: "EFFECT_UNCERTAIN_RECONCILIATION_REQUIRED", auditRef: commit.reconciliationRef });
}
