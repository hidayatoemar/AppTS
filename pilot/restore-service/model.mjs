const HFP_NARRATIVE_ID = "1BfKuQyKJopEqZ4zpORJPGYw_8kJGwRBm5-P-XsmHUaM";
const HFP_STG_ID = "1vWTLstun7w7FygLfgEi0PxE3r14NY0baqs1Su8YKwg0";

export const source = Object.freeze({
  narrative: {
    id: HFP_NARRATIVE_ID,
    title: "APPTS-HFP-NAR-001_Service_Recovery_Operational_Narrative_v1.0_VALIDATED",
    status: "VALIDATED",
  },
  stg: {
    id: HFP_STG_ID,
    title: "APPTS-HFP-STG-EXTRACT-001_Service_Recovery_Real_World_State_Activity_Transition_Model_v1.0_VALIDATED",
    status: "VALIDATED",
  },
});

const materialEventOrder = [
  "STOCK_CONFIRMED_ALLOCATED_0831",
  "WAIT_ACTIVITY_0842",
  "SUPPLIER_BLOCKED_0847",
  "REQUEST_ATTENTION_0850",
  "SUPERVISOR_RELEASE_0855",
  "SPARE_SENT_0903",
  "SPARE_ARRIVING_0923",
  "SPARE_RECEIVED_CONTINUE_0928",
  "INTERVENTION_STARTED_0932",
  "RECOVERY_EVIDENCE_0938",
  "NETWORK_RECOVERY_INDICATED_0943",
  "CUSTOMER_SLOW_0947",
  "TECHNICAL_STABLE_0953",
  "CUSTOMER_CONFIRMED_1001",
  "TICKET_CLOSED",
];

const siteAccessEventOrder = [
  "FIELD_READY_ACCESS_MISSING",
  "ACCESS_CONTACT_ATTEMPT",
  "ACCESS_AGING_ESCALATION",
  "AUTHORIZED_ACCESS_GRANTED",
  "FIELD_INSPECTION_STARTED",
];

const handoverEventOrder = [
  "HANDOVER_OFFERED",
  "HANDOVER_NOT_ACCEPTED",
  "HANDOVER_ACCEPTED",
];

export function createMaterialScenario() {
  return {
    scenarioId: "HFP-RS-MATERIAL-001",
    title: "RESTORE_SERVICE — material dependency through closure",
    purpose: "RESTORE_SERVICE",
    source,
    version: 0,
    clock: "2026-09-27T08:27:00+07:00",
    nextEventIndex: 0,
    allowedEventIds: [...materialEventOrder],
    actor: { person: "Budi", role: "NOC Operator", responsibility: "SITUATION-RS-001" },
    tracks: {
      service: { state: "SERVICE_IMPACT_ACTIVE", since: "07:24", evidence: [] },
      assessment: { state: "PROBABLE_OPTICAL_COMPONENT_OR_INTERFACE_FAULT", since: "08:18", evidence: ["HFP:08:18"] },
      work: { state: "FIELD_DIAGNOSTIC_COMPLETE", since: "08:18", evidence: ["HFP:08:18"] },
      material: { state: "MATERIAL_REQUIRED_AVAILABILITY_UNCONFIRMED", since: "08:27", evidence: ["HFP:08:27"] },
      blocker: { state: "WAITING_FOR_MATERIAL_AVAILABILITY", since: "08:27", evidence: ["HFP:08:27"] },
      verification: { state: "NOT_READY", since: "08:27", evidence: [] },
      closure: { state: "NOT_ELIGIBLE", since: "08:27", evidence: [] },
      coordination: { state: "NONE", since: "08:27", evidence: [] },
      responsibility: { holder: "Budi", role: "NOC Operator", since: "07:00" },
    },
    evidence: [
      { at: "08:18", kind: "FIELD_OBSERVATION", text: "Link up; optical power/transceiver abnormal; final cause not established.", sourceRef: "HFP:08:18" },
      { at: "08:27", kind: "FIELD_REQUIREMENT", text: "Compatible spare transceiver required; ready stock at current location not confirmed.", sourceRef: "HFP:08:27" },
    ],
    chronology: [
      { at: "08:27", event: "Material dependency becomes operationally relevant.", changedTracks: ["material", "blocker"] },
    ],
    invariants: [
      "R-001 Event ≠ State Transition",
      "R-002 Activity ≠ Progress",
      "R-006 Routine activity must not silently reset aging",
      "R-009 Request Attention ≠ Escalation ≠ Handoff",
      "R-012 Field Work Completed ≠ Network Recovered ≠ Customer Verified ≠ Ticket Closed",
      "R-015 AppTS is not the operational actor",
      "R-018 Coexisting truths must occupy separate tracks",
      "R-019 Only materially affected tracks transition",
    ],
  };
}

