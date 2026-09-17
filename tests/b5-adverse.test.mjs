import assert from "node:assert/strict";
import test from "node:test";
import { executeCommand } from "../dist/src/runtime/command-pipeline.js";
import { InMemoryStore } from "../dist/src/persistence/in-memory-store.js";
import { firstSlicePolicy } from "../dist/src/config/policy-config.js";
import { ManualClock } from "../dist/src/simulator/clock.js";
import { DeterministicIdGenerator } from "../dist/src/simulator/ids.js";
import { makeCandidate, makeServiceScope, makeSnapshot } from "../dist/src/simulator/fixture.js";

const makeCommand = (scopeRef, overrides = {}) => ({
  commandId: "CMD-B5-001",
  actionId: "RS-A-022",
  purposeRef: {
    purpose: "RESTORE_SERVICE",
    situationId: scopeRef.situationId,
    compositionInstanceId: "COMP-B5",
    startedFromBasisRef: "EV-INTAKE",
  },
  scopeRef,
  requestedByActorOrMachineRef: "PERSON-001",
  actingContextRef: "CTX-001",
  expectedInputVersion: 0,
  requestTime: "2026-09-17T12:00:00.000Z",
  evidenceRefs: ["EV-DIAGNOSIS"],
  ...overrides,
});

const successfulOutcome = {
  executionResult: "EXECUTED",
  executorRef: "EXECUTOR-B5",
  executionEvidenceRefs: ["EV-EXEC-B5"],
  uncertaintyFlag: false,
  resultantEffect: {
    effectTypeRef: "EFFECT-SERVICE-RECOVERED",
    beforeTruthRefs: ["TRUTH-DOWN"],
    afterTruthRefs: ["TRUTH-UP"],
    evidenceRefs: ["EV-RECOVERY-B5"],
    materialEffectEstablished: true,
  },
};

function runtime({ snapshot, policy = firstSlicePolicy, outcome = successfulOutcome }) {
  const repository = new InMemoryStore();
  repository.seed(snapshot);
  let calls = 0;
  const executor = {
    async execute() {
      calls += 1;
      return structuredClone(outcome);
    },
  };
  const deps = {
    repository,
    policy,
    executor,
    clock: new ManualClock(new Date("2026-09-17T12:00:00.000Z")),
    ids: new DeterministicIdGenerator(),
    requiredAuthorityRefByAction: { "RS-A-022": "AUTH-RS-A022" },
  };
  return { repository, deps, calls: () => calls };
}

test("B5 ambiguous Acting Context fails closed before execution", async () => {
  const scope = makeServiceScope();
  const snapshot = makeSnapshot(scope, [
    makeCandidate(scope),
    makeCandidate(scope, { contextRef: "CTX-002", personRef: "PERSON-002" }),
  ]);
  const r = runtime({ snapshot });
  const result = await executeCommand(makeCommand(scope), r.deps);
  assert.equal(result.kind, "REJECTED");
  assert.ok(result.reasons.includes("acting_context_ambiguous"));
  assert.equal(r.calls(), 0);
  assert.equal((await r.repository.load(scope)).version, 0);
});

test("B5 no lawful Acting Context fails closed", async () => {
  const scope = makeServiceScope();
  const r = runtime({ snapshot: makeSnapshot(scope, []) });
  const result = await executeCommand(makeCommand(scope), r.deps);
  assert.equal(result.kind, "REJECTED");
  assert.ok(result.reasons.includes("no_lawful_context_or_machine_authority"));
  assert.equal(r.calls(), 0);
});

test("B5 integrity conflict fails closed", async () => {
  const scope = makeServiceScope();
  const conflicted = makeCandidate(scope, {
    integrity: { sufficient: true, conflict: true, evidenceRefs: ["EV-CONFLICT"] },
  });
  const r = runtime({ snapshot: makeSnapshot(scope, [conflicted]) });
  const result = await executeCommand(makeCommand(scope), r.deps);
  assert.equal(result.kind, "REJECTED");
  assert.ok(result.reasons.includes("integrity_unsatisfied"));
  assert.equal(r.calls(), 0);
});

