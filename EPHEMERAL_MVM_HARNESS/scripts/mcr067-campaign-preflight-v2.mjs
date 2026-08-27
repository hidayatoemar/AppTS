import fs from "node:fs";
import crypto from "node:crypto";
import childProcess from "node:child_process";

const AUTHORITY = { id: "MCR-to-CODEX-067", file_id: "1YjRsfj56S7K8vD5QOIidUxR-Z4TKWjD-zSJia3UBh3I" };
const TOR = { id: "MVM-TOR-001 v0.8", file_id: "1dlBRa7f38OxaatTMCewEbvQgSBTwqUxCKysTGsf8nro" };
const ACCEPTED_CARRIER = { commit: "17b1c4211ae35487b4fd2c7a4aef8a31889db4dd", tree: "1eaa2c612f6251dcd6ac2e60d86ba4835ad3a7cc", branch: "harness/mcr066-carrier-readiness-run" };
const PRODUCT = { repository: "hidayatoemar/AppTS", branch: "codex/mcr062-cf06-pretrial-successor", commit: "685e900545c686f1c2e802ff1e712394d1d324f6", tree: "440b4a5b2a402d929b0a398d51733e9bc1ede292" };
const CATALOG_SHA = "662d688ae96c8a161b5ddff607d03ea9ac201ae3636af6be475112485acdb1b7";
const AVAILABILITY_OBL = "MVM-OBL-NFR-D04-001";
const AVAILABILITY_REQUIREMENT = ">=99.90% monthly availability under the controlled availability basis";
const BLOCKER_ID = "MCR067-BLK-NFR-D04-AVAILABILITY-BASIS-001";
const HALT_REASON = "BLOCKED_CAMPAIGN_STOP_AFTER_MATERIAL_PREFLIGHT_GATE";

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
if (!obligations.includes(AVAILABILITY_OBL)) throw new Error("FROZEN_AVAILABILITY_OBLIGATION_MISSING");

if (exec(`git rev-parse ${PRODUCT.commit}^{tree}`) !== PRODUCT.tree) throw new Error("PRODUCT_TREE_MISMATCH");
if (exec(`git rev-parse ${ACCEPTED_CARRIER.commit}^{tree}`) !== ACCEPTED_CARRIER.tree) throw new Error("ACCEPTED_CARRIER_TREE_MISMATCH");
const productDiff = exec(`git diff --name-only ${PRODUCT.commit} -- DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001`);
if (productDiff) throw new Error(`PRODUCT_MUTATION:${productDiff}`);

const productRoot = new URL("../../DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001/", import.meta.url);
const pkg = JSON.parse(fs.readFileSync(new URL("package.json", productRoot), "utf8"));
const nfrCommand = pkg?.scripts?.["test:nfr"] ?? null;
const cf05Source = fs.readFileSync(new URL("tools/verify-cf05-harness.mjs", productRoot), "utf8");
const staticRegistryEvidence = {
  command: nfrCommand,
  expected_static_registry_command: "npm exec -- node tools/verify-cf05-harness.mjs",
  command_matches_static_registry: nfrCommand === "npm exec -- node tools/verify-cf05-harness.mjs",
  registered_case_population_71: cf05Source.includes("cases.length !== 71"),
  registered_status_static: cf05Source.includes('status: "REGISTERED"'),
  emits_registry_manifest_hash: cf05Source.includes("evidence_manifest_hash"),
  consumes_uptime_measurement: /uptime[_ -]?(sample|window|measurement|seconds)/i.test(cf05Source),
  consumes_downtime_measurement: /downtime[_ -]?(sample|window|measurement|seconds)/i.test(cf05Source),
  consumes_monthly_observation_window: /monthly[_ -]?(window|observation|sample)/i.test(cf05Source),
};

const inputs = {
  controlled_availability_basis_ref: process.env.MCR067_CONTROLLED_AVAILABILITY_BASIS_REF || null,
  monthly_availability_evidence_ref: process.env.MCR067_CONTROLLED_AVAILABILITY_EVIDENCE_REF || null,
  monthly_availability_observed: process.env.MCR067_MONTHLY_AVAILABILITY_OBSERVED || null,
};
const missingMeasurementMechanics = !staticRegistryEvidence.consumes_uptime_measurement && !staticRegistryEvidence.consumes_downtime_measurement && !staticRegistryEvidence.consumes_monthly_observation_window;
const blockerConfirmed = !inputs.controlled_availability_basis_ref && !inputs.monthly_availability_evidence_ref && !inputs.monthly_availability_observed && staticRegistryEvidence.command_matches_static_registry && staticRegistryEvidence.registered_case_population_71 && staticRegistryEvidence.registered_status_static && missingMeasurementMechanics;
if (!blockerConfirmed) {
  console.log(JSON.stringify({ blockerConfirmed, inputs, staticRegistryEvidence }));
  throw new Error("PREFLIGHT_BLOCKER_NOT_DETERMINISTIC");
}

