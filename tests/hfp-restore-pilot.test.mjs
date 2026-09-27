import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTORS,
  EVENT_IDS,
  applyEvent,
  createInitialState,
  invariantSnapshot,
  nextExpectedEvent,
  project,
  recordRoutineActivity,
} from '../pilot/restore-service/model.mjs';

function walkTo(state, eventId) {
  let current = state;
  while (nextExpectedEvent(current)?.id !== eventId) {
    const next = nextExpectedEvent(current);
    assert.ok(next, 'expected ' + eventId + ' before scenario end');
    const applied = applyEvent(current, next.id, next.actorRef);
    assert.equal(applied.result.kind, 'APPLIED');
    current = applied.state;
  }
  return current;
}

test('full HFP PT ABC slice reaches explicit closure without collapsing meanings', () => {
  let state = createInitialState();
  for (const id of EVENT_IDS) {
    const next = nextExpectedEvent(state);
    assert.equal(next.id, id);
    const applied = applyEvent(state, id, next.actorRef);
    assert.equal(applied.result.kind, 'APPLIED');
    state = applied.state;
  }
  assert.equal(state.truth.fieldWork, 'COMPLETED');
  assert.equal(state.truth.networkRecovery, 'INDICATED');
  assert.equal(state.truth.customerVerification, 'VERIFIED_RECOVERED');
  assert.equal(state.truth.closureEligibility, 'ELIGIBLE');
  assert.equal(state.truth.ticket, 'CLOSED');
});

test('request attention does not transfer responsibility or clear blocker', () => {
  let state = walkTo(createInitialState(), 'RS-H-0850-ATTENTION');
  const beforeHolder = state.truth.responsibility.holder;
  const applied = applyEvent(state, 'RS-H-0850-ATTENTION', ACTORS.BUDI.ref);
  state = applied.state;
  assert.equal(state.truth.responsibility.holder, beforeHolder);
  assert.equal(state.truth.blocker, 'MATERIAL_RELEASE_AUTHORITY');
  assert.equal(state.truth.attention, 'SUPERVISOR_ATTENTION_REQUESTED');
});

test('allocated physical spare is not usable material and cannot start intervention', () => {
  const state = walkTo(createInitialState(), 'RS-W-0847-SUPPLIER-BLOCKED');
  assert.equal(state.truth.materialAvailability, 'EXISTS_BUT_ALLOCATED');
  assert.equal(state.truth.interventionRelease, 'NOT_READY');
  const wrong = applyEvent(state, 'RS-H-0928-CONTINUE', ACTORS.BUDI.ref);
  assert.equal(wrong.result.kind, 'REJECTED');
  assert.equal(wrong.result.reason, 'EVENT_NOT_CURRENT');
});

test('field completion remains distinct from network recovery', () => {
  const state = walkTo(createInitialState(), 'RS-H-0943-NETWORK-RECOVERY');
  assert.equal(state.truth.fieldWork, 'COMPLETED');
  assert.equal(state.truth.networkRecovery, 'NOT_INDICATED');
  assert.equal(state.truth.customerVerification, 'NOT_READY');
});

test('technical recovery does not manufacture customer verification or closure', () => {
  const state = walkTo(createInitialState(), 'RS-W-0947-CUSTOMER-CONCERN');
  assert.equal(state.truth.networkRecovery, 'INDICATED');
  assert.equal(state.truth.customerVerification, 'PENDING');
  assert.equal(state.truth.closureEligibility, 'NOT_ELIGIBLE');
  assert.equal(state.truth.ticket, 'OPEN');
});

test('customer concern preserves technical truth while verification stays pending', () => {
  const state = walkTo(createInitialState(), 'RS-W-0953-STABLE');
  assert.equal(state.truth.networkRecovery, 'INDICATED');
  assert.equal(state.truth.customerVerification, 'PENDING');
  assert.ok(state.evidence.some((e) => e.id === 'EV-0947-CUSTOMER'));
});

test('routine activity is explicit no-transition', () => {
  const state = walkTo(createInitialState(), 'RS-H-0850-ATTENTION');
  const truthBefore = structuredClone(state.truth);
  const r = recordRoutineActivity(state, ACTORS.BUDI.ref, 'Checked console and followed up');
  assert.equal(r.result.kind, 'NO_TRANSITION');
  assert.deepEqual(r.state.truth, truthBefore);
});

test('wrong actor cannot perform supervisor material-release decision', () => {
  const state = walkTo(createInitialState(), 'RS-H-0855-RELEASE');
  const wrong = applyEvent(state, 'RS-H-0855-RELEASE', ACTORS.BUDI.ref);
  assert.equal(wrong.result.kind, 'REJECTED');
  assert.equal(wrong.result.reason, 'ACTOR_NOT_AUTHORIZED_FOR_CURRENT_EVENT');
  const ok = applyEvent(state, 'RS-H-0855-RELEASE', ACTORS.SUPERVISOR.ref);
  assert.equal(ok.result.kind, 'APPLIED');
});

test('closure is eligible after customer verification but still needs explicit decision', () => {
  const state = walkTo(createInitialState(), 'RS-H-CLOSE');
  assert.equal(state.truth.closureEligibility, 'ELIGIBLE');
  assert.equal(state.truth.ticket, 'OPEN');
  const p = project(state, ACTORS.CLOSURE.ref);
  assert.equal(p.nextHumanActions[0].id, 'RS-H-CLOSE');
});

test('core semantic invariants remain true at every scenario step', () => {
  let state = createInitialState();
  for (;;) {
    const inv = invariantSnapshot(state);
    for (const [name, value] of Object.entries(inv)) assert.equal(value, true, name);
    const next = nextExpectedEvent(state);
    if (!next) break;
    state = applyEvent(state, next.id, next.actorRef).state;
  }
});
