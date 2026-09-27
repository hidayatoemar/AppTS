const clone = (value) => structuredClone(value);

export const ACTORS = Object.freeze({
  BUDI: { ref: 'PERSON-BUDI', name: 'Budi Santoso', role: 'NOC Operator' },
  SUPERVISOR: { ref: 'PERSON-SUPERVISOR', name: 'NOC Supervisor', role: 'NOC Supervisor' },
  FIELD: { ref: 'PERSON-FIELD', name: 'Field Engineer', role: 'Field' },
  CS: { ref: 'PERSON-CS', name: 'Customer Service', role: 'Customer Verification' },
  CLOSURE: { ref: 'PERSON-CLOSURE', name: 'Closure Officer', role: 'Closure Decision' },
  SYSTEM: { ref: 'SYSTEM', name: 'Synthetic World', role: 'External / observed reality' },
});

export const HFP_SOURCE = Object.freeze({
  artifact: 'APPTS-HFP-NAR-001_Service_Recovery_Operational_Narrative_v1.0_VALIDATED',
  fileId: '1BfKuQyKJopEqZ4zpORJPGYw_8kJGwRBm5-P-XsmHUaM',
  scope: 'PT ABC Service Recovery reference scenario 07:12 through closure',
});

function initialTruth() {
  return {
    serviceImpact: 'CUSTOMER_REPORTED_UNUSABLE',
    diagnosis: 'UNRESOLVED',
    fieldDiagnostic: 'NOT_REQUESTED',
    materialDependency: 'NONE',
    materialAvailability: 'UNKNOWN',
    materialRelease: 'NOT_REQUIRED',
    supplierPath: 'UNKNOWN',
    logistics: 'NONE',
    interventionRelease: 'NOT_READY',
    fieldWork: 'NOT_STARTED',
    networkRecovery: 'NOT_INDICATED',
    customerVerification: 'NOT_READY',
    closureEligibility: 'NOT_ELIGIBLE',
    ticket: 'OPEN',
    blocker: 'NONE',
    attention: 'NONE',
    responsibility: {
      holder: 'PERSON-BUDI',
      role: 'NOC Operator',
      transferred: false,
    },
  };
}

export function createInitialState() {
  return {
    scenarioId: 'HFP-RS-PTABC-001',
    purpose: 'RESTORE_SERVICE',
    customer: 'PT ABC',
    service: 'Dedicated Internet',
    currentTime: '07:12',
    cursor: 0,
    revision: 0,
    truth: initialTruth(),
    evidence: [
      evidence('EV-0712-CS-REPORT', '07:12', 'Customer Service', 'PT ABC reports Dedicated Internet cannot be used.'),
    ],
    history: [
      history('07:12', 'WORLD_OBSERVATION', 'Customer report received', 'Service impact is known; cause remains unresolved.'),
    ],
    lastOutcome: null,
  };
}

