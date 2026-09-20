import type { ActingContextResolution, LawfulActionProjection } from "../contracts/ce-di.js";
import type { GateEnableEvaluation } from "../contracts/results.js";
import { resolveActingContext } from "../runtime/acting-context-resolver.js";
import { scopeKey } from "../runtime/runtime-composition.js";
import type { LocalJsonlStore } from "../persistence/jsonl-store.js";
import {
  HITL_A14_AUTHORITY_REF,
  HITL_ACTIONS,
  HITL_AUTHORITIES,
  type HitlTrial1HumanActionId,
  type HitlTrial1RuntimeScenario,
  type TrialActionProjection,
  type TrialMachineActionProjection,
  type TrialOperatorViewDTO,
} from "./hitl-trial1-contracts.js";
import { classifyA14, readHitlTrialState } from "./hitl-trial1-runtime.js";

export async function buildTrialOperatorView(
  repository: LocalJsonlStore,
  scenario: HitlTrial1RuntimeScenario,
  selectedActingContextRef?: string,
  ready = true,
): Promise<TrialOperatorViewDTO> {
  const snapshot = await repository.load(scenario.scopeBaseline.scopeRef);
  const selectedRef = selectedActingContextRef ?? scenario.initialActiveActingContextRef;
  const state = readHitlTrialState(snapshot);
  const evidenceCurrentness = scenario.evidenceBasis.evidence.map((item) => structuredClone(item.currentness));
  const evidenceIntegrity = scenario.evidenceBasis.integrityAssessments.map((item) => structuredClone(item.assessment));
  const residualPolicy = new Map(scenario.residualObligations.map((item) => [item.obligationRef, item]));

  const recovery = humanProjection(
    "RS-A-022",
    selectedRef,
    scenario,
    snapshot,
    snapshot.materialEffects.length === 0,
    [],
  );
  const service = humanProjection(
    "RS-A-012",
    selectedRef,
    scenario,
    snapshot,
    snapshot.materialEffects.some((effect) => effect.materialEffectEstablished),
    ["material_effect_not_established"],
  );
  const customer = humanProjection(
    "RS-A-013",
    selectedRef,
    scenario,
    snapshot,
    scenario.customerVerificationApplicability === "REQUIRED" && state.serviceVerification === "VERIFIED_OK",
    scenario.customerVerificationApplicability !== "REQUIRED"
      ? ["customer_verification_not_required"]
      : ["service_verification_not_ok"],
  );
  const closure = humanProjection(
    "RS-A-015",
    selectedRef,
    scenario,
    snapshot,
    state.closureEligibility === "ELIGIBLE" &&
      !snapshot.residualObligationRefs.some((ref) => residualPolicy.get(ref)?.closureBlocking === true),
    state.closureEligibility !== "ELIGIBLE" ? ["closure_not_eligible"] : ["closure_blocker_present"],
  );

  const classification = classifyA14(snapshot, scenario);
  const machineGate = gateEvaluation(
    snapshot,
    HITL_ACTIONS.closureEligibility,
    classification.ready ? "READY" : "NOT_READY",
    "NOT_REQUIRED",
    classification.reasons,
  );
  const machineProjection: LawfulActionProjection = {
    scopeRef: structuredClone(snapshot.scopeRef),
    actionId: HITL_ACTIONS.closureEligibility,
    available: classification.ready,
    blockedReasons: [...classification.reasons],
    requiredContextRefs: [],
    requiredDependencyRefs: [...snapshot.dependencyRefs],
    gateEnableRef: `${HITL_ACTIONS.closureEligibility}@${snapshot.version}`,
  };
  const machine: TrialMachineActionProjection = {
    actionId: "RS-A-014",
    mode: "DETERMINISTIC_MACHINE",
    boundedMachineAuthorityRef: HITL_A14_AUTHORITY_REF,
    gateEnable: machineGate,
    projection: machineProjection,
    pendingRequiredIssuance: classification.ready && state.closureEligibility === undefined,
    ...(state.closureEligibility === undefined
      ? {}
      : { committedEligibilityRef: responseRef("RS-A-014", state.closureEligibility) }),
    blockedReasons: [...classification.reasons],
  };

  const selectedBinding = scenario.actingContexts.find((item) => item.actingContextRef === selectedRef);
  const selectedResolution = selectedBinding
    ? resolveSelected(selectedBinding.actionId, selectedRef, scenario, snapshot)
    : ({ kind: "NONE", reason: "selected_context_not_admitted", evidenceRefs: [] } satisfies ActingContextResolution);

  return {
    infrastructure: { ready, syntheticTrial: true, loopbackOnly: true },
    trial: {
      trialId: scenario.trialId,
      scenarioId: scenario.scenarioId,
      personRef: scenario.personRef,
    },
    scope: {
      purpose: "RESTORE_SERVICE",
      scopeRef: structuredClone(snapshot.scopeRef),
      version: snapshot.version,
    },
    responsibility: structuredClone(snapshot.responsibility),
    roleContexts: scenario.actingContexts.map((binding) => ({
      actingContextRef: binding.actingContextRef,
      roleRef: binding.candidate.roleRef,
      assignmentRef: binding.candidate.assignmentRef,
      authorityBasisRef: binding.requiredAuthorityRef,
      selected: binding.actingContextRef === selectedRef,
    })),
    selectedActingContext: selectedResolution,
    evidence: {
      evidenceRefs: scenario.evidenceBasis.evidence.map((item) => item.evidenceId),
      currentness: evidenceCurrentness,
      integrity: evidenceIntegrity,
    },
    dependencies: [...snapshot.dependencyRefs],
    residualObligations: snapshot.residualObligationRefs.map((obligationRef) => {
      const policy = residualPolicy.get(obligationRef);
      return {
        obligationRef,
        closureBlocking: policy?.closureBlocking ?? null,
        ...(policy === undefined ? {} : { policyBasisRef: policy.policyBasisRef }),
      };
    }),
    actions: {
      "RS-A-022": recovery,
      "RS-A-012": service,
      "RS-A-013": customer,
      "RS-A-014": machine,
      "RS-A-015": closure,
    },
    latest: {
      ...(snapshot.actionExecutions.length === 0
        ? {}
        : { execution: structuredClone(snapshot.actionExecutions[snapshot.actionExecutions.length - 1]) }),
      materialEffects: structuredClone(snapshot.materialEffects),
      ...(snapshot.verificationClosureEffects.length === 0
        ? {}
        : {
            verificationClosure: structuredClone(
              snapshot.verificationClosureEffects[snapshot.verificationClosureEffects.length - 1],
            ),
          }),
    },
    verification: {
      ...(state.serviceVerification === undefined
        ? {}
        : { serviceVerificationRef: responseRef("RS-A-012", state.serviceVerification) }),
      customerVerificationApplicability: scenario.customerVerificationApplicability,
      ...(state.customerVerification === undefined
        ? {}
        : { customerVerificationRef: responseRef("RS-A-013", state.customerVerification) }),
      ...(state.closureEligibility === undefined
        ? {}
        : { closureEligibilityRef: responseRef("RS-A-014", state.closureEligibility) }),
      ...(state.closureDecision === undefined
        ? {}
        : { closureDecisionRef: responseRef("RS-A-015", state.closureDecision) }),
    },
    warnings: [
      "Execution is not Material Effect",
      "Material Effect is not Service Verification",
      "Service Verification is not Customer Verification",
      "Customer Verification is not Closure Eligibility",
      "Closure Eligibility is not Closure Decision",
      "Role switch is not handover or responsibility transfer",
    ],
  };
}

