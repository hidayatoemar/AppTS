import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer as createNetServer } from "node:net";
import {
  HITL_RUNTIME_PROFILE,
  HITL_SCENARIO_PATH,
  validateHitlTrial1ScenarioObject,
} from "../dist/src/staging/hitl-trial1-contracts.js";
import {
  buildIdentityCanonicalBytes,
  classifyA14,
  createHitlTrial1Runtime,
  readHitlTrialState,
} from "../dist/src/staging/hitl-trial1-runtime.js";
import { createLocalRuntimeComposition } from "../dist/src/staging/runtime-composition.js";
import { createLocalBoundary } from "../dist/src/staging/local-boundary.js";
import { HITL_TRIAL1_CONSOLE_HTML } from "../dist/src/staging/hitl-trial1-console.js";
import { TRIAL_FIXTURE_PATH } from "../dist/src/staging/runtime-config.js";
import {
  HITL_TRIAL1_SCENARIOS,
  makeHitlScenario,
  makeScopeBaseline,
} from "./fixtures/hitl-trial1-scenarios.mjs";
import { HITL_TRIAL1_ORACLES } from "./fixtures/hitl-trial1-oracles.mjs";

const clone = (value) => structuredClone(value);

const syntheticFixture = (scenario) => ({
  syntheticTrial: true,
  trialId: scenario.trialId,
  scopeBaselines: [scenario.scopeBaseline],
  outcomeInstances: [{
    commandId: "CMD-STAGING-001",
    executorRef: "EXECUTOR-STAGING",
    responseRef: "RESPONSE-STAGING-001",
    executionEvidenceRefs: ["EV-HITL1-RECOVERY-EXEC"],
    beforeTruthRefs: ["TRUTH-HITL1-DOWN"],
    afterTruthRefs: ["TRUTH-HITL1-UP"],
    effectEvidenceRefs: ["EV-HITL1-RECOVERY-EFFECT"],
  }],
});

const config = (dataDir) => ({
  profile: HITL_RUNTIME_PROFILE,
  bindAddress: "127.0.0.1",
  port: 8080,
  dataDir,
  trialFixturePath: TRIAL_FIXTURE_PATH,
  hitlScenarioPath: HITL_SCENARIO_PATH,
});

const actingContext = {
  "RS-A-022": "CTX-HITL1-RECOVERY",
  "RS-A-012": "CTX-HITL1-SERVICE-VERIFICATION",
  "RS-A-013": "CTX-HITL1-CUSTOMER-VERIFICATION",
  "RS-A-015": "CTX-HITL1-CLOSURE-DECISION",
};

function recoveryCommand(scenario, expectedInputVersion = 0) {
  return {
    commandId: "CMD-STAGING-001",
    actionId: "RS-A-022",
    purposeRef: {
      purpose: "RESTORE_SERVICE",
      situationId: scenario.scopeBaseline.scopeRef.situationId,
      compositionInstanceId: scenario.scenarioId,
      startedFromBasisRef: scenario.evidenceBasis.basisRef,
    },
    scopeRef: clone(scenario.scopeBaseline.scopeRef),
    requestedByActorOrMachineRef: scenario.personRef,
    actingContextRef: actingContext["RS-A-022"],
    expectedInputVersion,
    requestTime: "2026-09-21T00:00:01.000Z",
    payloadRef: "EXECUTE_RECOVERY_ACTION",
    evidenceRefs: scenario.evidenceBasis.evidence.map((item) => item.evidenceId),
  };
}

function humanCommand(scenario, actionId, intent, expectedInputVersion, commandId = `CMD-${actionId}-${expectedInputVersion}`) {
  return {
    commandId,
    actionId,
    purposeRef: {
      purpose: "RESTORE_SERVICE",
      situationId: scenario.scopeBaseline.scopeRef.situationId,
      compositionInstanceId: scenario.scenarioId,
      startedFromBasisRef: scenario.evidenceBasis.basisRef,
    },
    scopeRef: clone(scenario.scopeBaseline.scopeRef),
    requestedByActorOrMachineRef: scenario.personRef,
    actingContextRef: actingContext[actionId],
    expectedInputVersion,
    requestTime: `2026-09-21T00:00:${String(expectedInputVersion + 2).padStart(2, "0")}.000Z`,
    payloadRef: intent,
    evidenceRefs: scenario.evidenceBasis.evidence.map((item) => item.evidenceId),
  };
}

function semanticRef(actionId, value) {
  if (actionId === "RS-A-012") return `HITL1:SERVICE_VERIFICATION:${value}`;
  if (actionId === "RS-A-013") return `HITL1:CUSTOMER_VERIFICATION:${value}`;
  if (actionId === "RS-A-014") return `HITL1:CLOSURE_ELIGIBILITY:${value}`;
  return `HITL1:CLOSURE_DECISION:${value}`;
}

