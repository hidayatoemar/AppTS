import type { DependencyWaitingRecord, ScopeRef } from "../contracts/ce-di.js";
import type { IsoInstant, Ref } from "../contracts/ids.js";

export interface DependencyEvaluationInput {
  dependencyId: Ref;
  scopeRef: ScopeRef;
  requiredConditionRef: Ref;
  requiredCapabilityOrAuthorityRef?: Ref;
  sinceTime: IsoInstant;
  agingBasis: string;
  blockedDownstreamEffectRefs: Ref[];
  alternateLawfulPathRefs: Ref[];
  escalationOrCommunicationObligationRefs: Ref[];
  evidenceRefs: Ref[];
  provenanceSourceRefs: Ref[];
  currentnessStatus: "CURRENT" | "STALE" | "UNKNOWN";
  materialConditionSatisfiedRef?: Ref;
  timeoutReached?: boolean;
  timeoutInterventionObligationRef?: Ref;
  followUpOrAckEvidenceRefs?: Ref[];
}

export interface DependencyEvaluationResult {
  active: boolean;
  record?: DependencyWaitingRecord;
  satisfiedByMaterialConditionRef?: Ref;
  obligationsToEmit: Ref[];
}

export function evaluateDependency(input: DependencyEvaluationInput): DependencyEvaluationResult {
  if (input.materialConditionSatisfiedRef) {
    return {
      active: false,
      satisfiedByMaterialConditionRef: input.materialConditionSatisfiedRef,
      obligationsToEmit: [],
    };
  }

  const obligationsToEmit = input.timeoutReached && input.timeoutInterventionObligationRef
    ? [input.timeoutInterventionObligationRef]
    : [];

  const evidenceRefs = [...new Set([
    ...input.evidenceRefs,
    ...(input.followUpOrAckEvidenceRefs ?? []),
  ])];

  return {
    active: true,
    record: {
      dependencyId: input.dependencyId,
      scopeRef: input.scopeRef,
      requiredConditionRef: input.requiredConditionRef,
      requiredCapabilityOrAuthorityRef: input.requiredCapabilityOrAuthorityRef,
      sinceTime: input.sinceTime,
      agingBasis: input.agingBasis,
      blockedDownstreamEffectRefs: [...input.blockedDownstreamEffectRefs],
      alternateLawfulPathRefs: [...input.alternateLawfulPathRefs],
      escalationOrCommunicationObligationRefs: [
        ...input.escalationOrCommunicationObligationRefs,
        ...obligationsToEmit.filter((ref) => !input.escalationOrCommunicationObligationRefs.includes(ref)),
      ],
      currentness: { status: input.currentnessStatus },
      evidenceRefs,
      provenance: { sourceRefs: [...input.provenanceSourceRefs], chainRefs: [] },
    },
    obligationsToEmit,
  };
}
