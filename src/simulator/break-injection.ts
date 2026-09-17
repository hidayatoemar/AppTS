import type { Ref } from "../contracts/ids.js";
import type { ScopeSnapshot } from "../runtime/runtime-composition.js";

const clone = <T>(value: T): T => structuredClone(value);

export function injectStaleResponsibility(snapshot: ScopeSnapshot): ScopeSnapshot {
  const next = clone(snapshot);
  next.responsibility.currentness = { status: "STALE", basisRef: "BREAK-STALE-RESP" };
  return next;
}

export function injectDependency(snapshot: ScopeSnapshot, dependencyRef: Ref): ScopeSnapshot {
  const next = clone(snapshot);
  next.dependencyRefs = [...next.dependencyRefs, dependencyRef];
  return next;
}

export function injectConflictingContext(snapshot: ScopeSnapshot): ScopeSnapshot {
  const next = clone(snapshot);
  if (next.actingContextCandidates[0]) {
    next.actingContextCandidates[0].integrity = {
      sufficient: true,
      conflict: true,
      evidenceRefs: [...next.actingContextCandidates[0].integrity.evidenceRefs, "BREAK-CONFLICT"],
    };
  }
  return next;
}
