import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm, writeFile, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LocalJsonlStore } from "../dist/src/persistence/jsonl-store.js";
import { DerivedEvidenceIndex } from "../dist/src/persistence/derived-evidence-index.js";

const scope = { situationId: "SIT-1", subjectType: "SERVICE", subjectId: "SVC-1" };
const baseline = {
  scopeRef: scope,
  version: 0,
  truthRefs: ["DOWN"],
  evidenceRefs: [],
  responsibility: {
    responsibilityRef: "R1",
    scopeRef: scope,
    holderPersonRef: "P1",
    roleRef: "NOC",
    assignmentRef: "A1",
    effectiveTime: "2026-09-18T00:00:00Z",
    currentness: { status: "CURRENT" },
    provenance: { sourceRefs: [], chainRefs: [] },
  },
  actingContextCandidates: [],
  dependencyRefs: [],
};
const evidence = (id) => ({
  evidenceId: id,
  sourceType: "TEST",
  sourceRef: "SRC",
  actorOrSystemRef: "SYS",
  receivedTime: "2026-09-18T00:00:00Z",
  currentness: { status: "CURRENT" },
  payloadOrRecordRef: id,
  provenanceChain: [],
});
const batch = (id, { effect = false, evidenceId = `EV-${id}` } = {}) => ({
  commitId: id,
  scopeRef: scope,
  actionExecutions: [],
  materialEffects: effect
    ? [{
        effectId: `EF-${id}`,
        scopeRef: scope,
        effectTypeRef: "RECOVERY",
        beforeTruthRefs: ["DOWN"],
        afterTruthRefs: ["UP"],
        materialEffectEstablished: true,
        actorOrMachineRef: "SYS",
        evidenceRefs: [evidenceId],
        provenance: { sourceRefs: [evidenceId], chainRefs: [] },
        currentness: { status: "CURRENT" },
        residualObligationRefs: [],
      }]
    : [],
  evidenceProvenance: [evidence(evidenceId)],
  responsibilityHandoverEffects: [],
  dependencyWaitingUpdates: [],
  residualObligationRefs: ["OB-1"],
  verificationClosureEffects: [],
  otherAuthoritativeP01ToP10Records: [],
});

