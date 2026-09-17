import assert from "node:assert/strict";
import test from "node:test";
import { ScenarioHarness } from "../dist/src/simulator/harness.js";
import { handoverTimeout } from "../dist/src/simulator/break-injection.js";
import { makeFixture, makeResponsibility, makeServiceScope, makeSnapshot } from "../dist/src/simulator/fixture.js";

const executor = {
  async execute() {
    return {
      executionResult: "EXECUTED",
      executorRef: "EXECUTOR-TEST",
      executionEvidenceRefs: ["EV-EXEC"],
      uncertaintyFlag: false,
      resultantEffect: {
        effectTypeRef: "EFFECT-SERVICE-RECOVERED",
        beforeTruthRefs: ["TRUTH-DOWN"],
        afterTruthRefs: ["TRUTH-UP"],
        evidenceRefs: ["EV-RECOVERY"],
        materialEffectEstablished: true,
      },
    };
  },
};

const commandFor = (scopeRef) => ({
  commandId: "CMD-F04-CLOSURE",
  actionId: "RS-A-022",
  purposeRef: {
    purpose: "RESTORE_SERVICE",
    situationId: scopeRef.situationId,
    compositionInstanceId: "COMP-F04-CLOSURE",
    startedFromBasisRef: "EV-INTAKE",
  },
  scopeRef,
  requestedByActorOrMachineRef: "PERSON-001",
  actingContextRef: "CTX-001",
  expectedInputVersion: 0,
  requestTime: "2026-09-17T12:00:00.000Z",
  evidenceRefs: ["EV-DIAGNOSIS"],
});

test("CODE-F04 closure: reusable Oracle verifies governed Gate Enable and action projection", async () => {
  const scopeRef = makeServiceScope();
  const harness = new ScenarioHarness(executor);
  harness.load(makeFixture([makeSnapshot(scopeRef)]));

  const result = await harness.run({ kind: "ACTION_COMMAND", command: commandFor(scopeRef) });
  const expectedProjection = {
    gateEnable: {
      scopeRef,
      actionId: "RS-A-022",
      gateReadiness: "READY",
      enableState: "ENABLED",
      reasons: [],
      evidenceRefs: ["EV-DIAGNOSIS"],
      evaluatedAt: "2026-09-17T12:00:00.000Z",
      inputVersion: 0,
    },
    actionProjection: {
      scopeRef,
      actionId: "RS-A-022",
      available: true,
      blockedReasons: [],
      requiredContextRefs: ["CTX-001"],
      requiredDependencyRefs: [],
      gateEnableRef: "RS-A-022@0",
    },
  };

  assert.deepEqual(result.gateEnableActionProjection, expectedProjection);
  harness.assert({
    expectedChangedTruthsEffects: ["TRUTH-UP"],
    expectedRetainedTruths: [],
    prohibitedOutcomes: [],
    emittedObligationsDependencies: [],
    gateEnableActionProjection: expectedProjection,
    evidenceProvenanceAssertions: [],
  }, result);

  assert.throws(() => harness.assert({
    expectedChangedTruthsEffects: ["TRUTH-UP"],
    expectedRetainedTruths: [],
    prohibitedOutcomes: [],
    emittedObligationsDependencies: [],
    gateEnableActionProjection: { ...expectedProjection, actionProjection: { ...expectedProjection.actionProjection, available: false } },
    evidenceProvenanceAssertions: [],
  }, result), /gate_enable_action_projection_mismatch/);
});

test("CODE-F04 closure: handover timeout executes Fixture to Stimulus to Run to Oracle end-to-end", async () => {
  const scopeRef = makeServiceScope();
  const responsibility = makeResponsibility(scopeRef);
  const harness = new ScenarioHarness(executor);
  harness.load(makeFixture([makeSnapshot(scopeRef)]));

  const result = await harness.run(handoverTimeout(responsibility, "HO-TIMEOUT-F04"));
  assert.equal(result.steps.length, 1);
  assert.equal(result.steps[0].stimulusKind, "RESPONSIBILITY_HANDOVER");
  assert.equal(result.steps[0].result.evaluation.kind, "RESPONSIBILITY_UNCHANGED");
  assert.equal(result.steps[0].result.evaluation.interventionObligation, true);
  assert.ok(result.steps[0].result.evaluation.reasons.includes("handover_failed_or_timed_out"));
  assert.equal(result.steps[0].result.emittedObligationRefs.length, 1);

  const replayed = await harness.replay(scopeRef);
  assert.equal(replayed.snapshots[0].responsibility.responsibilityRef, "RESP-001");
  assert.equal(replayed.snapshots[0].responsibilityHandoverEffects.length, 1);
  assert.equal(replayed.snapshots[0].responsibilityHandoverEffects[0].handoverRef, "HO-TIMEOUT-F04");
  assert.equal(replayed.snapshots[0].residualObligationRefs.length, 1);

  harness.assert({
    expectedChangedTruthsEffects: [],
    expectedRetainedTruths: ["TRUTH-DOWN"],
    prohibitedOutcomes: ["TRUTH-UP"],
    emittedObligationsDependencies: replayed.snapshots[0].residualObligationRefs,
    evidenceProvenanceAssertions: [],
  }, replayed);
});
