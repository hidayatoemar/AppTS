import type { IsoInstant, Ref } from "./ids.js";

export type GateReadiness =
  | "NOT_READY"
  | "CANDIDATE"
  | "CONFIRMING"
  | "READY"
  | "INVALID";

export type EnableState =
  | "NOT_REQUIRED"
  | "PENDING"
  | "ENABLED"
  | "HOLD"
  | "REJECTED"
  | "EXPIRED";

export interface GateEnableEvaluation {
  scopeRefKey: Ref;
  actionId: Ref;
  gateReadiness: GateReadiness;
  enableState: EnableState;
  reasons: string[];
  evidenceRefs: Ref[];
  evaluatedAt: IsoInstant;
  inputVersion: number;
}