export function createSiteAccessScenario() {
  return {
    scenarioId: "HFP-RS-SITE-ACCESS-001",
    title: "RESTORE_SERVICE — site access blocker",
    purpose: "RESTORE_SERVICE",
    source,
    version: 0,
    clock: "2026-09-27T15:31:00+07:00",
    nextEventIndex: 0,
    allowedEventIds: [...siteAccessEventOrder],
    actor: { person: "Dimas", role: "NOC Operator", responsibility: "SITUATION-RS-ACCESS-001" },
    tracks: {
      service: { state: "CUSTOMER_IMPACT_ACTIVE", since: "15:22", evidence: ["HFP:15:22"] },
      assessment: { state: "FIELD_INSPECTION_REQUIRED", since: "15:31", evidence: ["HFP:15:31"] },
      work: { state: "FIELD_READY", since: "15:31", evidence: ["HFP:15:31"] },
      material: { state: "NOT_APPLICABLE", since: "15:31", evidence: [] },
      blocker: { state: "WAITING_FOR_SITE_ACCESS", since: "15:31", evidence: ["HFP:15:31"] },
      verification: { state: "NOT_READY", since: "15:31", evidence: [] },
      closure: { state: "NOT_ELIGIBLE", since: "15:31", evidence: [] },
      coordination: { state: "NONE", since: "15:31", evidence: [] },
      responsibility: { holder: "Dimas", role: "NOC Operator", since: "15:00" },
    },
    evidence: [{ at: "15:31", kind: "ACCESS_FACT", text: "Authorized site contact unavailable; lawful access not available.", sourceRef: "HFP:15:31" }],
    chronology: [{ at: "15:31", event: "Field ready but intervention blocked by lawful site access.", changedTracks: ["work", "blocker"] }],
    invariants: ["R-002 Activity ≠ Progress", "R-006 Routine activity must not silently reset aging", "R-008 Escalation may change obligation while core blocker remains unchanged", "R-015 AppTS is not the operational actor"],
  };
}

export function createHandoverScenario() {
  return {
    scenarioId: "HFP-RS-HANDOVER-001",
    title: "RESTORE_SERVICE — responsibility handover",
    purpose: "RESTORE_SERVICE",
    source,
    version: 0,
    clock: "2026-09-27T14:55:00+07:00",
    nextEventIndex: 0,
    allowedEventIds: [...handoverEventOrder],
    actor: { person: "Budi", role: "NOC Operator", responsibility: "SITUATION-RS-HO-001" },
    tracks: {
      service: { state: "SERVICE_RECOVERY_ACTIVE", since: "14:20", evidence: [] },
      assessment: { state: "CURRENT_ASSESSMENT_RETAINED", since: "14:20", evidence: [] },
      work: { state: "ACTIVE_WORK_RETAINED", since: "14:20", evidence: [] },
      material: { state: "UNCHANGED", since: "14:20", evidence: [] },
      blocker: { state: "ACTIVE_BLOCKER_RETAINED", since: "14:25", evidence: [] },
      verification: { state: "PENDING", since: "14:20", evidence: [] },
      closure: { state: "NOT_ELIGIBLE", since: "14:20", evidence: [] },
      coordination: { state: "NONE", since: "14:20", evidence: [] },
      responsibility: { holder: "Budi", role: "NOC Operator", since: "14:20" },
    },
    evidence: [],
    chronology: [],
    invariants: ["R-010 Handoff offered ≠ Handoff accepted", "R-011 Responsibility transfer need not reset operational state or aging", "R-019 Only materially affected tracks transition"],
  };
}

