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
  execute(envelope: ActionCommandEnvelope): Promise<CommandPipelineResult>;
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
): Promise<LocalRuntimeComposition> {
  assertSemanticAdmissionManifest();
  if (fixture.syntheticTrial !== true) throw new Error("SYNTHETIC_TRIAL_MARKER_REQUIRED");

  await mkdir(config.dataDir, { recursive: true });
  const repository = new LocalJsonlStore(config.dataDir);

  for (const baseline of fixture.scopeBaselines) {
    if (baseline.scopeRef.subjectType !== STAGING_SUBJECT_TYPE) throw new Error("STAGING_SERVICE_SCOPE_ONLY");
    repository.seed(baseline);
  }

  for (const baseline of fixture.scopeBaselines) {
    await repository.replay(baseline.scopeRef);
  }

  const deps: CommandRuntimeDeps = {
    repository,
    policy: firstSlicePolicy,
    executor: new SyntheticTrialActionEffectPort(fixture.outcomeInstances),
    clock: new SystemClock(),
    ids: new CryptoIdGenerator(),
    requiredAuthorityRefByAction: {
      [STAGING_ACTION_ID]: STAGING_REQUIRED_AUTHORITY_REF,
    },
  };

  return {
    repository,
    policy: firstSlicePolicy,
    execute: async (envelope) => {
      assertStagingCommandAdmission(envelope);
      return executeCommand(envelope, deps);
    },
  };
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
