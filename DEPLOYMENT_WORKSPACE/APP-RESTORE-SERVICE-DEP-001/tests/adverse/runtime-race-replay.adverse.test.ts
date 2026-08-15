import assert from "node:assert/strict";
import test from "node:test";
import { executeLifecycleEffect, mayRetryAfterReconciliation, reconcileUncertainEffect, type CommitOutcome, type DurableEffectResult, type RuntimeAggregate, type RuntimeEffectStore } from "../../packages/runtime-d04/src/index.ts";

class AdverseStore implements RuntimeEffectStore {
  aggregate: RuntimeAggregate = { ticketId: "t", state: "ACCEPTED", aggregateVersion: 0, purposeBindingId: "pb", purposeIdentity: "restore", purposeVersion: "1", packageIdentity: "pkg", packageVersion: "1", activationId: "a" };
  results = new Map<string, DurableEffectResult>();
  readonly uncertain: boolean;
  constructor(uncertain = false) { this.uncertain = uncertain; }
  async loadAggregate() { return this.aggregate; }
  async findCommandResult(id: string) { return this.results.get(id); }
  async commitEffect(expected: number, next: RuntimeAggregate, result: DurableEffectResult): Promise<CommitOutcome> { if (this.uncertain) return { status: "UNCERTAIN", reconciliationRef: `reconcile:${result.commandId}` }; if (this.aggregate.aggregateVersion !== expected) return { status: "VERSION_CONFLICT" }; this.aggregate = next; this.results.set(result.commandId, result); return { status: "COMMITTED", result }; }
}
const command = (id: string, hash = "h") => ({ commandId: id, payloadHash: hash, ticketId: "t", expectedAggregateVersion: 0, actionClass: "ACTIVATE", targetState: "ACTIVE" as const, availableActions: ["ACTIVATE"], currentness: "CURRENT" as const });

test("duplicate replay is idempotent and conflicting replay is held", async () => {
  const store = new AdverseStore();
  const first = await executeLifecycleEffect(store, command("same"));
  assert.strictEqual(await executeLifecycleEffect(store, command("same")), first);
  const conflict = await executeLifecycleEffect(store, command("same", "different"));
  assert.equal(conflict.disposition, "NO_EFFECT");
  assert.equal(conflict.reason, "CONFLICTING_REPLAY");
});

test("concurrent race has one effect and no arrival-order authority", async () => {
  const store = new AdverseStore();
  const results = await Promise.all([executeLifecycleEffect(store, command("race-a")), executeLifecycleEffect(store, command("race-b"))]);
  assert.equal(results.filter((item) => item.disposition === "EFFECT_APPLIED").length, 1);
  assert.equal(results.filter((item) => item.disposition === "NO_EFFECT").length, 1);
  assert.equal(store.aggregate.aggregateVersion, 1);
});

test("stale, CLOSED and uncertain commit paths fail closed", async () => {
  const staleStore = new AdverseStore();
  assert.equal((await executeLifecycleEffect(staleStore, { ...command("stale"), currentness: "STALE" })).disposition, "NO_EFFECT");
  const closedStore = new AdverseStore(); closedStore.aggregate = { ...closedStore.aggregate, state: "CLOSED", aggregateVersion: 3 };
  assert.equal((await executeLifecycleEffect(closedStore, { ...command("closed"), expectedAggregateVersion: 3 })).reason, "CLOSED_NORMAL_EFFECT_REJECTED");
  const uncertain = await executeLifecycleEffect(new AdverseStore(true), command("uncertain"));
  assert.equal(uncertain.disposition, "EFFECT_UNCERTAIN_RECONCILIATION_REQUIRED");
  assert.equal(mayRetryAfterReconciliation(uncertain), false);
  const reconciled = reconcileUncertainEffect(uncertain, { status: "NO_EFFECT_CONFIRMED", aggregateVersion: 0, state: "ACCEPTED" });
  assert.equal(reconciled.disposition, "NO_EFFECT");
  assert.equal(mayRetryAfterReconciliation(reconciled), true);
});
