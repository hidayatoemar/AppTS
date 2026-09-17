import type { ActingContextCandidate, ResponsibilityContext, ScopeRef } from "../contracts/ce-di.js";
import type { Ref } from "../contracts/ids.js";

export interface ScopeSnapshot {
  scopeRef: ScopeRef;
  version: number;
  truthRefs: Ref[];
  evidenceRefs: Ref[];
  responsibility: ResponsibilityContext;
  actingContextCandidates: ActingContextCandidate[];
  dependencyRefs: Ref[];
}

export const scopeKey = (scope: ScopeRef): string =>
  [scope.situationId, scope.subjectType, scope.subjectId, scope.parentScopeRef ?? "", scope.relationRef ?? ""].join("|");
