import type {
  ActionExecutionRecord,
  ActingContextCandidate,
  ActingContextResolution,
  Currentness,
  EvidenceProvenanceRef,
  IntegrityAssessment,
  LawfulActionProjection,
  MaterialEffectRecord,
  ResponsibilityContext,
  ScopeRef,
} from "../contracts/ce-di.js";
import type { Ref } from "../contracts/ids.js";
import type { GateEnableEvaluation } from "../contracts/results.js";
import type { VerificationClosureEvaluation } from "../contracts/b7.js";
import type { ScopeSnapshot } from "../runtime/runtime-composition.js";

export const HITL_RUNTIME_PROFILE = "HITL_TRIAL1_LOCAL_ONLY" as const;
export const HITL_SCENARIO_PATH = "/etc/appts-restore-service/hitl-trial1-scenario.json" as const;

export const HITL_ACTIONS = Object.freeze({
  recovery: "RS-A-022",
  serviceVerification: "RS-A-012",
  customerVerification: "RS-A-013",
  closureEligibility: "RS-A-014",
  closureDecision: "RS-A-015",
} as const);

export const HITL_AUTHORITIES = Object.freeze({
  "RS-A-022": "AUTH-RS-A022",
  "RS-A-012": "AUTH-HITL1-RS-A012",
  "RS-A-013": "AUTH-HITL1-RS-A013",
  "RS-A-015": "AUTH-HITL1-RS-A015",
} as const);

export const HITL_A14_MACHINE_REF = "MACHINE-HITL1-RS-A014" as const;
export const HITL_A14_AUTHORITY_REF = "BMA-HITL1-RS-A014" as const;

export type HitlTrial1HumanActionId = "RS-A-022" | "RS-A-012" | "RS-A-013" | "RS-A-015";
export type HitlTrial1ActionId = HitlTrial1HumanActionId | "RS-A-014";
export type CustomerVerificationApplicability = "REQUIRED" | "NOT_REQUIRED";
export type ServiceVerificationIntent = "VERIFIED_OK" | "VERIFIED_NOT_OK";
export type CustomerVerificationIntent = "CONFIRMED_OK" | "NOT_OK" | "UNREACHABLE";
export type ClosureEligibilityResult = "ELIGIBLE" | "NOT_ELIGIBLE" | "BLOCKED" | "UNKNOWN" | "CONFLICT";
export type ClosureDecisionIntent = "CLOSED" | "NOT_CLOSED";

export interface HitlTrial1ActingContextBinding {
  actingContextRef: Ref;
  actionId: HitlTrial1HumanActionId;
  requiredAuthorityRef: Ref;
  candidate: ActingContextCandidate;
}

export interface HitlTrial1EvidenceBasis {
  basisRef: Ref;
  evidence: readonly EvidenceProvenanceRef[];
  integrityAssessments: readonly {
    evidenceId: Ref;
    assessment: IntegrityAssessment;
  }[];
  policyBasisRefs: readonly Ref[];
}

export interface HitlTrial1ResidualObligationPolicy {
  obligationRef: Ref;
  closureBlocking: boolean;
  policyBasisRef: Ref;
}

export interface HitlTrial1RuntimeScenario {
  schemaVersion: "HITL1-RUNTIME-1";
  syntheticTrial: true;
  trialId: Ref;
  scenarioId: Ref;
  scopeBaseline: ScopeSnapshot;
  personRef: Ref;
  responsibilityRef: Ref;
  actingContexts: readonly HitlTrial1ActingContextBinding[];
  initialActiveActingContextRef: Ref;
  evidenceBasis: HitlTrial1EvidenceBasis;
  customerVerificationApplicability: CustomerVerificationApplicability;
  customerVerificationApplicabilityPolicyBasisRef: Ref;
  residualObligations: readonly HitlTrial1ResidualObligationPolicy[];
}

