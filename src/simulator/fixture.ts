import type {
  ActingContextCandidate,
  Currentness,
  EvidenceProvenanceRef,
  ResponsibilityContext,
  ScopeRef,
} from "../contracts/ce-di.js";
import type { DependencyWaitingRecord } from "../contracts/b6.js";
import type { IsoInstant } from "../contracts/ids.js";
import type { PolicyConfig } from "../contracts/policy.js";
import type { ScopeSnapshot } from "../runtime/runtime-composition.js";
import { firstSlicePolicy } from "../config/policy-config.js";

export interface Fixture {
  initialScopedTruths: ScopeSnapshot[];
  responsibilities: ResponsibilityContext[];
  actingContextFacts: ActingContextCandidate[];
  dependencies: DependencyWaitingRecord[];
  evidence: EvidenceProvenanceRef[];
  currentness: Currentness[];
  policyConfigInputs: PolicyConfig;
  clock: IsoInstant;
}

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
  actionExecutions: [],
  materialEffects: [],
  evidenceProvenance: [],
  responsibilityHandoverEffects: [],
  dependencyWaitingUpdates: [],
  residualObligationRefs: [],
  verificationClosureEffects: [],
  otherAuthoritativeP01ToP10Records: [],
});

export const makeFixture = (snapshots: ScopeSnapshot[], overrides: Partial<Fixture> = {}): Fixture => ({
  initialScopedTruths: snapshots,
  responsibilities: snapshots.map((snapshot) => snapshot.responsibility),
  actingContextFacts: snapshots.flatMap((snapshot) => snapshot.actingContextCandidates),
  dependencies: snapshots.flatMap((snapshot) => snapshot.dependencyWaitingUpdates),
  evidence: snapshots.flatMap((snapshot) => snapshot.evidenceProvenance),
  currentness: snapshots.flatMap((snapshot) => [snapshot.responsibility.currentness, ...snapshot.actingContextCandidates.map((candidate) => candidate.currentness)]),
  policyConfigInputs: firstSlicePolicy,
  clock: "2026-09-17T12:00:00.000Z",
  ...overrides,
});
