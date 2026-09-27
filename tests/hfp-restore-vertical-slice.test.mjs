import test from "node:test";
import assert from "node:assert/strict";
import {
  createMaterialScenario,
  createSiteAccessScenario,
  createHandoverScenario,
  applyEvent,
} from "../pilot/restore-service/model.mjs";

function runAll(state) {
  while (state.nextEventIndex < state.allowedEventIds.length) state = applyEvent(state, state.allowedEventIds[state.nextEventIndex]);
  return state;
}

test("HFP material path preserves prerequisite, no-transition, recovery, verification and closure semantics", () => {
  let s = createMaterialScenario();
  s = applyEvent(s, "STOCK_CONFIRMED_ALLOCATED_0831");
  assert.equal(s.tracks.blocker.state, "WAITING_FOR_MATERIAL_RELEASE_AUTHORITY");
  const blockerSince = s.tracks.blocker.since;

  s = applyEvent(s, "WAIT_ACTIVITY_0842");
  assert.equal(s.tracks.blocker.state, "WAITING_FOR_MATERIAL_RELEASE_AUTHORITY");
  assert.equal(s.tracks.blocker.since, blockerSince);

  s = applyEvent(s, "SUPPLIER_BLOCKED_0847");
  assert.equal(s.tracks.blocker.since, blockerSince);
  s = applyEvent(s, "REQUEST_ATTENTION_0850");
  assert.equal(s.tracks.responsibility.holder, "Budi");
  assert.equal(s.tracks.blocker.state, "WAITING_FOR_MATERIAL_RELEASE_AUTHORITY");

  s = applyEvent(s, "SUPERVISOR_RELEASE_0855");
  assert.equal(s.tracks.material.state, "MATERIAL_RELEASE_IN_PROGRESS");
  assert.notEqual(s.tracks.service.state, "NETWORK_RECOVERY_INDICATED");

  for (const event of ["SPARE_SENT_0903","SPARE_ARRIVING_0923","SPARE_RECEIVED_CONTINUE_0928","INTERVENTION_STARTED_0932"]) {
    s = applyEvent(s, event);
    assert.notEqual(s.tracks.service.state, "NETWORK_RECOVERY_INDICATED");
    assert.notEqual(s.tracks.verification.state, "CUSTOMER_VERIFIED_RECOVERED");
  }

  s = applyEvent(s, "RECOVERY_EVIDENCE_0938");
  assert.equal(s.tracks.work.state, "FIELD_WORK_COMPLETED");
  assert.equal(s.tracks.service.state, "TECHNICAL_RECOVERY_EVIDENCE_AVAILABLE");
  assert.notEqual(s.tracks.verification.state, "CUSTOMER_VERIFIED_RECOVERED");

  s = applyEvent(s, "NETWORK_RECOVERY_INDICATED_0943");
  assert.equal(s.tracks.service.state, "NETWORK_RECOVERY_INDICATED");
  assert.equal(s.tracks.verification.state, "CUSTOMER_VERIFICATION_PENDING");

  s = applyEvent(s, "CUSTOMER_SLOW_0947");
  assert.equal(s.tracks.service.state, "NETWORK_RECOVERY_INDICATED");
  assert.equal(s.tracks.verification.state, "CUSTOMER_VERIFICATION_PENDING");
  s = applyEvent(s, "TECHNICAL_STABLE_0953");
  assert.equal(s.tracks.verification.state, "CUSTOMER_VERIFICATION_PENDING");

  s = applyEvent(s, "CUSTOMER_CONFIRMED_1001");
  assert.equal(s.tracks.verification.state, "CUSTOMER_VERIFIED_RECOVERED");
  assert.equal(s.tracks.closure.state, "TICKET_ELIGIBLE_FOR_CLOSURE");
  s = applyEvent(s, "TICKET_CLOSED");
  assert.equal(s.tracks.closure.state, "CLOSED");
});

test("HFP site-access path keeps activity and escalation separate from blocker resolution", () => {
  let s = createSiteAccessScenario();
  const since = s.tracks.blocker.since;
  s = applyEvent(s, "FIELD_READY_ACCESS_MISSING");
  s = applyEvent(s, "ACCESS_CONTACT_ATTEMPT");
  assert.equal(s.tracks.blocker.state, "WAITING_FOR_SITE_ACCESS");
  assert.equal(s.tracks.blocker.since, since);
  s = applyEvent(s, "ACCESS_AGING_ESCALATION");
  assert.equal(s.tracks.coordination.state, "ESCALATION_ACTIVE");
  assert.equal(s.tracks.blocker.state, "WAITING_FOR_SITE_ACCESS");
  s = applyEvent(s, "AUTHORIZED_ACCESS_GRANTED");
  assert.equal(s.tracks.blocker.state, "SITE_ACCESS_AVAILABLE");
  s = applyEvent(s, "FIELD_INSPECTION_STARTED");
  assert.equal(s.tracks.work.state, "FIELD_INSPECTION_IN_PROGRESS");
});

test("HFP handover transfers responsibility only after explicit acceptance and retains other track aging", () => {
  let s = createHandoverScenario();
  const serviceSince = s.tracks.service.since;
  const blockerSince = s.tracks.blocker.since;
  s = applyEvent(s, "HANDOVER_OFFERED");
  assert.equal(s.tracks.responsibility.holder, "Budi");
  s = applyEvent(s, "HANDOVER_NOT_ACCEPTED");
  assert.equal(s.tracks.responsibility.holder, "Budi");
  s = applyEvent(s, "HANDOVER_ACCEPTED");
  assert.equal(s.tracks.responsibility.holder, "Dimas");
  assert.equal(s.tracks.service.since, serviceSince);
  assert.equal(s.tracks.blocker.since, blockerSince);
});

test("all pilot scenarios execute to completion without implicit events", () => {
  for (const factory of [createMaterialScenario, createSiteAccessScenario, createHandoverScenario]) {
    const end = runAll(factory());
    assert.equal(end.nextEventIndex, end.allowedEventIds.length);
  }
});
