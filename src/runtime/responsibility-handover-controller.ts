import type {
  HandoverRecord,
  MaterialEffectRecord,
  ResponsibilityContext,
  ScopeRef,
} from "../contracts/ce-di.js";
import type { IsoInstant, Ref } from "../contracts/ids.js";

export type HandoverEvaluationOutcome =
  | "INITIATED"
  | "CONFIRMATION_PENDING"
  | "CONFIRMED_EFFECTIVE"
  | "FAILED"
  | "TIMED_OUT";

export interface HandoverEvaluationInput {
  handoverId: Ref;
  scopeRef: ScopeRef;
  currentResponsibility: ResponsibilityContext;
  predecessorRef: Ref;
  intendedSuccessorRef: Ref;
  initiationRef: Ref;
  confirmationConditionRef: Ref;
  outcome: HandoverEvaluationOutcome;
  evidenceRefs: Ref[];
  provenanceSourceRefs: Ref[];
  actorOrSystemRef: Ref;
  evaluatedAt: IsoInstant;
  transferEffectId?: Ref;
  transferEffectTypeRef?: Ref;
  confirmedResponsibilityRef?: Ref;
  timeoutFailureRef?: Ref;
  interventionObligationRef?: Ref;
  existingRecord?: HandoverRecord;
}

export interface HandoverEvaluationResult {
  record: HandoverRecord;
  transferEffect?: MaterialEffectRecord;
  interventionObligationRefs: Ref[];
}

export function evaluateHandover(input: HandoverEvaluationInput): HandoverEvaluationResult {
  const baseRecord: HandoverRecord = input.existingRecord
    ? structuredClone(input.existingRecord)
    : {
        handoverId: input.handoverId,
        responsibilityRef: input.currentResponsibility.responsibilityRef,
        scopeRef: input.scopeRef,
        predecessorRef: input.predecessorRef,
        intendedSuccessorRef: input.intendedSuccessorRef,
        initiationRef: input.initiationRef,
        confirmationConditionRef: input.confirmationConditionRef,
        evidenceRefs: [...input.evidenceRefs],
        provenance: { sourceRefs: [...input.provenanceSourceRefs], chainRefs: [] },
      };

  // A previously established transfer is not emitted again on repeated evaluation.
  if (baseRecord.effectiveTransferRef) {
    return { record: baseRecord, interventionObligationRefs: [] };
  }

  if (input.outcome === "CONFIRMED_EFFECTIVE") {
    if (!input.transferEffectId || !input.transferEffectTypeRef || !input.confirmedResponsibilityRef) {
      throw new Error("CONFIRMED_HANDOVER_REQUIRES_TRANSFER_BINDING");
    }
    const record: HandoverRecord = {
      ...baseRecord,
      effectiveTransferRef: input.transferEffectId,
      evidenceRefs: [...new Set([...baseRecord.evidenceRefs, ...input.evidenceRefs])],
    };
    const transferEffect: MaterialEffectRecord = {
      effectId: input.transferEffectId,
      scopeRef: input.scopeRef,
      effectTypeRef: input.transferEffectTypeRef,
      beforeTruthRefs: [input.currentResponsibility.responsibilityRef],
      afterTruthRefs: [input.confirmedResponsibilityRef],
      materialEffectEstablished: true,
      observationTime: input.evaluatedAt,
      effectiveTime: input.evaluatedAt,
      actorOrMachineRef: input.actorOrSystemRef,
      evidenceRefs: [...input.evidenceRefs],
      provenance: { sourceRefs: [...input.provenanceSourceRefs], chainRefs: [] },
      currentness: { status: "CURRENT" },
      residualObligationRefs: [],
    };
    return { record, transferEffect, interventionObligationRefs: [] };
  }

  if (input.outcome === "FAILED" || input.outcome === "TIMED_OUT") {
    const obligationRefs = input.interventionObligationRef ? [input.interventionObligationRef] : [];
    return {
      record: {
        ...baseRecord,
        timeoutFailureRef: input.timeoutFailureRef,
        evidenceRefs: [...new Set([...baseRecord.evidenceRefs, ...input.evidenceRefs])],
      },
      interventionObligationRefs: obligationRefs,
    };
  }

  return {
    record: {
      ...baseRecord,
      evidenceRefs: [...new Set([...baseRecord.evidenceRefs, ...input.evidenceRefs])],
    },
    interventionObligationRefs: [],
  };
}
