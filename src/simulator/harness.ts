import type { ActionEffectPort } from "../adapters/action-effect-port.js";
import type { ActionCommandEnvelope, EvidenceProvenanceRef, ScopeRef } from "../contracts/ce-di.js";
import type { ResponsibilityHandoverRecord } from "../contracts/b6.js";
import type { ExternalExecutionObservation, ExternalReconciliationEvidence } from "../contracts/b8.js";
import type { PolicyConfig } from "../contracts/policy.js";
import { firstSlicePolicy } from "../config/policy-config.js";
import { InMemoryStore } from "../persistence/in-memory-store.js";
import type { AppendBatch } from "../persistence/ports.js";
import type { CommandPipelineResult } from "../runtime/command-pipeline.js";
import { executeCommand } from "../runtime/command-pipeline.js";
import { evaluateResponsibilityHandover } from "../runtime/responsibility-handover-controller.js";
import type { AuthoritativeP01ToP10Record, ScopeSnapshot } from "../runtime/runtime-composition.js";
import { scopeKey } from "../runtime/runtime-composition.js";
import { ManualClock } from "./clock.js";
import type { Fixture } from "./fixture.js";
import { DeterministicIdGenerator } from "./ids.js";
import type { Oracle } from "./oracle.js";
import { assertScenarioOracle } from "./oracle.js";

export interface EventOrObservationStimulus {
  kind: "EVENT_OR_OBSERVATION";
  scopeRef: ScopeRef;
  evidence: EvidenceProvenanceRef[];
}

export interface ActionCommandStimulus {
  kind: "ACTION_COMMAND";
  command: ActionCommandEnvelope;
}

export interface TimeoutStimulus {
  kind: "TIMEOUT";
  advanceMs: number;
  scopeRef?: ScopeRef;
}

export interface ExternalResponseStimulus {
  kind: "EXTERNAL_RESPONSE";
  scopeRef: ScopeRef;
  observation?: ExternalExecutionObservation;
  reconciliationEvidence?: ExternalReconciliationEvidence;
}

export interface HumanClarificationStimulus {
  kind: "HUMAN_CLARIFICATION";
  scopeRef: ScopeRef;
  evidence: EvidenceProvenanceRef[];
}

export interface ResponsibilityHandoverStimulus {
  kind: "RESPONSIBILITY_HANDOVER";
  scopeRef: ScopeRef;
  handover: ResponsibilityHandoverRecord;
}

export type Stimulus =
  | EventOrObservationStimulus
  | ActionCommandStimulus
  | TimeoutStimulus
  | ExternalResponseStimulus
  | HumanClarificationStimulus
  | ResponsibilityHandoverStimulus;

export interface ScenarioStepResult {
  stimulusKind: Stimulus["kind"];
  scopeRef?: ScopeRef;
  result: unknown;
}

export interface ScenarioResult {
  steps: ScenarioStepResult[];
  snapshots: ScopeSnapshot[];
  gateEnableActionProjection?: unknown;
}

export class ScenarioHarness {
  readonly store = new InMemoryStore();
  readonly clock = new ManualClock(new Date("2026-09-17T12:00:00.000Z"));
  readonly ids = new DeterministicIdGenerator();
  private policy: PolicyConfig = firstSlicePolicy;
  private readonly loadedScopeRefs: ScopeRef[] = [];

  constructor(private readonly executor: ActionEffectPort) {}

  load(input: Fixture | ScopeSnapshot): void {
    if ("initialScopedTruths" in input) {
      this.policy = input.policyConfigInputs;
      this.clock.set(input.clock);
      for (const snapshot of input.initialScopedTruths) this.seedScope(snapshot);
      this.validateFixture(input);
      return;
    }
    this.seedScope(input);
  }

