import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const seed = read("deploy/db/seed-tls-day2-arc001.sql");
const flow = read("apps/api/src/trial/tls-day2-arc001-flow.ts");
const trainer = read("apps/web/src/views/TrainerConsoleView.tsx");
const closure = read("apps/web/src/views/ClosureReadinessView.tsx");

test("ARC001 static seed cannot manufacture Ticket/runtime state or broaden grants", () => {
  assert.match(seed, /must not run as appts_runtime/i);
  assert.doesNotMatch(seed, /INSERT\s+INTO\s+appts\.ticket_identity/i);
  assert.doesNotMatch(seed, /INSERT\s+INTO\s+appts\.runtime_ticket/i);
  assert.doesNotMatch(seed, /INSERT\s+INTO\s+appts\.runtime_state_transition/i);
  assert.doesNotMatch(seed, /\bGRANT\b/i);
});

test("ARC001 exact symbolic controls remain present and distinct", () => {
  for (const value of [
    "SIM-NMS-RS-TLS-D2-01", "SIM-RS-QER-PROFILE-V1",
    "TRIAL-RS-VERIFICATION-ROLE-01", "TRIAL-HOLDER-VERIFY-B",
    "TRIAL-RS-TERMINAL-DISPOSITION-ROLE-01", "TRIAL-HOLDER-DISP-C",
    "TRIAL-RS-CLOSURE-AUTHORITY-ROLE-01", "TRIAL-HOLDER-CLOSE-D",
  ]) assert.match(seed, new RegExp(value));
});

test("simulator uses accepted external contract and does not directly advance lifecycle", () => {
  assert.match(flow, /INT_RUN_TD_01_IDENTITY/);
  assert.match(flow, /validateQualifiedExternalRecord/);
  assert.match(flow, /SERVICE_RESTORATION_INDICATION/);
  assert.match(flow, /PROVISIONAL_PENDING_INDEPENDENT_VERIFICATION/);
  assert.match(flow, /executeLifecycleEffect/);
  assert.match(flow, /actionClass:TLS_DAY2_TERMINAL_CLAIM,targetState:"TERMINAL_PROCESSING"/);
  assert.doesNotMatch(flow, /SET_TERMINAL_PROCESSING/);
  assert.doesNotMatch(flow, /requested_action_class[^\n]*CLOSE/);
});

test("Day-2 action classes are the ARC001 controlled values", () => {
  assert.match(flow, /RS_TRIAL_REQUEST_RESTORATION_VERIFICATION/);
  assert.match(flow, /RS_TRIAL_VERIFY_RESTORATION_EVIDENCE/);
  assert.match(flow, /RS_TRIAL_SUBMIT_TERMINAL_DISPOSITION_CLAIM/);
  assert.match(flow, /TERMINAL_DISPOSITION_CLAIM/);
  assert.match(flow, /OUTCOME_ACHIEVED/);
});

test("Trainer and closure browser surfaces visibly enforce training boundary", () => {
  assert.match(trainer, /not AppTS business authority/i);
  assert.match(trainer, /cannot create Tickets, verify evidence, advance lifecycle state, or close a Ticket/i);
  assert.match(closure, /no CLOSE action/i);
  assert.match(closure, /Readiness is server-derived/i);
});
