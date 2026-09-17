import type { ActionCommandEnvelope, EvidenceProvenanceRef, ResponsibilityContext, ScopeRef } from "../contracts/ce-di.js";
import type { ResponsibilityHandoverRecord } from "../contracts/b6.js";
import type { ExternalExecutionObservation } from "../contracts/b8.js";
import type { Ref } from "../contracts/ids.js";
import type { ScopeSnapshot } from "../runtime/runtime-composition.js";
import type {
  EventOrObservationStimulus,
  ExternalResponseStimulus,
  ResponsibilityHandoverStimulus,
  TimeoutStimulus,
} from "./harness.js";

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

export function injectUnavailableHolder(snapshot: ScopeSnapshot): ScopeSnapshot {
  const next = clone(snapshot);
  next.actingContextCandidates = [];
  return next;
}

export function injectAccessDenied(snapshot: ScopeSnapshot, dependencyRef: Ref = "BREAK-ACCESS-DENIED"): ScopeSnapshot {
  return injectDependency(snapshot, dependencyRef);
}

export function providerTimeout(scopeRef: ScopeRef, advanceMs: number): TimeoutStimulus {
  return { kind: "TIMEOUT", scopeRef, advanceMs };
}

export function handoverTimeoutRecord(
  current: ResponsibilityContext,
  handoverRef: Ref = "BREAK-HANDOVER-TIMEOUT",
): ResponsibilityHandoverRecord {
  return {
    handoverRef,
    scopeRef: clone(current.scopeRef),
    fromResponsibilityRef: current.responsibilityRef,
    accepted: false,
    confirmedEffective: false,
    failedOrTimedOut: true,
    evidenceRefs: [handoverRef],
    provenance: { sourceRefs: [handoverRef], chainRefs: [current.responsibilityRef] },
  };
}

export function handoverTimeout(
  current: ResponsibilityContext,
  handoverRef: Ref = "BREAK-HANDOVER-TIMEOUT",
): ResponsibilityHandoverStimulus {
  const handover = handoverTimeoutRecord(current, handoverRef);
  return { kind: "RESPONSIBILITY_HANDOVER", scopeRef: clone(current.scopeRef), handover };
}

export function replayedCommand(command: ActionCommandEnvelope): ActionCommandEnvelope {
  return clone(command);
}

export function delayedExternalResponse(scopeRef: ScopeRef, observation: ExternalExecutionObservation): ExternalResponseStimulus {
  return { kind: "EXTERNAL_RESPONSE", scopeRef, observation: clone(observation) };
}

export function siblingScopeEvent(scopeRef: ScopeRef, evidence: EvidenceProvenanceRef[]): EventOrObservationStimulus {
  return { kind: "EVENT_OR_OBSERVATION", scopeRef, evidence: clone(evidence) };
}
