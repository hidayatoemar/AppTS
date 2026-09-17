import assert from "node:assert/strict";
import test from "node:test";
import { ScenarioHarness } from "../dist/src/simulator/harness.js";
import { makeServiceScope, makeSnapshot } from "../dist/src/simulator/fixture.js";

const executor = {
  async execute(_command, bindings) {
    assert.deepEqual(bindings, ["FB-SRV-15"]);
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

const makeCommand = () => {
  const scopeRef = makeServiceScope();
  return {
    commandId: "CMD-001",
    actionId: "RS-A-022",
    purposeRef: {
      purpose: "RESTORE_SERVICE",
      situationId: scopeRef.situationId,
      compositionInstanceId: "COMP-001",
      startedFromBasisRef: "EV-INTAKE",
    },
    scopeRef,
    requestedByActorOrMachineRef: "PERSON-001",
    actingContextRef: "CTX-001",
    expectedInputVersion: 0,
    requestTime: "2026-09-17T12:00:00.000Z",
    evidenceRefs: ["EV-DIAGNOSIS"],
  };
};

test("TV-RS-001 clean restore: execution -> material effect only, responsibility unchanged", async () => {
  const harness = new ScenarioHarness(executor);
  const command = makeCommand();
  harness.load(makeSnapshot(command.scopeRef));
  const result = await harness.run(command);
  assert.equal(result.kind, "COMMITTED");
  assert.equal(result.execution.accepted, true);
  assert.equal(result.effects.length, 1);
  assert.equal(result.effects[0].materialEffectEstablished, true);
  assert.deepEqual(result.effects[0].afterTruthRefs, ["TRUTH-UP"]);
  const snapshot = await harness.store.load(command.scopeRef);
  assert.equal(snapshot.responsibility.responsibilityRef, "RESP-001");
  assert.deepEqual(snapshot.truthRefs, ["TRUTH-UP"]);
});

test("committed equivalent replay after world change returns prior result and creates no second effect", async () => {
  const harness = new ScenarioHarness(executor);
  const command = makeCommand();
  harness.load(makeSnapshot(command.scopeRef));
  const first = await harness.run(command);
  assert.equal(first.kind, "COMMITTED");
  harness.store.mutateForTest(command.scopeRef, (snapshot) => {
    snapshot.actingContextCandidates = [];
    snapshot.dependencyRefs = ["DEP-NOW-BLOCKED"];
    snapshot.responsibility.currentness = { status: "STALE" };
  });
  const replay = await harness.run(command);
  assert.equal(replay.kind, "REPLAY");
  assert.equal(replay.execution.commandId, first.execution.commandId);
  assert.deepEqual(replay.effects, first.effects);
  const after = await harness.store.load(command.scopeRef);
  assert.equal(after.version, 1);
});

test("same commandId with conflicting normalized envelope fails without execution", async () => {
  const harness = new ScenarioHarness(executor);
  const command = makeCommand();
  harness.load(makeSnapshot(command.scopeRef));
  await harness.run(command);
  const conflicting = { ...command, payloadRef: "DIFFERENT" };
  await assert.rejects(() => harness.run(conflicting), /IMPLEMENTATION_REPLAY_CONFLICT/);
  const after = await harness.store.load(command.scopeRef);
  assert.equal(after.version, 1);
});
