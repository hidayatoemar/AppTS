import type {
  ActionCommandEnvelope,
  ActionExecutionRecord,
  EvidenceProvenanceRef,
  ScopeRef,
} from "../contracts/ce-di.js";
import type { VerificationClosureEvaluation } from "../contracts/b7.js";
import type { Ref } from "../contracts/ids.js";
import { normalizeCommandEnvelope } from "../persistence/in-memory-store.js";
import type { LocalJsonlStore } from "../persistence/jsonl-store.js";
import { resolveActingContext } from "../runtime/acting-context-resolver.js";
import type { ScopeSnapshot } from "../runtime/runtime-composition.js";
import type { Clock } from "../simulator/clock.js";
import type { IdGenerator } from "../simulator/ids.js";
import {
  HITL_A14_AUTHORITY_REF,
  HITL_A14_MACHINE_REF,
  HITL_ACTIONS,
  HITL_AUTHORITIES,
  type ClosureDecisionIntent,
  type ClosureEligibilityResult,
  type CustomerVerificationIntent,
  type HitlTrial1ActionId,
  type HitlTrial1RuntimeScenario,
  type ServiceVerificationIntent,
  type TrialActionState,
} from "./hitl-trial1-contracts.js";

const RESPONSE_PREFIX = "HITL1";
const A14_COMMAND_PREFIX = "CMD-HITL1-RS-A014-";

export type HitlCommandResult =
  | { kind: "REPLAY"; execution: ActionExecutionRecord; effects: [] }
  | { kind: "REJECTED"; reasons: string[] }
  | { kind: "COMMITTED"; execution: ActionExecutionRecord; effects: []; newVersion: number };

export interface A14Classification {
  ready: boolean;
  result?: ClosureEligibilityResult;
  reasons: string[];
}

export interface A14Identity {
  commandId: string;
  digest: string;
  canonicalBytes: string;
  governingBasisVersion: number;
  envelope: ActionCommandEnvelope;
}

export interface HitlTrial1Runtime {
  execute(envelope: ActionCommandEnvelope): Promise<HitlCommandResult>;
  recoverPendingA14(): Promise<void>;
  readState(snapshot: ScopeSnapshot): TrialActionState;
  classify(snapshot: ScopeSnapshot): A14Classification;
  buildA14Identity(snapshot: ScopeSnapshot): Promise<A14Identity | null>;
}

interface RuntimeDeps {
  repository: LocalJsonlStore;
  scenario: HitlTrial1RuntimeScenario;
  clock: Clock;
  ids: IdGenerator;
}

export function createHitlTrial1Runtime(deps: RuntimeDeps): HitlTrial1Runtime {
  const runtime: HitlTrial1Runtime = {
    execute: async (envelope) => executeHitl(envelope, deps, runtime),
    recoverPendingA14: async () => recoverPendingA14(deps, runtime),
    readState: (snapshot) => readHitlTrialState(snapshot),
    classify: (snapshot) => classifyA14(snapshot, deps.scenario),
    buildA14Identity: async (snapshot) => buildA14Identity(snapshot, deps),
  };
  return runtime;
}

