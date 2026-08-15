import type { DurableEffectResult } from "./effect-engine.ts";
export type AuthoritativeOutcome = { readonly status: "EFFECT_CONFIRMED"; readonly result: DurableEffectResult } | { readonly status: "NO_EFFECT_CONFIRMED"; readonly aggregateVersion: number; readonly state: DurableEffectResult["state"] } | { readonly status: "STILL_UNCERTAIN" };
export function reconcileUncertainEffect(uncertain: DurableEffectResult, outcome: AuthoritativeOutcome): DurableEffectResult {
  if (uncertain.disposition !== "EFFECT_UNCERTAIN_RECONCILIATION_REQUIRED") return uncertain;
  if (outcome.status === "EFFECT_CONFIRMED") return outcome.result;
  if (outcome.status === "NO_EFFECT_CONFIRMED") return Object.freeze({ ...uncertain, disposition: "NO_EFFECT", reason: "AUTHORITATIVE_RECONCILIATION_NO_EFFECT", aggregateVersion: outcome.aggregateVersion, state: outcome.state });
  return uncertain;
}
export function mayRetryAfterReconciliation(result: DurableEffectResult): boolean { return result.disposition !== "EFFECT_UNCERTAIN_RECONCILIATION_REQUIRED"; }