  run(command: ActionCommandEnvelope): Promise<CommandPipelineResult>;
  run(stimulus: Stimulus | Stimulus[]): Promise<ScenarioResult>;
  async run(input: ActionCommandEnvelope | Stimulus | Stimulus[]): Promise<CommandPipelineResult | ScenarioResult> {
    if (isRawCommand(input)) return this.executeAction(input);
    const stimuli = Array.isArray(input) ? input : [input];
    const steps: ScenarioStepResult[] = [];
    for (const stimulus of stimuli) steps.push(await this.applyStimulus(stimulus));
    const gateEnableActionProjection = lastGateEnableActionProjection(steps);
    return {
      steps,
      snapshots: await this.currentSnapshots(),
      ...(gateEnableActionProjection === undefined ? {} : { gateEnableActionProjection }),
    };
  }

  async replay(scopeRef: ScopeRef): Promise<ScenarioResult> {
    return { steps: [], snapshots: [await this.store.replay(scopeRef)] };
  }

  assert(oracle: Oracle, result: ScenarioResult): void {
    const truthOrEffectRefs = result.snapshots.flatMap((snapshot) => [
      ...snapshot.truthRefs,
      ...snapshot.materialEffects.flatMap((effect) => effect.afterTruthRefs),
    ]);
    const dependencyOrObligationRefs = result.snapshots.flatMap((snapshot) => [
      ...snapshot.dependencyRefs,
      ...snapshot.residualObligationRefs,
    ]);
    const evidenceRefs = result.snapshots.flatMap((snapshot) => [
      ...snapshot.evidenceRefs,
      ...snapshot.evidenceProvenance.map((item) => item.evidenceId),
    ]);
    assertScenarioOracle(oracle, {
      truthOrEffectRefs: unique(truthOrEffectRefs),
      dependencyOrObligationRefs: unique(dependencyOrObligationRefs),
      evidenceRefs: unique(evidenceRefs),
      gateEnableActionProjection: result.gateEnableActionProjection,
    });
  }

  private async applyStimulus(stimulus: Stimulus): Promise<ScenarioStepResult> {
    switch (stimulus.kind) {
      case "ACTION_COMMAND":
        return { stimulusKind: stimulus.kind, scopeRef: stimulus.command.scopeRef, result: await this.executeAction(stimulus.command) };
      case "EVENT_OR_OBSERVATION":
        return { stimulusKind: stimulus.kind, scopeRef: stimulus.scopeRef, result: await this.appendEvidenceOnly(stimulus.scopeRef, stimulus.evidence) };
      case "HUMAN_CLARIFICATION":
        return { stimulusKind: stimulus.kind, scopeRef: stimulus.scopeRef, result: await this.appendEvidenceOnly(stimulus.scopeRef, stimulus.evidence) };
      case "TIMEOUT":
        this.clock.advance(stimulus.advanceMs);
        return { stimulusKind: stimulus.kind, scopeRef: stimulus.scopeRef, result: { advancedMs: stimulus.advanceMs, now: this.clock.now() } };
      case "EXTERNAL_RESPONSE":
        return { stimulusKind: stimulus.kind, scopeRef: stimulus.scopeRef, result: await this.appendExternalResponse(stimulus) };
      case "RESPONSIBILITY_HANDOVER":
        return { stimulusKind: stimulus.kind, scopeRef: stimulus.scopeRef, result: await this.applyResponsibilityHandover(stimulus) };
    }
  }

  private executeAction(command: ActionCommandEnvelope): Promise<CommandPipelineResult> {
    return executeCommand(command, {
      repository: this.store,
      policy: this.policy,
      executor: this.executor,
      clock: this.clock,
      ids: this.ids,
      requiredAuthorityRefByAction: { "RS-A-022": "AUTH-RS-A022" },
    });
  }

  private async appendEvidenceOnly(scopeRef: ScopeRef, evidence: EvidenceProvenanceRef[]) {
    const snapshot = await this.store.load(scopeRef);
    return this.store.append(snapshot.version, emptyBatch(this.ids.next("sim-evidence"), scopeRef, evidence));
  }

  private async appendExternalResponse(stimulus: ExternalResponseStimulus) {
    const snapshot = await this.store.load(stimulus.scopeRef);
    const records: AuthoritativeP01ToP10Record[] = [];
    if (stimulus.observation) records.push({ family: "P08_EXTERNAL_EXECUTION_OBSERVATION", record: stimulus.observation });
    if (stimulus.reconciliationEvidence) records.push({ family: "P08_EXTERNAL_RECONCILIATION_EVIDENCE", record: stimulus.reconciliationEvidence });
    const batch = emptyBatch(this.ids.next("sim-external"), stimulus.scopeRef, []);
    batch.otherAuthoritativeP01ToP10Records = records;
    return this.store.append(snapshot.version, batch);
  }

