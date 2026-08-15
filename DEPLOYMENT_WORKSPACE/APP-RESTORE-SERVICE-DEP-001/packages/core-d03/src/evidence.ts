export type EvidenceQualification = "SUFFICIENT" | "INSUFFICIENT" | "MISSING" | "DISPUTED";
export interface EvidenceObject { readonly evidenceId: string; readonly sourceRef: string; readonly contentDigest: string; readonly observedAt: string; readonly qualification: EvidenceQualification; readonly correctionOf?: string; readonly supersedes?: string; readonly retainUntil: string; }
export interface EvidenceSetVersion { readonly evidenceSetVersionId: string; readonly version: number; readonly evidenceRefs: readonly string[]; readonly predecessorRef?: string; }
export function recordEvidence(input: EvidenceObject): EvidenceObject {
  if (!input.evidenceId || !input.sourceRef || !input.contentDigest || !input.retainUntil) throw new Error("EVIDENCE_REQUIRED_FACT_MISSING");
  return Object.freeze({ ...input });
}
export function versionEvidenceSet(id: string, version: number, evidence: readonly EvidenceObject[], predecessorRef?: string): EvidenceSetVersion {
  if (!Number.isSafeInteger(version) || version < 1) throw new Error("INVALID_EVIDENCE_SET_VERSION");
  return Object.freeze({ evidenceSetVersionId: id, version, evidenceRefs: Object.freeze(evidence.map((item) => item.evidenceId)), ...(predecessorRef ? { predecessorRef } : {}) });
}
