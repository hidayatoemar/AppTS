import fs from "node:fs";
import crypto from "node:crypto";
import childProcess from "node:child_process";

const AUTHORITY = { id: "MCR-to-CODEX-069", file_id: "1sXvoMI-aSTXmH87b-vUsjXvcoVp7Q0szDCSZeA-Q8Og" };
const D04_001_DISPOSITION = { id: "MCR-CODEX071-DISP-001", file_id: "19duxv_u8rs7IzN0r0wHElZYRdprKtpb47UqUzHYiwvo" };
const D04_002_DISPOSITION = { id: "MCR-CODEX072-DISP-001", file_id: "1QQxDjGcTsHU7hq4Qe4P0fataV-NCBXIHzDfAxfbmD40" };
const TOR = { id: "MVM-TOR-001 v0.8", file_id: "1dlBRa7f38OxaatTMCewEbvQgSBTwqUxCKysTGsf8nro" };
const IR_MAINTENANCE = {
  requirement_id: "IR-AVL-006",
  matrix_file_id: "1DP2Ix0ukP4OALiNr1iDYIcWqbeT7VQXATsVU65VYfQc",
  accepted_by: { id: "MCR-to-IR-002", file_id: "1FQp10HW2_0L0kYlzNAgLgnQzY2UVQRaHh1hMEMESKBc" },
  stage: "Production",
  factual_status: "GAP / INFORMATION REQUIRED",
  factual_observation: "Production maintenance policy/window evidence was not returned; compatibility with D04 <=4h/calendar month is unproven; Production maintenance posture remains OPEN."
};
const ACCEPTED_CARRIER = { commit: "17b1c4211ae35487b4fd2c7a4aef8a31889db4dd", tree: "1eaa2c612f6251dcd6ac2e60d86ba4835ad3a7cc", branch: "harness/mcr066-carrier-readiness-run" };
const ACCEPTED_PREFLIGHT = { commit: "1408cc123803c2dfe8d9401257acb029f7b2cd0a", tree: "2484817a7944c8da4e112ea439e262dec27d7216", branch: "harness/mcr067-frozen-mvm-campaign-preflight" };
const ACCEPTED_RERUN = { commit: "d1bca986df2ca3ef6561c8566eb594da4b2f4ca2", tree: "b5e7f384899701c331107fd8a4f42c7f7efc6ad3", branch: "harness/mcr068-frozen-mvm-pretrial-rerun" };
const PRODUCT = { repository: "hidayatoemar/AppTS", branch: "codex/mcr062-cf06-pretrial-successor", commit: "685e900545c686f1c2e802ff1e712394d1d324f6", tree: "440b4a5b2a402d929b0a398d51733e9bc1ede292" };
const CATALOG_SHA = "662d688ae96c8a161b5ddff607d03ea9ac201ae3636af6be475112485acdb1b7";
const AUTHORIZED_NA = new Map([
  ["MVM-OBL-NFR-D04-001", D04_001_DISPOSITION],
  ["MVM-OBL-NFR-D04-002", D04_002_DISPOSITION],
]);
const NEXT_MATERIAL_OBL = "MVM-OBL-NFR-D04-003";
const NEXT_REQUIREMENT = "Planned maintenance is <=4 hours per calendar month.";
const BLOCKER_ID = "MCR069-BLK-NFR-D04-003-PLANNED-MAINTENANCE-QUALIFICATION-001";
const HALT_REASON = "BLOCKED_CAMPAIGN_STOP_AFTER_MATERIAL_QUALIFICATION_GATE";

const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");
const exec = (cmd) => childProcess.execFileSync("bash", ["-lc", cmd], { encoding: "utf8" }).trim();

