import fs from "node:fs";
import assert from "node:assert/strict";
import crypto from "node:crypto";

import {
  I01_INTERFACE_IDENTITY,
  I01_SEMANTIC_VERSION,
  I01_PROFILE_IDENTITY,
  validateTicketActivation,
} from "../../DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001/packages/contracts/src/i01-ticket-activation.ts";
import { activateRuntime } from "../../DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001/packages/runtime-d04/src/activation.ts";
import { deriveAvailableActions } from "../../DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001/packages/runtime-d04/src/action-derivation.ts";
import { executeLifecycleEffect } from "../../DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001/packages/runtime-d04/src/effect-engine.ts";

const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");
const loadCatalog = () => {
  const text = fs.readFileSync(new URL("../manifest/frozen-mvm.catalog.spec", import.meta.url), "utf8");
  assert.equal(sha256(text), "662d688ae96c8a161b5ddff607d03ea9ac201ae3636af6be475112485acdb1b7", "CATALOG_SPEC_SHA_MISMATCH");
  const lines = text.trimEnd().split("\n");
  assert.equal(lines.shift(), "APPTS_MCR066_FROZEN_MVM_CATALOG_SPEC_V1");
  const population = { obligations: [], value_pairs: [], high_risk_tuples: [] };
  const crosswalk = { variant_to_scenario: {} };
  for (const line of lines) {
    const p = line.split("|");
    if (p[0] === "OBL") population.obligations.push(p[1]);
    else if (p[0] === "VP") population.value_pairs.push(p[1]);
    else if (p[0] === "HRT") population.high_risk_tuples.push(p[1]);
    else if (p[0] === "VAR") crosswalk.variant_to_scenario[p[1]] = p[2];
  }
  assert.equal(population.obligations.length, 344);
  assert.equal(population.value_pairs.length, 527);
  assert.equal(population.high_risk_tuples.length, 42);
  assert.equal(Object.keys(crosswalk.variant_to_scenario).length, 217);
  return { population, crosswalk };
};
const catalog = loadCatalog();

const ticketId = "MCR066-NONFACTUAL-CS001-TICKET";
const purposeBindingId = "MCR066-NONFACTUAL-PB";
const activationMessage = {
  interface_identity: I01_INTERFACE_IDENTITY,
  semantic_version: I01_SEMANTIC_VERSION,
  profile_identity: I01_PROFILE_IDENTITY,
  message_id: "MCR066-I01-MSG-001",
  idempotency_key: "MCR066-I01-IDEMP-001",
  correlation_id: "MCR066-CORR-CS001",
  producer_ref: "MCR066_EPHEMERAL_HARNESS",
  subject_ref: "MCR066-NONFACTUAL-SUBJECT",
  source_sequence_or_version: 1,
  produced_at: "2026-08-26T16:50:00Z",
  effective_from: "2026-08-26T16:50:00Z",
  currentness_ref: "CURRENT",
  payload_hash: "MCR066-SYNTHETIC-I01-HASH",
  payload: {
    activation_id: "MCR066-ACTIVATION-001",
    ticket_id: ticketId,
    purpose_binding_id: purposeBindingId,
    purpose_identity: "RESTORE_SERVICE",
    purpose_version: "1",
    package_identity: "APP-RESTORE-SERVICE",
    package_version: "MCR066-FROZEN",
    domain_id: "MCR066-NONFACTUAL-DOMAIN",
    intake_decision_id: "MCR066-NONFACTUAL-INTAKE",
    responsible_assignment_ref: "MCR066-NONFACTUAL-RESPONSIBLE-ASSIGNMENT",
    formation_evidence_set_ref: "MCR066-NONFACTUAL-FORMATION-EVIDENCE",
    producer_aggregate_version: 0,
    effective_at: "2026-08-26T16:50:00Z",
    activation_code: "ACTIVATE"
  }
};

const activationValidation = validateTicketActivation(activationMessage);
assert.equal(activationValidation.ok, true, `I01 validation failed: ${JSON.stringify(activationValidation)}`);
const activated = activateRuntime(undefined, activationMessage, activationValidation);
assert.equal(activated.status, "ACTIVATED");
assert.equal(activated.aggregate.state, "ACCEPTED");

class Store {
  constructor(aggregate) { this.aggregate = aggregate; this.results = new Map(); }
  async loadAggregate(id) { return id === this.aggregate.ticketId ? this.aggregate : undefined; }
  async findCommandResult(id) { return this.results.get(id); }
  async commitEffect(expected, next, result) {
    if (this.aggregate.aggregateVersion !== expected) return { status: "VERSION_CONFLICT" };
    this.aggregate = next;
    this.results.set(result.commandId, result);
    return { status: "COMMITTED", result };
  }
}