const blocker = {
  blocker_id: BLOCKER_ID,
  classification: "CONTROLLED_ENVIRONMENT_AVAILABILITY / QUALIFICATION_INPUT_ABSENT",
  product_failure: false,
  harness_mechanics_failure: false,
  material_obligation: AVAILABILITY_OBL,
  frozen_authority: TOR,
  frozen_requirement: AVAILABILITY_REQUIREMENT,
  observed: { ...inputs, product_nfr_entrypoint: staticRegistryEvidence },
  prohibited_substitution: "A short synthetic run, extrapolated ratio, invented availability basis, or static registry declaration SHALL NOT substitute for reconstructible monthly availability evidence.",
  required_disposition: "STOP_TO_MCR",
};

const blockedMap = (ids, specialId = null) => Object.fromEntries(ids.map((id) => [id, { status: "BLOCKED", reason: id === specialId ? BLOCKER_ID : HALT_REASON }]));
const accounting = {
  obligations: blockedMap(obligations, AVAILABILITY_OBL),
  value_pairs: blockedMap(vps),
  high_risk_tuples: blockedMap(hrts),
  scenarios: blockedMap([...scenarios].sort()),
  mandatory_variants: blockedMap(variants),
  exact_f01_bindings: Object.fromEntries(exactBindings.map(([o, v]) => [`${o}->${v}`, { status: "BLOCKED", reason: HALT_REASON }])),
  summary: {
    obligations: { PROVEN: 0, PARTIAL: 0, FAILED: 0, BLOCKED: 344, N_A_WITH_AUTHORITY: 0 },
    value_pairs: { PROVEN: 0, FAILED: 0, BLOCKED: 527 },
    high_risk_tuples: { PROVEN: 0, FAILED: 0, BLOCKED: 42 },
    scenarios: { PROVEN: 0, FAILED: 0, BLOCKED: 35 },
    mandatory_variants: { PROVEN: 0, FAILED: 0, BLOCKED: 217 },
    exact_f01_bindings: { PROVEN: 0, FAILED: 0, BLOCKED: 68 },
  },
};

const execution = {
  branch: process.env.GITHUB_REF_NAME || "harness/mcr067-frozen-mvm-campaign-preflight",
  commit: process.env.GITHUB_SHA || exec("git rev-parse HEAD"),
  tree: exec("git rev-parse HEAD^{tree}"),
  workflow: process.env.GITHUB_WORKFLOW || null,
  run_id: process.env.GITHUB_RUN_ID || null,
  run_attempt: process.env.GITHUB_RUN_ATTEMPT || null,
};
const evidence = {
  disposition: "STOP",
  scope: "MCR067_FROZEN_MVM_FRESH_CAMPAIGN_PREFLIGHT",
  campaign_credit_awarded: false,
  authority: AUTHORITY,
  product: { ...PRODUCT, diff_against_bound_commit: "NONE" },
  admitted_carrier: ACCEPTED_CARRIER,
  execution_extension: execution,
  frozen_catalog: { sha256: CATALOG_SHA, population: { obligations: 344, value_pairs: 527, high_risk_tuples: 42, scenarios: 35, mandatory_variants: 217, exact_f01_bindings: 68 } },
  blockers: [blocker],
  evidence_contract: {
    test_id: "MCR067-PREFLIGHT-NFR-D04-001",
    cs_variant_identity: "CS-030 / quantitative NFR qualification gate",
    obligation_ids: [AVAILABILITY_OBL],
    frozen_authority_reference: `${TOR.id} / ${TOR.file_id}`,
    exact_product_identity: PRODUCT,
    exact_carrier_execution_identity: { admitted_carrier: ACCEPTED_CARRIER, execution_extension: execution },
    precondition_fixture_identity: "Exact immutable Product + accepted carrier; fresh campaign; no controlled availability basis/evidence admitted",
    ordered_stimulus: ["bind immutable Product/carrier", "resolve closed frozen catalog", "inspect Product NFR entrypoint", "resolve admitted availability basis/evidence inputs", "evaluate whether monthly availability requirement is evidentiary-executable without substitution"],
    expected_result: "Controlled availability basis plus reconstructible monthly availability evidence sufficient to evaluate >=99.90%.",
    prohibited_result: blocker.prohibited_substitution,
    actual_observed_result: blocker.observed,
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
  prior_readiness_evidence: { status: "NOT_PROMOTED", campaign_credit: false },
  product_or_frozen_source_repair_performed: false,
  required_next_authority: "MCR disposition/admission of the controlled availability basis and reconstructible monthly availability evidence source, or explicit authoritative disposition for MVM-OBL-NFR-D04-001; any resumed campaign must rerun fresh from zero campaign credit.",
};

const out = new URL("../evidence/mcr067/", import.meta.url);
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(new URL("campaign-preflight-stop.json", out), JSON.stringify(evidence, null, 2) + "\n");
fs.writeFileSync(new URL("aggregate-accounting-stop.json", out), JSON.stringify(accounting, null, 2) + "\n");
console.log(JSON.stringify({ disposition: "STOP", scope: evidence.scope, blocker: BLOCKER_ID, campaign_credit_awarded: false, population: evidence.frozen_catalog.population, product_diff: "NONE" }));
