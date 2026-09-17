import assert from "node:assert/strict";
import test from "node:test";
import {
  holdUncertainExternalEffect,
  reconcileExternalEffect,
  recordProviderCompletionEvidence,
} from "../dist/src/runtime/external-reconciliation-controller.js";

const scope = { situationId: "SIT-1", subjectType: "SERVICE", subjectId: "SVC-1" };
const observation = {
  interactionRef: "EXT-1",
  requestIdentityRef: "REQ-1",
  scopeRef: scope,
  providerRef: "PROVIDER-1",
  requestEvidenceRefs: ["EV-REQ"],
  responseEvidenceRefs: ["EV-RESP"],
  currentness: { status: "CURRENT" },
  integrity: { sufficient: true, conflict: false, evidenceRefs: ["EV-I"] },
  receivedTime: "2026-09-18T00:00:00Z",
};
const rec = (overrides = {}) => ({
  reconciliationRef: "REC-1",
  requestIdentityRef: "REQ-1",
  scopeRef: scope,
  evidenceRefs: ["EV-REC"],
  currentness: { status: "CURRENT" },
  integrity: { sufficient: true, conflict: false, evidenceRefs: ["EV-REC-I"] },
  effectEstablishedByGovernedEvidence: false,
  noEffectEstablishedByGovernedEvidence: false,
  receivedTime: "2026-09-18T00:01:00Z",
  ...overrides,
});

test("TV-RS-018 uncertain external effect holds retry and creates no canonical outcome", () => {
  const r = holdUncertainExternalEffect(observation);
  assert.equal(r.materialEffectEstablished, false);
  assert.equal(r.retryHeld, true);
  assert.equal(r.reconciliationRequired, true);
  assert.equal(r.retryAuthorized, false);
  assert.equal("outcomeUnknown" in r, false);
});

test("TV-RS-003 provider completion is evidence/dependency progress only", () => {
  const r = recordProviderCompletionEvidence(observation);
  assert.deepEqual(r.dependencyProgressEvidenceRefs, ["EV-RESP"]);
  assert.equal(r.internalRestorationEstablished, false);
  assert.equal(r.serviceVerificationEstablished, false);
  assert.equal(r.closureEstablished, false);
});

test("reconciliation identity mismatch fails closed and keeps retry held", () => {
  const r = reconcileExternalEffect(
    observation,
    rec({ requestIdentityRef: "REQ-OTHER", noEffectEstablishedByGovernedEvidence: true }),
  );
  assert.equal(r.retryHeld, true);
  assert.equal(r.reconciliationRequired, true);
  assert.ok(r.reasons.includes("request_identity_mismatch"));
});

test("stale reconciliation evidence fails closed", () => {
  const r = reconcileExternalEffect(
    observation,
    rec({ currentness: { status: "STALE" }, noEffectEstablishedByGovernedEvidence: true }),
  );
  assert.equal(r.retryHeld, true);
  assert.ok(r.reasons.includes("reconciliation_evidence_not_usable"));
});

test("TV-RS-019 exact no-effect reconciliation releases hold only to lawful reevaluation", () => {
  const r = reconcileExternalEffect(observation, rec({ noEffectEstablishedByGovernedEvidence: true }));
  assert.equal(r.retryHeld, false);
  assert.equal(r.reconciliationRequired, false);
  assert.equal(r.requiresGateEnableAndLawfulActionReevaluation, true);
  assert.equal(r.retryAuthorized, false);
});

test("exact effect reconciliation records external material effect but never internal verification/closure", () => {
  const r = reconcileExternalEffect(observation, rec({ effectEstablishedByGovernedEvidence: true }));
  assert.equal(r.materialEffectEstablished, true);
  assert.equal(r.retryHeld, true);
  assert.equal(r.internalRestorationEstablished, false);
  assert.equal(r.serviceVerificationEstablished, false);
  assert.equal(r.closureEstablished, false);
});