const authority = {
  authority_result_id: "MCR066-AUTH-001",
  ticket_id: ticketId,
  domain_id: "MCR066-NONFACTUAL-DOMAIN",
  context_ref: "MCR066-CS001-CURRENT-CONTEXT",
  assignment_snapshot_refs: ["MCR066-NONFACTUAL-SNAPSHOT"],
  responsibility_id: "MCR066-NONFACTUAL-RESPONSIBILITY",
  responsible_assignment_ref: "MCR066-NONFACTUAL-RESPONSIBLE-ASSIGNMENT",
  authority_actions: [
    { action_class_ref: "ACTIVATE", permission_code: "ALLOW" },
    { action_class_ref: "CLOSE", permission_code: "ALLOW" }
  ],
  result_status_ref: "AUTHORIZED",
  currentness_ref: "CURRENT",
  effective_from: "2026-08-26T16:50:00Z"
};
const gate = {
  gate_result_id: "MCR066-GATE-001",
  ticket_id: ticketId,
  gate_identity: "MCR066-CS001-GATE",
  gate_evaluation_id: "MCR066-GATE-EVAL-001",
  input_version_set_ref: "MCR066-CURRENT-INPUT-SET",
  gate_predicate_results: [],
  permitted_progression_classes: ["ACTIVATE"],
  currentness_ref: "CURRENT",
  effective_from: "2026-08-26T16:50:00Z"
};

const actions = deriveAvailableActions(authority, gate, []);
assert.deepEqual(actions, ["ACTIVATE"]);
const store = new Store(activated.aggregate);
const command = {
  commandId: "MCR066-CS001-SETUP-CMD",
  payloadHash: "MCR066-CS001-SETUP-HASH",
  ticketId,
  expectedAggregateVersion: 0,
  actionClass: "ACTIVATE",
  targetState: "ACTIVE",
  availableActions: actions,
  currentness: "CURRENT"
};
const effect = await executeLifecycleEffect(store, command);
assert.equal(effect.disposition, "EFFECT_APPLIED");
assert.equal(effect.state, "ACTIVE");
assert.equal(store.aggregate.state, "ACTIVE");
assert.equal(store.aggregate.aggregateVersion, 1);
const replay = await executeLifecycleEffect(store, command);
assert.equal(replay.disposition, "EFFECT_APPLIED");
assert.equal(store.aggregate.aggregateVersion, 1);

const cs001Obligations = [
  "MVM-OBL-GLOBAL-CORE-INV-002",
  "MVM-OBL-GLOBAL-CORE-INV-003",
  "MVM-OBL-GLOBAL-CORE-INV-007",
  "MVM-OBL-GLOBAL-CORE-INV-008",
  "MVM-OBL-GLOBAL-CORE-INV-011",
  "MVM-OBL-LC-001",
  "MVM-OBL-RUN-D04-LIFE-001"
];
const cs001Vps = ["VP-001","VP-006","VP-018","VP-030","VP-074","VP-081","VP-109","VP-158","VP-424","VP-428","VP-504"];
const cs001Hrts = ["HRT-001","HRT-018"];
for (const id of cs001Obligations) assert(catalog.population.obligations.includes(id), `CS001_OBLIGATION_NOT_IN_FROZEN_CATALOG:${id}`);
for (const id of cs001Vps) assert(catalog.population.value_pairs.includes(id), `CS001_VP_NOT_IN_FROZEN_CATALOG:${id}`);
for (const id of cs001Hrts) assert(catalog.population.high_risk_tuples.includes(id), `CS001_HRT_NOT_IN_FROZEN_CATALOG:${id}`);