async function executeHitl(
  envelope: ActionCommandEnvelope,
  deps: RuntimeDeps,
  runtime: HitlTrial1Runtime,
): Promise<HitlCommandResult> {
  assertCommonAdmission(envelope, deps.scenario);
  if (!["RS-A-012", "RS-A-013", "RS-A-014", "RS-A-015"].includes(envelope.actionId)) {
    return { kind: "REJECTED", reasons: ["HITL_ACTION_NOT_IMPLEMENTED"] };
  }

  const normalized = normalizeCommandEnvelope(envelope);
  const committed = await deps.repository.findCommand(envelope.commandId);
  if (committed) {
    if (committed.normalizedEnvelope !== normalized) {
      if (envelope.actionId === HITL_ACTIONS.closureEligibility && envelope.commandId.startsWith(A14_COMMAND_PREFIX)) {
        throw new Error("A14_IDENTITY_COLLISION_OR_REPLAY_CONFLICT");
      }
      throw new Error("IMPLEMENTATION_REPLAY_CONFLICT");
    }
    return { kind: "REPLAY", execution: committed.execution, effects: [] };
  }

  const snapshot = await deps.repository.load(envelope.scopeRef);
  if (snapshot.version !== envelope.expectedInputVersion) {
    return { kind: "REJECTED", reasons: ["stale_expected_version"] };
  }

  if (envelope.actionId === HITL_ACTIONS.closureEligibility) {
    return executeA14(envelope, snapshot, deps);
  }

  const actionId = envelope.actionId as "RS-A-012" | "RS-A-013" | "RS-A-015";
  const humanCheck = checkHumanAction(envelope, snapshot, deps.scenario, actionId);
  if (humanCheck.length > 0) return { kind: "REJECTED", reasons: humanCheck };

  const intent = validateHumanIntent(actionId, envelope.payloadRef);
  const responseRef = makeResponseRef(actionId, intent);
  const execution = makeExecution(envelope, responseRef, deps.clock, envelope.requestedByActorOrMachineRef, "RECORDED");
  const nextState = { ...readHitlTrialState(snapshot) };
  if (actionId === HITL_ACTIONS.serviceVerification) nextState.serviceVerification = intent as ServiceVerificationIntent;
  if (actionId === HITL_ACTIONS.customerVerification) nextState.customerVerification = intent as CustomerVerificationIntent;
  if (actionId === HITL_ACTIONS.closureDecision) nextState.closureDecision = intent as ClosureDecisionIntent;

  const commit = await appendHitlCommit(envelope, execution, snapshot, nextState, deps);
  if (actionId === HITL_ACTIONS.serviceVerification || actionId === HITL_ACTIONS.customerVerification) {
    await runtime.recoverPendingA14();
  }
  return { kind: "COMMITTED", execution, effects: [], newVersion: commit.newVersion };
}

async function executeA14(
  envelope: ActionCommandEnvelope,
  snapshot: ScopeSnapshot,
  deps: RuntimeDeps,
): Promise<HitlCommandResult> {
  if (envelope.requestedByActorOrMachineRef !== HITL_A14_MACHINE_REF) {
    return { kind: "REJECTED", reasons: ["A14_MACHINE_ACTOR_MISMATCH"] };
  }
  if (envelope.boundedMachineAuthorityRef !== HITL_A14_AUTHORITY_REF) {
    return { kind: "REJECTED", reasons: ["A14_MACHINE_AUTHORITY_MISMATCH"] };
  }
  if (envelope.actingContextRef !== undefined) {
    return { kind: "REJECTED", reasons: ["A14_HUMAN_CONTEXT_FORBIDDEN"] };
  }

  const identity = await buildA14Identity(snapshot, deps);
  if (!identity) return { kind: "REJECTED", reasons: ["A14_GATE_NOT_READY"] };
  if (identity.commandId !== envelope.commandId || identity.canonicalBytes !== buildIdentityCanonicalBytes(snapshot, deps.scenario, identity.governingBasisVersion)) {
    throw new Error("A14_IDENTITY_COLLISION_OR_REPLAY_CONFLICT");
  }
  const normalized = normalizeCommandEnvelope(envelope);
  if (normalized !== normalizeCommandEnvelope(identity.envelope)) {
    throw new Error("A14_IDENTITY_COLLISION_OR_REPLAY_CONFLICT");
  }

  const classification = classifyA14(snapshot, deps.scenario);
  if (!classification.ready || !classification.result) {
    return { kind: "REJECTED", reasons: classification.reasons.length > 0 ? classification.reasons : ["A14_GATE_NOT_READY"] };
  }

  const responseRef = makeA14ResponseRef(classification.result, identity.digest);
  const execution = makeExecution(envelope, responseRef, deps.clock, HITL_A14_MACHINE_REF, "EVALUATED");
  const nextState = { ...readHitlTrialState(snapshot), closureEligibility: classification.result };
  const commit = await appendHitlCommit(envelope, execution, snapshot, nextState, deps);
  return { kind: "COMMITTED", execution, effects: [], newVersion: commit.newVersion };
}

