import type { GovernedExecutionOutcome } from "../adapters/action-effect-port.js";
import type { ActionCommandEnvelope, EvidenceProvenanceRef, MaterialEffectRecord } from "../contracts/ce-di.js";
import type { Clock } from "../simulator/clock.js";

export function recordDeterminingEvidence(
  envelope: ActionCommandEnvelope,
  outcome: GovernedExecutionOutcome,
  effects: MaterialEffectRecord[],
  clock: Clock,
): EvidenceProvenanceRef[] {
  return [...new Set([...outcome.executionEvidenceRefs, ...effects.flatMap((effect) => effect.evidenceRefs)])].map((evidenceId) => ({
    evidenceId,
    sourceType: "BOUNDED_EXECUTION",
    sourceRef: envelope.commandId,
    actorOrSystemRef: outcome.executorRef,
    receivedTime: clock.now(),
    currentness: { status: "CURRENT" },
    payloadOrRecordRef: evidenceId,
    provenanceChain: [],
  }));
}
