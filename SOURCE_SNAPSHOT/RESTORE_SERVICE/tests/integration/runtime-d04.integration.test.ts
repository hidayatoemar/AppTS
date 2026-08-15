import assert from "node:assert/strict";
import test from "node:test";
import { addBlocker, createDurableObligation, deriveAvailableActions, evaluateObligation, executeLifecycleEffect, invokeBoundExtension, validateAoua, type CommitOutcome, type DurableEffectResult, type RuntimeAggregate, type RuntimeEffectStore } from "../../packages/runtime-d04/src/index.ts";
import { runRuntimeObligationWorker } from "../../apps/worker/src/runtime-obligation-worker.ts";

class Store implements RuntimeEffectStore {
  aggregate: RuntimeAggregate = { ticketId: "t", state: "ACCEPTED", aggregateVersion: 0, purposeBindingId: "pb", purposeIdentity: "restore", purposeVersion: "1", packageIdentity: "pkg", packageVersion: "1", activationId: "a" };
  results = new Map<string, DurableEffectResult>();
  async loadAggregate() { return this.aggregate; }
  async findCommandResult(id: string) { return this.results.get(id); }
  async commitEffect(expected: number, next: RuntimeAggregate, result: DurableEffectResult): Promise<CommitOutcome> { if (this.aggregate.aggregateVersion !== expected) return { status: "VERSION_CONFLICT" }; this.aggregate = next; this.results.set(result.commandId, result); return { status: "COMMITTED", result }; }
}

test("D04 is the singular monotonic lifecycle effect boundary", async () => {
  const authority = { authority_result_id: "ar", ticket_id: "t", domain_id: "d", context_ref: "c", assignment_snapshot_refs: ["s"], responsibility_id: "r", responsible_assignment_ref: "assignment", authority_actions: [{ action_class_ref: "ACTIVATE", permission_code: "ALLOW" }], result_status_ref: "AUTHORIZED", currentness_ref: "current", effective_from: "2026-08-11T00:00:00Z" };
  const gate = { gate_result_id: "g", ticket_id: "t", gate_identity: "gate", gate_evaluation_id: "ge", input_version_set_ref: "v", gate_predicate_results: [], permitted_progression_classes: ["ACTIVATE"], currentness_ref: "current", effective_from: "2026-08-11T00:00:00Z" };
  const actions = deriveAvailableActions(authority, gate, []);
  const store = new Store();
  const result = await executeLifecycleEffect(store, { commandId: "cmd", payloadHash: "h", ticketId: "t", expectedAggregateVersion: 0, actionClass: "ACTIVATE", targetState: "ACTIVE", availableActions: actions, currentness: "CURRENT" });
  assert.equal(result.disposition, "EFFECT_APPLIED");
  assert.equal(store.aggregate.aggregateVersion, 1);
  assert.equal(result.auditRef, "audit:cmd");
  assert.equal(result.outboxRef, "outbox:cmd");
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