async function withStore(fn) {
  const dir = await mkdtemp(join(tmpdir(), "appts-b9-"));
  try {
    const store = new LocalJsonlStore(dir);
    store.seed(baseline);
    await fn(store, dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function committedFiles(store) {
  return (await readdir(store.streamDirectory(scope))).filter((name) => name.endsWith(".jsonl")).sort();
}

test("B9 partial final write is incomplete and not committed truth", async () =>
  withStore(async (store) => {
    await store.append(0, batch("C1"));
    const path = join(store.streamDirectory(scope), "0000000002-C2.jsonl");
    await writeFile(path, "{\"streamIdentity\":", "utf8");
    const recovery = await store.recoverRecords(scope);
    assert.equal(recovery.recoveredVersion, 1);
    assert.equal(recovery.ignoredFinalTailFiles.length, 1);
  }));

test("B9 malformed final record is ignored/quarantinable", async () =>
  withStore(async (store) => {
    await store.append(0, batch("C1"));
    const path = join(store.streamDirectory(scope), "0000000002-C2.jsonl");
    await writeFile(path, "not-json\n", "utf8");
    const recovery = await store.recoverRecords(scope);
    assert.equal(recovery.recoveredVersion, 1);
    assert.equal(recovery.ignoredFinalTailFiles.length, 1);
  }));

test("B9 malformed interior record fails closed", async () =>
  withStore(async (store) => {
    await store.append(0, batch("C1"));
    const dir = store.streamDirectory(scope);
    await writeFile(join(dir, "0000000002-C2.jsonl"), "not-json\n", "utf8");
    const first = JSON.parse(await readFile(join(dir, (await committedFiles(store))[0]), "utf8"));
    const record3 = { ...first, version: 2, commitId: "C3", batch: batch("C3") };
    await writeFile(join(dir, "0000000003-C3.jsonl"), `${JSON.stringify(record3)}\n`, "utf8");
    await assert.rejects(() => store.recoverRecords(scope), /JSONL_INTERIOR_CORRUPTION/);
  }));

test("B9 version gap/duplicate/out-of-order fails closed", async () =>
  withStore(async (store) => {
    await store.append(0, batch("C1"));
    const dir = store.streamDirectory(scope);
    const first = JSON.parse(await readFile(join(dir, (await committedFiles(store))[0]), "utf8"));
    for (const [name, version] of [["0000000002-GAP.jsonl", 3], ["0000000002-DUP.jsonl", 1]]) {
      await writeFile(join(dir, name), `${JSON.stringify({ ...first, version, commitId: name, batch: batch(name) })}\n`, "utf8");
      await assert.rejects(() => store.recoverRecords(scope), /JSONL_VERSION_CORRUPTION/);
      await rm(join(dir, name));
    }
  }));

test("B9 restart/replay recovers last contiguous valid committed record", async () =>
  withStore(async (store, dir) => {
    await store.append(0, batch("C1"));
    await store.append(1, batch("C2", { effect: true }));
    const restarted = new LocalJsonlStore(dir);
    restarted.seed(baseline);
    const snapshot = await restarted.replay(scope);
    assert.equal(snapshot.version, 2);
    assert.deepEqual(snapshot.truthRefs, ["UP"]);
    assert.equal(snapshot.materialEffects.length, 1);
  }));

test("B9 next expectedVersion derives from recovered version after incomplete tail", async () =>
  withStore(async (store, dir) => {
    await store.append(0, batch("C1"));
    await writeFile(join(store.streamDirectory(scope), "0000000002-BAD.jsonl"), "{bad", "utf8");
    const restarted = new LocalJsonlStore(dir);
    restarted.seed(baseline);
    const appended = await restarted.append(1, batch("C2"));
    assert.equal(appended.newVersion, 2);
    const recovery = await restarted.recoverRecords(scope);
    assert.equal(recovery.recoveredVersion, 2);
  }));

test("B9 determining records are atomic in one physical AppendBatch record", async () =>
  withStore(async (store) => {
    const authoritativeBatch = batch("C1", { effect: true, evidenceId: "EV-ATOMIC" });
    await store.append(0, authoritativeBatch);
    const recovery = await store.recoverRecords(scope);
    assert.equal(recovery.records.length, 1);
    assert.deepEqual(recovery.records[0].batch, authoritativeBatch);
  }));

test("B9 derived evidence index loss/rebuild does not alter authoritative truth", async () =>
  withStore(async (store) => {
    await store.append(0, batch("C1", { effect: true, evidenceId: "EV-INDEX" }));
    const index = new DerivedEvidenceIndex();
    await index.rebuildFromAuthoritativeHistory(scope, store);
    assert.equal(index.readIndex(["EV-INDEX"]).length, 1);
    index.clear();
    assert.equal(index.readIndex(["EV-INDEX"]).length, 0);
    assert.equal((await store.replay(scope)).version, 1);
    await index.rebuildFromAuthoritativeHistory(scope, store);
    assert.equal(index.readIndex(["EV-INDEX"]).length, 1);
  }));

test("CODE-F03 restart/replay reconstructs confirmed responsibility handover", async () =>
  withStore(async (store, dir) => {
    const authoritative = batch("C1");
    authoritative.responsibilityHandoverEffects = [{
      handoverRef: "HO-1",
      scopeRef: scope,
      fromResponsibilityRef: "R1",
      proposedHolderPersonRef: "P2",
      proposedRoleRef: "NOC-2",
      proposedAssignmentRef: "A2",
      accepted: true,
      confirmedEffective: true,
      failedOrTimedOut: false,
      effectiveTime: "2026-09-18T00:01:00Z",
      evidenceRefs: ["EV-HO"],
      provenance: { sourceRefs: ["EV-HO"], chainRefs: [] },
    }];
    await store.append(0, authoritative);
    const restarted = new LocalJsonlStore(dir);
    restarted.seed(baseline);
    const snapshot = await restarted.replay(scope);
    assert.equal(snapshot.responsibility.holderPersonRef, "P2");
    assert.equal(snapshot.responsibilityHandoverEffects.length, 1);
  }));

test("CODE-F03 restart/replay reconstructs dependency waiting updates", async () =>
  withStore(async (store, dir) => {
    const dep = {
      dependencyRef: "DEP-X",
      scopeRef: scope,
      requiredConditionRef: "COND-X",
      requiredCapabilityOrAuthorityRefs: [],
      openedAt: "2026-09-18T00:00:00Z",
      blockedActionIds: ["RS-A-022"],
      alternateLawfulPathRefs: [],
      escalationObligationRefs: [],
      communicationObligationRefs: [],
      satisfied: false,
      satisfactionEvidenceRefs: [],
      currentness: { status: "CURRENT" },
      provenance: { sourceRefs: ["EV-D1"], chainRefs: [] },
    };
    const first = batch("C1");
    first.dependencyWaitingUpdates = [dep];
    await store.append(0, first);
    const second = batch("C2");
    second.dependencyWaitingUpdates = [{ ...dep, satisfied: true, satisfactionEvidenceRefs: ["EV-DONE"] }];
    await store.append(1, second);
    const restarted = new LocalJsonlStore(dir);
    restarted.seed(baseline);
    const snapshot = await restarted.replay(scope);
    assert.deepEqual(snapshot.dependencyRefs, []);
    assert.equal(snapshot.dependencyWaitingUpdates.length, 1);
    assert.equal(snapshot.dependencyWaitingUpdates[0].satisfied, true);
  }));

test("CODE-F03 restart/replay retains residual obligations", async () =>
  withStore(async (store, dir) => {
    const authoritative = batch("C1");
    authoritative.residualObligationRefs = ["OB-RETAIN"];
    await store.append(0, authoritative);
    const restarted = new LocalJsonlStore(dir);
    restarted.seed(baseline);
    assert.ok((await restarted.replay(scope)).residualObligationRefs.includes("OB-RETAIN"));
  }));

test("CODE-F03 restart/replay reconstructs verification closure effects", async () =>
  withStore(async (store, dir) => {
    const authoritative = batch("C1");
    authoritative.verificationClosureEffects = [{
      scopeRef: scope,
      workCompleted: true,
      materialRestorationEstablished: true,
      serviceVerified: true,
      customerVerified: false,
      closureEligible: false,
      closureDecisionAuthorized: false,
      residualObligationRefs: ["OB-CUSTOMER"],
      prohibitedInferences: ["service_verification_does_not_establish_customer_verification"],
    }];
    await store.append(0, authoritative);
    const restarted = new LocalJsonlStore(dir);
    restarted.seed(baseline);
    const snapshot = await restarted.replay(scope);
    assert.equal(snapshot.verificationClosureEffects.length, 1);
    assert.equal(snapshot.verificationClosureEffects[0].serviceVerified, true);
    assert.ok(snapshot.residualObligationRefs.includes("OB-CUSTOMER"));
  }));