function humanProjection(
  actionId: HitlTrial1HumanActionId,
  selectedRef: string,
  scenario: HitlTrial1RuntimeScenario,
  snapshot: Awaited<ReturnType<LocalJsonlStore["load"]>>,
  prerequisite: boolean,
  prerequisiteReasons: readonly string[],
): TrialActionProjection {
  const resolution = resolveSelected(actionId, selectedRef, scenario, snapshot);
  const contextReady = resolution.kind === "EXACT_ONE";
  const gateReady = prerequisite && contextReady && snapshot.dependencyRefs.length === 0;
  const reasons = [
    ...(prerequisite ? [] : prerequisiteReasons),
    ...(contextReady ? [] : ["selected_acting_context_not_lawful"]),
    ...(snapshot.dependencyRefs.length === 0 ? [] : ["dependency_unsatisfied"]),
  ];
  const gateEnable = gateEvaluation(
    snapshot,
    actionId,
    gateReady ? "READY" : "NOT_READY",
    gateReady ? "ENABLED" : "PENDING",
    reasons,
  );
  const projection: LawfulActionProjection = {
    scopeRef: structuredClone(snapshot.scopeRef),
    actionId,
    available: gateReady,
    blockedReasons: [...reasons],
    requiredContextRefs: resolution.kind === "EXACT_ONE" ? [resolution.candidate.contextRef] : [],
    requiredDependencyRefs: [...snapshot.dependencyRefs],
    gateEnableRef: `${actionId}@${snapshot.version}`,
  };
  return {
    actionId,
    mode: "HUMAN_ONLY",
    requiredAuthorityRef: HITL_AUTHORITIES[actionId],
    gateEnable,
    projection,
    selectedActingContextRef: selectedRef,
    selectedContextMatchesRequiredBinding: contextReady,
    allowedIntentRefs: allowedIntents(actionId, scenario),
    blockedReasons: [...reasons],
  };
}