async function appendHitlCommit(
  envelope: ActionCommandEnvelope,
  execution: ActionExecutionRecord,
  snapshot: ScopeSnapshot,
  state: TrialActionState,
  deps: RuntimeDeps,
): Promise<{ newVersion: number; commitId: Ref }> {
  const evidenceProvenance = determiningEvidence(envelope.evidenceRefs, deps.scenario);
  const evaluation = verificationEvaluation(snapshot, state, deps.scenario);
  return deps.repository.append(snapshot.version, {
    commitId: deps.ids.next("commit"),
    scopeRef: envelope.scopeRef,
    commandReplayIdentity: {
      commandId: envelope.commandId,
      normalizedEnvelope: normalizeCommandEnvelope(envelope),
      execution,
      effects: [],
    },
    actionExecutions: [execution],
    materialEffects: [],
    evidenceProvenance,
    responsibilityHandoverEffects: [],
    dependencyWaitingUpdates: [],
    residualObligationRefs: [...snapshot.residualObligationRefs],
    verificationClosureEffects: [evaluation],
    otherAuthoritativeP01ToP10Records: [],
  });
}

export function readHitlTrialState(snapshot: ScopeSnapshot): TrialActionState {
  const state: TrialActionState = {};
  for (const execution of snapshot.actionExecutions) {
    const parsed = parseResponseRef(execution.responseRef);
    if (!parsed) continue;
    if (parsed.actionId === HITL_ACTIONS.serviceVerification) {
      state.serviceVerification = parsed.value as ServiceVerificationIntent;
    } else if (parsed.actionId === HITL_ACTIONS.customerVerification) {
      state.customerVerification = parsed.value as CustomerVerificationIntent;
    } else if (parsed.actionId === HITL_ACTIONS.closureEligibility) {
      state.closureEligibility = parsed.value as ClosureEligibilityResult;
    } else if (parsed.actionId === HITL_ACTIONS.closureDecision) {
      state.closureDecision = parsed.value as ClosureDecisionIntent;
    }
  }
  return state;
}

export function classifyA14(snapshot: ScopeSnapshot, scenario: HitlTrial1RuntimeScenario): A14Classification {
  const state = readHitlTrialState(snapshot);
  const reasons: string[] = [];
  if (!state.serviceVerification) reasons.push("missing_service_verification");
  if (!scenario.customerVerificationApplicabilityPolicyBasisRef) reasons.push("missing_customer_applicability_policy_basis");
  if (scenario.customerVerificationApplicability === "REQUIRED" && !state.customerVerification) {
    reasons.push("missing_customer_verification");
  }
  if (scenario.evidenceBasis.evidence.length === 0) reasons.push("missing_governing_evidence");
  const residualPolicies = new Map(scenario.residualObligations.map((item) => [item.obligationRef, item]));
  for (const obligationRef of snapshot.residualObligationRefs) {
    if (!residualPolicies.has(obligationRef)) reasons.push(`missing_residual_policy:${obligationRef}`);
  }
  if (reasons.length > 0) return { ready: false, reasons };

  let conflict = false;
  let unknown = false;
  for (const evidence of scenario.evidenceBasis.evidence) {
    const integrity = scenario.evidenceBasis.integrityAssessments.find((item) => item.evidenceId === evidence.evidenceId);
    if (!integrity) return { ready: false, reasons: [`missing_integrity_assessment:${evidence.evidenceId}`] };
    if (evidence.currentness.status === "CONFLICT" || evidence.integrityConflictRef || integrity.assessment.conflict) {
      conflict = true;
    }
    if (
      evidence.currentness.status === "UNKNOWN" ||
      evidence.currentness.status === "STALE" ||
      !integrity.assessment.sufficient
    ) {
      unknown = true;
    }
  }
  if (conflict) return { ready: true, result: "CONFLICT", reasons: [] };
  if (unknown || state.customerVerification === "UNREACHABLE") {
    return { ready: true, result: "UNKNOWN", reasons: [] };
  }

  const negative =
    state.serviceVerification === "VERIFIED_NOT_OK" ||
    (scenario.customerVerificationApplicability === "REQUIRED" && state.customerVerification === "NOT_OK");
  const blocked = snapshot.residualObligationRefs.some((ref) => residualPolicies.get(ref)?.closureBlocking === true);
  if (negative && blocked) throw new Error("A14_CLASSIFICATION_AMBIGUOUS");
  if (negative) return { ready: true, result: "NOT_ELIGIBLE", reasons: [] };
  if (blocked) return { ready: true, result: "BLOCKED", reasons: [] };

  if (state.serviceVerification !== "VERIFIED_OK") throw new Error("A14_CLASSIFICATION_AMBIGUOUS");
  if (
    scenario.customerVerificationApplicability === "REQUIRED" &&
    state.customerVerification !== "CONFIRMED_OK"
  ) {
    throw new Error("A14_CLASSIFICATION_AMBIGUOUS");
  }
  return { ready: true, result: "ELIGIBLE", reasons: [] };
}

