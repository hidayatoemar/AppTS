import assert from "node:assert/strict";
import test from "node:test";
import { evaluateResponsibilityHandover } from "../dist/src/runtime/responsibility-handover.js";
import { evaluateDependencyWaiting, dependencyCanRelease } from "../dist/src/runtime/dependency-waiting.js";
import { evaluateFieldWork } from "../dist/src/runtime/field-work.js";

const scope = { situationId: "SIT-1", subjectType: "SERVICE", subjectId: "SVC-1" };
const current = {
  responsibilityRef: "RESP-1",
  scopeRef: scope,
  holderPersonRef: "P1",
  roleRef: "NOC",
  assignmentRef: "A1",
  effectiveTime: "2026-09-17T12:00:00Z",
  currentness: { status: "CURRENT" },
  provenance: { sourceRefs: ["EV1"], chainRefs: [] },
};
const handover = {
  handoverRef: "HO-1",
  scopeRef: scope,
  fromResponsibilityRef: "RESP-1",
  proposedHolderPersonRef: "P2",
  proposedRoleRef: "NOC2",
  proposedAssignmentRef: "A2",
  accepted: true,
  confirmedEffective: true,
  failedOrTimedOut: false,
  effectiveTime: "2026-09-17T13:00:00Z",
  evidenceRefs: ["EV-HO"],
  provenance: { sourceRefs: ["EV-HO"], chainRefs: [] },
};

test("B6 handover initiation/acceptance alone does not transfer responsibility", () => {
  const r = evaluateResponsibilityHandover(current, { ...handover, confirmedEffective: false });
  assert.equal(r.kind, "RESPONSIBILITY_UNCHANGED");
});

test("B6 failed/timed-out handover preserves responsibility and creates intervention obligation", () => {
  const r = evaluateResponsibilityHandover(current, { ...handover, confirmedEffective: false, failedOrTimedOut: true });
  assert.equal(r.kind, "RESPONSIBILITY_UNCHANGED");
  assert.equal(r.interventionObligation, true);
  assert.equal(r.current.holderPersonRef, "P1");
});

test("B6 only confirmed effective governed handover creates transfer effect", () => {
  const r = evaluateResponsibilityHandover(current, handover);
  assert.equal(r.kind, "TRANSFER_EFFECT");
  assert.equal(r.previous.holderPersonRef, "P1");
  assert.equal(r.next.holderPersonRef, "P2");
});

test("B6 dependency remains blocking until current satisfied condition has evidence", () => {
  const dep = {
    dependencyRef: "DEP-1",
    scopeRef: scope,
    requiredConditionRef: "ACCESS",
    requiredCapabilityOrAuthorityRefs: ["AUTH-ACCESS"],
    openedAt: "2026-09-17T12:00:00Z",
    blockedActionIds: ["RS-A-022"],
    alternateLawfulPathRefs: ["PATH-ALT"],
    escalationObligationRefs: ["ESC-1"],
    communicationObligationRefs: ["COM-1"],
    satisfied: false,
    satisfactionEvidenceRefs: [],
    currentness: { status: "CURRENT" },
    provenance: { sourceRefs: ["EV-D"], chainRefs: [] },
  };
  assert.equal(evaluateDependencyWaiting(dep).blocked, true);
  assert.equal(dependencyCanRelease(dep), false);
  assert.equal(dependencyCanRelease({ ...dep, satisfied: true, satisfactionEvidenceRefs: ["EV-ACCESS"] }), true);
});

test("B6 follow-up/ACK without material satisfaction evidence does not release dependency", () => {
  const dep = {
    dependencyRef: "DEP-1",
    scopeRef: scope,
    requiredConditionRef: "ACCESS",
    requiredCapabilityOrAuthorityRefs: [],
    openedAt: "2026-09-17T12:00:00Z",
    blockedActionIds: ["RS-A-022"],
    alternateLawfulPathRefs: [],
    escalationObligationRefs: [],
    communicationObligationRefs: ["ACK-1"],
    satisfied: true,
    satisfactionEvidenceRefs: [],
    currentness: { status: "CURRENT" },
    provenance: { sourceRefs: ["ACK-1"], chainRefs: [] },
  };
  const r = evaluateDependencyWaiting(dep);
  assert.equal(r.blocked, true);
  assert.ok(r.reasons.includes("satisfaction_evidence_missing"));
});

test("B6 field COMPLETED does not establish restoration/service verification or transfer Purpose responsibility", () => {
  const r = evaluateFieldWork({
    fieldWorkRef: "FW-1",
    scopeRef: scope,
    progress: "COMPLETED",
    assignedPersonRef: "TECH-1",
    evidenceRefs: ["EV-FW"],
    currentness: { status: "CURRENT" },
    provenance: { sourceRefs: ["EV-FW"], chainRefs: [] },
  });
  assert.equal(r.workCompleted, true);
  assert.equal(r.restorationEstablished, false);
  assert.equal(r.serviceVerificationEstablished, false);
  assert.equal(r.purposeResponsibilityTransferred, false);
});
