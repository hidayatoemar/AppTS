import assert from "node:assert/strict";
import test from "node:test";
import { escalate, resolveAuthority, resolveHandover, type AssignmentSnapshot, type AuthorityCandidate } from "../../packages/core-d02/src/index.ts";

const snapshot = (assignmentRef: string, state: AssignmentSnapshot["state"] = "CURRENT"): AssignmentSnapshot => ({ snapshotId: `s-${assignmentRef}`, roleRef: "role", holderRef: "holder", assignmentRef, domainId: "domain", effectiveFrom: "2026-08-11T00:00:00Z", state, sourceRef: "source" });
const candidate = (assignmentRef: string, state: AssignmentSnapshot["state"] = "CURRENT"): AuthorityCandidate => ({ responsibilityId: `r-${assignmentRef}`, snapshot: snapshot(assignmentRef, state), scopeMatches: true, ticketContextMatches: true, evidenceSatisfied: true, sodSatisfied: true, policySatisfied: true, actions: [{ action_class_ref: "RESTORE", permission_code: "ALLOW" }] });
const input = (candidates: AuthorityCandidate[]) => ({ resultId: "authority-1", ticketId: "ticket-1", domainId: "domain", contextRef: "context", currentnessRef: "current", effectiveFrom: "2026-08-11T00:00:00Z", candidates });

test("D02 grants authority only for exactly one fully valid assignment", () => {
  const accepted = resolveAuthority(input([candidate("a-1")]));
  assert.equal(accepted.result_status_ref, "AUTHORIZED");
  assert.equal(accepted.responsible_assignment_ref, "a-1");
  assert.equal(resolveAuthority(input([candidate("a-1"), candidate("a-2")])).result_status_ref, "UNRESOLVED_CONFLICT");
  assert.equal(resolveAuthority(input([candidate("a-1", "STALE")])).result_status_ref, "NO_VALID_AUTHORITY");
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