export function applyEvent(state, eventId) {
  if (!state || typeof state !== "object") throw new Error("STATE_REQUIRED");
  const expected = state.allowedEventIds[state.nextEventIndex];
  if (eventId !== expected) throw new Error(`EVENT_OUT_OF_SEQUENCE:${eventId}:expected:${expected ?? "NONE"}`);

  const before = structuredClone(state);
  const s = structuredClone(state);
  const changedTracks = [];
  const event = { at: eventTime(eventId), event: eventLabel(eventId), changedTracks };

  switch (eventId) {
    case "STOCK_CONFIRMED_ALLOCATED_0831":
      setTrack(s, "material", "COMPATIBLE_SPARE_EXISTS_BUT_ALLOCATED", "08:31", "HFP:08:31", changedTracks);
      setTrack(s, "blocker", "WAITING_FOR_MATERIAL_RELEASE_AUTHORITY", "08:31", "HFP:08:31", changedTracks);
      addEvidence(s, "08:31", "INVENTORY_CONFIRMATION", "Compatible spare exists at another operating location but is allocated to scheduled backbone work.", "HFP:08:31");
      break;
    case "WAIT_ACTIVITY_0842":
      addEvidence(s, "08:42", "OBSERVATION", "Budi reviews impact, Field update, spare status and Purchasing response; no material condition changed.", "HFP:08:42");
      break;
    case "SUPPLIER_BLOCKED_0847":
      addEvidence(s, "08:47", "PURCHASING_UPDATE", "Supplier path exists but release is administratively blocked; primary material-release blocker remains.", "HFP:08:47");
      break;
    case "REQUEST_ATTENTION_0850":
      setTrack(s, "coordination", "REQUEST_ATTENTION_TO_NOC_SUPERVISOR", "08:50", "HFP:08:50", changedTracks);
      addEvidence(s, "08:50", "ATTENTION_REQUEST", "Budi requests Supervisor judgment on spare release without transferring Situation responsibility.", "HFP:08:50");
      break;
    case "SUPERVISOR_RELEASE_0855":
      setTrack(s, "blocker", "MATERIAL_RELEASE_BLOCKER_RESOLVED", "08:55", "HFP:08:55", changedTracks);
      setTrack(s, "material", "MATERIAL_RELEASE_IN_PROGRESS", "08:55", "HFP:08:55", changedTracks);
      setTrack(s, "coordination", "ATTENTION_RESOLVED", "08:55", "HFP:08:55", changedTracks);
      addEvidence(s, "08:55", "AUTHORITY_DECISION", "Supervisor authorizes release after judging backbone work can be moved.", "HFP:08:55");
      break;
    case "SPARE_SENT_0903":
      setTrack(s, "material", "MATERIAL_EN_ROUTE", "09:03", "HFP:09:03", changedTracks);
      addEvidence(s, "09:03", "LOGISTICS", "Field receives confirmation that spare is being sent. Service is not yet recovered.", "HFP:09:03");
      break;
    case "SPARE_ARRIVING_0923":
      setTrack(s, "material", "MATERIAL_ARRIVING_AT_SITE", "09:23", "HFP:09:23", changedTracks);
      addEvidence(s, "09:23", "LOGISTICS", "Spare status becomes Arriving at Site; technical errors still intermittently present.", "HFP:09:23");
      break;
    case "SPARE_RECEIVED_CONTINUE_0928":
      setTrack(s, "material", "MATERIAL_AVAILABLE_AT_SITE", "09:28", "HFP:09:28", changedTracks);
      setTrack(s, "work", "INTERVENTION_AUTHORIZED_READY", "09:28", "HFP:09:28", changedTracks);
      addEvidence(s, "09:28", "FIELD_CONFIRMATION", "Spare received and part identity confirmed; Budi chooses to continue replacement.", "HFP:09:28");
      break;
    case "INTERVENTION_STARTED_0932":
      setTrack(s, "work", "TECHNICAL_INTERVENTION_IN_PROGRESS", "09:32", "HFP:09:32", changedTracks);
      addEvidence(s, "09:32", "FIELD_WORK", "Field starts transceiver replacement. No recovery conclusion is created from work start.", "HFP:09:32");
      break;
    case "RECOVERY_EVIDENCE_0938":
      setTrack(s, "work", "FIELD_WORK_COMPLETED", "09:38", "HFP:09:38", changedTracks);
      setTrack(s, "service", "TECHNICAL_RECOVERY_EVIDENCE_AVAILABLE", "09:38", "HFP:09:38", changedTracks);
      addEvidence(s, "09:38", "TECHNICAL_OBSERVATION", "Interface up; error counter stops increasing; optical reading normal; signals begin stabilizing.", "HFP:09:38");
      break;
    case "NETWORK_RECOVERY_INDICATED_0943":
      setTrack(s, "service", "NETWORK_RECOVERY_INDICATED", "09:43", "HFP:09:43", changedTracks);
      setTrack(s, "verification", "CUSTOMER_VERIFICATION_PENDING", "09:43", "HFP:09:43", changedTracks);
      addEvidence(s, "09:43", "HUMAN_JUDGMENT", "Budi judges technical evidence sufficient for Network Recovery Indicated; customer confirmation still required.", "HFP:09:43");
      break;
    case "CUSTOMER_SLOW_0947":
      addEvidence(s, "09:47", "CUSTOMER_OBSERVATION", "Customer says connection is back but one internal application still feels slow. Verification remains pending.", "HFP:09:47");
      break;
    case "TECHNICAL_STABLE_0953":
      addEvidence(s, "09:53", "TECHNICAL_MEASUREMENT", "End-to-end measurement remains stable; customer is asked to retest after reconnecting internal equipment.", "HFP:09:53");
      break;
    case "CUSTOMER_CONFIRMED_1001":
      setTrack(s, "verification", "CUSTOMER_VERIFIED_RECOVERED", "10:01", "HFP:10:01", changedTracks);
      setTrack(s, "closure", "TICKET_ELIGIBLE_FOR_CLOSURE", "10:01", "HFP:10:01", changedTracks);
      addEvidence(s, "10:01", "CUSTOMER_VERIFICATION", "Customer confirms service and application are normal; source/time retained.", "HFP:10:01");
      break;
    case "TICKET_CLOSED":
      if (s.tracks.closure.state !== "TICKET_ELIGIBLE_FOR_CLOSURE") throw new Error("CLOSURE_NOT_ELIGIBLE");
      setTrack(s, "closure", "CLOSED", "10:02", "HFP:post-10:01", changedTracks);
      addEvidence(s, "10:02", "AUTHORIZED_CLOSURE", "An authorized closure role closes the Ticket after eligibility is established.", "HFP:post-10:01");
      break;

    case "FIELD_READY_ACCESS_MISSING":
      addEvidence(s, "15:31", "FIELD_UPDATE", "Field ready; authorized site contact unavailable. Waiting for Site Access remains.", "HFP:15:31");
      break;
    case "ACCESS_CONTACT_ATTEMPT":
      addEvidence(s, "15:36", "COMMUNICATION_ATTEMPT", "Calls/messages/follow-up occur but lawful access is still unavailable; blocker aging continues.", "HFP:site-access-follow-up");
      break;
    case "ACCESS_AGING_ESCALATION":
      setTrack(s, "coordination", "ESCALATION_ACTIVE", "15:45", "HFP:site-access-aging", changedTracks);
      addEvidence(s, "15:45", "AGING_TRIGGER", "Governed threshold is reached; escalation obligation becomes visible while the access blocker remains unchanged.", "HFP:site-access-aging");
      break;
    case "AUTHORIZED_ACCESS_GRANTED":
      setTrack(s, "blocker", "SITE_ACCESS_AVAILABLE", "15:55", "HFP:site-access-granted", changedTracks);
      setTrack(s, "coordination", "ESCALATION_RESOLVED", "15:55", "HFP:site-access-granted", changedTracks);
      addEvidence(s, "15:55", "ACCESS_AUTHORIZATION", "Authorized customer contact grants access; blocker aging stops because the real condition changes.", "HFP:site-access-granted");
      break;
    case "FIELD_INSPECTION_STARTED":
      if (s.tracks.blocker.state !== "SITE_ACCESS_AVAILABLE") throw new Error("SITE_ACCESS_NOT_AVAILABLE");
      setTrack(s, "work", "FIELD_INSPECTION_IN_PROGRESS", "16:03", "HFP:16:03", changedTracks);
      addEvidence(s, "16:03", "FIELD_WORK", "Field inspection starts only after lawful access is available.", "HFP:16:03");
      break;

    case "HANDOVER_OFFERED":
      setTrack(s, "coordination", "HANDOVER_OFFERED", "14:56", "HFP:handover-offer", changedTracks);
      addEvidence(s, "14:56", "HANDOVER", "Handover offered; responsibility has not transferred.", "HFP:handover-offer");
      break;
    case "HANDOVER_NOT_ACCEPTED":
      setTrack(s, "coordination", "HANDOVER_PENDING", "14:58", "HFP:handover-pending", changedTracks);
      addEvidence(s, "14:58", "HANDOVER", "Proposed holder cannot accept; current responsibility remains unchanged.", "HFP:handover-pending");
      break;
    case "HANDOVER_ACCEPTED": {
      const retained = retainAgingSnapshot(s);
      s.tracks.responsibility = { holder: "Dimas", role: "NOC Operator", since: "15:00" };
      changedTracks.push("responsibility");
      setTrack(s, "coordination", "HANDOVER_EFFECTIVE", "15:00", "HFP:handover-accepted", changedTracks);
      addEvidence(s, "15:00", "HANDOVER", "Incoming holder explicitly accepts; responsibility transfers while service/blocker/verification state and aging remain unchanged.", "HFP:handover-accepted");
      assertAgingRetained(s, retained);
      break;
    }
    default:
      throw new Error(`UNKNOWN_EVENT:${eventId}`);
  }

  s.version += 1;
  s.clock = isoForEvent(eventId);
  s.nextEventIndex += 1;
  s.chronology.push(event);
  assertCoreInvariants(before, s, eventId);
  return s;
}

