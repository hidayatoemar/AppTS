import type { GateReadiness, EnableState } from "./results.js";
import type { IsoInstant, Ref } from "./ids.js";
export type Currentness = { status: "CURRENT" | "STALE" | "UNKNOWN"; basisRef?: Ref; };
export type GovernedConditionAssessment = { conditionRef: Ref; satisfied: boolean; evidenceRefs: Ref[]; };
export type IntegrityAssessment = { sufficient: boolean; conflict: boolean; evidenceRefs: Ref[]; };
export type Provenance = { sourceRefs: Ref[]; chainRefs: Ref[] };
export interface PurposeInstanceRef { purpose: "RESTORE_SERVICE"; situationId: Ref; compositionInstanceId: Ref; startedFromBasisRef: Ref; }
export interface ScopeRef { situationId: Ref; subjectType: string; subjectId: Ref; parentScopeRef?: Ref; relationRef?: Ref; }
export interface ResponsibilityContext { responsibilityRef: Ref; scopeRef: ScopeRef; holderPersonRef?: Ref; roleRef?: Ref; assignmentRef?: Ref; dutyRef?: Ref; availabilityRef?: Ref; authorityBasisRef?: Ref; effectiveTime: IsoInstant; currentness: Currentness; provenance: Provenance; }
export interface ActingContextCandidate { contextRef: Ref; personRef: Ref; entityRef?: Ref; roleRef: Ref; assignmentRef: Ref; dutyRef?: Ref; availabilityRef: Ref; responsibilityRef: Ref; authorityBasisRef: Ref; scopeRef: ScopeRef; validity: GovernedConditionAssessment; applicability: GovernedConditionAssessment; currentness: Currentness; integrity: IntegrityAssessment; provenance: Provenance; }
export type ActingContextResolution = { kind: "EXACT_ONE"; candidate: ActingContextCandidate } | { kind: "AMBIGUOUS"; candidates: ActingContextCandidate[]; evidenceRefs: Ref[] } | { kind: "NONE"; reason: string; evidenceRefs: Ref[] };
export interface GateEnableEvaluationRecord { scopeRef: ScopeRef; actionId: Ref; gateReadiness: GateReadiness; enableState: EnableState; reasons: string[]; evidenceRefs: Ref[]; evaluatedAt: IsoInstant; inputVersion: number; }
export interface LawfulActionProjection { scopeRef: ScopeRef; actionId: Ref; available: boolean; blockedReasons: string[]; requiredContextRefs: Ref[]; requiredDependencyRefs: Ref[]; gateEnableRef: Ref; }
export interface ActionCommandEnvelope { commandId: Ref; actionId: Ref; purposeRef: PurposeInstanceRef; scopeRef: ScopeRef; requestedByActorOrMachineRef: Ref; actingContextRef?: Ref; boundedMachineAuthorityRef?: Ref; expectedInputVersion: number; requestTime: IsoInstant; payloadRef?: Ref; evidenceRefs: Ref[]; }
export interface ActionExecutionRecord { commandId: Ref; accepted: boolean; executionAttempted: boolean; executionResult: string; executorRef: Ref; executionTime: IsoInstant; responseRef?: Ref; evidenceRefs: Ref[]; provenance: Provenance; uncertaintyFlag: boolean; }
export interface MaterialEffectRecord { effectId: Ref; commandId?: Ref; actionId?: Ref; scopeRef: ScopeRef; effectTypeRef: Ref; beforeTruthRefs: Ref[]; afterTruthRefs: Ref[]; materialEffectEstablished: boolean; noEffectOrFailureReason?: string; observationTime?: IsoInstant; effectiveTime?: IsoInstant; actorOrMachineRef: Ref; actingContextRef?: Ref; evidenceRefs: Ref[]; provenance: Provenance; currentness: Currentness; residualObligationRefs: Ref[]; }
export interface EvidenceProvenanceRef { evidenceId: Ref; sourceType: string; sourceRef: Ref; actorOrSystemRef: Ref; observationTime?: IsoInstant; effectiveTime?: IsoInstant; receivedTime: IsoInstant; currentness: Currentness; integrityConflictRef?: Ref; payloadOrRecordRef: Ref; provenanceChain: Ref[]; }

export interface DependencyWaitingRecord {
  dependencyId: Ref;
  scopeRef: ScopeRef;
  requiredConditionRef: Ref;
  requiredCapabilityOrAuthorityRef?: Ref;
  sinceTime: IsoInstant;
  agingBasis: string;
  blockedDownstreamEffectRefs: Ref[];
  alternateLawfulPathRefs: Ref[];
  escalationOrCommunicationObligationRefs: Ref[];
  currentness: Currentness;
  evidenceRefs: Ref[];
  provenance: Provenance;
}

export interface HandoverRecord {
  handoverId: Ref;
  responsibilityRef: Ref;
  scopeRef: ScopeRef;
  predecessorRef: Ref;
  intendedSuccessorRef: Ref;
  initiationRef: Ref;
  confirmationConditionRef: Ref;
  effectiveTransferRef?: Ref;
  timeoutFailureRef?: Ref;
  evidenceRefs: Ref[];
  provenance: Provenance;
}

export interface FieldWorkRecord {
  fieldWorkId: Ref;
  scopeRef: ScopeRef;
  assignmentRef?: Ref;
  holderRef?: Ref;
  availabilityRef?: Ref;
  accessRef?: Ref;
  workProgressRef: Ref;
  evidenceRefs: Ref[];
  provenance: Provenance;
  currentness: Currentness;
}
