/**
 * MCR-to-CODEX-040 trial-only representation bridge. This is deliberately
 * absent unless the caller is the admitted TD-PRE-001 trial surface.
 */
export const TRIAL_DISCLOSURE_CONFIGURATION_KEY = "APPTS_TRIAL_DISCLOSURE_LABEL_REF" as const;
export const TD_PRE_001_TRIAL_CONTEXT = "TD-PRE-001" as const;
export const TD_PRE_001_DISCLOSURE_CONTROL_REF = "MCR-TRIAL-DISCLOSURE-TD-PRE-001-01" as const;
export const TD_PRE_001_DISCLOSURE_LABEL_REF = "6f79da70-412f-469e-bcf7-f544f81b8aa7" as const;

export function resolveTrialDisclosureLabelRef(trialContext: string): string {
  if (trialContext !== TD_PRE_001_TRIAL_CONTEXT) throw new Error("TRIAL_DISCLOSURE_CONTEXT_NOT_AUTHORIZED");
  const configured = process.env[TRIAL_DISCLOSURE_CONFIGURATION_KEY];
  if (configured === undefined) throw new Error("TRIAL_DISCLOSURE_CONFIGURATION_MISSING");
  if (configured !== TD_PRE_001_DISCLOSURE_LABEL_REF) throw new Error("TRIAL_DISCLOSURE_CONFIGURATION_INVALID");
  return configured;
}
