import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  REGRESSION_GATES,
  RUNTIME_PROFILE,
  LOOPBACK_ADDRESS,
  TRIAL_FIXTURE_PATH,
} from "../dist/src/staging/runtime-config.js";
import { createLocalRuntimeComposition } from "../dist/src/staging/runtime-composition.js";

const makeScope = () => ({
  situationId: "SIT-STAGING-001",
  subjectType: "SERVICE",
  subjectId: "SVC-STAGING-001",
});

const makeBaseline = (overrides = {}) => {
  const scopeRef = makeScope();
  return {
    scopeRef,
    version: 0,
    truthRefs: ["TRUTH-DOWN-STAGING"],
    evidenceRefs: ["EV-DIAGNOSIS-STAGING"],
    responsibility: {
      responsibilityRef: "RESP-STAGING-001",
      scopeRef,
      holderPersonRef: "PERSON-STAGING-001",
      roleRef: "ROLE-NOC-STAGING",
      assignmentRef: "ASSIGN-STAGING-001",
      dutyRef: "DUTY-STAGING-001",
      availabilityRef: "AVAIL-STAGING-001",
      authorityBasisRef: "AUTH-RS-A022",
      effectiveTime: "2026-09-19T00:00:00.000Z",
      currentness: { status: "CURRENT" },
      provenance: { sourceRefs: ["EV-RESP-STAGING"], chainRefs: [] },
    },
    actingContextCandidates: [{
      contextRef: "CTX-STAGING-001",
      personRef: "PERSON-STAGING-001",
      roleRef: "ROLE-NOC-STAGING",
      assignmentRef: "ASSIGN-STAGING-001",
      dutyRef: "DUTY-STAGING-001",
      availabilityRef: "AVAIL-STAGING-001",
      responsibilityRef: "RESP-STAGING-001",
      authorityBasisRef: "AUTH-RS-A022",
      scopeRef,
      validity: { conditionRef: "COND-VALID-STAGING", satisfied: true, evidenceRefs: ["EV-VALID-STAGING"] },
      applicability: { conditionRef: "COND-APPLICABLE-STAGING", satisfied: true, evidenceRefs: ["EV-APPLICABLE-STAGING"] },
      currentness: { status: "CURRENT" },
      integrity: { sufficient: true, conflict: false, evidenceRefs: ["EV-INTEGRITY-STAGING"] },
      provenance: { sourceRefs: ["EV-CTX-STAGING"], chainRefs: [] },
    }],
    dependencyRefs: [],
    actionExecutions: [],
    materialEffects: [],
    evidenceProvenance: [],
    responsibilityHandoverEffects: [],
    dependencyWaitingUpdates: [],
    residualObligationRefs: [],
    verificationClosureEffects: [],
    otherAuthoritativeP01ToP10Records: [],
    ...overrides,
  };
};

const outcome = (commandId) => ({
  commandId,
  executorRef: "EXECUTOR-STAGING",
  responseRef: `RESPONSE-${commandId}`,
  executionEvidenceRefs: [`EV-EXEC-${commandId}`],
  beforeTruthRefs: ["TRUTH-DOWN-STAGING"],
  afterTruthRefs: ["TRUTH-UP-STAGING"],
  effectEvidenceRefs: [`EV-EFFECT-${commandId}`],
});

const fixture = (baseline = makeBaseline()) => ({
  syntheticTrial: true,
  trialId: "TRIAL-LOCAL-001",
  scopeBaselines: [baseline],
  outcomeInstances: [outcome("CMD-STAGING-001"), outcome("CMD-STAGING-002")],
});

const config = (dataDir) => ({
  profile: RUNTIME_PROFILE,
  bindAddress: LOOPBACK_ADDRESS,
  port: 8080,
  dataDir,
  trialFixturePath: TRIAL_FIXTURE_PATH,
});

const command = (commandId = "CMD-STAGING-001", expectedInputVersion = 0, overrides = {}) => ({
  commandId,
  actionId: "RS-A-022",
  purposeRef: {
    purpose: "RESTORE_SERVICE",
    situationId: "SIT-STAGING-001",
    compositionInstanceId: "COMP-STAGING-001",
    startedFromBasisRef: "EV-INTAKE-STAGING",
  },
  scopeRef: makeScope(),
  requestedByActorOrMachineRef: "PERSON-STAGING-001",
  actingContextRef: "CTX-STAGING-001",
  expectedInputVersion,
  requestTime: "2026-09-19T00:00:00.000Z",
  evidenceRefs: ["EV-DIAGNOSIS-STAGING"],
  ...overrides,
});