function verificationRecord(scenario, actionId, value, commandId, index, residualObligationRefs = []) {
  const record = {
    recordKind: "HITL1_VERIFICATION_CLOSURE",
    recordRef: `HITL1:VC:${actionId}:${commandId}`,
    actionId,
    determiningCommandId: commandId,
    determiningExpectedVersion: index,
    determiningTime: "2026-09-21T00:00:10.000Z",
    determiningEvidenceRefs: ["EV-HITL1-GOV"],
    governingResidualObligationRefs: [...residualObligationRefs],
    scopeRef: clone(scenario.scopeBaseline.scopeRef),
    workCompleted: true,
    materialRestorationEstablished: true,
    serviceVerified: actionId === "RS-A-012" && value === "VERIFIED_OK",
    customerVerified: actionId === "RS-A-013" && value === "CONFIRMED_OK",
    closureEligible: actionId === "RS-A-014" && value === "ELIGIBLE",
    closureDecisionAuthorized: actionId === "RS-A-015" && value === "CLOSED",
    residualObligationRefs: [...residualObligationRefs],
    prohibitedInferences: [],
  };
  if (actionId === "RS-A-012") record.serviceVerificationRef = semanticRef(actionId, value);
  if (actionId === "RS-A-013") record.customerVerificationRef = semanticRef(actionId, value);
  if (actionId === "RS-A-014") record.closureEligibilityRef = semanticRef(actionId, value);
  if (actionId === "RS-A-015") record.closureDecisionRef = semanticRef(actionId, value);
  return record;
}

function actionExecution(actionId, commandId = `CMD-${actionId}-STATE`) {
  return {
    commandId,
    accepted: true,
    executionAttempted: true,
    executionResult: actionId === "RS-A-014" ? "EVALUATED" : "RECORDED",
    executorRef: actionId === "RS-A-014" ? "MACHINE-HITL1-RS-A014" : "PERSON-HITL1-001",
    executionTime: "2026-09-21T00:00:10.000Z",
    responseRef: `HITL1:VC:${actionId}:${commandId}`,
    evidenceRefs: ["EV-HITL1-GOV"],
    provenance: { sourceRefs: ["EV-HITL1-GOV"], chainRefs: [] },
    uncertaintyFlag: false,
  };
}

function snapshotWithState(scenario, entries, residualObligationRefs = undefined) {
  const snapshot = clone(scenario.scopeBaseline);
  const residuals = residualObligationRefs ?? snapshot.residualObligationRefs;
  snapshot.actionExecutions = entries.map(([action], index) => actionExecution(action, `CMD-${action}-STATE-${index}`));
  snapshot.verificationClosureEffects = entries.map(([action, value], index) =>
    verificationRecord(scenario, action, value, `CMD-${action}-STATE-${index}`, index, residuals),
  );
  if (residualObligationRefs) snapshot.residualObligationRefs = [...residualObligationRefs];
  snapshot.version = entries.length;
  return snapshot;
}