const EVENTS = [
  human('RS-H-0727-TECH-CONFIRM', '07:27', 'PERSON-BUDI', 'Request Technical Confirmation',
    s => s.truth.diagnosis === 'UNRESOLVED',
    s => {
      s.history.push(history('07:27', 'HUMAN_ACTION', 'Technical confirmation requested', 'Attention request adds work; it does not diagnose the fault or transfer responsibility.'));
    }),
  world('RS-W-0731-TECH-OBS', '07:31', 'Engineer reports abnormal optical interface; cause still uncertain.',
    s => {
      s.evidence.push(evidence('EV-0731-OPTICAL', '07:31', 'Engineer', 'Abnormal optical indication; transceiver, patching, or fiber path not yet distinguished.'));
      s.truth.diagnosis = 'EVIDENCE_INCOMPLETE';
    }),
  world('RS-W-0736-LINK-FLAP', '07:36', 'Short link flap and renewed packet loss arrive as observations.',
    s => {
      s.evidence.push(evidence('EV-0736-LINK-FLAP', '07:36', 'Monitoring', 'Short link flap on shared aggregation path.'));
    }),
  human('RS-H-0736-ASSESS', '07:36', 'PERSON-BUDI', 'Record probable shared infrastructure degradation',
    s => s.truth.diagnosis === 'EVIDENCE_INCOMPLETE',
    s => {
      s.truth.diagnosis = 'PROBABLE_SHARED_INFRA_DEGRADATION';
      s.history.push(history('07:36', 'HUMAN_JUDGMENT', 'Working assessment updated', 'Judgment is recorded with evidence; it is not a final cause declaration.'));
    }),
  human('RS-H-0739-FIELD-REQUEST', '07:39', 'PERSON-BUDI', 'Request Field inspection',
    s => s.truth.diagnosis === 'PROBABLE_SHARED_INFRA_DEGRADATION',
    s => {
      s.truth.fieldDiagnostic = 'REQUESTED';
      s.history.push(history('07:39', 'HUMAN_ACTION', 'Field inspection requested', 'Budi retains Service Recovery responsibility while Field performs diagnostic work.'));
    }),
  world('RS-W-0818-FIELD-OBS', '08:18', 'Field reports link up but abnormal optical power/transceiver condition.',
    s => {
      s.truth.fieldDiagnostic = 'OBSERVATION_RECEIVED';
      s.evidence.push(evidence('EV-0818-FIELD', '08:18', 'Field', 'Physical link up; optical power and transceiver readings abnormal; final cause not declared.'));
    }),
  world('RS-W-0827-SPARE-NEEDED', '08:27', 'Field requires one compatible spare transceiver for the next examination/intervention.',
    s => {
      s.truth.materialDependency = 'COMPATIBLE_SPARE_REQUIRED';
      s.truth.materialAvailability = 'UNCONFIRMED';
      s.truth.materialRelease = 'PENDING';
      s.truth.blocker = 'MATERIAL_AVAILABILITY';
      s.evidence.push(evidence('EV-0827-SPARE-REQ', '08:27', 'Field', 'Compatible spare transceiver required; local ready stock not confirmed.'));
    }),
  human('RS-H-0831-STOCK-CONFIRM', '08:31', 'PERSON-BUDI', 'Request stock confirmation',
    s => s.truth.materialAvailability === 'UNCONFIRMED',
    s => {
      s.history.push(history('08:31', 'HUMAN_ACTION', 'Stock confirmation requested', 'Existing stock is checked before assuming a purchase is required.'));
    }),
  world('RS-W-0834-STOCK-ALLOCATED', '08:34', 'Compatible spare exists at another location but is allocated to planned backbone work.',
    s => {
      s.truth.materialAvailability = 'EXISTS_BUT_ALLOCATED';
      s.truth.materialRelease = 'AUTHORITY_REQUIRED';
      s.truth.blocker = 'MATERIAL_RELEASE_AUTHORITY';
      s.evidence.push(evidence('EV-0834-STOCK', '08:34', 'Inventory', 'Compatible unit exists but is allocated to planned backbone work.'));
    }),
  world('RS-W-0847-SUPPLIER-BLOCKED', '08:47', 'Purchasing reports same-day supplier stock, but release is blocked administratively.',
    s => {
      s.truth.supplierPath = 'BLOCKED';
      s.evidence.push(evidence('EV-0847-SUPPLIER', '08:47', 'Purchasing', 'Supplier path cannot currently support rapid recovery because release is blocked.'));
    }),
  human('RS-H-0850-ATTENTION', '08:50', 'PERSON-BUDI', 'Request Attention from NOC Supervisor',
    s => s.truth.materialRelease === 'AUTHORITY_REQUIRED',
    s => {
      s.truth.attention = 'SUPERVISOR_ATTENTION_REQUESTED';
      s.history.push(history('08:50', 'ATTENTION', 'Supervisor attention requested', 'Attention requests judgment on a constraint; responsibility remains with Budi and blocker remains unresolved.'));
    }),
  human('RS-H-0855-RELEASE', '08:55', 'PERSON-SUPERVISOR', 'Authorize release of internal spare',
    s => s.truth.attention === 'SUPERVISOR_ATTENTION_REQUESTED' && s.truth.materialAvailability === 'EXISTS_BUT_ALLOCATED',
    s => {
      s.truth.materialRelease = 'AUTHORIZED';
      s.truth.blocker = 'MATERIAL_RELEASE_IN_PROGRESS';
      s.history.push(history('08:55', 'AUTHORIZED_DECISION', 'Internal spare release authorized', 'Authority removes the allocation constraint; physical material has not yet reached Field.'));
    }),
  world('RS-W-0903-DISPATCHED', '09:03', 'Field receives confirmation that the spare is being sent.',
    s => {
      s.truth.logistics = 'DISPATCHED';
      s.evidence.push(evidence('EV-0903-DISPATCH', '09:03', 'Logistics', 'Authorized compatible spare dispatched toward site.'));
    }),
  world('RS-W-0923-ARRIVING', '09:23', 'Spare shipment changes to Arriving at Site.',
    s => {
      s.truth.logistics = 'ARRIVING';
      s.evidence.push(evidence('EV-0923-ARRIVING', '09:23', 'Logistics', 'Spare arriving at site.'));
    }),
  world('RS-W-0928-RECEIVED', '09:28', 'Field confirms spare received and part identity matches the requirement.',
    s => {
      s.truth.logistics = 'RECEIVED';
      s.truth.materialAvailability = 'AVAILABLE_FOR_RECOVERY';
      s.truth.blocker = 'NONE';
      s.truth.interventionRelease = 'HUMAN_DECISION_PENDING';
      s.evidence.push(evidence('EV-0928-RECEIVED', '09:28', 'Field', 'Compatible spare received and identity confirmed.'));
    }),
  human('RS-H-0928-CONTINUE', '09:28', 'PERSON-BUDI', 'Authorize continuation with replacement',
    s => s.truth.materialRelease === 'AUTHORIZED' && s.truth.materialAvailability === 'AVAILABLE_FOR_RECOVERY' && s.truth.interventionRelease === 'HUMAN_DECISION_PENDING',
    s => {
      s.truth.interventionRelease = 'AUTHORIZED';
      s.history.push(history('09:28', 'HUMAN_JUDGMENT', 'Replacement continuation authorized', 'Budi chooses to continue based on current evidence and already-valid material authority.'));
    }),
  human('RS-H-0932-FIELD-START', '09:32', 'PERSON-FIELD', 'Start transceiver replacement',
    s => s.truth.interventionRelease === 'AUTHORIZED' && s.truth.materialAvailability === 'AVAILABLE_FOR_RECOVERY',
    s => {
      s.truth.fieldWork = 'IN_PROGRESS';
      s.history.push(history('09:32', 'FIELD_ACTION', 'Technical intervention started', 'Starting Field work does not assert service recovery.'));
    }),
  world('RS-W-0938-RECOVERY-EVIDENCE', '09:38', 'Interface returns up; error counter stabilizes; optical reading normalizes.',
    s => {
      s.truth.fieldWork = 'COMPLETED';
      s.evidence.push(evidence('EV-0938-RECOVERY', '09:38', 'Field + Monitoring', 'Interface up, error counter stable, optical reading normal; recovery evidence available.'));
    }),
  human('RS-H-0943-NETWORK-RECOVERY', '09:43', 'PERSON-BUDI', 'Record Network Recovery Indicated',
    s => s.truth.fieldWork === 'COMPLETED' && hasEvidence(s, 'EV-0938-RECOVERY'),
    s => {
      s.truth.networkRecovery = 'INDICATED';
      s.truth.customerVerification = 'PENDING';
      s.history.push(history('09:43', 'HUMAN_JUDGMENT', 'Network Recovery Indicated', 'Technical recovery is now indicated; customer verification remains independently pending.'));
    }),
  world('RS-W-0947-CUSTOMER-CONCERN', '09:47', 'Customer says connection is back but an internal application still feels slow.',
    s => {
      s.truth.customerVerification = 'PENDING';
      s.evidence.push(evidence('EV-0947-CUSTOMER', '09:47', 'Customer', 'Connectivity is back but one internal application remains slow.'));
      s.history.push(history('09:47', 'CUSTOMER_OBSERVATION', 'Customer concern recorded', 'Technical recovery evidence is preserved; customer recovery is not yet verified.'));
    }),
  world('RS-W-0953-STABLE', '09:53', 'Measurement to the customer service point remains stable.',
    s => {
      s.evidence.push(evidence('EV-0953-STABLE', '09:53', 'Monitoring', 'Path to customer service point is stable.'));
      s.history.push(history('09:53', 'WORLD_OBSERVATION', 'Technical measurement remains stable', 'Customer verification still waits for customer evidence.'));
    }),
  world('RS-W-1001-CUSTOMER-VERIFIED', '10:01', 'PT ABC confirms service and previously slow application are normal.',
    s => {
      s.truth.customerVerification = 'VERIFIED_RECOVERED';
      s.evidence.push(evidence('EV-1001-CUSTOMER-VERIFY', '10:01', 'Customer', 'Customer confirms service normal and application working normally.'));
      recomputeClosure(s);
    }),
  human('RS-H-CLOSE', '10:02', 'PERSON-CLOSURE', 'Close Ticket',
    s => s.truth.closureEligibility === 'ELIGIBLE',
    s => {
      s.truth.ticket = 'CLOSED';
      s.history.push(history('10:02', 'AUTHORIZED_DECISION', 'Ticket closed', 'Closure is an explicit authorized decision after eligibility was established.'));
    }),
];

