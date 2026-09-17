import type { ActingContextCandidate, ResponsibilityContext, ScopeRef } from "../contracts/ce-di.js";
import type { ScopeSnapshot } from "../runtime/runtime-composition.js";

export const makeServiceScope = (): ScopeRef => ({ situationId: "SIT-001", subjectType: "SERVICE", subjectId: "SVC-001" });

export const makeResponsibility = (scopeRef: ScopeRef): ResponsibilityContext => ({
  responsibilityRef: "RESP-001",
  scopeRef,
  holderPersonRef: "PERSON-001",
  roleRef: "ROLE-NOC",
  assignmentRef: "ASSIGN-001",
  dutyRef: "DUTY-001",
  availabilityRef: "AVAIL-001",
  authorityBasisRef: "AUTH-RS-A022",
  effectiveTime: "2026-09-17T12:00:00.000Z",
  currentness: { status: "CURRENT" },
  provenance: { sourceRefs: ["EV-RESP"], chainRefs: [] },
});

export const makeCandidate = (scopeRef: ScopeRef, overrides: Partial<ActingContextCandidate> = {}): ActingContextCandidate => ({
  contextRef: "CTX-001",
  personRef: "PERSON-001",
  roleRef: "ROLE-NOC",
  assignmentRef: "ASSIGN-001",
  dutyRef: "DUTY-001",
  availabilityRef: "AVAIL-001",
  responsibilityRef: "RESP-001",
  authorityBasisRef: "AUTH-RS-A022",
  scopeRef,
  validity: { conditionRef: "COND-VALID", satisfied: true, evidenceRefs: ["EV-VALID"] },
  applicability: { conditionRef: "COND-APPLICABLE", satisfied: true, evidenceRefs: ["EV-APPLICABLE"] },
  currentness: { status: "CURRENT" },
  integrity: { sufficient: true, conflict: false, evidenceRefs: ["EV-INTEGRITY"] },
  provenance: { sourceRefs: ["EV-CTX"], chainRefs: [] },
  ...overrides,
});

export const makeSnapshot = (scopeRef: ScopeRef, candidates = [makeCandidate(scopeRef)]): ScopeSnapshot => ({
  scopeRef,
  version: 0,
  truthRefs: ["TRUTH-DOWN"],
  evidenceRefs: ["EV-DIAGNOSIS"],
  responsibility: makeResponsibility(scopeRef),
  actingContextCandidates: candidates,
  dependencyRefs: [],
});
