import type { EnableState, GateReadiness } from "./results.js";
import type { Ref } from "./ids.js";

export interface PolicyConfig {
  allowStaleActingContext: boolean;
  rsA022BindingsBySubjectType: Readonly<Record<string, readonly Ref[]>>;
  gateByAction: Readonly<Record<string, GateReadiness>>;
  enableByAction: Readonly<Record<string, EnableState>>;
  boundedMachineAuthorityRefsByAction: Readonly<Record<string, readonly Ref[]>>;
}