function human(id, time, actorRef, label, guard, apply) {
  return { id, kind: 'HUMAN', time, actorRef, label, guard, apply };
}

function world(id, time, label, apply) {
  return { id, kind: 'WORLD', time, actorRef: 'SYSTEM', label, guard: () => true, apply };
}

function evidence(id, time, source, summary) {
  return { id, time, source, summary };
}

function history(time, kind, label, consequence) {
  return { time, kind, label, consequence };
}

function hasEvidence(state, id) {
  return state.evidence.some((entry) => entry.id === id);
}

function recomputeClosure(state) {
  const eligible =
    state.truth.fieldWork === 'COMPLETED' &&
    state.truth.networkRecovery === 'INDICATED' &&
    state.truth.customerVerification === 'VERIFIED_RECOVERED';
  state.truth.closureEligibility = eligible ? 'ELIGIBLE' : 'NOT_ELIGIBLE';
}

export function nextExpectedEvent(state) {
  return EVENTS[state.cursor] ?? null;
}

export function project(state, actorRef = 'PERSON-BUDI') {
  const next = nextExpectedEvent(state);
  const allowed = next && next.kind === 'HUMAN' && next.actorRef === actorRef && next.guard(state)
    ? [{ id: next.id, label: next.label, actorRef: next.actorRef }]
    : [];
  const world = next && next.kind === 'WORLD'
    ? { id: next.id, label: next.label, time: next.time }
    : null;
  return {
    ...clone(state),
    hfpSource: HFP_SOURCE,
    nextHumanActions: allowed,
    nextWorldEvent: world,
    expectedActorRef: next?.actorRef ?? null,
    expectedKind: next?.kind ?? null,
    complete: state.cursor >= EVENTS.length,
  };
}