  private async applyResponsibilityHandover(stimulus: ResponsibilityHandoverStimulus) {
    if (scopeKey(stimulus.scopeRef) !== scopeKey(stimulus.handover.scopeRef)) throw new Error("HANDOVER_STIMULUS_SCOPE_MISMATCH");
    const snapshot = await this.store.load(stimulus.scopeRef);
    const evaluation = evaluateResponsibilityHandover(snapshot.responsibility, stimulus.handover);
    const emittedObligationRefs =
      evaluation.kind === "RESPONSIBILITY_UNCHANGED" && evaluation.interventionObligation
        ? [this.ids.next("handover-intervention-obligation")]
        : [];
    const batch = emptyBatch(this.ids.next("sim-handover"), stimulus.scopeRef, []);
    batch.responsibilityHandoverEffects = [stimulus.handover];
    batch.residualObligationRefs = emittedObligationRefs;
    const commit = await this.store.append(snapshot.version, batch);
    return { evaluation, emittedObligationRefs, newVersion: commit.newVersion };
  }

  private seedScope(snapshot: ScopeSnapshot): void {
    this.store.seed(snapshot);
    if (!this.loadedScopeRefs.some((scope) => scopeKey(scope) === scopeKey(snapshot.scopeRef))) this.loadedScopeRefs.push(snapshot.scopeRef);
  }

  private async currentSnapshots(): Promise<ScopeSnapshot[]> {
    return Promise.all(this.loadedScopeRefs.map((scopeRef) => this.store.replay(scopeRef)));
  }

  private validateFixture(fixture: Fixture): void {
    const byScope = new Map(fixture.initialScopedTruths.map((snapshot) => [scopeKey(snapshot.scopeRef), snapshot]));
    for (const responsibility of fixture.responsibilities) {
      const snapshot = byScope.get(scopeKey(responsibility.scopeRef));
      if (!snapshot || snapshot.responsibility.responsibilityRef !== responsibility.responsibilityRef) throw new Error("FIXTURE_RESPONSIBILITY_MISMATCH");
    }
    for (const candidate of fixture.actingContextFacts) {
      const snapshot = byScope.get(scopeKey(candidate.scopeRef));
      if (!snapshot?.actingContextCandidates.some((item) => item.contextRef === candidate.contextRef)) throw new Error("FIXTURE_ACTING_CONTEXT_MISMATCH");
    }
    for (const dependency of fixture.dependencies) {
      const snapshot = byScope.get(scopeKey(dependency.scopeRef));
      if (!snapshot?.dependencyWaitingUpdates.some((item) => item.dependencyRef === dependency.dependencyRef)) throw new Error("FIXTURE_DEPENDENCY_MISMATCH");
    }
  }
}

function isRawCommand(input: ActionCommandEnvelope | Stimulus | Stimulus[]): input is ActionCommandEnvelope {
  return !Array.isArray(input) && "commandId" in input && !("kind" in input);
}

function emptyBatch(commitId: string, scopeRef: ScopeRef, evidenceProvenance: EvidenceProvenanceRef[]): AppendBatch {
  return {
    commitId,
    scopeRef,
    actionExecutions: [],
    materialEffects: [],
    evidenceProvenance,
    responsibilityHandoverEffects: [],
    dependencyWaitingUpdates: [],
    residualObligationRefs: [],
    verificationClosureEffects: [],
    otherAuthoritativeP01ToP10Records: [],
  };
}

function lastGateEnableActionProjection(steps: readonly ScenarioStepResult[]): unknown | undefined {
  for (let index = steps.length - 1; index >= 0; index -= 1) {
    const value = steps[index]?.result as { gateEnableActionProjection?: unknown } | undefined;
    if (value?.gateEnableActionProjection !== undefined) return value.gateEnableActionProjection;
  }
  return undefined;
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}
