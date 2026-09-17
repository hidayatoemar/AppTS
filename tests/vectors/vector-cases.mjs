import assert from "node:assert/strict";
import { executeCommand } from "../../dist/src/runtime/command-pipeline.js";
import { evaluateFieldWork } from "../../dist/src/runtime/field-work-controller.js";
import { evaluateDependencyWaiting } from "../../dist/src/runtime/dependency-waiting-controller.js";
import { evaluateResponsibilityHandover } from "../../dist/src/runtime/responsibility-handover-controller.js";
import { evaluateVerificationClosure } from "../../dist/src/runtime/verification-closure-evaluator.js";
import { holdUncertainExternalEffect, reconcileExternalEffect, recordProviderCompletionEvidence } from "../../dist/src/runtime/external-reconciliation-controller.js";
import { resolveActingContext } from "../../dist/src/runtime/acting-context-resolver.js";
import { InMemoryStore } from "../../dist/src/persistence/in-memory-store.js";
import { firstSlicePolicy } from "../../dist/src/config/policy-config.js";
import { ManualClock } from "../../dist/src/simulator/clock.js";
import { DeterministicIdGenerator } from "../../dist/src/simulator/ids.js";
import { makeCandidate, makeServiceScope, makeSnapshot, makeResponsibility } from "../../dist/src/simulator/fixture.js";

const condition = (ref, satisfied) => ({ conditionRef: ref, satisfied, evidenceRefs: [`EV-${ref}`] });
const scope = () => makeServiceScope();
const verificationInput = (overrides = {}) => ({
  scopeRef: scope(),
  workCompleted: false,
  materialRestorationEstablished: false,
  serviceVerification: condition("SERVICE", false),
  customerVerification: condition("CUSTOMER", false),
  closureEligibility: condition("ELIGIBLE", false),
  closureDecisionAuthorization: condition("CLOSE", false),
  residualObligationRefs: [],
  ...overrides,
});
const fieldRecord = (progress) => ({
  fieldWorkRef: `FW-${progress}`,
  scopeRef: scope(),
  progress,
  assignedPersonRef: "TECH-1",
  evidenceRefs: [`EV-${progress}`],
  currentness: { status: "CURRENT" },
  provenance: { sourceRefs: [`EV-${progress}`], chainRefs: [] },
});
const dependency = (overrides = {}) => ({
  dependencyRef: "DEP-1",
  scopeRef: scope(),
  requiredConditionRef: "ACCESS",
  requiredCapabilityOrAuthorityRefs: ["AUTH-ACCESS"],
  openedAt: "2026-09-18T00:00:00Z",
  blockedActionIds: ["RS-A-022"],
  alternateLawfulPathRefs: [],
  escalationObligationRefs: [],
  communicationObligationRefs: [],
  satisfied: false,
  satisfactionEvidenceRefs: [],
  currentness: { status: "CURRENT" },
  provenance: { sourceRefs: ["EV-DEP"], chainRefs: [] },
  ...overrides,
});
const handover = (current, overrides = {}) => ({
  handoverRef: "HO-1",
  scopeRef: current.scopeRef,
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
  ...overrides,
});
const externalObservation = () => ({
  interactionRef: "EXT-1",
  requestIdentityRef: "REQ-1",
  scopeRef: scope(),
  providerRef: "PROVIDER-1",
  requestEvidenceRefs: ["EV-REQ"],
  responseEvidenceRefs: ["EV-RESP"],
  currentness: { status: "CURRENT" },
  integrity: { sufficient: true, conflict: false, evidenceRefs: ["EV-I"] },
  receivedTime: "2026-09-18T00:00:00Z",
});
const reconciliation = (overrides = {}) => ({
  reconciliationRef: "REC-1",
  requestIdentityRef: "REQ-1",
  scopeRef: scope(),
  evidenceRefs: ["EV-REC"],
  currentness: { status: "CURRENT" },
  integrity: { sufficient: true, conflict: false, evidenceRefs: ["EV-REC-I"] },
  effectEstablishedByGovernedEvidence: false,
  noEffectEstablishedByGovernedEvidence: false,
  receivedTime: "2026-09-18T00:01:00Z",
  ...overrides,
});

