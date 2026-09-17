import assert from "node:assert/strict";
import test from "node:test";
import { evaluateVerificationClosure } from "../dist/src/runtime/verification-closure.js";

const scope = { situationId: "SIT-1", subjectType: "SERVICE", subjectId: "SVC-1" };
const cond = (id, satisfied) => ({ conditionRef: id, satisfied, evidenceRefs: satisfied ? [`EV-${id}`] : [] });

test("B7 work completed does not imply restoration or verification", () => {
  const r = evaluateVerificationClosure({ scopeRef: scope, workCompleted: true, materialRestorationEstablished: false, serviceVerification: cond("SV", false), customerVerification: cond("CV", false), closureEligibility: cond("CE", false), closureDecisionAuthorization: cond("CD", false), residualObligationRefs: [] });
  assert.equal(r.workCompleted, true);
  assert.equal(r.materialRestorationEstablished, false);
  assert.equal(r.serviceVerified, false);
  assert.ok(r.prohibitedInferences.includes("work_completed_does_not_establish_restoration"));
});

test("B7 restoration does not imply Service Verification", () => {
  const r = evaluateVerificationClosure({ scopeRef: scope, workCompleted: true, materialRestorationEstablished: true, serviceVerification: cond("SV", false), customerVerification: cond("CV", false), closureEligibility: cond("CE", false), closureDecisionAuthorization: cond("CD", false), residualObligationRefs: [] });
  assert.equal(r.materialRestorationEstablished, true);
  assert.equal(r.serviceVerified, false);
});

test("B7 Service Verification does not imply Customer Verification", () => {
  const r = evaluateVerificationClosure({ scopeRef: scope, workCompleted: true, materialRestorationEstablished: true, serviceVerification: cond("SV", true), customerVerification: cond("CV", false), closureEligibility: cond("CE", false), closureDecisionAuthorization: cond("CD", false), residualObligationRefs: [] });
  assert.equal(r.serviceVerified, true);
  assert.equal(r.customerVerified, false);
});

test("B7 Customer Verification does not imply Closure Eligibility", () => {
  const r = evaluateVerificationClosure({ scopeRef: scope, workCompleted: true, materialRestorationEstablished: true, serviceVerification: cond("SV", true), customerVerification: cond("CV", true), closureEligibility: cond("CE", false), closureDecisionAuthorization: cond("CD", false), residualObligationRefs: [] });
  assert.equal(r.customerVerified, true);
  assert.equal(r.closureEligible, false);
});

test("B7 Closure Eligibility does not imply Closure Decision", () => {
  const r = evaluateVerificationClosure({ scopeRef: scope, workCompleted: true, materialRestorationEstablished: true, serviceVerification: cond("SV", true), customerVerification: cond("CV", true), closureEligibility: cond("CE", true), closureDecisionAuthorization: cond("CD", false), residualObligationRefs: [] });
  assert.equal(r.closureEligible, true);
  assert.equal(r.closureDecisionAuthorized, false);
});

test("B7 residual obligations remain independently live after restoration/verification", () => {
  const r = evaluateVerificationClosure({ scopeRef: scope, workCompleted: true, materialRestorationEstablished: true, serviceVerification: cond("SV", true), customerVerification: cond("CV", true), closureEligibility: cond("CE", true), closureDecisionAuthorization: cond("CD", true), residualObligationRefs: ["OBL-RCA", "OBL-CREDIT"] });
  assert.deepEqual(r.residualObligationRefs, ["OBL-RCA", "OBL-CREDIT"]);
});