const variants = [
  {
    id: "V08-VP-034", vp: "VP-034", mode: "PRODUCT_OBSERVATION",
    ordered_stimulus: ["provide current authority with ACTIVATE+CLOSE allowed", "provide current Gate permitting ACTIVATE only", "derive available action envelope"],
    expected: "only governed current intersection is exposed", prohibited: "authority-only action leaks past Gate",
    actual: { available_actions: actions },
    disposition: actions.length === 1 && actions[0] === "ACTIVATE" ? "PASS_READINESS_PLUMBING" : "FAIL"
  },
  {
    id: "V08-VP-070", vp: "VP-070", mode: "HARNESS_TRACE_OBSERVATION",
    ordered_stimulus: ["bind one synthetic accepted Ticket identity", "bind one Responsible Assignment", "bind current authority/Gate context", "materialize ACTIVE setup through Product code"],
    expected: "Ticket identity, responsibility and current control remain anchored to one work context", prohibited: "carrier silently substitutes a second Ticket/responsibility identity",
    actual: { ticket_id: store.aggregate.ticketId, purpose_binding_id: store.aggregate.purposeBindingId, responsible_assignment_ref: authority.responsible_assignment_ref, authority_ticket_id: authority.ticket_id, gate_ticket_id: gate.ticket_id },
    disposition: store.aggregate.ticketId === authority.ticket_id && authority.ticket_id === gate.ticket_id ? "PASS_READINESS_PLUMBING" : "FAIL"
  },
  {
    id: "V08-VP-142", vp: "VP-142", mode: "MATERIALIZED_NOT_PRODUCT_EXECUTED",
    ordered_stimulus: ["materialize current Ticket/Purpose/domain fixture", "materialize separate foreign Ticket/domain authority fixture", "preserve both identities in trace envelope"],
    expected: "carrier can orchestrate exact cross-context borrowing challenge under later campaign authority", prohibited: "MCR066 smoke awards semantic PASS or mutates Product using foreign authority",
    actual: { current_ticket_id: ticketId, foreign_ticket_id: "MCR066-NONFACTUAL-FOREIGN-TICKET", current_domain_id: authority.domain_id, foreign_domain_id: "MCR066-NONFACTUAL-FOREIGN-DOMAIN", product_mutation_attempted: false },
    disposition: "PASS_READINESS_PLUMBING"
  },
  {
    id: "V08-VP-479", vp: "VP-479", mode: "MATERIALIZED_NOT_PRODUCT_EXECUTED",
    ordered_stimulus: ["materialize current Responsible Role/Holder fixture for CS-001 Ticket", "materialize eligible Role/Holder fixture for a different work context", "preserve context identities separately"],
    expected: "carrier can orchestrate the no-cross-context-role-borrowing challenge under later campaign authority", prohibited: "MCR066 smoke treats eligibility elsewhere as current Ticket authority or awards campaign credit",
    actual: { current_assignment_ref: authority.responsible_assignment_ref, foreign_assignment_ref: "MCR066-NONFACTUAL-FOREIGN-ASSIGNMENT", product_mutation_attempted: false },
    disposition: "PASS_READINESS_PLUMBING"
  }
];
for (const row of variants) {
  assert.equal(catalog.crosswalk.variant_to_scenario[row.id], "CS-001", `VARIANT_NOT_BOUND_TO_CS001:${row.id}`);
  assert.equal(row.disposition, "PASS_READINESS_PLUMBING", `VARIANT_READINESS_FAIL:${row.id}`);
}

const evidence = {
  disposition: "PASS",
  scope: "MCR066_CS001_AND_MANDATORY_VARIANT_CARRIER_READINESS",
  no_frozen_campaign_credit: true,
  carrier_semantics: "CS001 readiness plumbing only; not frozen campaign execution evidence",
  catalog_carrier: { source: "checksum-bound clean spec", sha256: sha256(fs.readFileSync(new URL("../manifest/frozen-mvm.catalog.spec", import.meta.url), "utf8")) },
  frozen_trace: { scenario: "CS-001", obligations: cs001Obligations, value_pairs: cs001Vps, high_risk_tuples: cs001Hrts, mandatory_variants: variants.map((v) => v.id) },
  product_setup_observation: {
    i01_contract_validation: activationValidation.ok,
    activation_status: activated.status,
    initial_runtime_state: "ACCEPTED",
    derived_available_actions: actions,
    effect_result: effect,
    replay_result: replay,
    final_runtime_state: store.aggregate.state,
    final_aggregate_version: store.aggregate.aggregateVersion,
    canonical_state_manufactured_directly_by_harness: false
  },
  variants,
  environment: { node: process.version, github_sha: process.env.GITHUB_SHA ?? null, github_run_id: process.env.GITHUB_RUN_ID ?? null, github_run_attempt: process.env.GITHUB_RUN_ATTEMPT ?? null, timestamp: new Date().toISOString() },
  classification_boundary: { harness_failure_prefix: "HARNESS_", product_observation: "preserve Product result without repair", semantic_ambiguity: "STOP_TO_MCR", product_repair_authority: false }
};
fs.mkdirSync(new URL("../evidence/", import.meta.url), { recursive: true });
fs.writeFileSync(new URL("../evidence/cs001-readiness-smoke.json", import.meta.url), JSON.stringify(evidence, null, 2) + "\n");
console.log(JSON.stringify({ disposition: evidence.disposition, scope: evidence.scope, final_runtime_state: store.aggregate.state, variants: variants.map((v) => [v.id, v.disposition]), no_frozen_campaign_credit: true }));