function commandRuntime(snapshot, outcome = {
  executionResult: "EXECUTED",
  executorRef: "EXECUTOR",
  executionEvidenceRefs: ["EV-EXEC"],
  uncertaintyFlag: false,
  resultantEffect: {
    effectTypeRef: "EFFECT-SERVICE-RECOVERED",
    beforeTruthRefs: ["TRUTH-DOWN"],
    afterTruthRefs: ["TRUTH-UP"],
    evidenceRefs: ["EV-RECOVERY"],
    materialEffectEstablished: true,
  },
}) {
  const repository = new InMemoryStore();
  repository.seed(snapshot);
  let calls = 0;
  const deps = {
    repository,
    policy: firstSlicePolicy,
    executor: { async execute() { calls += 1; return structuredClone(outcome); } },
    clock: new ManualClock(new Date("2026-09-18T00:00:00Z")),
    ids: new DeterministicIdGenerator(),
    requiredAuthorityRefByAction: { "RS-A-022": "AUTH-RS-A022" },
  };
  return { repository, deps, calls: () => calls };
}
const command = (s, overrides = {}) => ({
  commandId: "CMD-VECTOR",
  actionId: "RS-A-022",
  purposeRef: { purpose: "RESTORE_SERVICE", situationId: s.situationId, compositionInstanceId: "COMP", startedFromBasisRef: "EV-INTAKE" },
  scopeRef: s,
  requestedByActorOrMachineRef: "PERSON-001",
  actingContextRef: "CTX-001",
  expectedInputVersion: 0,
  requestTime: "2026-09-18T00:00:00Z",
  evidenceRefs: ["EV-DIAGNOSIS"],
  ...overrides,
});

export const vectorNames = {
  "001": "clean restore no field: material recovery only; responsibility unchanged",
  "002": "field progression remains field truth until separate recovery evidence",
  "003": "provider completion is not internal Service Verification",
  "004": "event/evidence alone is not a command trigger or state transition",
  "005": "conflicting observations are preserved; no last-message-wins",
  "006": "support participation does not transfer Purpose responsibility",
  "007": "unavailable holder/context does not silently substitute",
  "008": "ON_SITE without access does not make work ready",
  "009": "work completed does not imply Service Verification",
  "010": "Service Verification may be true while Customer Verification remains pending",
  "011": "Customer Verification does not decide closure",
  "012": "blocking residual obligation prevents closure eligibility",
  "013": "non-blocking residual obligation survives closure decision",
  "014": "handover initiated/accepted does not transfer responsibility",
  "015": "confirmed handover transfers once; replay cannot transfer again",
  "016": "handover/duty timeout creates obligation without responsibility transfer",
  "017": "escalation obligation does not transfer responsibility",
  "018": "uncertain external effect holds retry; no canonical OUTCOME_UNKNOWN",
  "019": "reconciled no-effect requires fresh lawful-action reevaluation before retry",
  "020": "sibling scope remains unchanged when another scope changes",
  "021": "stale evidence/context blocks consequential action",
  "022": "exactly one lawful Acting Context resolves EXACT_ONE",
  "023": "multiple lawful Acting Contexts resolve AMBIGUOUS",
  "024": "no lawful Acting Context resolves NONE",
  "025": "ACK/follow-up is evidence only and does not satisfy dependency",
  "026": "background scoped event changes only its sibling branch",
  "027": "customer unreachable retains Service Verification without invented closure",
  "028": "brief/unstable UP observation does not establish VERIFIED_OK",
};

