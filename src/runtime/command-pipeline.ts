import type {
  ActionCommandEnvelope,
  ActionExecutionRecord,
  ActingContextResolution,
  EvidenceProvenanceRef,
  MaterialEffectRecord,
} from "../contracts/ce-di.js";
import type { PolicyConfig } from "../contracts/policy.js";
import type { Ref } from "../contracts/ids.js";
import type { ActionEffectPort } from "../adapters/action-effect-port.js";
import type { ScopeRepository } from "../persistence/ports.js";
import { normalizeCommandEnvelope } from "../persistence/in-memory-store.js";
import type { Clock } from "../simulator/clock.js";
import type { IdGenerator } from "../simulator/ids.js";
import { resolveActingContext } from "./acting-context-resolver.js";
import { evaluateGateEnable } from "./gate-enable-evaluator.js";
import { projectLawfulAction } from "./lawful-action-set.js";
import { resolveRsA022Bindings, RS_A_022 } from "./rs-a-022-binding.js";

export type CommandPipelineResult =
  | { kind: "REPLAY"; execution: ActionExecutionRecord; effects: MaterialEffectRecord[] }
  | { kind: "REJECTED"; reasons: string[] }
  | { kind: "COMMITTED"; execution: ActionExecutionRecord; effects: MaterialEffectRecord[]; newVersion: number };

export interface CommandRuntimeDeps {
  repository: ScopeRepository;
  policy: PolicyConfig;
  executor: ActionEffectPort;
  clock: Clock;
  ids: IdGenerator;
  requiredAuthorityRefByAction: Readonly<Record<string, Ref>>;
}

