import type {
  ActingContextCandidate,
  ActingContextResolution,
  ResponsibilityContext,
  ScopeRef,
} from "../contracts/ce-di.js";
import type { Ref } from "../contracts/ids.js";
import { scopeKey } from "./runtime-composition.js";

export interface ActingContextInput {
  scopeRef: ScopeRef;
  requiredAuthorityRef: Ref;
  responsibility: ResponsibilityContext;
  candidates: ActingContextCandidate[];
  allowStale: boolean;
}

const candidateEvidence = (candidate: ActingContextCandidate): Ref[] => [
  ...candidate.validity.evidenceRefs,
  ...candidate.applicability.evidenceRefs,
  ...candidate.integrity.evidenceRefs,
  ...candidate.provenance.sourceRefs,
];

export function resolveActingContext(input: ActingContextInput): ActingContextResolution {
  const lawful: ActingContextCandidate[] = [];
  const rejectedEvidence: Ref[] = [];
  const rejectedReasons = new Set<string>();

  for (const candidate of input.candidates) {
    const reasons: string[] = [];
    if (scopeKey(candidate.scopeRef) !== scopeKey(input.scopeRef)) reasons.push("scope_mismatch");
    if (!candidate.validity.satisfied) reasons.push("invalid");
    if (!candidate.applicability.satisfied) reasons.push("inapplicable");
    if (!input.allowStale && candidate.currentness.status !== "CURRENT") reasons.push("non_current");
    if (!candidate.integrity.sufficient || candidate.integrity.conflict) reasons.push("integrity_insufficient_or_conflicting");
    if (candidate.authorityBasisRef !== input.requiredAuthorityRef) reasons.push("authority_mismatch");
    if (candidate.responsibilityRef !== input.responsibility.responsibilityRef) reasons.push("responsibility_mismatch");

    if (reasons.length === 0) {
      lawful.push(candidate);
    } else {
      reasons.forEach((reason) => rejectedReasons.add(reason));
      rejectedEvidence.push(...candidateEvidence(candidate));
    }
  }

  if (lawful.length === 1) return { kind: "EXACT_ONE", candidate: lawful[0] };
  if (lawful.length > 1) {
    return {
      kind: "AMBIGUOUS",
      candidates: lawful,
      evidenceRefs: lawful.flatMap(candidateEvidence),
    };
  }
  return {
    kind: "NONE",
    reason: [...rejectedReasons].sort().join(",") || "no_candidate",
    evidenceRefs: [...new Set(rejectedEvidence)],
  };
}
