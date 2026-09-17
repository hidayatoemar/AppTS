import assert from "node:assert/strict";
import test from "node:test";
import { resolveActingContext } from "../dist/src/runtime/acting-context-resolver.js";
import { evaluateResponsibilityHandover } from "../dist/src/runtime/responsibility-handover-controller.js";
import { ScenarioHarness } from "../dist/src/simulator/harness.js";
import { makeCandidate, makeFixture, makeResponsibility, makeServiceScope, makeSnapshot } from "../dist/src/simulator/fixture.js";

const evidence = (id, scopeRef) => ({
  evidenceId: id,
  sourceType: "TEST",
  sourceRef: `SRC-${id}`,
  actorOrSystemRef: "SYS",
  receivedTime: "2026-09-18T00:00:00Z",
  currentness: { status: "CURRENT" },
  payloadOrRecordRef: id,
  provenanceChain: [scopeRef.subjectId],
});

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

test("CODE-F01 currentness CONFLICT is representable and distinct from integrity conflict", () => {
  const scopeRef = makeServiceScope();
  const responsibility = makeResponsibility(scopeRef);
  const currentnessConflict = makeCandidate(scopeRef, {
    currentness: { status: "CONFLICT", basisRef: "CUR-CONFLICT" },
    integrity: { sufficient: true, conflict: false, evidenceRefs: ["EV-I-CLEAN"] },
  });
  const first = resolveActingContext({
    scopeRef,
    requiredAuthorityRef: "AUTH-RS-A022",
    responsibility,
    candidates: [currentnessConflict],
    allowStale: false,
  });
  assert.equal(first.kind, "NONE");
  assert.match(first.reason, /non_current/);
  assert.doesNotMatch(first.reason, /integrity_insufficient_or_conflicting/);

  const integrityConflict = makeCandidate(scopeRef, {
    currentness: { status: "CURRENT" },
    integrity: { sufficient: true, conflict: true, evidenceRefs: ["EV-I-CONFLICT"] },
  });
  const second = resolveActingContext({
    scopeRef,
    requiredAuthorityRef: "AUTH-RS-A022",
    responsibility,
    candidates: [integrityConflict],
    allowStale: false,
  });
  assert.equal(second.kind, "NONE");
  assert.match(second.reason, /integrity_insufficient_or_conflicting/);
  assert.doesNotMatch(second.reason, /non_current/);
});

test("CODE-F02 handover cannot transfer across parent or relation scope", () => {
  const currentScope = { ...makeServiceScope(), parentScopeRef: "PARENT-A", relationRef: "REL-A" };
  const current = makeResponsibility(currentScope);
  const handover = {
    handoverRef: "HO-CROSS-SCOPE",
    scopeRef: { ...currentScope, parentScopeRef: "PARENT-B", relationRef: "REL-B" },
    fromResponsibilityRef: current.responsibilityRef,
    proposedHolderPersonRef: "P2",
    proposedRoleRef: "NOC2",
    proposedAssignmentRef: "A2",
    accepted: true,
    confirmedEffective: true,
    failedOrTimedOut: false,
    effectiveTime: "2026-09-18T00:01:00Z",
    evidenceRefs: ["EV-HO"],
    provenance: { sourceRefs: ["EV-HO"], chainRefs: [] },
  };
  const result = evaluateResponsibilityHandover(current, handover);
  assert.equal(result.kind, "RESPONSIBILITY_UNCHANGED");
  assert.ok(result.reasons.includes("handover_scope_mismatch"));
  assert.equal(result.current.responsibilityRef, current.responsibilityRef);
});

test("CODE-F04 ordered simulator stimuli, replay and oracle are reusable", async () => {
  const scopeRef = makeServiceScope();
  const harness = new ScenarioHarness(executor);
  harness.load(makeFixture([makeSnapshot(scopeRef)], { clock: "2026-09-18T00:00:00Z" }));

  const observation = {
    interactionRef: "EXT-1",
    requestIdentityRef: "REQ-1",
    scopeRef,
    providerRef: "PROVIDER-1",
    requestEvidenceRefs: ["EV-REQ"],
    responseEvidenceRefs: ["EV-RESP"],
    currentness: { status: "CURRENT" },
    integrity: { sufficient: true, conflict: false, evidenceRefs: ["EV-EXT-I"] },
    receivedTime: "2026-09-18T00:00:05Z",
  };

  const result = await harness.run([
    { kind: "EVENT_OR_OBSERVATION", scopeRef, evidence: [evidence("EV-EVENT", scopeRef)] },
    { kind: "TIMEOUT", scopeRef, advanceMs: 1000 },
    { kind: "HUMAN_CLARIFICATION", scopeRef, evidence: [evidence("EV-CLARIFY", scopeRef)] },
    { kind: "EXTERNAL_RESPONSE", scopeRef, observation },
  ]);

  assert.deepEqual(result.steps.map((step) => step.stimulusKind), [
    "EVENT_OR_OBSERVATION",
    "TIMEOUT",
    "HUMAN_CLARIFICATION",
    "EXTERNAL_RESPONSE",
  ]);
  assert.equal(harness.clock.now(), "2026-09-18T00:00:01.000Z");
  const replayed = await harness.replay(scopeRef);
  assert.equal(replayed.snapshots[0].responsibility.responsibilityRef, "RESP-001");
  assert.deepEqual(replayed.snapshots[0].truthRefs, ["TRUTH-DOWN"]);
  assert.ok(replayed.snapshots[0].evidenceRefs.includes("EV-EVENT"));
  assert.ok(replayed.snapshots[0].evidenceRefs.includes("EV-CLARIFY"));
  assert.equal(replayed.snapshots[0].otherAuthoritativeP01ToP10Records.length, 1);

  harness.assert({
    expectedChangedTruthsEffects: [],
    expectedRetainedTruths: ["TRUTH-DOWN"],
    prohibitedOutcomes: ["TRUTH-UP"],
    emittedObligationsDependencies: [],
    evidenceProvenanceAssertions: ["EV-EVENT", "EV-CLARIFY"],
  }, replayed);
});

test("CODE-F04 ACTION_COMMAND stimulus is dispatched through governed command pipeline", async () => {
  const scopeRef = makeServiceScope();
  const harness = new ScenarioHarness(executor);
  harness.load(makeFixture([makeSnapshot(scopeRef)]));
  const command = {
    commandId: "CMD-F04",
    actionId: "RS-A-022",
    purposeRef: { purpose: "RESTORE_SERVICE", situationId: scopeRef.situationId, compositionInstanceId: "COMP-F04", startedFromBasisRef: "EV-INTAKE" },
    scopeRef,
    requestedByActorOrMachineRef: "PERSON-001",
    actingContextRef: "CTX-001",
    expectedInputVersion: 0,
    requestTime: "2026-09-17T12:00:00.000Z",
    evidenceRefs: ["EV-DIAGNOSIS"],
  };
  const result = await harness.run({ kind: "ACTION_COMMAND", command });
  assert.equal(result.steps.length, 1);
  assert.equal(result.steps[0].stimulusKind, "ACTION_COMMAND");
  assert.equal(result.steps[0].result.kind, "COMMITTED");
  assert.deepEqual(result.snapshots[0].truthRefs, ["TRUTH-UP"]);
});