export interface TrialActionProjection {
  actionId: HitlTrial1HumanActionId;
  mode: "HUMAN_ONLY";
  requiredAuthorityRef: Ref;
  gateEnable: GateEnableEvaluation;
  projection: LawfulActionProjection;
  selectedActingContextRef?: Ref;
  selectedContextMatchesRequiredBinding: boolean;
  allowedIntentRefs: readonly Ref[];
  blockedReasons: readonly string[];
}

export interface TrialMachineActionProjection {
  actionId: "RS-A-014";
  mode: "DETERMINISTIC_MACHINE";
  boundedMachineAuthorityRef: typeof HITL_A14_AUTHORITY_REF;
  gateEnable: GateEnableEvaluation;
  projection: LawfulActionProjection;
  governingBasisVersion?: number;
  governingBasisDigest?: string;
  pendingRequiredIssuance: boolean;
  committedEligibilityRef?: Ref;
  blockedReasons: readonly string[];
}

export interface ExpectedActionAvailability {
  stepRef: Ref;
  actionId: HitlTrial1ActionId;
  expectedAvailable: boolean;
  expectedGateReadiness?: GateEnableEvaluation["gateReadiness"];
  expectedEnableState?: GateEnableEvaluation["enableState"];
  expectedSelectedActingContextRef?: Ref;
  expectedBlockedReasonRefs?: readonly Ref[];
}

export interface TrialCommandResponseProjection {
  commandId?: Ref;
  httpStatus: number;
  resultKind?: "REJECTED" | "COMMITTED" | "REPLAY";
  actionExecutionRef?: Ref;
  responseRef?: Ref;
  materialEffectRefs: readonly Ref[];
  transportErrorClass?: string;
}

export interface TrialActionState {
  serviceVerification?: ServiceVerificationIntent;
  customerVerification?: CustomerVerificationIntent;
  closureEligibility?: ClosureEligibilityResult;
  closureDecision?: ClosureDecisionIntent;
}

export interface TrialOperatorViewDTO {
  infrastructure: {
    ready: boolean;
    syntheticTrial: true;
    loopbackOnly: true;
  };
  trial: {
    trialId: Ref;
    scenarioId: Ref;
    personRef: Ref;
  };
  scope: {
    purpose: "RESTORE_SERVICE";
    scopeRef: ScopeRef;
    version: number;
  };
  responsibility: ResponsibilityContext;
  roleContexts: readonly {
    actingContextRef: Ref;
    roleRef: Ref;
    assignmentRef: Ref;
    authorityBasisRef: Ref;
    selected: boolean;
  }[];
  selectedActingContext: ActingContextResolution;
  evidence: {
    evidenceRefs: readonly Ref[];
    currentness: readonly Currentness[];
    integrity: readonly IntegrityAssessment[];
  };
  dependencies: readonly Ref[];
  residualObligations: readonly {
    obligationRef: Ref;
    closureBlocking: boolean | null;
    policyBasisRef?: Ref;
  }[];
  actions: {
    "RS-A-022": TrialActionProjection;
    "RS-A-012": TrialActionProjection;
    "RS-A-013": TrialActionProjection;
    "RS-A-014": TrialMachineActionProjection;
    "RS-A-015": TrialActionProjection;
  };
  latest: {
    execution?: ActionExecutionRecord;
    materialEffects: readonly MaterialEffectRecord[];
    verificationClosure?: VerificationClosureEvaluation;
  };
  verification: {
    serviceVerificationRef?: Ref;
    customerVerificationApplicability: CustomerVerificationApplicability;
    customerVerificationRef?: Ref;
    closureEligibilityRef?: Ref;
    closureDecisionRef?: Ref;
  };
  warnings: readonly string[];
}