export async function buildA14Identity(snapshot: ScopeSnapshot, deps: RuntimeDeps): Promise<A14Identity | null> {
  const classification = classifyA14(snapshot, deps.scenario);
  if (!classification.ready) return null;
  const basis = await governingBasisRecord(deps.repository, deps.scenario);
  if (!basis) return null;
  const canonicalBytes = buildIdentityCanonicalBytes(snapshot, deps.scenario, basis.version);
  const digest = sha256Hex(canonicalBytes);
  const commandId = `${A14_COMMAND_PREFIX}${digest}`;
  const envelope: ActionCommandEnvelope = {
    commandId,
    actionId: HITL_ACTIONS.closureEligibility,
    purposeRef: {
      purpose: "RESTORE_SERVICE",
      situationId: snapshot.scopeRef.situationId,
      compositionInstanceId: deps.scenario.scenarioId,
      startedFromBasisRef: deps.scenario.evidenceBasis.basisRef,
    },
    scopeRef: structuredClone(snapshot.scopeRef),
    requestedByActorOrMachineRef: HITL_A14_MACHINE_REF,
    boundedMachineAuthorityRef: HITL_A14_AUTHORITY_REF,
    expectedInputVersion: basis.version,
    requestTime: basis.time,
    payloadRef: `HITL1:A14-BASIS:${digest}`,
    evidenceRefs: deps.scenario.evidenceBasis.evidence.map((item) => item.evidenceId).sort(),
  };
  return { commandId, digest, canonicalBytes, governingBasisVersion: basis.version, envelope };
}

export function buildIdentityCanonicalBytes(
  snapshot: ScopeSnapshot,
  scenario: HitlTrial1RuntimeScenario,
  governingBasisVersion: number,
): string {
  const state = readHitlTrialState(snapshot);
  const integrityByEvidence = new Map(
    scenario.evidenceBasis.integrityAssessments.map((item) => [item.evidenceId, item.assessment]),
  );
  const governingEvidenceBasis = scenario.evidenceBasis.evidence
    .map((evidence) => {
      const integrity = integrityByEvidence.get(evidence.evidenceId);
      if (!integrity) throw new Error(`HITL_MISSING_INTEGRITY_ASSOCIATION:${evidence.evidenceId}`);
      return {
        evidenceId: evidence.evidenceId,
        payloadOrRecordRef: evidence.payloadOrRecordRef,
        currentnessStatus: evidence.currentness.status,
        currentnessBasisRef: evidence.currentness.basisRef ?? null,
        evidenceIntegrityConflictRef: evidence.integrityConflictRef ?? null,
        integritySufficient: integrity.sufficient,
        integrityConflict: integrity.conflict,
        integrityEvidenceRefs: [...integrity.evidenceRefs].sort(),
      };
    })
    .sort((a, b) =>
      a.evidenceId.localeCompare(b.evidenceId) || a.payloadOrRecordRef.localeCompare(b.payloadOrRecordRef),
    );

  const residualPolicy = new Map(scenario.residualObligations.map((item) => [item.obligationRef, item]));
  const residualObligationBasis = snapshot.residualObligationRefs
    .map((obligationRef) => {
      const policy = residualPolicy.get(obligationRef);
      if (!policy) throw new Error(`HITL_RESIDUAL_POLICY_MISSING:${obligationRef}`);
      return {
        obligationRef,
        closureBlocking: policy.closureBlocking,
        policyBasisRef: policy.policyBasisRef,
      };
    })
    .sort((a, b) => a.obligationRef.localeCompare(b.obligationRef) || a.policyBasisRef.localeCompare(b.policyBasisRef));

  const scope = {
    situationId: snapshot.scopeRef.situationId,
    subjectType: snapshot.scopeRef.subjectType,
    subjectId: snapshot.scopeRef.subjectId,
    parentScopeRef: snapshot.scopeRef.parentScopeRef ?? null,
    relationRef: snapshot.scopeRef.relationRef ?? null,
  };

  return JSON.stringify({
    trialId: scenario.trialId,
    scenarioId: scenario.scenarioId,
    scope,
    governingBasisVersion,
    serviceVerificationRef: state.serviceVerification ? makeResponseRef("RS-A-012", state.serviceVerification) : null,
    customerVerificationApplicability: scenario.customerVerificationApplicability,
    customerVerificationApplicabilityPolicyBasisRef: scenario.customerVerificationApplicabilityPolicyBasisRef,
    customerVerificationRef: state.customerVerification ? makeResponseRef("RS-A-013", state.customerVerification) : null,
    evidenceBasisRef: scenario.evidenceBasis.basisRef,
    governingPolicyBasisRefs: [...scenario.evidenceBasis.policyBasisRefs].sort(),
    governingEvidenceBasis,
    residualObligationBasis,
  });
}

