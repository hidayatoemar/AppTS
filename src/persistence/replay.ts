import type { ScopeRef } from "../contracts/ce-di.js";
import { evaluateDependencyWaiting } from "../runtime/dependency-waiting-controller.js";
import { evaluateResponsibilityHandover } from "../runtime/responsibility-handover-controller.js";
import type { ScopeSnapshot } from "../runtime/runtime-composition.js";
import { scopeKey } from "../runtime/runtime-composition.js";
import type { AppendBatch, ScopeRepository } from "./ports.js";

const clone = <T>(value: T): T => structuredClone(value);

export function prepareScopeSnapshot(input: ScopeSnapshot): ScopeSnapshot {
  const snapshot = clone(input);
  snapshot.actionExecutions ??= [];
  snapshot.materialEffects ??= [];
  snapshot.evidenceProvenance ??= [];
  snapshot.responsibilityHandoverEffects ??= [];
  snapshot.dependencyWaitingUpdates ??= [];
  snapshot.residualObligationRefs ??= [];
  snapshot.verificationClosureEffects ??= [];
  snapshot.otherAuthoritativeP01ToP10Records ??= [];
  return snapshot;
}

export function applyAuthoritativeBatch(snapshot: ScopeSnapshot, version: number, batch: AppendBatch): void {
  assertExactScope(snapshot.scopeRef, batch.scopeRef, "batch");
  snapshot.version = version;

  snapshot.actionExecutions.push(...clone(batch.actionExecutions));

  for (const effect of batch.materialEffects) {
    assertExactScope(snapshot.scopeRef, effect.scopeRef, "material_effect");
    snapshot.materialEffects.push(clone(effect));
    if (effect.materialEffectEstablished) snapshot.truthRefs = [...effect.afterTruthRefs];
    pushUnique(snapshot.evidenceRefs, effect.evidenceRefs);
    pushUnique(snapshot.residualObligationRefs, effect.residualObligationRefs);
  }

  snapshot.evidenceProvenance.push(...clone(batch.evidenceProvenance));
  pushUnique(snapshot.evidenceRefs, batch.evidenceProvenance.map((item) => item.evidenceId));

  for (const handover of batch.responsibilityHandoverEffects) {
    assertExactScope(snapshot.scopeRef, handover.scopeRef, "responsibility_handover");
    snapshot.responsibilityHandoverEffects.push(clone(handover));
    const evaluation = evaluateResponsibilityHandover(snapshot.responsibility, handover);
    if (evaluation.kind === "TRANSFER_EFFECT") snapshot.responsibility = clone(evaluation.next);
  }

  for (const dependency of batch.dependencyWaitingUpdates) {
    assertExactScope(snapshot.scopeRef, dependency.scopeRef, "dependency_waiting");
    const index = snapshot.dependencyWaitingUpdates.findIndex((item) => item.dependencyRef === dependency.dependencyRef);
    if (index >= 0) snapshot.dependencyWaitingUpdates[index] = clone(dependency);
    else snapshot.dependencyWaitingUpdates.push(clone(dependency));
  }
  snapshot.dependencyRefs = snapshot.dependencyWaitingUpdates
    .filter((record) => evaluateDependencyWaiting(record).blocked)
    .map((record) => record.dependencyRef);

  pushUnique(snapshot.residualObligationRefs, batch.residualObligationRefs);

  for (const verification of batch.verificationClosureEffects) {
    assertExactScope(snapshot.scopeRef, verification.scopeRef, "verification_closure");
    snapshot.verificationClosureEffects.push(clone(verification));
    pushUnique(snapshot.residualObligationRefs, verification.residualObligationRefs);
  }

  for (const authoritative of batch.otherAuthoritativeP01ToP10Records) {
    assertExactScope(snapshot.scopeRef, authoritative.record.scopeRef, authoritative.family);
    snapshot.otherAuthoritativeP01ToP10Records.push(clone(authoritative));
  }
}

export const replayScope = (repository: ScopeRepository, scopeRef: ScopeRef): Promise<ScopeSnapshot> => repository.replay(scopeRef);

function assertExactScope(expected: ScopeRef, actual: ScopeRef, source: string): void {
  if (scopeKey(expected) !== scopeKey(actual)) throw new Error(`AUTHORITATIVE_SCOPE_MISMATCH:${source}`);
}

function pushUnique(target: string[], values: readonly string[]): void {
  const seen = new Set(target);
  for (const value of values) {
    if (!seen.has(value)) {
      target.push(value);
      seen.add(value);
    }
  }
}
