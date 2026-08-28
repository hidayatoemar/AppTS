import assert from "node:assert/strict";
import test from "node:test";
import { escalate, resolveAuthority, resolveHandover, type AssignmentSnapshot, type AuthorityCandidate } from "../../packages/core-d02/src/index.ts";

const snapshot = (assignmentRef: string, state: AssignmentSnapshot["state"] = "CURRENT", entityRef = "ENTITY-A"): AssignmentSnapshot => ({ snapshotId: `s-${assignmentRef}-${entityRef}`, roleRef: "role", roleInstanceRef: `role-instance-${entityRef}`, holderRef: "HOLDER-H", assignmentRef, entityRef, domainId: "domain", authorityBasisRef: `authority-basis-${entityRef}`, effectiveFrom: "2026-08-11T00:00:00Z", state, sourceRef: "source" });
const candidate = (assignmentRef: string, state: AssignmentSnapshot["state"] = "CURRENT", entityRef = "ENTITY-A", responsibilityId = `r-${assignmentRef}`): AuthorityCandidate => ({ responsibilityId, snapshot: snapshot(assignmentRef, state, entityRef), scopeMatches: true, ticketContextMatches: true, evidenceSatisfied: true, sodSatisfied: true, policySatisfied: true, actions: [{ action_class_ref: "RESTORE", permission_code: "ALLOW" }] });
const input = (candidates: AuthorityCandidate[], entityRef = "ENTITY-A", assignmentRef = "a-1") => ({ resultId: "authority-1", ticketId: "ticket-1", entityRef, domainId: "domain", actorHolderRef: "HOLDER-H", actingRoleInstanceRef: `role-instance-${entityRef}`, actingAssignmentRef: assignmentRef, authorityBasisRef: `authority-basis-${entityRef}`, contextRef: "context", currentnessRef: "current", effectiveFrom: "2026-08-11T00:00:00Z", candidates });

test("D02 grants authority only for exactly one fully valid Entity-scoped assignment", () => {
  const accepted = resolveAuthority(input([candidate("a-1")]));
  assert.equal(accepted.result_status_ref, "AUTHORIZED");
  assert.equal(accepted.entity_ref, "ENTITY-A");
  assert.equal(accepted.responsible_assignment_ref, "a-1");
  assert.equal(resolveAuthority(input([candidate("a-1", "CURRENT", "ENTITY-A", "r-1"), candidate("a-1", "CURRENT", "ENTITY-A", "r-2")])).result_status_ref, "UNRESOLVED_CONFLICT");
  assert.equal(resolveAuthority(input([candidate("a-1", "STALE")])).result_status_ref, "NO_VALID_AUTHORITY");
});

test("D02 same Holder across Entities never bleeds authority", () => {
  const entityA = candidate("a-1", "CURRENT", "ENTITY-A");
  const entityB = candidate("b-1", "CURRENT", "ENTITY-B");
  const resolvedA = resolveAuthority(input([entityA, entityB], "ENTITY-A", "a-1"));
  const wrong = resolveAuthority(input([entityA, entityB], "ENTITY-B", "a-1"));
  assert.equal(resolvedA.result_status_ref, "AUTHORIZED");
  assert.equal(wrong.result_status_ref, "NO_VALID_AUTHORITY");
});

test("D02 preserves old responsibility until handover acceptance", () => {
  const proposal = { proposalId: "p", current: { responsibilityId: "r", assignmentRef: "old" }, proposedAssignmentRef: "new" };
  const rejected = resolveHandover(proposal, { status: "REJECTED", reasonRef: "declined" });
  assert.equal(rejected.responsibility.assignmentRef, "old");
  assert.equal(rejected.escalationRequired, true);
  assert.equal(resolveHandover(proposal, { status: "ACCEPTED", acceptanceRef: "ack" }).responsibility.assignmentRef, "new");
});

test("D02 escalation creates obligation without transferring responsibility", () => {
  assert.deepEqual(escalate(false), { responsibilityTransferred: false, obligationCreated: true, interventionFailed: true, furtherEscalationRequired: true });
});