async function withRuntime(rawScenario, fn) {
  const scenario = validateHitlTrial1ScenarioObject(clone(rawScenario));
  const dir = await mkdtemp(join(tmpdir(), "appts-hitl1-"));
  try {
    const runtime = await createLocalRuntimeComposition(config(dir), syntheticFixture(scenario), scenario);
    return await fn({ runtime, scenario, dir });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function executeRecovery(runtime, scenario) {
  const result = await runtime.execute(recoveryCommand(scenario));
  assert.equal(result.kind, "COMMITTED");
  return result;
}

async function freePort() {
  const server = createNetServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("FREE_PORT_FAILED");
  await new Promise((resolve) => server.close(resolve));
  return address.port;
}

test("HITL-T01 exactly one synthetic human owns all admitted human contexts", async () => {
  const scenario = validateHitlTrial1ScenarioObject(clone(HITL_TRIAL1_SCENARIOS.S01_SUCCESS_REQUIRED));
  assert.equal(new Set(scenario.actingContexts.map((item) => item.candidate.personRef)).size, 1);
  assert.equal(scenario.actingContexts.length, 4);
  assert.deepEqual(
    scenario.actingContexts.map((item) => item.actionId).sort(),
    ["RS-A-012", "RS-A-013", "RS-A-015", "RS-A-022"],
  );
});

test("HITL-T02 Role selection changes no handover or responsibility truth", async () => {
  await withRuntime(HITL_TRIAL1_SCENARIOS.S01_SUCCESS_REQUIRED, async ({ runtime, scenario }) => {
    const before = await runtime.repository.load(scenario.scopeBaseline.scopeRef);
    const first = await runtime.buildOperatorView("CTX-HITL1-RECOVERY");
    const second = await runtime.buildOperatorView("CTX-HITL1-SERVICE-VERIFICATION");
    const after = await runtime.repository.load(scenario.scopeBaseline.scopeRef);
    assert.equal(first.responsibility.responsibilityRef, second.responsibility.responsibilityRef);
    assert.equal(first.roleContexts.filter((item) => item.selected).length, 1);
    assert.equal(second.roleContexts.filter((item) => item.selected).length, 1);
    assert.equal(after.version, before.version);
    assert.equal(after.responsibilityHandoverEffects.length, 0);
    assert.equal(after.responsibility.responsibilityRef, before.responsibility.responsibilityRef);
  });
});

test("HITL-T03 wrong selected Role blocks Service Verification even for same person", async () => {
  await withRuntime(HITL_TRIAL1_SCENARIOS.S01_SUCCESS_REQUIRED, async ({ runtime, scenario }) => {
    await executeRecovery(runtime, scenario);
    const view = await runtime.buildOperatorView("CTX-HITL1-RECOVERY");
    assert.equal(view.actions["RS-A-012"].projection.available, false);
    assert.ok(view.actions["RS-A-012"].blockedReasons.includes("selected_acting_context_not_lawful"));
  });
});

test("HITL-T04 RS-A-012 records Service Verification separately from material effect", async () => {
  await withRuntime(HITL_TRIAL1_SCENARIOS.S01_SUCCESS_REQUIRED, async ({ runtime, scenario }) => {
    await executeRecovery(runtime, scenario);
    const result = await runtime.execute(humanCommand(scenario, "RS-A-012", "VERIFIED_OK", 1, "CMD-HITL-T04-A12"));
    assert.equal(result.kind, "COMMITTED");
    const snapshot = await runtime.repository.load(scenario.scopeBaseline.scopeRef);
    assert.equal(snapshot.materialEffects.length, 1);
    const serviceRecord = snapshot.verificationClosureEffects.find((record) => record.actionId === "RS-A-012");
    assert.ok(serviceRecord);
    assert.equal(serviceRecord.serviceVerificationRef, "HITL1:SERVICE_VERIFICATION:VERIFIED_OK");
    assert.equal(serviceRecord.customerVerificationRef, undefined);
    assert.equal(serviceRecord.closureEligibilityRef, undefined);
    assert.equal(serviceRecord.closureDecisionRef, undefined);
    const serviceExecution = snapshot.actionExecutions.find((record) => record.commandId === "CMD-HITL-T04-A12");
    assert.equal(serviceExecution.responseRef, serviceRecord.recordRef);
    const responseCorrupted = clone(snapshot);
    responseCorrupted.actionExecutions.find((record) => record.commandId === "CMD-HITL-T04-A12").responseRef =
      "NON_SEMANTIC_CORRUPTED_RESPONSE_REFERENCE";
    assert.equal(readHitlTrialState(responseCorrupted).serviceVerification, "VERIFIED_OK");
    assert.equal(readHitlTrialState(snapshot).serviceVerification, "VERIFIED_OK");
    assert.equal(snapshot.responsibilityHandoverEffects.length, 0);
  });
});

test("HITL-T05 negative Service Verification never implies Customer Verification or Closure", async () => {
  await withRuntime(HITL_TRIAL1_SCENARIOS.S02_SERVICE_VERIFICATION_NEGATIVE, async ({ runtime, scenario }) => {
    await executeRecovery(runtime, scenario);
    await runtime.execute(humanCommand(scenario, "RS-A-012", "VERIFIED_NOT_OK", 1, "CMD-HITL-T05-A12"));
    const snapshot = await runtime.repository.load(scenario.scopeBaseline.scopeRef);
    const state = readHitlTrialState(snapshot);
    assert.equal(state.serviceVerification, "VERIFIED_NOT_OK");
    assert.equal(state.customerVerification, undefined);
    assert.equal(state.closureEligibility, "NOT_ELIGIBLE");
    assert.equal(state.closureDecision, undefined);
  });
});

test("HITL-T06 RS-A-013 is a separate authorized human action when REQUIRED", async () => {
  const raw = clone(HITL_TRIAL1_SCENARIOS.S01_SUCCESS_REQUIRED);
  raw.evidenceBasis.evidence.push({
    evidenceId: "EV-HITL1-GOV-2",
    sourceType: "SYNTHETIC_TRIAL",
    sourceRef: "SRC-HITL1-GOV-2",
    actorOrSystemRef: "SYSTEM-HITL1-FIXTURE",
    receivedTime: "2026-09-21T00:00:00.000Z",
    currentness: { status: "CURRENT", basisRef: "EV-HITL1-CURRENT-2" },
    payloadOrRecordRef: "PAYLOAD-HITL1-GOV-2",
    provenanceChain: [],
  });
  raw.evidenceBasis.integrityAssessments.push({
    evidenceId: "EV-HITL1-GOV-2",
    assessment: { sufficient: true, conflict: false, evidenceRefs: ["EV-HITL1-INTEGRITY-2"] },
  });

  await withRuntime(raw, async ({ runtime, scenario }) => {
    await executeRecovery(runtime, scenario);
    await runtime.execute(humanCommand(scenario, "RS-A-012", "VERIFIED_OK", 1, "CMD-HITL-T06-A12"));

    for (const [suffix, evidenceRefs] of [
      ["EMPTY", []],
      ["MISSING", ["EV-HITL1-GOV"]],
      ["SUBSTITUTED", ["EV-HITL1-GOV", "EV-NOT-GOVERNING"]],
    ]) {
      const command = humanCommand(scenario, "RS-A-013", "CONFIRMED_OK", 2, `CMD-HITL-T06-A13-${suffix}`);
      command.evidenceRefs = evidenceRefs;
      const rejectedEvidence = await runtime.execute(command);
      assert.equal(rejectedEvidence.kind, "REJECTED");
      assert.ok(rejectedEvidence.reasons.includes("determining_evidence_set_mismatch"));
      assert.equal((await runtime.repository.load(scenario.scopeBaseline.scopeRef)).version, 2);
    }

    const wrong = humanCommand(scenario, "RS-A-013", "CONFIRMED_OK", 2, "CMD-HITL-T06-A13-WRONG");
    wrong.actingContextRef = "CTX-HITL1-SERVICE-VERIFICATION";
    const rejected = await runtime.execute(wrong);
    assert.equal(rejected.kind, "REJECTED");

    const committed = await runtime.execute(
      humanCommand(scenario, "RS-A-013", "CONFIRMED_OK", 2, "CMD-HITL-T06-A13"),
    );
    assert.equal(committed.kind, "COMMITTED");
    const state = readHitlTrialState(await runtime.repository.load(scenario.scopeBaseline.scopeRef));
    assert.equal(state.customerVerification, "CONFIRMED_OK");
    assert.equal(state.closureEligibility, "ELIGIBLE");

    const recovery = await runtime.repository.recoverRecords(scenario.scopeBaseline.scopeRef);
    const a13 = recovery.records.find(
      (record) => record.batch.commandReplayIdentity?.commandId === "CMD-HITL-T06-A13",
    );
    assert.deepEqual(
      a13.batch.evidenceProvenance.map((item) => item.evidenceId),
      ["EV-HITL1-GOV", "EV-HITL1-GOV-2"],
    );
  });
});

test("HITL-T07 explicit Customer Verification NOT_REQUIRED offers no RS-A-013 command and never auto-closes", async () => {
  await withRuntime(HITL_TRIAL1_SCENARIOS.S04_CUSTOMER_VERIFICATION_NOT_REQUIRED, async ({ runtime, scenario }) => {
    await executeRecovery(runtime, scenario);
    await runtime.execute(humanCommand(scenario, "RS-A-012", "VERIFIED_OK", 1, "CMD-HITL-T07-A12"));
    const view = await runtime.buildOperatorView("CTX-HITL1-CUSTOMER-VERIFICATION");
    assert.equal(view.verification.customerVerificationApplicability, "NOT_REQUIRED");
    assert.equal(view.actions["RS-A-013"].projection.available, false);
    assert.deepEqual(view.actions["RS-A-013"].allowedIntentRefs, []);
    const state = readHitlTrialState(await runtime.repository.load(scenario.scopeBaseline.scopeRef));
    assert.equal(state.closureEligibility, "ELIGIBLE");
    assert.equal(state.closureDecision, undefined);
  });
});

test("HITL-T08 Customer Verification NOT_OK yields NOT_ELIGIBLE without closure", async () => {
  await withRuntime(HITL_TRIAL1_SCENARIOS.S03_CUSTOMER_VERIFICATION_NOT_OK, async ({ runtime, scenario }) => {
    await executeRecovery(runtime, scenario);
    await runtime.execute(humanCommand(scenario, "RS-A-012", "VERIFIED_OK", 1, "CMD-HITL-T08-A12"));
    await runtime.execute(humanCommand(scenario, "RS-A-013", "NOT_OK", 2, "CMD-HITL-T08-A13"));
    const state = readHitlTrialState(await runtime.repository.load(scenario.scopeBaseline.scopeRef));
    assert.equal(state.customerVerification, "NOT_OK");
    assert.equal(state.closureEligibility, "NOT_ELIGIBLE");
    assert.equal(state.closureDecision, undefined);
  });
});

test("HITL-T09 RS-A-014 is deterministic machine evaluation with no human Acting Context", async () => {
  await withRuntime(HITL_TRIAL1_SCENARIOS.S01_SUCCESS_REQUIRED, async ({ runtime, scenario }) => {
    await executeRecovery(runtime, scenario);
    await runtime.execute(humanCommand(scenario, "RS-A-012", "VERIFIED_OK", 1, "CMD-HITL-T09-A12"));
    await runtime.execute(humanCommand(scenario, "RS-A-013", "CONFIRMED_OK", 2, "CMD-HITL-T09-A13"));
    const snapshot = await runtime.repository.load(scenario.scopeBaseline.scopeRef);
    const a14Record = snapshot.verificationClosureEffects.find((item) => item.actionId === "RS-A-014");
    assert.ok(a14Record);
    assert.equal(a14Record.closureEligibilityRef, "HITL1:CLOSURE_ELIGIBILITY:ELIGIBLE");
    assert.equal(a14Record.serviceVerificationRef, undefined);
    assert.equal(a14Record.customerVerificationRef, undefined);
    assert.equal(a14Record.closureDecisionRef, undefined);
    const a14 = snapshot.actionExecutions.find((item) => item.commandId === a14Record.determiningCommandId);
    assert.ok(a14);
    assert.equal(a14.executorRef, "MACHINE-HITL1-RS-A014");
    assert.equal(a14.responseRef, a14Record.recordRef);
    assert.notEqual(a14.responseRef, a14Record.closureEligibilityRef);
    const view = await runtime.buildOperatorView("CTX-HITL1-RECOVERY");
    assert.equal(view.actions["RS-A-014"].mode, "DETERMINISTIC_MACHINE");
    assert.equal(view.actions["RS-A-014"].boundedMachineAuthorityRef, "BMA-HITL1-RS-A014");
    assert.equal(view.verification.closureEligibilityRef, a14Record.closureEligibilityRef);
  });
});

test("HITL-T10 positive verification basis yields ELIGIBLE but not CLOSED", async () => {
  await withRuntime(HITL_TRIAL1_SCENARIOS.S01_SUCCESS_REQUIRED, async ({ runtime, scenario }) => {
    await executeRecovery(runtime, scenario);
    await runtime.execute(humanCommand(scenario, "RS-A-012", "VERIFIED_OK", 1, "CMD-HITL-T10-A12"));
    await runtime.execute(humanCommand(scenario, "RS-A-013", "CONFIRMED_OK", 2, "CMD-HITL-T10-A13"));
    const state = readHitlTrialState(await runtime.repository.load(scenario.scopeBaseline.scopeRef));
    assert.equal(state.closureEligibility, "ELIGIBLE");
    assert.equal(state.closureDecision, undefined);
  });
});

test("HITL-T11 resolved negative verification basis yields NOT_ELIGIBLE", () => {
  const scenario = validateHitlTrial1ScenarioObject(clone(HITL_TRIAL1_SCENARIOS.S02_SERVICE_VERIFICATION_NEGATIVE));
  const snapshot = snapshotWithState(scenario, [["RS-A-012", "VERIFIED_NOT_OK"]]);
  const classification = classifyA14(snapshot, scenario);
  assert.deepEqual(classification, { ready: true, result: "NOT_ELIGIBLE", reasons: [] });
});

test("HITL-T12 closure-blocking residual obligation yields BLOCKED", () => {
  const scenario = validateHitlTrial1ScenarioObject(clone(HITL_TRIAL1_SCENARIOS.S05_CLOSURE_BLOCKING_RESIDUAL));
  const snapshot = snapshotWithState(
    scenario,
    [["RS-A-012", "VERIFIED_OK"], ["RS-A-013", "CONFIRMED_OK"]],
    ["OBL-HITL1-BLOCK"],
  );
  assert.deepEqual(classifyA14(snapshot, scenario), { ready: true, result: "BLOCKED", reasons: [] });
});

test("HITL-T13 missing category is NOT_READY while explicit UNKNOWN is classifiable UNKNOWN", () => {
  const required = validateHitlTrial1ScenarioObject(clone(HITL_TRIAL1_SCENARIOS.S01_SUCCESS_REQUIRED));
  const missing = snapshotWithState(required, [["RS-A-012", "VERIFIED_OK"]]);
  const missingResult = classifyA14(missing, required);
  assert.equal(missingResult.ready, false);
  assert.ok(missingResult.reasons.includes("missing_customer_verification"));

  const unknown = validateHitlTrial1ScenarioObject(clone(HITL_TRIAL1_SCENARIOS.S06_UNKNOWN_BASIS));
  const present = snapshotWithState(unknown, [["RS-A-012", "VERIFIED_OK"], ["RS-A-013", "CONFIRMED_OK"]]);
  assert.deepEqual(classifyA14(present, unknown), { ready: true, result: "UNKNOWN", reasons: [] });
});

test("HITL-T14 CONFLICT has precedence over negative, blocker, and UNKNOWN inputs", () => {
  const raw = clone(HITL_TRIAL1_SCENARIOS.S07_CONFLICT_BASIS);
  raw.scopeBaseline.residualObligationRefs = ["OBL-HITL1-BLOCK"];
  raw.residualObligations = [{
    obligationRef: "OBL-HITL1-BLOCK",
    closureBlocking: true,
    policyBasisRef: "POLICY-HITL1-BLOCK",
  }];
  const scenario = validateHitlTrial1ScenarioObject(raw);
  const snapshot = snapshotWithState(
    scenario,
    [["RS-A-012", "VERIFIED_NOT_OK"], ["RS-A-013", "NOT_OK"]],
    ["OBL-HITL1-BLOCK"],
  );
  assert.deepEqual(classifyA14(snapshot, scenario), { ready: true, result: "CONFLICT", reasons: [] });
});

test("HITL-T15 RS-A-015 remains unavailable unless eligibility and exact Closure Role are lawful", async () => {
  await withRuntime(HITL_TRIAL1_SCENARIOS.S03_CUSTOMER_VERIFICATION_NOT_OK, async ({ runtime, scenario }) => {
    await executeRecovery(runtime, scenario);
    await runtime.execute(humanCommand(scenario, "RS-A-012", "VERIFIED_OK", 1, "CMD-HITL-T15-A12"));
    await runtime.execute(humanCommand(scenario, "RS-A-013", "NOT_OK", 2, "CMD-HITL-T15-A13"));
    const view = await runtime.buildOperatorView("CTX-HITL1-CLOSURE-DECISION");
    assert.equal(view.actions["RS-A-015"].projection.available, false);
    assert.ok(view.actions["RS-A-015"].blockedReasons.includes("closure_not_eligible"));
  });
});

test("HITL-T16 CLOSED occurs only after explicit authorized RS-A-015 CLOSED command", async () => {
  await withRuntime(HITL_TRIAL1_SCENARIOS.S01_SUCCESS_REQUIRED, async ({ runtime, scenario }) => {
    await executeRecovery(runtime, scenario);
    await runtime.execute(humanCommand(scenario, "RS-A-012", "VERIFIED_OK", 1, "CMD-HITL-T16-A12"));
    await runtime.execute(humanCommand(scenario, "RS-A-013", "CONFIRMED_OK", 2, "CMD-HITL-T16-A13"));
    let snapshot = await runtime.repository.load(scenario.scopeBaseline.scopeRef);
    assert.equal(readHitlTrialState(snapshot).closureDecision, undefined);
    const close = await runtime.execute(humanCommand(scenario, "RS-A-015", "CLOSED", snapshot.version, "CMD-HITL-T16-A15"));
    assert.equal(close.kind, "COMMITTED");
    snapshot = await runtime.repository.load(scenario.scopeBaseline.scopeRef);
    assert.equal(readHitlTrialState(snapshot).closureDecision, "CLOSED");
  });
});

test("HITL-T17 explicit NOT_CLOSED remains not closed and eligibility does not override it", async () => {
  await withRuntime(HITL_TRIAL1_SCENARIOS.S01_SUCCESS_REQUIRED, async ({ runtime, scenario }) => {
    await executeRecovery(runtime, scenario);
    await runtime.execute(humanCommand(scenario, "RS-A-012", "VERIFIED_OK", 1, "CMD-HITL-T17-A12"));
    await runtime.execute(humanCommand(scenario, "RS-A-013", "CONFIRMED_OK", 2, "CMD-HITL-T17-A13"));
    const before = await runtime.repository.load(scenario.scopeBaseline.scopeRef);
    await runtime.execute(humanCommand(scenario, "RS-A-015", "NOT_CLOSED", before.version, "CMD-HITL-T17-A15"));
    const state = readHitlTrialState(await runtime.repository.load(scenario.scopeBaseline.scopeRef));
    assert.equal(state.closureEligibility, "ELIGIBLE");
    assert.equal(state.closureDecision, "NOT_CLOSED");
  });
});

test("HITL-T18 stale or invalid human Acting Context fails closed with zero unauthorized commit", async () => {
  const raw = clone(HITL_TRIAL1_SCENARIOS.S01_SUCCESS_REQUIRED);
  for (const candidate of raw.scopeBaseline.actingContextCandidates) {
    if (candidate.contextRef === "CTX-HITL1-SERVICE-VERIFICATION") candidate.currentness = { status: "STALE" };
  }
  for (const binding of raw.actingContexts) {
    if (binding.actionId === "RS-A-012") binding.candidate.currentness = { status: "STALE" };
  }
  await withRuntime(raw, async ({ runtime, scenario }) => {
    await executeRecovery(runtime, scenario);
    const before = await runtime.repository.load(scenario.scopeBaseline.scopeRef);
    const result = await runtime.execute(humanCommand(scenario, "RS-A-012", "VERIFIED_OK", 1, "CMD-HITL-T18-A12"));
    assert.equal(result.kind, "REJECTED");
    const after = await runtime.repository.load(scenario.scopeBaseline.scopeRef);
    assert.equal(after.version, before.version);
    assert.equal(readHitlTrialState(after).serviceVerification, undefined);
  });
});

test("HITL-T19 A14 replay is single-effect and deterministic identity is collision-safe", async () => {
  await withRuntime(HITL_TRIAL1_SCENARIOS.S01_SUCCESS_REQUIRED, async ({ runtime, scenario }) => {
    await executeRecovery(runtime, scenario);
    await runtime.execute(humanCommand(scenario, "RS-A-012", "VERIFIED_OK", 1, "CMD-HITL-T19-A12"));
    await runtime.execute(humanCommand(scenario, "RS-A-013", "CONFIRMED_OK", 2, "CMD-HITL-T19-A13"));
    const snapshot = await runtime.repository.load(scenario.scopeBaseline.scopeRef);
    const clock = { now: () => "2026-09-21T00:00:20.000Z" };
    const ids = { next: (kind) => `${kind}-T19` };
    const hitl = createHitlTrial1Runtime({ repository: runtime.repository, scenario, clock, ids });
    const identity = await hitl.buildA14Identity(snapshot);
    assert.ok(identity);

    const a14Record = snapshot.verificationClosureEffects.find((item) => item.actionId === "RS-A-014");
    assert.ok(a14Record);
    assert.equal(a14Record.canonicalA14IdentityBytes, identity.canonicalBytes);
    assert.equal(a14Record.canonicalA14IdentityDigest, identity.digest);
    assert.equal(a14Record.canonicalA14GoverningBasisVersion, identity.governingBasisVersion);

    const beforeExecutions = snapshot.actionExecutions.length;
    const replay = await runtime.execute(identity.envelope);
    assert.equal(replay.kind, "REPLAY");
    assert.equal(replay.execution.responseRef, a14Record.recordRef);
    assert.equal((await runtime.repository.load(scenario.scopeBaseline.scopeRef)).actionExecutions.length, beforeExecutions);

    const policyChanged = clone(scenario);
    policyChanged.customerVerificationApplicabilityPolicyBasisRef = "POLICY-HITL1-CUSTOMER-OTHER";
    assert.notEqual(
      buildIdentityCanonicalBytes(snapshot, policyChanged, identity.governingBasisVersion),
      identity.canonicalBytes,
    );

    const collisionRuntime = createHitlTrial1Runtime({
      repository: runtime.repository,
      scenario: policyChanged,
      clock: { now: () => "2026-09-21T00:00:21.000Z" },
      ids: { next: (kind) => `${kind}-T19-COLLISION` },
    });
    await assert.rejects(
      () => collisionRuntime.execute(identity.envelope),
      /A14_IDENTITY_COLLISION_OR_REPLAY_CONFLICT/,
    );
    const afterCollision = await runtime.repository.load(scenario.scopeBaseline.scopeRef);
    assert.equal(afterCollision.actionExecutions.length, beforeExecutions);
    assert.equal(
      afterCollision.verificationClosureEffects.filter((item) => item.actionId === "RS-A-014").length,
      1,
    );

    const currentnessChanged = clone(scenario);
    currentnessChanged.evidenceBasis.evidence[0].currentness = { status: "STALE", basisRef: "EV-HITL1-STALE" };
    assert.notEqual(
      buildIdentityCanonicalBytes(snapshot, currentnessChanged, identity.governingBasisVersion),
      identity.canonicalBytes,
    );

    const integrityChanged = clone(scenario);
    integrityChanged.evidenceBasis.integrityAssessments[0].assessment = {
      sufficient: false,
      conflict: true,
      evidenceRefs: ["EV-HITL1-INTEGRITY-CONFLICT"],
    };
    assert.notEqual(
      buildIdentityCanonicalBytes(snapshot, integrityChanged, identity.governingBasisVersion),
      identity.canonicalBytes,
    );

    const orderA = clone(scenario);
    orderA.evidenceBasis.policyBasisRefs = ["POLICY-B", "POLICY-A"];
    const orderB = clone(scenario);
    orderB.evidenceBasis.policyBasisRefs = ["POLICY-A", "POLICY-B"];
    assert.equal(
      buildIdentityCanonicalBytes(snapshot, orderA, identity.governingBasisVersion),
      buildIdentityCanonicalBytes(snapshot, orderB, identity.governingBasisVersion),
    );
  });
});

test("HITL-T20 conflicting same commandId envelope fails without a second business action", async () => {
  await withRuntime(HITL_TRIAL1_SCENARIOS.S01_SUCCESS_REQUIRED, async ({ runtime, scenario }) => {
    await executeRecovery(runtime, scenario);
    const original = humanCommand(scenario, "RS-A-012", "VERIFIED_OK", 1, "CMD-HITL-T20-SAME");
    await runtime.execute(original);
    const before = await runtime.repository.load(scenario.scopeBaseline.scopeRef);
    await assert.rejects(
      () => runtime.execute({ ...original, payloadRef: "VERIFIED_NOT_OK" }),
      /IMPLEMENTATION_REPLAY_CONFLICT/,
    );
    const after = await runtime.repository.load(scenario.scopeBaseline.scopeRef);
    assert.equal(after.version, before.version);
    assert.equal(after.actionExecutions.length, before.actionExecutions.length);
  });
});

test("HITL-T21 crash after classifiable basis recovers exactly one stable A14 issuance", async () => {
  const rawScenario = clone(HITL_TRIAL1_SCENARIOS.S01_SUCCESS_REQUIRED);
  const scenario = validateHitlTrial1ScenarioObject(rawScenario);
  const dir = await mkdtemp(join(tmpdir(), "appts-hitl1-crash-"));
  try {
    const first = await createLocalRuntimeComposition(config(dir), syntheticFixture(scenario), scenario);
    await executeRecovery(first, scenario);
    await first.execute(humanCommand(scenario, "RS-A-012", "VERIFIED_OK", 1, "CMD-HITL-T21-A12"));

    const originalAppend = first.repository.append.bind(first.repository);
    first.repository.append = async (expectedVersion, batch) => {
      const result = await originalAppend(expectedVersion, batch);
      if (batch.actionExecutions[0]?.responseRef?.startsWith("HITL1:RS-A-013:")) {
        throw new Error("SIMULATED_CRASH_AFTER_A13_COMMIT");
      }
      return result;
    };
    await assert.rejects(
      () => first.execute(humanCommand(scenario, "RS-A-013", "CONFIRMED_OK", 2, "CMD-HITL-T21-A13")),
      /SIMULATED_CRASH_AFTER_A13_COMMIT/,
    );
    first.repository.append = originalAppend;
    const crashed = await first.repository.load(scenario.scopeBaseline.scopeRef);
    assert.equal(crashed.version, 3);
    assert.equal(readHitlTrialState(crashed).closureEligibility, undefined);

    const preRecoveryHitl = createHitlTrial1Runtime({
      repository: first.repository,
      scenario,
      clock: { now: () => "2026-09-21T00:00:30.000Z" },
      ids: { next: (kind) => `${kind}-PRE` },
    });
    const pendingIdentity = await preRecoveryHitl.buildA14Identity(crashed);
    assert.ok(pendingIdentity);

    const restarted = await createLocalRuntimeComposition(config(dir), syntheticFixture(scenario), scenario);
    const recovered = await restarted.repository.load(scenario.scopeBaseline.scopeRef);
    assert.equal(recovered.version, 4);
    assert.equal(readHitlTrialState(recovered).closureEligibility, "ELIGIBLE");
    const a14Executions = recovered.actionExecutions.filter((item) => item.responseRef?.startsWith("HITL1:RS-A-014:"));
    assert.equal(a14Executions.length, 1);

    const postRecoveryHitl = createHitlTrial1Runtime({
      repository: restarted.repository,
      scenario,
      clock: { now: () => "2026-09-21T00:00:31.000Z" },
      ids: { next: (kind) => `${kind}-POST` },
    });
    const completedIdentity = await postRecoveryHitl.buildA14Identity(recovered);
    assert.equal(completedIdentity?.commandId, pendingIdentity.commandId);
    assert.equal(completedIdentity?.canonicalBytes, pendingIdentity.canonicalBytes);

    const secondRestart = await createLocalRuntimeComposition(config(dir), syntheticFixture(scenario), scenario);
    const afterSecond = await secondRestart.repository.load(scenario.scopeBaseline.scopeRef);
    assert.equal(afterSecond.version, 4);

    const beforeRead = afterSecond.version;
    await secondRestart.buildOperatorView("CTX-HITL1-CLOSURE-DECISION");
    assert.equal((await secondRestart.repository.load(scenario.scopeBaseline.scopeRef)).version, beforeRead);

    const changed = clone(scenario);
    changed.customerVerificationApplicabilityPolicyBasisRef = "POLICY-HITL1-CHANGED-WITHOUT-VERSION";
    assert.notEqual(
      buildIdentityCanonicalBytes(recovered, changed, pendingIdentity.governingBasisVersion),
      pendingIdentity.canonicalBytes,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("HITL-T22 console/read paths are loopback-only, read-only, and oracle-isolated", async () => {
  await withRuntime(HITL_TRIAL1_SCENARIOS.S01_SUCCESS_REQUIRED, async ({ runtime, scenario }) => {
    assert.ok(HITL_TRIAL1_ORACLES.S01_SUCCESS_REQUIRED);
    assert.doesNotMatch(HITL_TRIAL1_CONSOLE_HTML, /expectedClosureEligibility|HITL_TRIAL1_ORACLES/);
    const port = await freePort();
    const boundary = createLocalBoundary({
      port,
      execute: runtime.execute,
      trialConsoleHtml: HITL_TRIAL1_CONSOLE_HTML,
      operatorView: runtime.buildOperatorView,
    });
    await boundary.listen();
    boundary.setReady(true);
    try {
      const address = boundary.address();
      assert.ok(address && typeof address !== "string");
      assert.equal(address.address, "127.0.0.1");
      const before = await runtime.repository.load(scenario.scopeBaseline.scopeRef);

      const consoleResponse = await fetch(`http://127.0.0.1:${port}/trial-1`);
      assert.equal(consoleResponse.status, 200);
      assert.match(await consoleResponse.text(), /HITL Trial #1/);

      const viewResponse = await fetch(
        `http://127.0.0.1:${port}/trial-1/operator-view?actingContextRef=CTX-HITL1-SERVICE-VERIFICATION`,
      );
      assert.equal(viewResponse.status, 200);
      const view = await viewResponse.json();
      assert.equal(view.trial.personRef, scenario.personRef);
      assert.equal((await runtime.repository.load(scenario.scopeBaseline.scopeRef)).version, before.version);

      const getCommands = await fetch(`http://127.0.0.1:${port}/commands`);
      assert.equal(getCommands.status, 404);

      const recovery = recoveryCommand(scenario);
      const post = await fetch(`http://127.0.0.1:${port}/commands`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(recovery),
      });
      assert.equal(post.status, 200);
      assert.equal((await post.json()).kind, "COMMITTED");
    } finally {
      await boundary.close();
    }
  });
});