const specText = fs.readFileSync(new URL("../manifest/frozen-mvm.catalog.spec", import.meta.url), "utf8");
if (sha256(specText) !== CATALOG_SHA) throw new Error("CATALOG_IDENTITY_MISMATCH");
const lines = specText.trimEnd().split("\n");
if (lines.shift() !== "APPTS_MCR066_FROZEN_MVM_CATALOG_SPEC_V1") throw new Error("CATALOG_HEADER_MISMATCH");
const obligations = [], vps = [], hrts = [], variants = [], exactBindings = [], scenarios = new Set();
for (const line of lines) {
  const p = line.split("|");
  if (p[0] === "OBL") { obligations.push(p[1]); (p[2] || "").split(",").filter(Boolean).forEach((x) => scenarios.add(x)); }
  if (p[0] === "VP") { vps.push(p[1]); (p[2] || "").split(",").filter(Boolean).forEach((x) => scenarios.add(x)); }
  if (p[0] === "HRT") { hrts.push(p[1]); (p[2] || "").split(",").filter(Boolean).forEach((x) => scenarios.add(x)); }
  if (p[0] === "VAR") { variants.push(p[1]); if (p[2]) scenarios.add(p[2]); }
  if (p[0] === "EXACT") exactBindings.push([p[1], p[2]]);
}
const requireCount = (name, actual, expected) => { if (actual !== expected) throw new Error(`${name}_COUNT_MISMATCH:${actual}`); };
requireCount("OBL", obligations.length, 344);
requireCount("VP", vps.length, 527);
requireCount("HRT", hrts.length, 42);
requireCount("CS", scenarios.size, 35);
requireCount("VAR", variants.length, 217);
requireCount("EXACT", exactBindings.length, 68);
for (const id of AUTHORIZED_NA.keys()) if (!obligations.includes(id)) throw new Error(`AUTHORIZED_NA_OBLIGATION_MISSING:${id}`);
if (!obligations.includes(NEXT_MATERIAL_OBL)) throw new Error("NEXT_MATERIAL_OBLIGATION_MISSING");

if (exec(`git rev-parse ${PRODUCT.commit}^{tree}`) !== PRODUCT.tree) throw new Error("PRODUCT_TREE_MISMATCH");
if (exec(`git rev-parse ${ACCEPTED_CARRIER.commit}^{tree}`) !== ACCEPTED_CARRIER.tree) throw new Error("ACCEPTED_CARRIER_TREE_MISMATCH");
if (exec(`git rev-parse ${ACCEPTED_PREFLIGHT.commit}^{tree}`) !== ACCEPTED_PREFLIGHT.tree) throw new Error("ACCEPTED_PREFLIGHT_TREE_MISMATCH");
if (exec(`git rev-parse ${ACCEPTED_RERUN.commit}^{tree}`) !== ACCEPTED_RERUN.tree) throw new Error("ACCEPTED_RERUN_TREE_MISMATCH");
const productDiff = exec(`git diff --name-only ${PRODUCT.commit} -- DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001`);
if (productDiff) throw new Error(`PRODUCT_MUTATION:${productDiff}`);

const productRoot = new URL("../../DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001/", import.meta.url);
const pkg = JSON.parse(fs.readFileSync(new URL("package.json", productRoot), "utf8"));
const nfrCommand = pkg?.scripts?.["test:nfr"] ?? null;
const cf05Source = fs.readFileSync(new URL("tools/verify-cf05-harness.mjs", productRoot), "utf8");
const staticRegistryEvidence = {
  command: nfrCommand,
  expected_static_registry_command: "node tools/verify-cf05-harness.mjs",
  command_matches_static_registry: nfrCommand === "node tools/verify-cf05-harness.mjs",
  registered_case_population_71: cf05Source.includes("cases.length !== 71"),
  registered_status_static: cf05Source.includes('status: "REGISTERED"'),
  consumes_monthly_planned_maintenance_hours: /planned[_ -]?maintenance[_ -]?(hours|duration)|maintenance[_ -]?hours/i.test(cf05Source),
  consumes_calendar_month_maintenance_window: /calendar[_ -]?month.*maintenance|maintenance.*calendar[_ -]?month/i.test(cf05Source),
};

const inputs = {
  controlled_maintenance_basis_ref: process.env.MCR069_D04_003_CONTROLLED_MAINTENANCE_BASIS_REF || null,
  monthly_maintenance_evidence_ref: process.env.MCR069_D04_003_CONTROLLED_MAINTENANCE_EVIDENCE_REF || null,
  monthly_planned_maintenance_hours: process.env.MCR069_D04_003_MONTHLY_PLANNED_MAINTENANCE_HOURS || null,
};
const missingMeasurementMechanics = !staticRegistryEvidence.consumes_monthly_planned_maintenance_hours && !staticRegistryEvidence.consumes_calendar_month_maintenance_window;
const blockerConfirmed =
  !inputs.controlled_maintenance_basis_ref &&
  !inputs.monthly_maintenance_evidence_ref &&
  !inputs.monthly_planned_maintenance_hours &&
  staticRegistryEvidence.command_matches_static_registry &&
  staticRegistryEvidence.registered_case_population_71 &&
  staticRegistryEvidence.registered_status_static &&
  missingMeasurementMechanics;
