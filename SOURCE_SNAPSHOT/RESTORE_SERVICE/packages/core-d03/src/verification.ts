export type VerificationStatus = "VERIFIED" | "FAILED" | "DISPUTED" | "STALE" | "UNAUTHORIZED" | "SELF_CONFLICTED";
export interface VerificationRequest { readonly requestId: string; readonly evidenceSetVersionRef: string; readonly requesterRef: string; readonly verifierRef: string; readonly independentRequired: boolean; }
export interface VerificationResult { readonly requestId: string; readonly status: VerificationStatus; readonly resultRef: string; }
export function verifyEvidence(request: VerificationRequest, eligible: boolean, substantiveStatus: "VERIFIED" | "FAILED" | "DISPUTED" | "STALE"): VerificationResult {
  const status: VerificationStatus = !eligible ? "UNAUTHORIZED" : request.independentRequired && request.requesterRef === request.verifierRef ? "SELF_CONFLICTED" : substantiveStatus;
  return Object.freeze({ requestId: request.requestId, status, resultRef: `${request.requestId}:${status}` });
}