export async function executeCommand(
  envelope: ActionCommandEnvelope,
  deps: CommandRuntimeDeps,
): Promise<CommandPipelineResult> {
  minimallyValidate(envelope);
  const normalized = normalizeCommandEnvelope(envelope);

  // Replay identity is resolved BEFORE mutable-world preconditions.
  const committed = await deps.repository.findCommand(envelope.commandId);
  if (committed) {
    if (committed.normalizedEnvelope !== normalized) throw new Error("IMPLEMENTATION_REPLAY_CONFLICT");
    return { kind: "REPLAY", execution: committed.execution, effects: committed.effects };
  }

  const snapshot = await deps.repository.load(envelope.scopeRef);
  if (snapshot.version !== envelope.expectedInputVersion) {
    return { kind: "REJECTED", reasons: ["stale_expected_version"] };
  }

  const requiredAuthorityRef = deps.requiredAuthorityRefByAction[envelope.actionId];
  if (!requiredAuthorityRef) return { kind: "REJECTED", reasons: ["missing_required_authority_binding"] };

  if (envelope.boundedMachineAuthorityRef) {
    const allowedMachineAuthorities = deps.policy.boundedMachineAuthorityRefsByAction[envelope.actionId] ?? [];
    if (!allowedMachineAuthorities.includes(envelope.boundedMachineAuthorityRef)) {
      return { kind: "REJECTED", reasons: ["bounded_machine_authority_not_pre_authorized"] };
    }
  }

  let actingContext: ActingContextResolution | null = null;
  if (!envelope.boundedMachineAuthorityRef) {
    actingContext = resolveActingContext({
      scopeRef: envelope.scopeRef,
      requiredAuthorityRef,
      responsibility: snapshot.responsibility,
      candidates: snapshot.actingContextCandidates,
      allowStale: deps.policy.allowStaleActingContext,
    });
  }

  if (!envelope.boundedMachineAuthorityRef && actingContext?.kind === "EXACT_ONE") {
    if (!envelope.actingContextRef || envelope.actingContextRef !== actingContext.candidate.contextRef) {
      return { kind: "REJECTED", reasons: ["acting_context_reference_mismatch"] };
    }
  }

  const gateReadiness = deps.policy.gateByAction[envelope.actionId];
  const enableState = envelope.boundedMachineAuthorityRef ? "NOT_REQUIRED" : deps.policy.enableByAction[envelope.actionId];
  if (!gateReadiness || !enableState) return { kind: "REJECTED", reasons: ["missing_gate_or_enable_policy"] };

  const gateEnable = evaluateGateEnable({
    scopeRef: envelope.scopeRef,
    actionId: envelope.actionId,
    gateReadiness,
    enableState,
    reasons: [],
    evidenceRefs: snapshot.evidenceRefs,
    evaluatedAt: deps.clock.now(),
    inputVersion: snapshot.version,
  });

  const responsibilityCurrent = snapshot.responsibility.currentness.status === "CURRENT";
  const contextCurrent =
    responsibilityCurrent &&
    (envelope.boundedMachineAuthorityRef
      ? true
      : actingContext?.kind === "EXACT_ONE" && actingContext.candidate.currentness.status === "CURRENT");
  const contextIntegrity = envelope.boundedMachineAuthorityRef
    ? true
    : actingContext?.kind === "EXACT_ONE" && actingContext.candidate.integrity.sufficient && !actingContext.candidate.integrity.conflict;

  const projection = projectLawfulAction({
    scopeRef: envelope.scopeRef,
    actionId: envelope.actionId,
    processEligible: true,
    authoritySatisfied: envelope.boundedMachineAuthorityRef ? true : actingContext?.kind === "EXACT_ONE",
    assignmentScopeSatisfied: envelope.boundedMachineAuthorityRef ? true : actingContext?.kind === "EXACT_ONE",
    currentnessSatisfied: Boolean(contextCurrent),
    integritySatisfied: Boolean(contextIntegrity),
    dependenciesSatisfied: snapshot.dependencyRefs.length === 0,
    actingContext,
    boundedMachineAuthorityRef: envelope.boundedMachineAuthorityRef,
    gateEnable,
    dependencyRefs: snapshot.dependencyRefs,
  });

  if (!projection.available) return { kind: "REJECTED", reasons: projection.blockedReasons };
  if (envelope.actionId !== RS_A_022) return { kind: "REJECTED", reasons: ["first_slice_action_not_implemented"] };

  const activeBindings = resolveRsA022Bindings(envelope.scopeRef, deps.policy);
  const outcome = await deps.executor.execute(envelope, activeBindings);
  const execution: ActionExecutionRecord = {
    commandId: envelope.commandId,
    accepted: true,
    executionAttempted: true,
    executionResult: outcome.executionResult,
    executorRef: outcome.executorRef,
    executionTime: deps.clock.now(),
    responseRef: outcome.responseRef,
    evidenceRefs: outcome.executionEvidenceRefs,
    provenance: { sourceRefs: outcome.executionEvidenceRefs, chainRefs: [] },
    uncertaintyFlag: outcome.uncertaintyFlag,
  };

  const effects: MaterialEffectRecord[] = [];
  if (outcome.resultantEffect) {
    effects.push({
      effectId: deps.ids.next("effect"),
      commandId: envelope.commandId,
      actionId: envelope.actionId,
      scopeRef: envelope.scopeRef,
      effectTypeRef: outcome.resultantEffect.effectTypeRef,
      beforeTruthRefs: outcome.resultantEffect.beforeTruthRefs,
      afterTruthRefs: outcome.resultantEffect.afterTruthRefs,
      materialEffectEstablished: outcome.resultantEffect.materialEffectEstablished,
      noEffectOrFailureReason: outcome.resultantEffect.noEffectOrFailureReason,
      observationTime: deps.clock.now(),
      effectiveTime: deps.clock.now(),
      actorOrMachineRef: envelope.requestedByActorOrMachineRef,
      actingContextRef: envelope.actingContextRef,
      evidenceRefs: outcome.resultantEffect.evidenceRefs,
      provenance: { sourceRefs: outcome.resultantEffect.evidenceRefs, chainRefs: outcome.executionEvidenceRefs },
      currentness: { status: "CURRENT" },
      residualObligationRefs: [],
    });
  }

  const determiningEvidence: EvidenceProvenanceRef[] = [
    ...new Set([...outcome.executionEvidenceRefs, ...effects.flatMap((effect) => effect.evidenceRefs)]),
  ].map((evidenceId) => ({
    evidenceId,
    sourceType: "BOUNDED_EXECUTION",
    sourceRef: envelope.commandId,
    actorOrSystemRef: outcome.executorRef,
    receivedTime: deps.clock.now(),
    currentness: { status: "CURRENT" },
    payloadOrRecordRef: evidenceId,
    provenanceChain: [],
  }));

  const commit = await deps.repository.append(snapshot.version, {
    commitId: deps.ids.next("commit"),
    scopeRef: envelope.scopeRef,
    normalizedCommandIdentity: normalized,
    command: envelope,
    executionRecords: [execution],
    materialEffects: effects,
    determiningEvidence,
    responsibilityHandoverRefs: [],
    dependencyWaitingRefs: [],
    residualObligationRefs: [],
    verificationClosureRefs: [],
    otherAuthoritativeRefs: [],
  });

  return { kind: "COMMITTED", execution, effects, newVersion: commit.newVersion };
}

function minimallyValidate(envelope: ActionCommandEnvelope): void {
  if (!envelope.commandId || !envelope.actionId) throw new Error("INVALID_COMMAND_IDENTITY");
  if (envelope.purposeRef.purpose !== "RESTORE_SERVICE") throw new Error("INVALID_PURPOSE");
  if (!envelope.scopeRef.situationId || !envelope.scopeRef.subjectType || !envelope.scopeRef.subjectId) {
    throw new Error("INVALID_SCOPE_SHAPE");
  }
}
