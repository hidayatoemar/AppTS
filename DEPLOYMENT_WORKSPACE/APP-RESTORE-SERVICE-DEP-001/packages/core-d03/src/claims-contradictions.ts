export interface Claim { readonly claimId: string; readonly claimType: string; readonly value: unknown; readonly evidenceRefs: readonly string[]; }
export interface Interpretation { readonly interpretationId: string; readonly claimRef: string; readonly interpreterRef: string; readonly value: unknown; }
export interface ContradictionSet { readonly contradictionId: string; readonly memberClaimRefs: readonly string[]; readonly status: "OPEN" | "RESOLVED"; readonly resolutionRef?: string; }
export function registerContradiction(id: string, claims: readonly Claim[]): ContradictionSet {
  const refs = [...new Set(claims.map((claim) => claim.claimId))].sort();
  if (refs.length < 2) throw new Error("CONTRADICTION_REQUIRES_MULTIPLE_CLAIMS");
  return Object.freeze({ contradictionId: id, memberClaimRefs: Object.freeze(refs), status: "OPEN" });
}
export function resolveContradiction(set: ContradictionSet, resolutionRef: string): ContradictionSet { return Object.freeze({ ...set, status: "RESOLVED", resolutionRef }); }
