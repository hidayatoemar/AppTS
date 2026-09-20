import { mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import type { ActionCommandEnvelope } from "../contracts/ce-di.js";
import type { Ref } from "../contracts/ids.js";
import { firstSlicePolicy } from "../config/policy-config.js";
import type { GovernedExecutionOutcome, ActionEffectPort } from "../adapters/action-effect-port.js";
import { LocalJsonlStore } from "../persistence/jsonl-store.js";
import { executeCommand, type CommandPipelineResult, type CommandRuntimeDeps } from "../runtime/command-pipeline.js";
import { resolveRsA022Bindings, RS_A_022 } from "../runtime/rs-a-022-binding.js";
import type { Clock } from "../simulator/clock.js";
import type { IdGenerator } from "../simulator/ids.js";
import type { LocalRuntimeConfig, SyntheticOutcomeInstance, SyntheticTrialFixture } from "./runtime-config.js";
import {
  HITL_RUNTIME_PROFILE,
  type HitlTrial1RuntimeScenario,
  type TrialOperatorViewDTO,
} from "./hitl-trial1-contracts.js";
import { createHitlTrial1Runtime, type HitlCommandResult } from "./hitl-trial1-runtime.js";
import { buildTrialOperatorView } from "./hitl-trial1-operator-view.js";

export const STAGING_ACTION_ID = RS_A_022;
export const STAGING_PURPOSE = "RESTORE_SERVICE" as const;
export const STAGING_SUBJECT_TYPE = "SERVICE" as const;
export const STAGING_FUNCTIONAL_BINDING = "FB-SRV-15" as const;
export const STAGING_REQUIRED_AUTHORITY_REF = "AUTH-RS-A022" as const;
export const STAGING_EXECUTION_RESULT = "EXECUTED" as const;
export const STAGING_EFFECT_TYPE_REF = "EFFECT-SERVICE-RECOVERED" as const;

export interface LocalRuntimeComposition {
  repository: LocalJsonlStore;
  policy: typeof firstSlicePolicy;
  execute(envelope: ActionCommandEnvelope): Promise<CommandPipelineResult | HitlCommandResult>;
  buildOperatorView?(selectedActingContextRef?: string): Promise<TrialOperatorViewDTO>;
}

class SystemClock implements Clock {
  now(): string {
    return new Date().toISOString();
  }
}

class CryptoIdGenerator implements IdGenerator {
  next(kind: string): Ref {
    return `${kind}-${randomUUID()}`;
  }
}

class SyntheticTrialActionEffectPort implements ActionEffectPort {
  private readonly outcomes: Map<string, SyntheticOutcomeInstance>;

  constructor(instances: readonly SyntheticOutcomeInstance[]) {
    this.outcomes = new Map(instances.map((instance) => [instance.commandId, instance]));
  }

  async execute(
    command: ActionCommandEnvelope,
    activeFunctionalBindings: readonly Ref[],
  ): Promise<GovernedExecutionOutcome> {
    assertStagingCommandAdmission(command);
    if (
      activeFunctionalBindings.length !== 1 ||
      activeFunctionalBindings[0] !== STAGING_FUNCTIONAL_BINDING
    ) {
      throw new Error("STAGING_FUNCTIONAL_BINDING_MISMATCH");
    }

    const instance = this.outcomes.get(command.commandId);
    if (!instance) throw new Error("MISSING_SYNTHETIC_EXECUTION_BINDING");

    return {
      executionResult: STAGING_EXECUTION_RESULT,
      executorRef: instance.executorRef,
      ...(instance.responseRef === undefined ? {} : { responseRef: instance.responseRef }),
      executionEvidenceRefs: [...instance.executionEvidenceRefs],
      uncertaintyFlag: false,
      resultantEffect: {
        effectTypeRef: STAGING_EFFECT_TYPE_REF,
        beforeTruthRefs: [...instance.beforeTruthRefs],
        afterTruthRefs: [...instance.afterTruthRefs],
        evidenceRefs: [...instance.effectEvidenceRefs],
        materialEffectEstablished: true,
      },
    };
  }
}

export async function createLocalRuntimeComposition(
  config: LocalRuntimeConfig,
  fixture: SyntheticTrialFixture,
  hitlScenario?: HitlTrial1RuntimeScenario,
): Promise<LocalRuntimeComposition> {
  assertSemanticAdmissionManifest();
  if (fixture.syntheticTrial !== true) throw new Error("SYNTHETIC_TRIAL_MARKER_REQUIRED");
  if (config.profile === HITL_RUNTIME_PROFILE && !hitlScenario) throw new Error("HITL_SCENARIO_REQUIRED");
  if (config.profile !== HITL_RUNTIME_PROFILE && hitlScenario) throw new Error("HITL_SCENARIO_PROFILE_MISMATCH");
  if (hitlScenario && hitlScenario.trialId !== fixture.trialId) throw new Error("HITL_FIXTURE_TRIAL_ID_MISMATCH");

  await mkdir(config.dataDir, { recursive: true });
  const repository = new LocalJsonlStore(config.dataDir);
  const baselines = hitlScenario ? [hitlScenario.scopeBaseline] : fixture.scopeBaselines;

  for (const baseline of baselines) {
    if (baseline.scopeRef.subjectType !== STAGING_SUBJECT_TYPE) throw new Error("STAGING_SERVICE_SCOPE_ONLY");
    repository.seed(baseline);
  }
  for (const baseline of baselines) await repository.replay(baseline.scopeRef);

  const clock = new SystemClock();
  const ids = new CryptoIdGenerator();
  const deps: CommandRuntimeDeps = {
    repository,
    policy: firstSlicePolicy,
    executor: new SyntheticTrialActionEffectPort(fixture.outcomeInstances),
    clock,
    ids,
    requiredAuthorityRefByAction: {
      [STAGING_ACTION_ID]: STAGING_REQUIRED_AUTHORITY_REF,
    },
  };

  const hitl = hitlScenario
    ? createHitlTrial1Runtime({ repository, scenario: hitlScenario, clock, ids })
    : null;
  if (hitl) await hitl.recoverPendingA14();

  const composition: LocalRuntimeComposition = {
    repository,
    policy: firstSlicePolicy,
    execute: async (envelope) => {
      if (envelope.actionId === STAGING_ACTION_ID) {
        assertStagingCommandAdmission(envelope);
        return executeCommand(envelope, deps);
      }
      if (!hitl) {
        assertStagingCommandAdmission(envelope);
        return executeCommand(envelope, deps);
      }
      return hitl.execute(envelope);
    },
  };

  if (hitl && hitlScenario) {
    composition.buildOperatorView = async (selectedActingContextRef) =>
      buildTrialOperatorView(repository, hitlScenario, selectedActingContextRef, true);
  }
  return composition;
}

export function assertSemanticAdmissionManifest(): void {
  if (STAGING_ACTION_ID !== "RS-A-022") throw new Error("STAGING_ACTION_ID_DRIFT");

  const serviceBindings = firstSlicePolicy.rsA022BindingsBySubjectType[STAGING_SUBJECT_TYPE];
  if (
    !serviceBindings ||
    serviceBindings.length !== 1 ||
    serviceBindings[0] !== STAGING_FUNCTIONAL_BINDING
  ) {
    throw new Error("STAGING_SERVICE_BINDING_DRIFT");
  }
  if (firstSlicePolicy.gateByAction[STAGING_ACTION_ID] !== "READY") {
    throw new Error("STAGING_GATE_POLICY_DRIFT");
  }
  if (firstSlicePolicy.enableByAction[STAGING_ACTION_ID] !== "ENABLED") {
    throw new Error("STAGING_ENABLE_POLICY_DRIFT");
  }

  const probeScope = {
    situationId: "STAGING-ADMISSION-PROBE",
    subjectType: STAGING_SUBJECT_TYPE,
    subjectId: "STAGING-ADMISSION-SERVICE",
  };
  const resolved = resolveRsA022Bindings(probeScope, firstSlicePolicy);
  if (resolved.length !== 1 || resolved[0] !== STAGING_FUNCTIONAL_BINDING) {
    throw new Error("STAGING_RESOLVED_BINDING_DRIFT");
  }
}

export function assertStagingCommandAdmission(envelope: ActionCommandEnvelope): void {
  if (envelope.actionId !== STAGING_ACTION_ID) throw new Error("STAGING_ACTION_NOT_ADMITTED");
  if (envelope.purposeRef.purpose !== STAGING_PURPOSE) throw new Error("STAGING_PURPOSE_NOT_ADMITTED");
  if (envelope.scopeRef.subjectType !== STAGING_SUBJECT_TYPE) throw new Error("STAGING_SUBJECT_NOT_ADMITTED");
}
