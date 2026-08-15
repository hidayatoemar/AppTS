export type Qualification = "CONFIRMED" | "UNCONFIRMED" | "DISPUTED";
export type Currentness = "CURRENT" | "STALE" | "UNKNOWN";
export interface IntakeCue { readonly intakeCueId: string; readonly sourceRef: string; readonly receivedAt: string; readonly payloadDigest: string; readonly correlationRef?: string; }
export interface SourceObservation { readonly observationId: string; readonly intakeCueId: string; readonly observedAt: string; readonly qualification: Qualification; readonly currentness: Currentness; readonly correctionOf?: string; }
export interface PreTicketCase { readonly preTicketCaseId: string; readonly cues: readonly IntakeCue[]; readonly observations: readonly SourceObservation[]; }
export function captureIntake(cue: IntakeCue, observation: SourceObservation, preTicketCaseId: string): PreTicketCase {
  if (!cue.intakeCueId || !cue.sourceRef || !cue.receivedAt || !cue.payloadDigest || !observation.observationId || !preTicketCaseId) throw new Error("INTAKE_REQUIRED_FACT_MISSING");
  if (observation.intakeCueId !== cue.intakeCueId) throw new Error("INTAKE_CUE_OBSERVATION_MISMATCH");
  return Object.freeze({ preTicketCaseId, cues: Object.freeze([Object.freeze({ ...cue })]), observations: Object.freeze([Object.freeze({ ...observation })]) });
}
export function appendObservation(caseRecord: PreTicketCase, observation: SourceObservation): PreTicketCase {
  if (!caseRecord.cues.some((cue) => cue.intakeCueId === observation.intakeCueId)) throw new Error("UNKNOWN_INTAKE_CUE");
  return Object.freeze({ ...caseRecord, observations: Object.freeze([...caseRecord.observations, Object.freeze({ ...observation })]) });
}
