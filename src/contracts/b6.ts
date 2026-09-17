import type { Currentness, Provenance, ResponsibilityContext, ScopeRef } from "./ce-di.js";
import type { IsoInstant, Ref } from "./ids.js";

export interface ResponsibilityHandoverRecord {
  handoverRef: Ref;
  scopeRef: ScopeRef;
  fromResponsibilityRef: Ref;
  proposedHolderPersonRef?: Ref;
  proposedRoleRef?: Ref;
  proposedAssignmentRef?: Ref;
  proposedDutyRef?: Ref;
  proposedAvailabilityRef?: Ref;
  proposedAuthorityBasisRef?: Ref;
  accepted: boolean;
  confirmedEffective: boolean;
  failedOrTimedOut: boolean;
  effectiveTime?: IsoInstant;
  evidenceRefs: Ref[];
  provenance: Provenance;
}

export interface DependencyWaitingRecord {
  dependencyRef: Ref;
  scopeRef: ScopeRef;
  requiredConditionRef: Ref;
  requiredCapabilityOrAuthorityRefs: Ref[];
  openedAt: IsoInstant;
  targetTime?: IsoInstant;
  blockedActionIds: Ref[];
  alternateLawfulPathRefs: Ref[];
  escalationObligationRefs: Ref[];
  communicationObligationRefs: Ref[];
  satisfied: boolean;
  satisfactionEvidenceRefs: Ref[];
  currentness: Currentness;
  provenance: Provenance;
}

export type FieldWorkProgress =
  | "REQUESTED"
  | "ASSIGNED"
  | "MOBILIZING"
  | "ON_SITE"
  | "ACCESS_WORK_READY"
  | "STARTED"
  | "COMPLETED";

export interface FieldWorkRecord {
  fieldWorkRef: Ref;
  scopeRef: ScopeRef;
  progress: FieldWorkProgress;
  assignedPersonRef?: Ref;
  assignedTeamRef?: Ref;
  evidenceRefs: Ref[];
  currentness: Currentness;
  provenance: Provenance;
}

export type ResponsibilityHandoverEvaluation =
  | { kind: "RESPONSIBILITY_UNCHANGED"; current: ResponsibilityContext; interventionObligation: boolean; reasons: string[] }
  | { kind: "TRANSFER_EFFECT"; previous: ResponsibilityContext; next: ResponsibilityContext; handoverRef: Ref; evidenceRefs: Ref[] };

export interface DependencyEvaluation {
  dependencyRef: Ref;
  blocked: boolean;
  blockedActionIds: Ref[];
  requiredCapabilityOrAuthorityRefs: Ref[];
  alternateLawfulPathRefs: Ref[];
  escalationObligationRefs: Ref[];
  communicationObligationRefs: Ref[];
  reasons: string[];
}

export interface FieldWorkEvaluation {
  fieldWorkRef: Ref;
  progress: FieldWorkProgress;
  purposeResponsibilityTransferred: false;
  workCompleted: boolean;
  restorationEstablished: false;
  serviceVerificationEstablished: false;
}