export function applyEvent(state, eventId, actorRef) {
  const next = nextExpectedEvent(state);
  if (!next) return outcome(state, 'REJECTED', 'SCENARIO_COMPLETE');
  if (next.id !== eventId) return outcome(state, 'REJECTED', 'EVENT_NOT_CURRENT');
  if (next.actorRef !== actorRef) return outcome(state, 'REJECTED', 'ACTOR_NOT_AUTHORIZED_FOR_CURRENT_EVENT');
  if (!next.guard(state)) return outcome(state, 'REJECTED', 'PRECONDITION_NOT_SATISFIED');

  const draft = clone(state);
  next.apply(draft);
  draft.currentTime = next.time;
  draft.cursor += 1;
  draft.revision += 1;
  recomputeClosure(draft);
  draft.lastOutcome = { kind: 'APPLIED', eventId: next.id, at: next.time };
  return { state: draft, result: draft.lastOutcome };
}

export function recordRoutineActivity(state, actorRef, note = 'Follow-up / checking activity') {
  if (typeof actorRef !== 'string' || actorRef.length === 0) return outcome(state, 'REJECTED', 'ACTOR_REQUIRED');
  const draft = clone(state);
  const truthBefore = JSON.stringify(draft.truth);
  draft.history.push(history(draft.currentTime, 'ROUTINE_ACTIVITY', note, 'Chronology grows, but no governed operational condition changes.'));
  draft.revision += 1;
  if (JSON.stringify(draft.truth) !== truthBefore) throw new Error('NO_TRANSITION_ACTIVITY_CHANGED_TRUTH');
  draft.lastOutcome = { kind: 'NO_TRANSITION', eventId: 'ROUTINE_ACTIVITY', at: draft.currentTime };
  return { state: draft, result: draft.lastOutcome };
}

function outcome(state, kind, reason) {
  return { state: clone(state), result: { kind, reason, at: state.currentTime } };
}

export function invariantSnapshot(state) {
  return {
    responsibilityNotSilentlyTransferred:
      state.truth.responsibility.holder === 'PERSON-BUDI' && state.truth.responsibility.transferred === false,
    materialExistsDoesNotMeanAvailable:
      state.truth.materialAvailability !== 'EXISTS_BUT_ALLOCATED' || state.truth.interventionRelease !== 'AUTHORIZED',
    fieldWorkDoesNotImplyNetworkRecovery:
      state.truth.fieldWork !== 'COMPLETED' || ['NOT_INDICATED', 'INDICATED'].includes(state.truth.networkRecovery),
    networkRecoveryDoesNotImplyCustomerVerification:
      state.truth.networkRecovery !== 'INDICATED' || ['PENDING', 'VERIFIED_RECOVERED'].includes(state.truth.customerVerification),
    closureNotAutomatic:
      state.truth.closureEligibility !== 'ELIGIBLE' || ['OPEN', 'CLOSED'].includes(state.truth.ticket),
  };
}

export const EVENT_IDS = Object.freeze(EVENTS.map((event) => event.id));