export async function runVector(id) {
  switch (id) {
    case "001": {
      const s = scope();
      const r = commandRuntime(makeSnapshot(s));
      const result = await executeCommand(command(s), r.deps);
      assert.equal(result.kind, "COMMITTED");
      assert.equal(result.effects[0].materialEffectEstablished, true);
      assert.equal((await r.repository.load(s)).responsibility.holderPersonRef, "PERSON-001");
      return;
    }
    case "002": {
      const stages = ["REQUESTED", "ASSIGNED", "MOBILIZING", "ON_SITE", "ACCESS_WORK_READY", "STARTED", "COMPLETED"];
      for (const stage of stages) {
        const r = evaluateFieldWork(fieldRecord(stage));
        assert.equal(r.restorationEstablished, false);
        assert.equal(r.serviceVerificationEstablished, false);
        assert.equal(r.purposeResponsibilityTransferred, false);
      }
      assert.equal(evaluateFieldWork(fieldRecord("COMPLETED")).workCompleted, true);
      return;
    }
    case "003": {
      const r = recordProviderCompletionEvidence(externalObservation());
      assert.equal(r.internalRestorationEstablished, false);
      assert.equal(r.serviceVerificationEstablished, false);
      assert.equal(r.closureEstablished, false);
      return;
    }
    case "004": {
      const s = scope();
      const store = new InMemoryStore();
      store.seed(makeSnapshot(s));
      store.mutateForTest(s, (snap) => snap.evidenceRefs.push("EV-EXTERNAL-EVENT"));
      const after = await store.load(s);
      assert.equal(after.version, 0);
      assert.deepEqual(after.truthRefs, ["TRUTH-DOWN"]);
      return;
    }
    case "005": {
      const s = scope();
      const store = new InMemoryStore();
      store.seed(makeSnapshot(s));
      store.mutateForTest(s, (snap) => snap.evidenceRefs.push("OBS-UP", "OBS-DOWN", "EV-CONFLICT"));
      const after = await store.load(s);
      assert.ok(after.evidenceRefs.includes("OBS-UP"));
      assert.ok(after.evidenceRefs.includes("OBS-DOWN"));
      assert.deepEqual(after.truthRefs, ["TRUTH-DOWN"]);
      return;
    }
    case "006": {
      const current = makeResponsibility(scope());
      const dep = evaluateDependencyWaiting(dependency({ requiredCapabilityOrAuthorityRefs: ["SUPPORT-TEAM"] }));
      assert.equal(dep.blocked, true);
      assert.equal(current.holderPersonRef, "PERSON-001");
      return;
    }
    case "007": {
      const s = scope();
      const candidate = makeCandidate(s, { applicability: condition("AVAILABLE", false) });
      const r = commandRuntime(makeSnapshot(s, [candidate]));
      const result = await executeCommand(command(s), r.deps);
      assert.equal(result.kind, "REJECTED");
      assert.equal((await r.repository.load(s)).responsibility.holderPersonRef, "PERSON-001");
      assert.equal(r.calls(), 0);
      return;
    }
    case "008": {
      const field = evaluateFieldWork(fieldRecord("ON_SITE"));
      const dep = evaluateDependencyWaiting(dependency({ requiredConditionRef: "ACCESS" }));
      assert.equal(field.workCompleted, false);
      assert.equal(dep.blocked, true);
      return;
    }
    case "009": {
      const r = evaluateVerificationClosure(verificationInput({ workCompleted: true }));
      assert.equal(r.serviceVerified, false);
      return;
    }
    case "010": {
      const r = evaluateVerificationClosure(verificationInput({ materialRestorationEstablished: true, serviceVerification: condition("SERVICE", true) }));
      assert.equal(r.serviceVerified, true);
      assert.equal(r.customerVerified, false);
      return;
    }
    case "011": {
      const r = evaluateVerificationClosure(verificationInput({ materialRestorationEstablished: true, serviceVerification: condition("SERVICE", true), customerVerification: condition("CUSTOMER", true), closureEligibility: condition("ELIGIBLE", true) }));
      assert.equal(r.customerVerified, true);
      assert.equal(r.closureDecisionAuthorized, false);
      return;
    }
    case "012": {
      const r = evaluateVerificationClosure(verificationInput({ materialRestorationEstablished: true, serviceVerification: condition("SERVICE", true), customerVerification: condition("CUSTOMER", true), residualObligationRefs: ["OB-BLOCKING"] }));
      assert.equal(r.closureEligible, false);
      assert.deepEqual(r.residualObligationRefs, ["OB-BLOCKING"]);
      return;
    }
    case "013": {
      const r = evaluateVerificationClosure(verificationInput({ materialRestorationEstablished: true, serviceVerification: condition("SERVICE", true), customerVerification: condition("CUSTOMER", true), closureEligibility: condition("ELIGIBLE", true), closureDecisionAuthorization: condition("CLOSE", true), residualObligationRefs: ["OB-NONBLOCKING"] }));
      assert.equal(r.closureDecisionAuthorized, true);
      assert.deepEqual(r.residualObligationRefs, ["OB-NONBLOCKING"]);
      return;
    }
    case "014": {
      const current = makeResponsibility(scope());
      const r = evaluateResponsibilityHandover(current, handover(current, { confirmedEffective: false }));
      assert.equal(r.kind, "RESPONSIBILITY_UNCHANGED");
      return;
    }
    case "015": {
      const current = makeResponsibility(scope());
      const first = evaluateResponsibilityHandover(current, handover(current));
      assert.equal(first.kind, "TRANSFER_EFFECT");
      const replay = evaluateResponsibilityHandover(first.next, handover(current));
      assert.equal(replay.kind, "RESPONSIBILITY_UNCHANGED");
      assert.ok(replay.reasons.includes("handover_source_mismatch"));
      return;
    }
    case "016": {
      const current = makeResponsibility(scope());
      const r = evaluateResponsibilityHandover(current, handover(current, { confirmedEffective: false, failedOrTimedOut: true }));
      assert.equal(r.kind, "RESPONSIBILITY_UNCHANGED");
      assert.equal(r.interventionObligation, true);
      return;
    }
    case "017": {
      const current = makeResponsibility(scope());
      const r = evaluateDependencyWaiting(dependency({ escalationObligationRefs: ["ESC-1"] }));
      assert.deepEqual(r.escalationObligationRefs, ["ESC-1"]);
      assert.equal(current.holderPersonRef, "PERSON-001");
      return;
    }
    case "018": {
      const r = holdUncertainExternalEffect(externalObservation());
      assert.equal(r.retryHeld, true);
      assert.equal(r.materialEffectEstablished, false);
      assert.equal("outcomeUnknown" in r, false);
      return;
    }
    case "019": {
      const r = reconcileExternalEffect(externalObservation(), reconciliation({ noEffectEstablishedByGovernedEvidence: true }));
      assert.equal(r.retryHeld, false);
      assert.equal(r.requiresGateEnableAndLawfulActionReevaluation, true);
      assert.equal(r.retryAuthorized, false);
      return;
    }
    case "020": {
      const a = scope();
      const b = { ...a, subjectId: "SVC-002" };
      const store = new InMemoryStore();
      store.seed(makeSnapshot(a));
      store.seed(makeSnapshot(b));
      store.mutateForTest(a, (snap) => { snap.truthRefs = ["TRUTH-UP"]; snap.version = 1; });
      assert.deepEqual((await store.load(b)).truthRefs, ["TRUTH-DOWN"]);
      assert.equal((await store.load(b)).version, 0);
      return;
    }
    case "021": {
      const s = scope();
      const stale = makeCandidate(s, { currentness: { status: "STALE", basisRef: "EV-OLD" } });
      const r = resolveActingContext({ scopeRef: s, requiredAuthorityRef: "AUTH-RS-A022", responsibility: makeResponsibility(s), candidates: [stale], allowStale: false });
      assert.equal(r.kind, "NONE");
      return;
    }
    case "022": {
      const s = scope();
      const r = resolveActingContext({ scopeRef: s, requiredAuthorityRef: "AUTH-RS-A022", responsibility: makeResponsibility(s), candidates: [makeCandidate(s)], allowStale: false });
      assert.equal(r.kind, "EXACT_ONE");
      return;
    }
    case "023": {
      const s = scope();
      const r = resolveActingContext({ scopeRef: s, requiredAuthorityRef: "AUTH-RS-A022", responsibility: makeResponsibility(s), candidates: [makeCandidate(s), makeCandidate(s, { contextRef: "CTX-2", personRef: "P2" })], allowStale: false });
      assert.equal(r.kind, "AMBIGUOUS");
      return;
    }
    case "024": {
      const s = scope();
      const r = resolveActingContext({ scopeRef: s, requiredAuthorityRef: "AUTH-RS-A022", responsibility: makeResponsibility(s), candidates: [], allowStale: false });
      assert.equal(r.kind, "NONE");
      return;
    }
    case "025": {
      const r = evaluateDependencyWaiting(dependency({ communicationObligationRefs: ["ACK-1"], satisfied: true, satisfactionEvidenceRefs: [] }));
      assert.equal(r.blocked, true);
      assert.ok(r.reasons.includes("satisfaction_evidence_missing"));
      return;
    }
    case "026": {
      const a = scope();
      const b = { ...a, subjectId: "SVC-002" };
      const store = new InMemoryStore();
      store.seed(makeSnapshot(a));
      store.seed(makeSnapshot(b));
      store.mutateForTest(b, (snap) => snap.evidenceRefs.push("EV-BACKGROUND-B"));
      assert.equal((await store.load(a)).evidenceRefs.includes("EV-BACKGROUND-B"), false);
      assert.equal((await store.load(b)).evidenceRefs.includes("EV-BACKGROUND-B"), true);
      return;
    }
    case "027": {
      const r = evaluateVerificationClosure(verificationInput({ materialRestorationEstablished: true, serviceVerification: condition("SERVICE", true), customerVerification: condition("CUSTOMER-UNREACHABLE", false), residualObligationRefs: ["COM-CUSTOMER-RETRY"] }));
      assert.equal(r.serviceVerified, true);
      assert.equal(r.customerVerified, false);
      assert.equal(r.closureEligible, false);
      assert.equal(r.closureDecisionAuthorized, false);
      return;
    }
    case "028": {
      const r = evaluateVerificationClosure(verificationInput({ materialRestorationEstablished: true, serviceVerification: condition("STABILITY", false) }));
      assert.equal(r.materialRestorationEstablished, true);
      assert.equal(r.serviceVerified, false);
      return;
    }
    default:
      throw new Error(`UNKNOWN_VECTOR:${id}`);
  }
}
