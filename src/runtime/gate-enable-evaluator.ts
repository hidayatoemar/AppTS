import type { GateEnableEvaluationRecord, ScopeRef } from "../contracts/ce-di.js";
import type { EnableState, GateReadiness } from "../contracts/results.js";
import type { IsoInstant, Ref } from "../contracts/ids.js";

export interface GateEvaluationInput {
  scopeRef: ScopeRef;
  actionId: Ref;
  gateReadiness: GateReadiness;
  enableState: EnableState;
  reasons: string[];
  evidenceRefs: Ref[];
  evaluatedAt: IsoInstant;
  inputVersion: number;
}

export function evaluateGateEnable(input: GateEvaluationInput): GateEnableEvaluationRecord {
  return { ...input };
}