export function validateHitlTrial1ScenarioObject(value: unknown): HitlTrial1RuntimeScenario {
  const record = asRecord(value, "INVALID_HITL_SCENARIO");
  assertExactKeys(record, [
    "schemaVersion",
    "syntheticTrial",
    "trialId",
    "scenarioId",
    "scopeBaseline",
    "personRef",
    "responsibilityRef",
    "actingContexts",
    "initialActiveActingContextRef",
    "evidenceBasis",
    "customerVerificationApplicability",
    "customerVerificationApplicabilityPolicyBasisRef",
    "residualObligations",
  ]);
  if (record.schemaVersion !== "HITL1-RUNTIME-1") throw new Error("INVALID_HITL_SCHEMA_VERSION");
  if (record.syntheticTrial !== true) throw new Error("HITL_SYNTHETIC_TRIAL_REQUIRED");
  const trialId = nonEmpty(record.trialId, "INVALID_HITL_TRIAL_ID");
  const scenarioId = nonEmpty(record.scenarioId, "INVALID_HITL_SCENARIO_ID");
  const personRef = nonEmpty(record.personRef, "INVALID_HITL_PERSON_REF");
  const responsibilityRef = nonEmpty(record.responsibilityRef, "INVALID_HITL_RESPONSIBILITY_REF");
  const initialActiveActingContextRef = nonEmpty(record.initialActiveActingContextRef, "INVALID_HITL_INITIAL_CONTEXT_REF");
  const policyBasisRef = nonEmpty(
    record.customerVerificationApplicabilityPolicyBasisRef,
    "CUSTOMER_VERIFICATION_APPLICABILITY_POLICY_BASIS_REQUIRED",
  );
  if (record.customerVerificationApplicability !== "REQUIRED" && record.customerVerificationApplicability !== "NOT_REQUIRED") {
    throw new Error("INVALID_CUSTOMER_VERIFICATION_APPLICABILITY");
  }

  const scopeBaseline = validateScopeBaseline(record.scopeBaseline, personRef, responsibilityRef);
  const actingContexts = validateActingContexts(
    record.actingContexts,
    personRef,
    responsibilityRef,
    scopeBaseline.scopeRef,
  );
  if (!actingContexts.some((binding) => binding.actingContextRef === initialActiveActingContextRef)) {
    throw new Error("HITL_INITIAL_CONTEXT_NOT_ADMITTED");
  }

  const evidenceBasis = validateEvidenceBasis(record.evidenceBasis);
  const residualObligations = validateResidualPolicies(record.residualObligations);
  const residualPolicyRefs = new Set(residualObligations.map((item) => item.obligationRef));
  for (const obligationRef of scopeBaseline.residualObligationRefs) {
    if (!residualPolicyRefs.has(obligationRef)) throw new Error("HITL_RESIDUAL_POLICY_MISSING");
  }

  const candidateRefs = new Set(scopeBaseline.actingContextCandidates.map((candidate) => candidate.contextRef));
  for (const binding of actingContexts) {
    if (!candidateRefs.has(binding.candidate.contextRef)) throw new Error("HITL_CONTEXT_NOT_IN_SCOPE_BASELINE");
  }

  return {
    schemaVersion: "HITL1-RUNTIME-1",
    syntheticTrial: true,
    trialId,
    scenarioId,
    scopeBaseline,
    personRef,
    responsibilityRef,
    actingContexts,
    initialActiveActingContextRef,
    evidenceBasis,
    customerVerificationApplicability: record.customerVerificationApplicability,
    customerVerificationApplicabilityPolicyBasisRef: policyBasisRef,
    residualObligations,
  };
}