async function recoverPendingA14(deps: RuntimeDeps, runtime: HitlTrial1Runtime): Promise<void> {
  const scopeRef = deps.scenario.scopeBaseline.scopeRef;
  const snapshot = await deps.repository.load(scopeRef);
  const classification = classifyA14(snapshot, deps.scenario);
  if (!classification.ready) return;
  const identity = await runtime.buildA14Identity(snapshot);
  if (!identity) return;

  const existing = await deps.repository.findCommand(identity.commandId);
  if (existing) {
    if (existing.normalizedEnvelope !== normalizeCommandEnvelope(identity.envelope)) {
      throw new Error("A14_IDENTITY_COLLISION_OR_REPLAY_CONFLICT");
    }
    return;
  }
  if (snapshot.version !== identity.governingBasisVersion) {
    throw new Error("A14_PENDING_BASIS_NOT_CURRENT");
  }
  await runtime.execute(identity.envelope);
}

async function governingBasisRecord(
  repository: LocalJsonlStore,
  scenario: HitlTrial1RuntimeScenario,
): Promise<{ version: number; time: string } | null> {
  const recovery = await repository.recoverRecords(scenario.scopeBaseline.scopeRef);
  let selected: { version: number; time: string } | null = null;
  for (const record of recovery.records) {
    for (const execution of record.batch.actionExecutions) {
      const parsed = parseResponseRef(execution.responseRef);
      if (!parsed) continue;
      if (
        parsed.actionId === HITL_ACTIONS.serviceVerification ||
        parsed.actionId === HITL_ACTIONS.customerVerification
      ) {
        selected = { version: record.version, time: execution.executionTime };
      }
    }
  }
  return selected;
}

function checkHumanAction(
  envelope: ActionCommandEnvelope,
  snapshot: ScopeSnapshot,
  scenario: HitlTrial1RuntimeScenario,
  actionId: "RS-A-012" | "RS-A-013" | "RS-A-015",
): string[] {
  const reasons: string[] = [];
  const requiredAuthorityRef = HITL_AUTHORITIES[actionId];
  const binding = scenario.actingContexts.find(
    (item) => item.actionId === actionId && item.actingContextRef === envelope.actingContextRef,
  );
  if (!binding) reasons.push("selected_acting_context_not_admitted");
  if (binding && binding.requiredAuthorityRef !== requiredAuthorityRef) reasons.push("authority_binding_mismatch");
  if (envelope.requestedByActorOrMachineRef !== scenario.personRef) reasons.push("single_human_identity_mismatch");
  if (envelope.boundedMachineAuthorityRef !== undefined) reasons.push("human_action_machine_authority_forbidden");
  if (!evidenceBasisSufficient(scenario)) reasons.push("governing_evidence_not_current_or_integrity_sufficient");
  if (snapshot.dependencyRefs.length > 0) reasons.push("dependency_unsatisfied");

  if (binding) {
    const resolution = resolveActingContext({
      scopeRef: envelope.scopeRef,
      requiredAuthorityRef,
      responsibility: snapshot.responsibility,
      candidates: [binding.candidate],
      allowStale: false,
    });
    if (resolution.kind !== "EXACT_ONE") reasons.push("acting_context_not_exact_one");
  }

  const state = readHitlTrialState(snapshot);
  if (actionId === HITL_ACTIONS.serviceVerification) {
    if (!snapshot.materialEffects.some((effect) => effect.materialEffectEstablished)) reasons.push("material_effect_not_established");
  }
  if (actionId === HITL_ACTIONS.customerVerification) {
    if (scenario.customerVerificationApplicability !== "REQUIRED") reasons.push("customer_verification_not_required");
    if (state.serviceVerification !== "VERIFIED_OK") reasons.push("service_verification_not_ok");
  }
  if (actionId === HITL_ACTIONS.closureDecision) {
    if (state.closureEligibility !== "ELIGIBLE") reasons.push("closure_not_eligible");
    if (hasClosureBlocker(snapshot, scenario)) reasons.push("closure_blocker_present");
  }
  return reasons;
}

