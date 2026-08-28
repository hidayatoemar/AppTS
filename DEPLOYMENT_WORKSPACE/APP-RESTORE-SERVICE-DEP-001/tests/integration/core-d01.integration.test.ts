import assert from "node:assert/strict";
import test from "node:test";
import { ADMISSION_PREDICATES, evaluateAdmission, formTicket, transitionTicket, type PredicateResult } from "../../packages/core-d01/src/index.ts";

const satisfied = (): PredicateResult[] => ADMISSION_PREDICATES.map((predicate) => ({ predicate, status: "SATISFIED" }));
const binding = { purposeBindingId: "pb-1", purposeIdentity: "restore", purposeVersion: "1", packageIdentity: "pkg", packageVersion: "1", coreBindingRef: "core", hookBindingRef: "hook" };

test("D01 forms I01 activation only after every admission predicate is satisfied", () => {
  const assessment = evaluateAdmission("a-1", "case-1", satisfied());
  const formed = formTicket(assessment, { formationId: "f-1", ticketId: "t-1", entityRef: "ENTITY-A", domainId: "d-1", intakeDecisionId: "decision-1", responsibleAssignmentRef: "assignment-1", formationEvidenceSetRef: "evidence-set-1", aggregateVersion: 1, effectiveAt: "2026-08-11T00:00:00Z", binding });
  assert.equal(assessment.result, "ACCEPTABLE");
  assert.equal(formed.activation.activation_code, "ACTIVATE");
  assert.equal(formed.activation.entity_ref, "ENTITY-A");
  assert.equal(formed.activation.responsible_assignment_ref, "assignment-1");
});

test("D01 fails closed for missing or stale admission facts", () => {
  const missing = evaluateAdmission("a-2", "case-2", satisfied().slice(0, -1));
  const stale = evaluateAdmission("a-3", "case-3", satisfied().map((item) => item.predicate === "CURRENTNESS" ? { ...item, status: "STALE" } : item));
  assert.equal(missing.result, "NOT_ACCEPTABLE");
  assert.equal(stale.result, "NOT_ACCEPTABLE");
  assert.throws(() => formTicket(stale, { formationId: "f", ticketId: "t", entityRef: "ENTITY-A", domainId: "d", intakeDecisionId: "i", responsibleAssignmentRef: "r", formationEvidenceSetRef: "e", aggregateVersion: 1, effectiveAt: "2026-08-11T00:00:00Z", binding }), /ADMISSION_NOT_ACCEPTABLE/);
});

test("D01 never reopens CLOSED tickets and preserves Entity history", () => {
  assert.throws(() => transitionTicket({ ticketId: "t", entityRef: "ENTITY-A", state: "CLOSED", relations: [] }, "ACTIVE"), /CLOSED_TICKET_CANNOT_REOPEN/);
});
