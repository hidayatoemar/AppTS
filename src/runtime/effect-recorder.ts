import type { GovernedExecutionOutcome } from "../adapters/action-effect-port.js";
import type { ActionCommandEnvelope, MaterialEffectRecord } from "../contracts/ce-di.js";
import type { Clock } from "../simulator/clock.js";
import type { IdGenerator } from "../simulator/ids.js";

export function recordMaterialEffects(
  envelope: ActionCommandEnvelope,
  outcome: GovernedExecutionOutcome,
  clock: Clock,
  ids: IdGenerator,
): MaterialEffectRecord[] {
  if (!outcome.resultantEffect) return [];
  return [{
    effectId: ids.next("effect"),
    commandId: envelope.commandId,
    actionId: envelope.actionId,
    scopeRef: envelope.scopeRef,
    effectTypeRef: outcome.resultantEffect.effectTypeRef,
    beforeTruthRefs: outcome.resultantEffect.beforeTruthRefs,
    afterTruthRefs: outcome.resultantEffect.afterTruthRefs,
    materialEffectEstablished: outcome.resultantEffect.materialEffectEstablished,
    noEffectOrFailureReason: outcome.resultantEffect.noEffectOrFailureReason,
    observationTime: clock.now(),
    effectiveTime: clock.now(),
    actorOrMachineRef: envelope.requestedByActorOrMachineRef,
    actingContextRef: envelope.actingContextRef,
    evidenceRefs: outcome.resultantEffect.evidenceRefs,
    provenance: { sourceRefs: outcome.resultantEffect.evidenceRefs, chainRefs: outcome.executionEvidenceRefs },
    currentness: { status: "CURRENT" },
    residualObligationRefs: [],
  }];
}