function validateHumanIntent(
  actionId: "RS-A-012" | "RS-A-013" | "RS-A-015",
  payloadRef: Ref | undefined,
): ServiceVerificationIntent | CustomerVerificationIntent | ClosureDecisionIntent {
  if (!payloadRef) throw new Error("HITL_INTENT_REQUIRED");
  if (actionId === HITL_ACTIONS.serviceVerification && ["VERIFIED_OK", "VERIFIED_NOT_OK"].includes(payloadRef)) {
    return payloadRef as ServiceVerificationIntent;
  }
  if (actionId === HITL_ACTIONS.customerVerification && ["CONFIRMED_OK", "NOT_OK", "UNREACHABLE"].includes(payloadRef)) {
    return payloadRef as CustomerVerificationIntent;
  }
  if (actionId === HITL_ACTIONS.closureDecision && ["CLOSED", "NOT_CLOSED"].includes(payloadRef)) {
    return payloadRef as ClosureDecisionIntent;
  }
  throw new Error("HITL_INTENT_NOT_ADMITTED");
}

function evidenceBasisSufficient(scenario: HitlTrial1RuntimeScenario): boolean {
  for (const evidence of scenario.evidenceBasis.evidence) {
    const integrity = scenario.evidenceBasis.integrityAssessments.find((item) => item.evidenceId === evidence.evidenceId);
    if (!integrity) return false;
    if (evidence.currentness.status !== "CURRENT") return false;
    if (evidence.integrityConflictRef) return false;
    if (!integrity.assessment.sufficient || integrity.assessment.conflict) return false;
  }
  return true;
}

function hasClosureBlocker(snapshot: ScopeSnapshot, scenario: HitlTrial1RuntimeScenario): boolean {
  const policies = new Map(scenario.residualObligations.map((item) => [item.obligationRef, item]));
  return snapshot.residualObligationRefs.some((ref) => policies.get(ref)?.closureBlocking === true);
}

function determiningEvidence(evidenceRefs: readonly Ref[], scenario: HitlTrial1RuntimeScenario): EvidenceProvenanceRef[] {
  const byId = new Map(scenario.evidenceBasis.evidence.map((item) => [item.evidenceId, item]));
  return evidenceRefs.map((ref) => {
    const evidence = byId.get(ref);
    if (!evidence) throw new Error(`HITL_EVIDENCE_REF_NOT_ADMITTED:${ref}`);
    return structuredClone(evidence);
  });
}

function verificationEvaluation(
  snapshot: ScopeSnapshot,
  state: TrialActionState,
  scenario: HitlTrial1RuntimeScenario,
): VerificationClosureEvaluation {
  const materialEstablished = snapshot.materialEffects.some((effect) => effect.materialEffectEstablished);
  return {
    scopeRef: structuredClone(snapshot.scopeRef),
    workCompleted: materialEstablished,
    materialRestorationEstablished: materialEstablished,
    serviceVerified: state.serviceVerification === "VERIFIED_OK",
    customerVerified:
      scenario.customerVerificationApplicability === "REQUIRED" && state.customerVerification === "CONFIRMED_OK",
    closureEligible: state.closureEligibility === "ELIGIBLE",
    closureDecisionAuthorized: state.closureEligibility === "ELIGIBLE",
    residualObligationRefs: [...snapshot.residualObligationRefs],
    prohibitedInferences: [
      "execution_does_not_establish_material_effect",
      "material_effect_does_not_establish_service_verification",
      "service_verification_does_not_establish_customer_verification",
      "customer_verification_does_not_establish_closure_eligibility",
      "closure_eligibility_does_not_establish_closure_decision",
    ],
  };
}

