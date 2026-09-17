import type { PolicyConfig } from "../contracts/policy.js";
import type { ScopeRef } from "../contracts/ce-di.js";
import type { Ref } from "../contracts/ids.js";

export const RS_A_022 = "RS-A-022" as const;

export function resolveRsA022Bindings(scope: ScopeRef, policy: PolicyConfig): readonly Ref[] {
  const bindings = policy.rsA022BindingsBySubjectType[scope.subjectType];
  if (!bindings || bindings.length === 0) throw new Error(`No governed RS-A-022 functional binding for subjectType=${scope.subjectType}`);
  if (bindings.includes("FB-D-05")) throw new Error("FB-D-05 is LEGACY LINEAGE ONLY and cannot be an active RS-A-022 binding");
  return bindings;
}
