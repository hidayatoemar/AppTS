import assert from "node:assert/strict";
import test from "node:test";
import { addBlocker, createDurableObligation, deriveAvailableActions, evaluateObligation, executeLifecycleEffect, invokeBoundExtension, validateAoua, type CommitOutcome, type DurableEffectResult, type RuntimeAggregate, type RuntimeEffectStore } from "../../packages/runtime-d04/src/index.ts";
import { runRuntimeObligationWorker } from "../../apps/worker/src/runtime-obligation-worker.ts";

class Store implements RuntimeEffectStore {
  aggregate: RuntimeAggregate = { ticketId: "t", entityRef: "ENTITY-A", state: "ACCEPTED", aggregateVersion: 0, purposeBindingId: "pb", purposeIdentity: "restore", purposeVersion: "1", packageIdentity: "pkg", packageVersion: "1", activationId: "a" };
  results = new Map<string, DurableEffectResult>();
  async loadAggregate() { return this.aggregate; }
  async findCommandResult(id: string) { return this.results.get(id); }
  async commitEffect(expected: number, next: RuntimeAggregate, result: DurableEffectResult): Promise<CommitOutcome> { if (this.aggregate.aggregateVersion !== expected) return { status: "VERSION_CONFLICT" }; this.aggregate = next; this.results.set(result.commandId, result); return { status: "COMMITTED", result }; }
}

const attribution = Object.freeze({ entity_ref: "ENTITY-A", actor_holder_ref: "HOLDER-H", acting_role_instance_ref: "ROLE-INSTANCE-A", acting_assignment_ref: "ASSIGNMENT-A", authority_basis_ref: "AUTH-BASIS-A" });

test("D04 is the singular monotonic lifecycle effect boundary", async () => {
  const authority = { authority_result_id: "ar", ticket_id: "t", ...attribution, domain_id: "d", context_ref: "c", assignment_snapshot_refs: ["s"], responsibility_id: "r", responsible_assignment_ref: "ASSIGNMENT-A", authority_actions: [{ action_class_ref: "ACTIVATE", permission_code: "ALLOW" }], result_status_ref: "AUTHORIZED", currentness_ref: "current", effective_from: "2026-08-11T00:00:00Z" };
  const gate = { gate_result_id: "g", ticket_id: "t", entity_ref: attribution.entity_ref, actor_holder_ref: attribution.actor_holder_ref, acting_role_instance_ref: attribution.acting_role_instance_ref, acting_assignment_ref: attribution.acting_assignment_ref, authority_basis_ref: attribution.authority_basis_ref, gate_identity: "gate", gate_evaluation_id: "ge", input_version_set_ref: "v", gate_predicate_results: [], permitted_progression_classes: ["ACTIVATE"], currentness_ref: "current", effective_from: "2026-08-11T00:00:00Z" };
  const actions = deriveAvailableActions(authority, gate, []);
  const store = new Store();
  const result = await executeLifecycleEffect(store, { commandId: "cmd", payloadHash: "h", ticketId: "t", entityRef: "ENTITY-A", actorHolderRef: "HOLDER-H", actingRoleInstanceRef: "ROLE-INSTANCE-A", actingAssignmentRef: "ASSIGNMENT-A", authorityBasisRef: "AUTH-BASIS-A", expectedAggregateVersion: 0, actionClass: "ACTIVATE", targetState: "ACTIVE", availableActions: actions, currentness: "CURRENT" });
  assert.equal(result.disposition, "EFFECT_APPLIED");
  assert.equal(store.aggregate.aggregateVersion, 1);
  assert.equal(result.entityRef, "ENTITY-A");
  assert.equal(result.actingRoleInstanceRef, "ROLE-INSTANCE-A");
  assert.equal(result.actingAssignmentRef, "ASSIGNMENT-A");
  assert.equal(result.authorityBasisRef, "AUTH-BASIS-A");
  assert.equal(result.auditRef, "audit:cmd");
  assert.equal(result.outboxRef, "outbox:cmd");
});