function resolveSelected(
  actionId: HitlTrial1HumanActionId,
  selectedRef: string,
  scenario: HitlTrial1RuntimeScenario,
  snapshot: Awaited<ReturnType<LocalJsonlStore["load"]>>,
): ActingContextResolution {
  const binding = scenario.actingContexts.find(
    (item) => item.actionId === actionId && item.actingContextRef === selectedRef,
  );
  if (!binding) return { kind: "NONE", reason: "selected_context_wrong_role", evidenceRefs: [] };
  return resolveActingContext({
    scopeRef: snapshot.scopeRef,
    requiredAuthorityRef: HITL_AUTHORITIES[actionId],
    responsibility: snapshot.responsibility,
    candidates: [binding.candidate],
    allowStale: false,
  });
}

function gateEvaluation(
  snapshot: Awaited<ReturnType<LocalJsonlStore["load"]>>,
  actionId: string,
  gateReadiness: GateEnableEvaluation["gateReadiness"],
  enableState: GateEnableEvaluation["enableState"],
  reasons: readonly string[],
): GateEnableEvaluation {
  return {
    scopeRefKey: scopeKey(snapshot.scopeRef),
    actionId,
    gateReadiness,
    enableState,
    reasons: [...reasons],
    evidenceRefs: [...snapshot.evidenceRefs],
    evaluatedAt: "VIEW_CURRENT",
    inputVersion: snapshot.version,
  };
}

function allowedIntents(actionId: HitlTrial1HumanActionId, scenario: HitlTrial1RuntimeScenario): readonly string[] {
  if (actionId === "RS-A-012") return ["VERIFIED_OK", "VERIFIED_NOT_OK"];
  if (actionId === "RS-A-013") {
    return scenario.customerVerificationApplicability === "REQUIRED"
      ? ["CONFIRMED_OK", "NOT_OK", "UNREACHABLE"]
      : [];
  }
  if (actionId === "RS-A-015") return ["CLOSED", "NOT_CLOSED"];
  return ["EXECUTE_RECOVERY_ACTION"];
}

function responseRef(actionId: string, value: string): string {
  return `HITL1:${actionId}:${value}`;
}