export function nextEvent(state) {
  return state.allowedEventIds[state.nextEventIndex] ?? null;
}

export function projectConsole(state) {
  return {
    scenarioId: state.scenarioId,
    title: state.title,
    purpose: state.purpose,
    version: state.version,
    clock: state.clock,
    actor: state.actor,
    nextEventId: nextEvent(state),
    nextEventLabel: nextEvent(state) ? eventLabel(nextEvent(state)) : null,
    tracks: state.tracks,
    evidence: state.evidence,
    chronology: state.chronology,
    invariants: state.invariants,
    source: state.source,
  };
}

function setTrack(s, key, state, since, evidenceRef, changedTracks) {
  s.tracks[key] = { ...s.tracks[key], state, since, evidence: [...(s.tracks[key].evidence ?? []), evidenceRef] };
  if (!changedTracks.includes(key)) changedTracks.push(key);
}

function addEvidence(s, at, kind, text, sourceRef) {
  s.evidence.push({ at, kind, text, sourceRef });
}

function retainAgingSnapshot(s) {
  return Object.fromEntries(Object.entries(s.tracks).filter(([,v]) => v && typeof v === "object" && "since" in v).map(([k,v]) => [k, v.since]));
}
function assertAgingRetained(s, before) {
  for (const [k, since] of Object.entries(before)) {
    if (k === "responsibility" || k === "coordination") continue;
    if (s.tracks[k]?.since !== since) throw new Error(`HANDOVER_RESET_AGING:${k}`);
  }
}