if (!blockerConfirmed) {
  console.log(JSON.stringify({ blockerConfirmed, inputs, staticRegistryEvidence }));
  throw new Error("D04_003_QUALIFICATION_GATE_NOT_DETERMINISTIC");
}

const blocker = {
  blocker_id: BLOCKER_ID,
  classification: "CONTROLLED_ENVIRONMENT_MAINTENANCE / MONTHLY_PLANNED_MAINTENANCE_QUALIFICATION_INPUT_ABSENT",
  product_failure: false,
  harness_mechanics_failure: false,
  material_obligation: NEXT_MATERIAL_OBL,
  frozen_authority: TOR,
  frozen_requirement: NEXT_REQUIREMENT,
  accepted_ir_context: IR_MAINTENANCE,
  observed: { ...inputs, product_nfr_entrypoint: staticRegistryEvidence },
  prohibited_substitution: "A short synthetic run, invented maintenance calendar, inferred maintenance hours, static registry declaration, readiness-smoke evidence, or infrastructure-up status SHALL NOT substitute for controlled reconstructible monthly planned-maintenance evidence.",
  required_disposition: "STOP_TO_MCR",
};

const obligationAccounting = {};
for (const id of obligations) {
  if (AUTHORIZED_NA.has(id)) {
    obligationAccounting[id] = {
      status: "N/A-WITH-AUTHORITY",
      campaign_proof: false,
      authority: AUTHORIZED_NA.get(id),
      reason: "DEFERRED-STAGE-QUALIFICATION FOR CURRENT PRE-TRIAL CAMPAIGN ONLY"
    };
  } else if (id === NEXT_MATERIAL_OBL) {
    obligationAccounting[id] = { status: "BLOCKED", reason: BLOCKER_ID };
  } else {
    obligationAccounting[id] = { status: "BLOCKED", reason: HALT_REASON };
  }
}
const blockedMap = (ids) => Object.fromEntries(ids.map((id) => [id, { status: "BLOCKED", reason: HALT_REASON }]));
const accounting = {
  obligations: obligationAccounting,
  value_pairs: blockedMap(vps),
  high_risk_tuples: blockedMap(hrts),
  scenarios: blockedMap([...scenarios].sort()),
  mandatory_variants: blockedMap(variants),
  exact_f01_bindings: Object.fromEntries(exactBindings.map(([o, v]) => [`${o}->${v}`, { status: "BLOCKED", reason: HALT_REASON }])),
  summary: {
    obligations: { PROVEN: 0, PARTIAL: 0, FAILED: 0, BLOCKED: 342, N_A_WITH_AUTHORITY: 2 },
    value_pairs: { PROVEN: 0, FAILED: 0, BLOCKED: 527 },
    high_risk_tuples: { PROVEN: 0, FAILED: 0, BLOCKED: 42 },
    scenarios: { PROVEN: 0, FAILED: 0, BLOCKED: 35 },
    mandatory_variants: { PROVEN: 0, FAILED: 0, BLOCKED: 217 },
    exact_f01_bindings: { PROVEN: 0, FAILED: 0, BLOCKED: 68 },
  },
};

