import type { FieldWorkRecord, ScopeRef } from "../contracts/ce-di.js";
import type { Ref } from "../contracts/ids.js";

export interface FieldWorkEvaluationInput {
  fieldWorkId: Ref;
  scopeRef: ScopeRef;
  workProgressRef: Ref;
  assignmentRef?: Ref;
  holderRef?: Ref;
  availabilityRef?: Ref;
  accessRef?: Ref;
  evidenceRefs: Ref[];
  provenanceSourceRefs: Ref[];
  currentnessStatus: "CURRENT" | "STALE" | "UNKNOWN";
  previousRecord?: FieldWorkRecord;
}

export interface FieldWorkEvaluationResult {
  accepted: boolean;
  record?: FieldWorkRecord;
  blockedReasons: string[];
}

export function evaluateFieldWork(input: FieldWorkEvaluationInput): FieldWorkEvaluationResult {
  const blockedReasons: string[] = [];

  // Progress labels remain governed opaque refs. The only construction rule here
  // is the verified invariant: ON_SITE does not imply ACCESS/WORK_READY/STARTED.
  if ((input.workProgressRef === "STARTED" || input.workProgressRef === "COMPLETED") && !input.accessRef) {
    blockedReasons.push("field_access_not_ready");
  }

  if (input.workProgressRef === "ASSIGNED" && !input.assignmentRef) blockedReasons.push("field_assignment_missing");

  if (blockedReasons.length > 0) return { accepted: false, blockedReasons };

  return {
    accepted: true,
    record: {
      fieldWorkId: input.fieldWorkId,
      scopeRef: input.scopeRef,
      assignmentRef: input.assignmentRef ?? input.previousRecord?.assignmentRef,
      holderRef: input.holderRef ?? input.previousRecord?.holderRef,
      availabilityRef: input.availabilityRef ?? input.previousRecord?.availabilityRef,
      accessRef: input.accessRef ?? input.previousRecord?.accessRef,
      workProgressRef: input.workProgressRef,
      evidenceRefs: [...new Set([...(input.previousRecord?.evidenceRefs ?? []), ...input.evidenceRefs])],
      provenance: { sourceRefs: [...input.provenanceSourceRefs], chainRefs: input.previousRecord?.provenance.sourceRefs ?? [] },
      currentness: { status: input.currentnessStatus },
    },
    blockedReasons: [],
  };
}
