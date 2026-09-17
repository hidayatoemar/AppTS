export interface OracleResult { pass: boolean; reasons: string[] }

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