function validateScopeBaseline(value: unknown, personRef: string, responsibilityRef: string): ScopeSnapshot {
  const record = asRecord(value, "INVALID_HITL_SCOPE_BASELINE");
  if (record.version !== 0) throw new Error("HITL_SCOPE_BASELINE_VERSION_MUST_BE_ZERO");
  const scopeRef = asRecord(record.scopeRef, "INVALID_HITL_SCOPE_REF");
  if (scopeRef.subjectType !== "SERVICE") throw new Error("HITL_SERVICE_SCOPE_ONLY");
  const responsibility = asRecord(record.responsibility, "INVALID_HITL_RESPONSIBILITY");
  if (responsibility.responsibilityRef !== responsibilityRef) throw new Error("HITL_RESPONSIBILITY_REF_MISMATCH");
  if (responsibility.holderPersonRef !== personRef) throw new Error("HITL_RESPONSIBILITY_PERSON_MISMATCH");
  if (!Array.isArray(record.actingContextCandidates) || record.actingContextCandidates.length === 0) {
    throw new Error("HITL_ACTING_CONTEXT_CANDIDATES_REQUIRED");
  }
  for (const key of [
    "actionExecutions",
    "materialEffects",
    "evidenceProvenance",
    "responsibilityHandoverEffects",
    "dependencyWaitingUpdates",
    "verificationClosureEffects",
    "otherAuthoritativeP01ToP10Records",
  ]) {
    if (!Array.isArray(record[key]) || record[key].length !== 0) throw new Error(`HITL_BASELINE_HISTORY_FORBIDDEN:${key}`);
  }
  return structuredClone(value) as ScopeSnapshot;
}

function validateActingContexts(
  value: unknown,
  personRef: string,
  responsibilityRef: string,
  scopeRef: ScopeRef,
): HitlTrial1ActingContextBinding[] {
  if (!Array.isArray(value)) throw new Error("INVALID_HITL_ACTING_CONTEXT_BINDINGS");
  const bindings = value.map((entry) => {
    const record = asRecord(entry, "INVALID_HITL_ACTING_CONTEXT_BINDING");
    assertExactKeys(record, ["actingContextRef", "actionId", "requiredAuthorityRef", "candidate"]);
    const actionId = nonEmpty(record.actionId, "INVALID_HITL_ACTION_ID") as HitlTrial1HumanActionId;
    const expectedAuthority = HITL_AUTHORITIES[actionId];
    if (!expectedAuthority) throw new Error("HITL_ACTION_NOT_ADMITTED");
    const requiredAuthorityRef = nonEmpty(record.requiredAuthorityRef, "INVALID_HITL_AUTHORITY_REF");
    if (requiredAuthorityRef !== expectedAuthority) throw new Error("HITL_AUTHORITY_BINDING_MISMATCH");
    const candidate = structuredClone(record.candidate) as ActingContextCandidate;
    if (!candidate || typeof candidate !== "object") throw new Error("INVALID_HITL_ACTING_CONTEXT_CANDIDATE");
    if (candidate.personRef !== personRef) throw new Error("HITL_SINGLE_PERSON_VIOLATION");
    if (candidate.responsibilityRef !== responsibilityRef) throw new Error("HITL_CONTEXT_RESPONSIBILITY_MISMATCH");
    if (candidate.contextRef !== record.actingContextRef) throw new Error("HITL_CONTEXT_REF_MISMATCH");
    if (candidate.authorityBasisRef !== requiredAuthorityRef) throw new Error("HITL_CONTEXT_AUTHORITY_MISMATCH");
    if (scopeIdentity(candidate.scopeRef) !== scopeIdentity(scopeRef)) throw new Error("HITL_CONTEXT_SCOPE_MISMATCH");
    return {
      actingContextRef: nonEmpty(record.actingContextRef, "INVALID_HITL_CONTEXT_REF"),
      actionId,
      requiredAuthorityRef,
      candidate,
    };
  });
  const required: HitlTrial1HumanActionId[] = ["RS-A-022", "RS-A-012", "RS-A-013", "RS-A-015"];
  for (const actionId of required) {
    if (bindings.filter((binding) => binding.actionId === actionId).length !== 1) {
      throw new Error(`HITL_CONTEXT_BINDING_CARDINALITY:${actionId}`);
    }
  }
  return bindings;
}