test("MCR071 D04 wrong Entity is NO_EFFECT before durable commit", async () => {
  const store = new Store();
  const result = await executeLifecycleEffect(store, { commandId: "wrong-entity", payloadHash: "h2", ticketId: "t", entityRef: "ENTITY-B", actorHolderRef: "HOLDER-H", actingRoleInstanceRef: "ROLE-INSTANCE-B", actingAssignmentRef: "ASSIGNMENT-B", authorityBasisRef: "AUTH-BASIS-B", expectedAggregateVersion: 0, actionClass: "ACTIVATE", targetState: "ACTIVE", availableActions: ["ACTIVATE"], currentness: "CURRENT" });
  assert.equal(result.disposition, "NO_EFFECT");
  assert.equal(result.reason, "WRONG_ENTITY_NO_EFFECT");
  assert.equal(store.aggregate.aggregateVersion, 0);
  assert.equal(store.results.size, 0);
});

test("MCR071 action availability fails closed on Entity attribution mismatch", () => {
  const authority = { authority_result_id: "ar2", ticket_id: "t", ...attribution, domain_id: "d", context_ref: "c", assignment_snapshot_refs: ["s"], responsibility_id: "r", responsible_assignment_ref: "ASSIGNMENT-A", authority_actions: [{ action_class_ref: "ACTIVATE", permission_code: "ALLOW" }], result_status_ref: "AUTHORIZED", currentness_ref: "current", effective_from: "2026-08-11T00:00:00Z" };
  const gate = { gate_result_id: "g2", ticket_id: "t", entity_ref: "ENTITY-B", actor_holder_ref: "HOLDER-H", acting_role_instance_ref: "ROLE-INSTANCE-B", acting_assignment_ref: "ASSIGNMENT-B", authority_basis_ref: "AUTH-BASIS-B", gate_identity: "gate", gate_evaluation_id: "ge2", input_version_set_ref: "v", gate_predicate_results: [], permitted_progression_classes: ["ACTIVATE"], currentness_ref: "current", effective_from: "2026-08-11T00:00:00Z" };
  assert.deepEqual(deriveAvailableActions(authority, gate, []), []);
});

test("waiting/blocker is orthogonal and durable obligations survive worker restart", async () => {
  const context = addBlocker({ waiting: [], blockers: [] }, { blockerId: "b", ticketId: "t", reasonRef: "dependency", status: "OPEN" });
  assert.equal(context.blockers.length, 1);
  const obligation = createDurableObligation({ obligationId: "o", ticketId: "t", sourceRef: "s", effectiveAt: "2026-08-11T00:00:00Z", dueBasisRef: "policy", nextEvaluationAt: "2026-08-11T01:00:00Z", status: "OPEN" });
  let saved = [] as typeof obligation[];
  const repository = { loadDue: async () => [obligation], evaluate: evaluateObligation, saveEvaluations: async (items: readonly typeof obligation[]) => { saved = [...items]; } };
  assert.equal(await runRuntimeObligationWorker(repository, "2026-08-11T02:00:00Z"), 1);
  assert.equal(saved[0]!.status, "EXPIRED");
});

test("AOUA and extension host fail closed without controlled inputs", async () => {
  const aoua = validateAoua({ authorizationId: "a", issuerRef: "issuer", deploymentBinding: "dep", validFrom: "2026-08-11T00:00:00Z", expiresAt: "2026-08-12T00:00:00Z", status: "ACTIVE", integrityValid: true, securityProfileKnown: false }, "dep", "2026-08-11T01:00:00Z");
  assert.equal(aoua.mode, "INVALID_OR_TAMPER_SUSPECTED");
  const extension = await invokeBoundExtension({ hookIdentity: "hook", packageIdentity: "pkg", packageVersion: "1", input: {} }, []);
  assert.equal(extension.status, "EXPLICIT_STUB_NO_EFFECT");
});
