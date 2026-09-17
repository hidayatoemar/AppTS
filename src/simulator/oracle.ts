import type { Ref } from "../contracts/ids.js";

export interface Oracle {
  expectedChangedTruthsEffects: Ref[];
  expectedRetainedTruths: Ref[];
  prohibitedOutcomes: Ref[];
  emittedObligationsDependencies: Ref[];
  gateEnableActionProjection?: unknown;
  evidenceProvenanceAssertions: Ref[];
}

export interface ScenarioOracleView {
  truthOrEffectRefs: Ref[];
  dependencyOrObligationRefs: Ref[];
  evidenceRefs: Ref[];
  gateEnableActionProjection?: unknown;
}

export interface OracleResult { pass: boolean; reasons: string[] }

export function assertScenarioOracle(oracle: Oracle, actual: ScenarioOracleView): void {
  const reasons: string[] = [];
  requireRefs(actual.truthOrEffectRefs, oracle.expectedChangedTruthsEffects, "changed_truth_or_effect", reasons);
  requireRefs(actual.truthOrEffectRefs, oracle.expectedRetainedTruths, "retained_truth", reasons);
  requireRefs(actual.dependencyOrObligationRefs, oracle.emittedObligationsDependencies, "obligation_or_dependency", reasons);
  requireRefs(actual.evidenceRefs, oracle.evidenceProvenanceAssertions, "evidence", reasons);
  for (const prohibited of oracle.prohibitedOutcomes) {
    if (actual.truthOrEffectRefs.includes(prohibited)) reasons.push(`prohibited_outcome_present:${prohibited}`);
  }
  if (oracle.gateEnableActionProjection !== undefined && !deepEqual(actual.gateEnableActionProjection, oracle.gateEnableActionProjection)) {
    reasons.push("gate_enable_action_projection_mismatch");
  }
  if (reasons.length > 0) throw new Error(`SCENARIO_ORACLE_FAILED:${reasons.join("|")}`);
}

export function evaluateOracle(
  actual: Record<string, unknown>,
  required: Readonly<Record<string, unknown>>,
  prohibitedKeys: readonly string[] = [],
): OracleResult {
  const reasons: string[] = [];
  for (const [key, value] of Object.entries(required)) {
    if (actual[key] !== value) reasons.push(`required_mismatch:${key}`);
  }
  for (const key of prohibitedKeys) {
    if (key in actual) reasons.push(`prohibited_key_present:${key}`);
  }
  return { pass: reasons.length === 0, reasons };
}

function requireRefs(actual: readonly Ref[], required: readonly Ref[], label: string, reasons: string[]): void {
  for (const ref of required) if (!actual.includes(ref)) reasons.push(`missing_${label}:${ref}`);
}

function deepEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