async function withTempDir(fn) {
  const dir = await mkdtemp(join(tmpdir(), "appts-local-runtime-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("RB-06 committed LocalJsonlStore state survives runtime reconstruction", async () => {
  await withTempDir(async (dir) => {
    const first = await createLocalRuntimeComposition(config(dir), fixture());
    const committed = await first.execute(command());
    assert.equal(committed.kind, "COMMITTED");

    const restarted = await createLocalRuntimeComposition(config(dir), fixture());
    const snapshot = await restarted.repository.load(makeScope());
    assert.equal(snapshot.version, 1);
    assert.equal(snapshot.actionExecutions.length, 1);
    assert.equal(snapshot.materialEffects.length, 1);
    assert.equal(snapshot.materialEffects[0].effectTypeRef, "EFFECT-SERVICE-RECOVERED");
  });
});

test("RB-07 runtime restart creates no authoritative or canonical RESTART record", async () => {
  await withTempDir(async (dir) => {
    const first = await createLocalRuntimeComposition(config(dir), fixture());
    await first.execute(command());
    const before = await first.repository.load(makeScope());

    const restarted = await createLocalRuntimeComposition(config(dir), fixture());
    const after = await restarted.repository.load(makeScope());
    assert.equal(after.version, before.version);
    assert.equal(JSON.stringify(after).includes('"RESTART"'), false);
    assert.deepEqual(after.actionExecutions, before.actionExecutions);
    assert.deepEqual(after.materialEffects, before.materialEffects);
  });
});

test("RB-08 exact replay precedes changed mutable-world validation after restart", async () => {
  await withTempDir(async (dir) => {
    const originalFixture = fixture();
    const first = await createLocalRuntimeComposition(config(dir), originalFixture);
    const committed = await first.execute(command());
    assert.equal(committed.kind, "COMMITTED");

    const changed = makeBaseline();
    changed.responsibility.currentness = { status: "STALE" };
    changed.actingContextCandidates[0].currentness = { status: "STALE" };
    const restarted = await createLocalRuntimeComposition(config(dir), fixture(changed));
    const replay = await restarted.execute(command());
    assert.equal(replay.kind, "REPLAY");
    assert.deepEqual(replay.execution, committed.execution);
    assert.deepEqual(replay.effects, committed.effects);

    const snapshot = await restarted.repository.load(makeScope());
    assert.equal(snapshot.version, 1);
    assert.equal(snapshot.actionExecutions.length, 1);
  });
});

test("RB-09 conflicting same commandId envelope is implementation replay conflict", async () => {
  await withTempDir(async (dir) => {
    const first = await createLocalRuntimeComposition(config(dir), fixture());
    await first.execute(command());

    const restarted = await createLocalRuntimeComposition(config(dir), fixture());
    await assert.rejects(
      () => restarted.execute(command("CMD-STAGING-001", 1)),
      /IMPLEMENTATION_REPLAY_CONFLICT/,
    );
    const snapshot = await restarted.repository.load(makeScope());
    assert.equal(snapshot.version, 1);
    assert.equal(snapshot.actionExecutions.length, 1);
  });
});

test("RB-10 malformed interior persistence history fails closed", async () => {
  await withTempDir(async (dir) => {
    const first = await createLocalRuntimeComposition(config(dir), fixture());
    await first.execute(command());

    const streamDir = first.repository.streamDirectory(makeScope());
    await writeFile(join(streamDir, "0000000002-bad.jsonl"), "{malformed}\n", "utf8");
    await writeFile(join(streamDir, "0000000003-tail.jsonl"), "{tail}\n", "utf8");

    await assert.rejects(
      () => createLocalRuntimeComposition(config(dir), fixture()),
      /JSONL_INTERIOR_CORRUPTION/,
    );
  });
});

test("RB-11 malformed final tail is non-committed and quarantined on next append", async () => {
  await withTempDir(async (dir) => {
    const first = await createLocalRuntimeComposition(config(dir), fixture());
    await first.execute(command());

    const streamDir = first.repository.streamDirectory(makeScope());
    await writeFile(join(streamDir, "0000000002-tail.jsonl"), "{malformed", "utf8");

    const restarted = await createLocalRuntimeComposition(config(dir), fixture());
    const before = await restarted.repository.load(makeScope());
    assert.equal(before.version, 1);

    const second = await restarted.execute(command("CMD-STAGING-002", 1, {
      requestTime: "2026-09-19T00:01:00.000Z",
    }));
    assert.equal(second.kind, "COMMITTED");

    const names = await readdir(streamDir);
    assert.ok(names.some((name) => name.endsWith(".quarantine")));
    const after = await restarted.repository.load(makeScope());
    assert.equal(after.version, 2);
  });
});

test("RB-14 regression gate identities remain three distinct deterministic proofs", () => {
  assert.deepEqual(REGRESSION_GATES, {
    productSemantic: {
      sha: "01097454cc73b9917b284c876af4c603856ebe6e",
      tests: 90,
    },
    admittedMain: {
      sha: "fc05398bb1e003a104cb644d6d4879f64b613be9",
      tests: 92,
    },
    candidate: {
      tests: 107,
    },
  });
});