test("B5 explicit dependency blocks downstream action", async () => {
  const scope = makeServiceScope();
  const snapshot = makeSnapshot(scope);
  snapshot.dependencyRefs = ["DEP-ACCESS"];
  const r = runtime({ snapshot });
  const result = await executeCommand(makeCommand(scope), r.deps);
  assert.equal(result.kind, "REJECTED");
  assert.ok(result.reasons.includes("dependency_unsatisfied"));
  assert.equal(r.calls(), 0);
});

test("B5 stale expected input version rejects before executor", async () => {
  const scope = makeServiceScope();
  const snapshot = makeSnapshot(scope);
  snapshot.version = 2;
  const r = runtime({ snapshot });
  const result = await executeCommand(makeCommand(scope, { expectedInputVersion: 1 }), r.deps);
  assert.deepEqual(result, { kind: "REJECTED", reasons: ["stale_expected_version"] });
  assert.equal(r.calls(), 0);
});

test("B5 Gate not READY fails closed", async () => {
  const scope = makeServiceScope();
  const policy = { ...firstSlicePolicy, gateByAction: { "RS-A-022": "CONFIRMING" } };
  const r = runtime({ snapshot: makeSnapshot(scope), policy });
  const result = await executeCommand(makeCommand(scope), r.deps);
  assert.equal(result.kind, "REJECTED");
  assert.ok(result.reasons.includes("gate_not_ready"));
  assert.equal(r.calls(), 0);
});

test("B5 human Enable not ENABLED fails closed", async () => {
  const scope = makeServiceScope();
  const policy = { ...firstSlicePolicy, enableByAction: { "RS-A-022": "HOLD" } };
  const r = runtime({ snapshot: makeSnapshot(scope), policy });
  const result = await executeCommand(makeCommand(scope), r.deps);
  assert.equal(result.kind, "REJECTED");
  assert.ok(result.reasons.includes("human_enable_not_enabled"));
  assert.equal(r.calls(), 0);
});

test("B5 selected Acting Context must match the unique lawful context", async () => {
  const scope = makeServiceScope();
  const r = runtime({ snapshot: makeSnapshot(scope) });
  const result = await executeCommand(makeCommand(scope, { actingContextRef: "CTX-WRONG" }), r.deps);
  assert.deepEqual(result, { kind: "REJECTED", reasons: ["acting_context_reference_mismatch"] });
  assert.equal(r.calls(), 0);
});

test("B5 NO_EFFECT remains distinct and does not advance material truth", async () => {
  const scope = makeServiceScope();
  const outcome = {
    executionResult: "EXECUTED",
    executorRef: "EXECUTOR-B5",
    executionEvidenceRefs: ["EV-EXEC-B5"],
    uncertaintyFlag: false,
    resultantEffect: {
      effectTypeRef: "EFFECT-NO-CHANGE",
      beforeTruthRefs: ["TRUTH-DOWN"],
      afterTruthRefs: ["TRUTH-UP-SHOULD-NOT-APPLY"],
      evidenceRefs: ["EV-NO-EFFECT"],
      materialEffectEstablished: false,
      noEffectOrFailureReason: "NO_EFFECT",
    },
  };
  const r = runtime({ snapshot: makeSnapshot(scope), outcome });
  const result = await executeCommand(makeCommand(scope), r.deps);
  assert.equal(result.kind, "COMMITTED");
  assert.equal(result.execution.executionResult, "EXECUTED");
  assert.equal(result.effects.length, 1);
  assert.equal(result.effects[0].materialEffectEstablished, false);
  assert.equal(result.effects[0].noEffectOrFailureReason, "NO_EFFECT");
  assert.deepEqual((await r.repository.load(scope)).truthRefs, ["TRUTH-DOWN"]);
});