function assertCoreInvariants(before, after, eventId) {
  if (eventId === "WAIT_ACTIVITY_0842" || eventId === "SUPPLIER_BLOCKED_0847" || eventId === "CUSTOMER_SLOW_0947" || eventId === "TECHNICAL_STABLE_0953" || eventId === "FIELD_READY_ACCESS_MISSING" || eventId === "ACCESS_CONTACT_ATTEMPT") {
    if (before.tracks.blocker?.since !== after.tracks.blocker?.since) throw new Error(`ROUTINE_ACTIVITY_RESET_BLOCKER_AGING:${eventId}`);
  }
  if (eventId === "REQUEST_ATTENTION_0850" && before.tracks.responsibility.holder !== after.tracks.responsibility.holder) {
    throw new Error("REQUEST_ATTENTION_TRANSFERRED_RESPONSIBILITY");
  }
  if (["SPARE_SENT_0903","SPARE_ARRIVING_0923","SPARE_RECEIVED_CONTINUE_0928","INTERVENTION_STARTED_0932"].includes(eventId)) {
    if (after.tracks.service.state === "NETWORK_RECOVERY_INDICATED") throw new Error(`PREMATURE_RECOVERY:${eventId}`);
  }
  if (["INTERVENTION_STARTED_0932","RECOVERY_EVIDENCE_0938"].includes(eventId)) {
    if (after.tracks.verification.state === "CUSTOMER_VERIFIED_RECOVERED") throw new Error(`PREMATURE_CUSTOMER_VERIFICATION:${eventId}`);
  }
  if (eventId === "CUSTOMER_SLOW_0947" && after.tracks.verification.state !== "CUSTOMER_VERIFICATION_PENDING") {
    throw new Error("CUSTOMER_OBSERVATION_INVENTED_VERIFICATION");
  }
  if (eventId === "ACCESS_AGING_ESCALATION" && after.tracks.blocker.state !== "WAITING_FOR_SITE_ACCESS") {
    throw new Error("ESCALATION_CLEARED_ACCESS_BLOCKER");
  }
  if ((eventId === "HANDOVER_OFFERED" || eventId === "HANDOVER_NOT_ACCEPTED") && before.tracks.responsibility.holder !== after.tracks.responsibility.holder) {
    throw new Error("HANDOVER_TRANSFERRED_BEFORE_ACCEPTANCE");
  }
}