function validateEvidenceBasis(value: unknown): HitlTrial1EvidenceBasis {
  const record = asRecord(value, "INVALID_HITL_EVIDENCE_BASIS");
  assertExactKeys(record, ["basisRef", "evidence", "integrityAssessments", "policyBasisRefs"]);
  const basisRef = nonEmpty(record.basisRef, "INVALID_HITL_EVIDENCE_BASIS_REF");
  if (!Array.isArray(record.evidence) || record.evidence.length === 0) throw new Error("HITL_EVIDENCE_REQUIRED");
  if (!Array.isArray(record.integrityAssessments)) throw new Error("HITL_INTEGRITY_ASSESSMENTS_REQUIRED");
  if (!Array.isArray(record.policyBasisRefs)) throw new Error("HITL_POLICY_BASIS_REFS_REQUIRED");
  const evidence = structuredClone(record.evidence) as EvidenceProvenanceRef[];
  const evidenceIds = new Set(evidence.map((item) => item.evidenceId));
  if (evidenceIds.size !== evidence.length || evidence.some((item) => !item.evidenceId || !item.payloadOrRecordRef)) {
    throw new Error("HITL_EVIDENCE_IDENTITY_INVALID");
  }
  const integrityAssessments = record.integrityAssessments.map((entry) => {
    const item = asRecord(entry, "INVALID_HITL_INTEGRITY_ASSOCIATION");
    assertExactKeys(item, ["evidenceId", "assessment"]);
    const evidenceId = nonEmpty(item.evidenceId, "INVALID_HITL_INTEGRITY_EVIDENCE_ID");
    if (!evidenceIds.has(evidenceId)) throw new Error("HITL_ORPHAN_INTEGRITY_ASSOCIATION");
    return { evidenceId, assessment: structuredClone(item.assessment) as IntegrityAssessment };
  });
  if (new Set(integrityAssessments.map((item) => item.evidenceId)).size !== integrityAssessments.length) {
    throw new Error("HITL_DUPLICATE_INTEGRITY_ASSOCIATION");
  }
  for (const evidenceId of evidenceIds) {
    if (!integrityAssessments.some((item) => item.evidenceId === evidenceId)) {
      throw new Error("HITL_MISSING_INTEGRITY_ASSOCIATION");
    }
  }
  const policyBasisRefs = record.policyBasisRefs.map((item) => nonEmpty(item, "INVALID_HITL_POLICY_BASIS_REF"));
  return { basisRef, evidence, integrityAssessments, policyBasisRefs };
}

function validateResidualPolicies(value: unknown): HitlTrial1ResidualObligationPolicy[] {
  if (!Array.isArray(value)) throw new Error("INVALID_HITL_RESIDUAL_POLICIES");
  const result = value.map((entry) => {
    const record = asRecord(entry, "INVALID_HITL_RESIDUAL_POLICY");
    assertExactKeys(record, ["obligationRef", "closureBlocking", "policyBasisRef"]);
    if (typeof record.closureBlocking !== "boolean") throw new Error("INVALID_HITL_CLOSURE_BLOCKING");
    return {
      obligationRef: nonEmpty(record.obligationRef, "INVALID_HITL_OBLIGATION_REF"),
      closureBlocking: record.closureBlocking,
      policyBasisRef: nonEmpty(record.policyBasisRef, "INVALID_HITL_OBLIGATION_POLICY_REF"),
    };
  });
  if (new Set(result.map((item) => item.obligationRef)).size !== result.length) {
    throw new Error("HITL_DUPLICATE_RESIDUAL_POLICY");
  }
  return result;
}

function scopeIdentity(scope: ScopeRef): string {
  return [scope.situationId, scope.subjectType, scope.subjectId, scope.parentScopeRef ?? "", scope.relationRef ?? ""].join("|");
}

function asRecord(value: unknown, code: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(code);
  return value as Record<string, unknown>;
}

function nonEmpty(value: unknown, code: string): string {
  if (typeof value !== "string" || value.length === 0) throw new Error(code);
  return value;
}

function assertExactKeys(record: Record<string, unknown>, required: readonly string[]): void {
  const allowed = new Set(required);
  for (const key of required) if (!(key in record)) throw new Error(`MISSING_REQUIRED_FIELD:${key}`);
  for (const key of Object.keys(record)) if (!allowed.has(key)) throw new Error(`FORBIDDEN_OR_UNKNOWN_FIELD:${key}`);
}