const execution = {
  branch: process.env.GITHUB_REF_NAME || "harness/mcr069-frozen-mvm-pretrial-rerun",
  commit: process.env.GITHUB_SHA || exec("git rev-parse HEAD"),
  tree: exec("git rev-parse HEAD^{tree}"),
  workflow: process.env.GITHUB_WORKFLOW || null,
  run_id: process.env.GITHUB_RUN_ID || null,
  run_attempt: process.env.GITHUB_RUN_ATTEMPT || null,
};
const evidence = {
  disposition: "STOP",
  scope: "MCR069_FROZEN_MVM_FRESH_ZERO_CREDIT_PRETRIAL_RERUN",
  campaign_credit_awarded: false,
  authority: AUTHORITY,
  stage_dispositions: [
    { obligation: "MVM-OBL-NFR-D04-001", authority: D04_001_DISPOSITION, status: "N/A-WITH-AUTHORITY", proof: false },
    { obligation: "MVM-OBL-NFR-D04-002", authority: D04_002_DISPOSITION, status: "N/A-WITH-AUTHORITY", proof: false },
  ],
  product: { ...PRODUCT, diff_against_bound_commit: "NONE" },
  admitted_carrier: ACCEPTED_CARRIER,
  accepted_preflight: ACCEPTED_PREFLIGHT,
  accepted_rerun_mechanics: ACCEPTED_RERUN,
  execution_extension: execution,
  frozen_catalog: { sha256: CATALOG_SHA, population: { obligations: 344, value_pairs: 527, high_risk_tuples: 42, scenarios: 35, mandatory_variants: 217, exact_f01_bindings: 68 } },
  blockers: [blocker],
  evidence_contract: {
    test_id: "MCR069-PREFLIGHT-NFR-D04-003",
    cs_variant_identity: "CS-030 / quantitative NFR planned-maintenance qualification gate",
    obligation_ids: [NEXT_MATERIAL_OBL],
    frozen_authority_reference: `${TOR.id} / ${TOR.file_id}`,
    authorized_stage_dispositions: [...AUTHORIZED_NA.entries()].map(([obligation, authority]) => ({ obligation, authority })),
    exact_product_identity: PRODUCT,
    exact_carrier_execution_identity: { admitted_carrier: ACCEPTED_CARRIER, accepted_preflight: ACCEPTED_PREFLIGHT, accepted_rerun_mechanics: ACCEPTED_RERUN, execution_extension: execution },
    precondition_fixture_identity: "Exact immutable Product + accepted carrier/preflight/rerun mechanics; fresh zero-credit campaign; D04-001 and D04-002 bound N/A-with-authority; no D04-003 monthly maintenance basis/evidence admitted",
    ordered_stimulus: [
      "bind immutable Product/carrier/preflight/rerun identities",
      "resolve closed frozen catalog",
      "apply exactly two authorized N/A-with-authority dispositions to D04-001 and D04-002",
      "inspect Product NFR entrypoint for monthly maintenance measurement mechanics",
      "resolve admitted D04-003 maintenance basis/evidence inputs",
      "evaluate whether <=4h/calendar-month planned maintenance is evidentiary-executable without substitution"
    ],
    expected_result: "Controlled maintenance basis plus reconstructible calendar-month planned-maintenance evidence sufficient to evaluate <=4 hours.",
    prohibited_result: blocker.prohibited_substitution,
    actual_observed_result: blocker.observed,
    corroborating_accepted_input: IR_MAINTENANCE,
    timestamp_context: new Date().toISOString(),
    discrepancy_classification: blocker.classification,
    disposition: "BLOCKED",
  },
  aggregate_accounting: accounting,
  lifecycle_matrix: { status: "BLOCKED", reason: HALT_REASON },
  global_invariant_sweep: { status: "BLOCKED", reason: HALT_REASON },
  nfr_boundary_status: { status: "BLOCKED", material_blocker: BLOCKER_ID },
  browser_console_status: { status: "BLOCKED", reason: HALT_REASON },
  replay_currentness_concurrency_adverse_status: { status: "BLOCKED", reason: HALT_REASON },
  prior_campaign_evidence: { status: "NOT_PROMOTED", campaign_credit: false },
  product_or_frozen_source_repair_performed: false,
  mutation_disclosure: "Harness/workflow extension only; immutable Product, accepted Product test source, and frozen-MVM sources unchanged.",
  required_next_authority: "MCR disposition/admission for MVM-OBL-NFR-D04-003: controlled reconstructible monthly planned-maintenance evidence sufficient to evaluate <=4h/calendar month, or an explicit authoritative current-stage disposition applying to that exact obligation. Any resumed frozen-MVM campaign must rerun fresh from zero proof credit unless newer authority states otherwise.",
};

const out = new URL("../evidence/mcr069/", import.meta.url);
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(new URL("campaign-rerun-stop.json", out), JSON.stringify(evidence, null, 2) + "\n");
fs.writeFileSync(new URL("aggregate-accounting-stop.json", out), JSON.stringify(accounting, null, 2) + "\n");
console.log(JSON.stringify({ disposition: "STOP", scope: evidence.scope, authorized_n_a: [...AUTHORIZED_NA.keys()], blocker: BLOCKER_ID, campaign_credit_awarded: false, population: evidence.frozen_catalog.population, product_diff: "NONE" }));