function eventTime(id) {
  const m = id.match(/_(\d{4})$/);
  if (m) return `${m[1].slice(0,2)}:${m[1].slice(2)}`;
  const fixed = {
    TICKET_CLOSED:"10:02",
    FIELD_READY_ACCESS_MISSING:"15:31",
    ACCESS_CONTACT_ATTEMPT:"15:36",
    ACCESS_AGING_ESCALATION:"15:45",
    AUTHORIZED_ACCESS_GRANTED:"15:55",
    FIELD_INSPECTION_STARTED:"16:03",
    HANDOVER_OFFERED:"14:56",
    HANDOVER_NOT_ACCEPTED:"14:58",
    HANDOVER_ACCEPTED:"15:00",
  };
  return fixed[id] ?? "--:--";
}
function isoForEvent(id) {
  return `2026-09-27T${eventTime(id)}:00+07:00`;
}
function eventLabel(id) {
  return ({
    STOCK_CONFIRMED_ALLOCATED_0831:"Stock confirmation: compatible spare exists but is allocated",
    WAIT_ACTIVITY_0842:"Repeated review/follow-up; no material condition changes",
    SUPPLIER_BLOCKED_0847:"Supplier path is blocked; internal release remains key dependency",
    REQUEST_ATTENTION_0850:"Request Supervisor attention without responsibility transfer",
    SUPERVISOR_RELEASE_0855:"Supervisor authorizes spare release",
    SPARE_SENT_0903:"Spare sent",
    SPARE_ARRIVING_0923:"Spare arriving at site",
    SPARE_RECEIVED_CONTINUE_0928:"Spare received; Budi chooses continuation",
    INTERVENTION_STARTED_0932:"Field starts transceiver replacement",
    RECOVERY_EVIDENCE_0938:"Technical recovery evidence becomes available",
    NETWORK_RECOVERY_INDICATED_0943:"Budi judges Network Recovery Indicated",
    CUSTOMER_SLOW_0947:"Customer says connection back but application still slow",
    TECHNICAL_STABLE_0953:"Technical measurement remains stable",
    CUSTOMER_CONFIRMED_1001:"Customer confirms normal service",
    TICKET_CLOSED:"Authorized role closes eligible Ticket",
    FIELD_READY_ACCESS_MISSING:"Field ready; lawful site access unavailable",
    ACCESS_CONTACT_ATTEMPT:"Contact/follow-up activity; access still unavailable",
    ACCESS_AGING_ESCALATION:"Aging threshold creates escalation obligation",
    AUTHORIZED_ACCESS_GRANTED:"Authorized contact grants site access",
    FIELD_INSPECTION_STARTED:"Field inspection starts after access available",
    HANDOVER_OFFERED:"Handover offered",
    HANDOVER_NOT_ACCEPTED:"Proposed holder cannot accept",
    HANDOVER_ACCEPTED:"Incoming holder explicitly accepts handover",
  })[id] ?? id;
}
