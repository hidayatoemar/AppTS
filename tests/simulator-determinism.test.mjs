import assert from "node:assert/strict";
import test from "node:test";
import { ScenarioHarness } from "../dist/src/simulator/harness.js";
import { makeServiceScope, makeSnapshot } from "../dist/src/simulator/fixture.js";

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

const runOnce = async () => {
  const scopeRef = makeServiceScope();
  const harness = new ScenarioHarness(executor);
  harness.load(makeSnapshot(scopeRef));
  return harness.run({
    commandId: "CMD-DETERMINISTIC",
    actionId: "RS-A-022",
    purposeRef: { purpose: "RESTORE_SERVICE", situationId: scopeRef.situationId, compositionInstanceId: "COMP-001", startedFromBasisRef: "EV-INTAKE" },
    scopeRef,
    requestedByActorOrMachineRef: "PERSON-001",
    actingContextRef: "CTX-001",
    expectedInputVersion: 0,
    requestTime: "2026-09-17T12:00:00.000Z",
    evidenceRefs: ["EV-DIAGNOSIS"],
  });
};

test("B2 deterministic simulator produces identical result for identical fixture/stimulus", async () => {
  assert.deepEqual(await runOnce(), await runOnce());
});
