import assert from "node:assert/strict";
import test from "node:test";
import { assessClosureReadiness, assessTerminalDisposition, evaluateGate, mayProgressToClosure, recordEvidence, registerContradiction, verifyEvidence } from "../../packages/core-d03/src/index.ts";

test("D03 preserves evidence qualification and deterministic contradiction membership", () => {
  const evidence = recordEvidence({ evidenceId: "e-1", sourceRef: "source", contentDigest: "sha256:x", observedAt: "2026-08-11T00:00:00Z", qualification: "INSUFFICIENT", retainUntil: "2027-08-11T00:00:00Z" });
  assert.equal(evidence.qualification, "INSUFFICIENT");
  const contradiction = registerContradiction("c-1", [{ claimId: "z", claimType: "state", value: 1, evidenceRefs: [] }, { claimId: "a", claimType: "state", value: 2, evidenceRefs: [] }]);
  assert.deepEqual(contradiction.memberClaimRefs, ["a", "z"]);
});

test("D03 independent verification rejects self-conflict", () => {
  const result = verifyEvidence({ requestId: "v-1", evidenceSetVersionRef: "set-1", requesterRef: "actor", verifierRef: "actor", independentRequired: true }, true, "VERIFIED");
  assert.equal(result.status, "SELF_CONFLICTED");
});

test("D03 Gate permits only explicit Entity-attributed progression after all predicates and verification pass", () => {
  const base = { gateResultId: "g", ticketId: "t", entityRef: "ENTITY-A", gateIdentity: "restore-gate", evaluationId: "eval", actorHolderRef: "HOLDER-H", actingRoleInstanceRef: "ROLE-INSTANCE-A", actingAssignmentRef: "ASSIGNMENT-A", authorityBasisRef: "AUTH-BASIS-A", inputVersionSetRef: "set-v1", currentnessRef: "current", effectiveFrom: "2026-08-11T00:00:00Z", requestedProgressionClasses: ["CLOSE"] };
  const denied = evaluateGate({ ...base, predicates: [{ identity: "evidence", status: "MISSING" }] });
  assert.deepEqual(denied.permitted_progression_classes, []);
  const verification = verifyEvidence({ requestId: "v", evidenceSetVersionRef: "set-v1", requesterRef: "requester", verifierRef: "independent", independentRequired: true }, true, "VERIFIED");
  const allowed = evaluateGate({ ...base, predicates: [{ identity: "evidence", status: "SATISFIED" }], verification });
  const terminal = assessTerminalDisposition("td", 1, true);
  const closure = assessClosureReadiness("cr", 1, terminal, true);
  assert.equal(allowed.entity_ref, "ENTITY-A");
  assert.equal(allowed.acting_assignment_ref, "ASSIGNMENT-A");
  assert.deepEqual(allowed.permitted_progression_classes, ["CLOSE"]);
  assert.equal(mayProgressToClosure(allowed.permitted_progression_classes, closure), true);
});

test("MCR071 D03 withholds progression when Entity authority attribution is incomplete", () => {
  const verification = verifyEvidence({ requestId: "v2", evidenceSetVersionRef: "set-v2", requesterRef: "requester", verifierRef: "independent", independentRequired: true }, true, "VERIFIED");
  const result = evaluateGate({ gateResultId: "g2", ticketId: "t", entityRef: "ENTITY-A", gateIdentity: "restore-gate", evaluationId: "eval2", actorHolderRef: "HOLDER-H", actingRoleInstanceRef: "ROLE-INSTANCE-A", actingAssignmentRef: "ASSIGNMENT-A", inputVersionSetRef: "set-v2", currentnessRef: "current", effectiveFrom: "2026-08-11T00:00:00Z", requestedProgressionClasses: ["CLOSE"], predicates: [{ identity: "evidence", status: "SATISFIED" }], verification });
  assert.deepEqual(result.permitted_progression_classes, []);
});