function makeExecution(
  envelope: ActionCommandEnvelope,
  responseRef: Ref,
  clock: Clock,
  executorRef: Ref,
  executionResult: string,
): ActionExecutionRecord {
  return {
    commandId: envelope.commandId,
    accepted: true,
    executionAttempted: true,
    executionResult,
    executorRef,
    executionTime: clock.now(),
    responseRef,
    evidenceRefs: [...envelope.evidenceRefs],
    provenance: { sourceRefs: [...envelope.evidenceRefs], chainRefs: [] },
    uncertaintyFlag: false,
  };
}

function makeResponseRef(actionId: string, value: string): string {
  return `${RESPONSE_PREFIX}:${actionId}:${value}`;
}

function makeA14ResponseRef(result: ClosureEligibilityResult, digest: string): string {
  return `${RESPONSE_PREFIX}:RS-A-014:${result}:${digest}`;
}

function parseResponseRef(responseRef: string | undefined): { actionId: HitlTrial1ActionId; value: string } | null {
  if (!responseRef) return null;
  const parts = responseRef.split(":");
  if (parts.length < 3 || parts[0] !== RESPONSE_PREFIX) return null;
  const actionId = parts[1] as HitlTrial1ActionId;
  if (!Object.values(HITL_ACTIONS).includes(actionId)) return null;
  return { actionId, value: parts[2] };
}

function assertCommonAdmission(envelope: ActionCommandEnvelope, scenario: HitlTrial1RuntimeScenario): void {
  if (envelope.purposeRef.purpose !== "RESTORE_SERVICE") throw new Error("HITL_PURPOSE_NOT_ADMITTED");
  if (scopeIdentity(envelope.scopeRef) !== scopeIdentity(scenario.scopeBaseline.scopeRef)) {
    throw new Error("HITL_SCOPE_NOT_ADMITTED");
  }
}

function scopeIdentity(scope: ScopeRef): string {
  return [scope.situationId, scope.subjectType, scope.subjectId, scope.parentScopeRef ?? "", scope.relationRef ?? ""].join("|");
}

export function sha256Hex(input: string): string {
  const bytes = new TextEncoder().encode(input);
  const bitLength = bytes.length * 8;
  const paddedLength = (((bytes.length + 9 + 63) >> 6) << 6);
  const data = new Uint8Array(paddedLength);
  data.set(bytes);
  data[bytes.length] = 0x80;
  const view = new DataView(data.buffer);
  const high = Math.floor(bitLength / 0x100000000);
  const low = bitLength >>> 0;
  view.setUint32(paddedLength - 8, high, false);
  view.setUint32(paddedLength - 4, low, false);

  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const k = new Uint32Array([
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
  ]);
  const w = new Uint32Array(64);
  const rotr = (x: number, n: number): number => (x >>> n) | (x << (32 - n));

  for (let offset = 0; offset < data.length; offset += 64) {
    for (let i = 0; i < 16; i += 1) w[i] = view.getUint32(offset + i * 4, false);
    for (let i = 16; i < 64; i += 1) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a,b,c,d,e,f,g,hh] = Array.from(h);
    for (let i = 0; i < 64; i += 1) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (hh + s1 + ch + k[i] + w[i]) >>> 0;
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) >>> 0;
      hh = g; g = f; f = e; e = (d + temp1) >>> 0;
      d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
    }
    h[0]=(h[0]+a)>>>0; h[1]=(h[1]+b)>>>0; h[2]=(h[2]+c)>>>0; h[3]=(h[3]+d)>>>0;
    h[4]=(h[4]+e)>>>0; h[5]=(h[5]+f)>>>0; h[6]=(h[6]+g)>>>0; h[7]=(h[7]+hh)>>>0;
  }
  return Array.from(h).map((value) => value.toString(16).padStart(8, "0")).join("");
}