test("B5 FAILED execution is distinct from NO_EFFECT and creates no material effect", async () => {
  const scope = makeServiceScope();
  const outcome = {
    executionResult: "FAILED",
    executorRef: "EXECUTOR-B5",
    executionEvidenceRefs: ["EV-FAILED"],
    uncertaintyFlag: false,
  };
  const r = runtime({ snapshot: makeSnapshot(scope), outcome });
  const result = await executeCommand(makeCommand(scope), r.deps);
  assert.equal(result.kind, "COMMITTED");
  assert.equal(result.execution.executionResult, "FAILED");
  assert.equal(result.effects.length, 0);
  assert.deepEqual((await r.repository.load(scope)).truthRefs, ["TRUTH-DOWN"]);
});

test("B5 sibling ScopeRef remains unchanged when one scope commits", async () => {
  const scopeA = makeServiceScope();
  const scopeB = { ...scopeA, subjectId: "SVC-002" };
  const repository = new InMemoryStore();
  repository.seed(makeSnapshot(scopeA));
  repository.seed(makeSnapshot(scopeB));
  let calls = 0;
  const deps = {
    repository,
    policy: firstSlicePolicy,
    executor: {
      async execute() {
        calls += 1;
        return structuredClone(successfulOutcome);
      },
    },
    clock: new ManualClock(new Date("2026-09-17T12:00:00.000Z")),
    ids: new DeterministicIdGenerator(),
    requiredAuthorityRefByAction: { "RS-A-022": "AUTH-RS-A022" },
  };
  const result = await executeCommand(makeCommand(scopeA), deps);
  assert.equal(result.kind, "COMMITTED");
  assert.equal(calls, 1);
  assert.equal((await repository.load(scopeA)).version, 1);
  assert.deepEqual((await repository.load(scopeA)).truthRefs, ["TRUTH-UP"]);
  assert.equal((await repository.load(scopeB)).version, 0);
  assert.deepEqual((await repository.load(scopeB)).truthRefs, ["TRUTH-DOWN"]);
});

test("B5 unrecognized bounded machine authority must fail closed", async () => {
  const scope = makeServiceScope();
  const r = runtime({ snapshot: makeSnapshot(scope, []) });
  const command = makeCommand(scope, {
    requestedByActorOrMachineRef: "MACHINE-001",
    actingContextRef: undefined,
    boundedMachineAuthorityRef: "UNRECOGNIZED-MACHINE-AUTH",
  });
  const result = await executeCommand(command, r.deps);
  assert.equal(result.kind, "REJECTED");
  assert.ok(result.reasons.includes("bounded_machine_authority_not_pre_authorized"));
  assert.equal(r.calls(), 0);
});

test("B5 stale Situation Responsibility fails closed for unseen consequential command", async () => {
  const scope = makeServiceScope();
  const snapshot = makeSnapshot(scope);
  snapshot.responsibility.currentness = { status: "STALE", basisRef: "EV-RESP-OLD" };
  const r = runtime({ snapshot });
  const result = await executeCommand(makeCommand(scope), r.deps);
  assert.equal(result.kind, "REJECTED");
  assert.ok(result.reasons.includes("currentness_unsatisfied"));
  assert.equal(r.calls(), 0);
});

test("B5 explicitly pre-authorized bounded machine execution may proceed without human Acting Context", async () => {
  const scope = makeServiceScope();
  const policy = {
    ...firstSlicePolicy,
    boundedMachineAuthorityRefsByAction: { "RS-A-022": ["MACHINE-AUTH-RS-A022"] },
  };
  const r = runtime({ snapshot: makeSnapshot(scope, []), policy });
  const command = makeCommand(scope, {
    commandId: "CMD-B5-MACHINE-OK",
    requestedByActorOrMachineRef: "MACHINE-001",
    actingContextRef: undefined,
    boundedMachineAuthorityRef: "MACHINE-AUTH-RS-A022",
  });
  const result = await executeCommand(command, r.deps);
  assert.equal(result.kind, "COMMITTED");
  assert.equal(r.calls(), 1);
});
