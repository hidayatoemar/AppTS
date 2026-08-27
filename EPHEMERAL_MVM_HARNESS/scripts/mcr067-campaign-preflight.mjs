import fs from "node:fs";
import crypto from "node:crypto";
import childProcess from "node:child_process";

const AUTHORITY = "MCR-to-CODEX-067";
const AUTHORITY_FILE_ID = "1YjRsfj56S7K8vD5QOIidUxR-Z4TKWjD-zSJia3UBh3I";
const TOR_FILE_ID = "1dlBRa7f38OxaatTMCewEbvQgSBTwqUxCKysTGsf8nro";
const ACCEPTED_CARRIER_COMMIT = "17b1c4211ae35487b4fd2c7a4aef8a31889db4dd";
const ACCEPTED_CARRIER_TREE = "1eaa2c612f6251dcd6ac2e60d86ba4835ad3a7cc";
const PRODUCT_COMMIT = "685e900545c686f1c2e802ff1e712394d1d324f6";
const PRODUCT_TREE = "440b4a5b2a402d929b0a398d51733e9bc1ede292";
const CATALOG_SHA = "662d688ae96c8a161b5ddff607d03ea9ac201ae3636af6be475112485acdb1b7";
const MONTHLY_AVAILABILITY_OBLIGATION = "MVM-OBL-NFR-D04-001";
const MONTHLY_AVAILABILITY_REQUIREMENT = ">=99.90% monthly availability under the controlled availability basis";

const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");
const exec = (cmd) => childProcess.execFileSync("bash", ["-lc", cmd], { encoding: "utf8" }).trim();
const root = new URL("../", import.meta.url);
const specPath = new URL("../manifest/frozen-mvm.catalog.spec", import.meta.url);
const specText = fs.readFileSync(specPath, "utf8");
if (sha256(specText) !== CATALOG_SHA) throw new Error("HARNESS_CATALOG_IDENTITY_MISMATCH");

const rows = specText.trimEnd().split("\n");
if (rows.shift() !== "APPTS_MCR066_FROZEN_MVM_CATALOG_SPEC_V1") throw new Error("HARNESS_CATALOG_HEADER_MISMATCH");
const obligations = [];
const vps = [];
const hrts = [];
const variants = [];
const exactBindings = [];
const scenarios = new Set();
for (const line of rows) {
  const p = line.split("|");
  if (p[0] === "OBL") { obligations.push(p[1]); for (const s of (p[2] || "").split(",").filter(Boolean)) scenarios.add(s); }
  if (p[0] === "VP") { vps.push(p[1]); for (const s of (p[2] || "").split(",").filter(Boolean)) scenarios.add(s); }
  if (p[0] === "HRT") { hrts.push(p[1]); for (const s of (p[2] || "").split(",").filter(Boolean)) scenarios.add(s); }
  if (p[0] === "VAR") { variants.push(p[1]); if (p[2]) scenarios.add(p[2]); }
  if (p[0] === "EXACT") exactBindings.push([p[1], p[2]]);
}
const exact = (actual, expected, code) => { if (actual !== expected) throw new Error(`${code}:${actual}`); };
exact(obligations.length, 344, "HARNESS_OBLIGATION_POPULATION_MISMATCH");
exact(vps.length, 527, "HARNESS_VP_POPULATION_MISMATCH");
exact(hrts.length, 42, "HARNESS_HRT_POPULATION_MISMATCH");
exact(variants.length, 217, "HARNESS_VARIANT_POPULATION_MISMATCH");
exact(exactBindings.length, 68, "HARNESS_EXACT_BINDING_POPULATION_MISMATCH");
exact(scenarios.size, 35, "HARNESS_SCENARIO_POPULATION_MISMATCH");
if (!obligations.includes(MONTHLY_AVAILABILITY_OBLIGATION)) throw new Error("HARNESS_REQUIRED_NFR_D04_OBLIGATION_NOT_IN_FROZEN_CATALOG");

const productDiff = exec(`git diff --name-only ${PRODUCT_COMMIT} -- DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001`);
if (productDiff !== "") throw new Error(`PRODUCT_BOUNDARY_MUTATION:${productDiff}`);
const actualProductTree = exec(`git rev-parse ${PRODUCT_COMMIT}^{tree}`);
exact(actualProductTree, PRODUCT_TREE, "PRODUCT_TREE_MISMATCH");
const acceptedCarrierTree = exec(`git rev-parse ${ACCEPTED_CARRIER_COMMIT}^{tree}`);
exact(acceptedCarrierTree, ACCEPTED_CARRIER_TREE, "ACCEPTED_CARRIER_TREE_MISMATCH");

const productPackage = JSON.parse(fs.readFileSync(new URL("../../DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001/package.json", import.meta.url), "utf8"));
const nfrScript = productPackage?.scripts?.["test:nfr"] ?? null;
const expectedRegistryOnlyCommand = "npm exec -- node tools/verify-cf05-harness.mjs";
const nfrRegistrySource = fs.readFileSync(new URL("../../DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001/tools/verify-cf05-harness.mjs", import.meta.url), "utf8");
const registryOnlySignals = {
  test_nfr_command_is_cf05_registry_verifier: nfrScript === expectedRegistryOnlyCommand,
  checks_nfr_trace_registry: nfrRegistrySource.includes("nfr-trace-registry"),
  contains_monthly_availability_measurement: /monthly\s+availability|99\.90|99\.9%/i.test(nfrRegistrySource),
  contains_load_stress_runner: /150%|30\s*minute|concurrent|events\/second|requests\/second/i.test(nfrRegistrySource),
};

const availabilityEvidenceRef = process.env.MCR067_CONTROLLED_AVAILABILITY_EVIDENCE_REF ?? "";
const controlledAvailabilityBasisRef = process.env.MCR067_CONTROLLED_AVAILABILITY_BASIS_REF ?? "";
const monthlyAvailabilityObserved = process.env.MCR067_MONTHLY_AVAILABILITY_OBSERVED ?? "";

const blocker = {
  blocker_id: "MCR067-BLK-NFR-D04-AVAILABILITY-BASIS-001",
  classification: "CONTROLLED_ENVIRONMENT_AVAILABILITY / QUALIFICATION_INPUT_ABSENT",
  product_failure: false,
  harness_mechanics_failure: false,
  authority_ambiguity: false,
  material_obligation: MONTHLY_AVAILABILITY_OBLIGATION,
  frozen_authority: { document: "MVM-TOR-001 v0.8", file_id: TOR_FILE_ID },
  frozen_requirement: MONTHLY_AVAILABILITY_REQUIREMENT,
  observed: {
    controlled_availability_basis_ref: controlledAvailabilityBasisRef || null,
    monthly_availability_evidence_ref: availabilityEvidenceRef || null,
    monthly_availability_observed: monthlyAvailabilityObserved || null,
    product_test_nfr_script: nfrScript,
    registry_only_signals: registryOnlySignals,
  },
  reason: "Fresh MCR067 campaign has no admitted controlled-availability basis or monthly availability evidence pointer. The immutable Product baseline exposes test:nfr as the CF05 registry verifier and does not itself provide monthly availability measurement evidence. Replacing the frozen monthly requirement with a short synthetic ratio or invented availability basis would weaken/reinterpret frozen authority, which MCR067 prohibits.",
  required_disposition: "STOP_TO_MCR",
};

const blockerConfirmed = !controlledAvailabilityBasisRef && !availabilityEvidenceRef && !monthlyAvailabilityObserved && registryOnlySignals.test_nfr_command_is_cf05_registry_verifier && registryOnlySignals.checks_nfr_trace_registry && !registryOnlySignals.contains_monthly_availability_measurement;
if (!blockerConfirmed) throw new Error("HARNESS_PREFLIGHT_BLOCKER_NOT_DETERMINISTIC");

const blockedByGate = "BLOCKED_CAMPAIGN_STOP_AFTER_MATERIAL_PREFLIGHT_GATE";
const obligationAccounting = Object.fromEntries(obligations.map((id) => [id, {
  status: id === MONTHLY_AVAILABILITY_OBLIGATION ? "BLOCKED" : "BLOCKED",
  reason: id === MONTHLY_AVAILABILITY_OBLIGATION ? blocker.blocker_id : blockedByGate,
}]));
const vpAccounting = Object.fromEntries(vps.map((id) => [id, { status: "BLOCKED", reason: blockedByGate }]));
const hrtAccounting = Object.fromEntries(hrts.map((id) => [id, { status: "BLOCKED", reason: blockedByGate }]));
const scenarioAccounting = Object.fromEntries([...scenarios].sort().map((id) => [id, { status: "BLOCKED", reason: blockedByGate }]));
const variantAccounting = Object.fromEntries(variants.map((id) => [id, { status: "BLOCKED", reason: blockedByGate }]));
const exactBindingAccounting = Object.fromEntries(exactBindings.map(([obl, variant]) => [`${obl}->${variant}`, { status: "BLOCKED", reason: blockedByGate }]));

const evidence = {
  disposition: "STOP",
  scope: "MCR067_FROZEN_MVM_FRESH_CAMPAIGN_PREFLIGHT",
  campaign_credit_awarded: false,
  authority: { id: AUTHORITY, file_id: AUTHORITY_FILE_ID },
  product: {
    repository: "hidayatoemar/AppTS",
    branch_identity: "codex/mcr062-cf06-pretrial-successor",
    commit: PRODUCT_COMMIT,
    tree: PRODUCT_TREE,
    diff_against_bound_product_commit: "NONE",
  },
  admitted_carrier: {
    commit: ACCEPTED_CARRIER_COMMIT,
    tree: ACCEPTED_CARRIER_TREE,
    branch_identity: "harness/mcr066-carrier-readiness-run",
  },
  execution_extension: {
    branch: process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || "harness/mcr067-frozen-mvm-campaign-preflight",
    commit: process.env.GITHUB_SHA || exec("git rev-parse HEAD"),
    tree: exec("git rev-parse HEAD^{tree}"),
    workflow: process.env.GITHUB_WORKFLOW ?? null,
    run_id: process.env.GITHUB_RUN_ID ?? null,
    run_attempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
  },
  frozen_catalog: {
    sha256: CATALOG_SHA,
    population: { obligations: obligations.length, value_pairs: vps.length, high_risk_tuples: hrts.length, scenarios: scenarios.size, mandatory_variants: variants.length, exact_f01_bindings: exactBindings.length },
  },
  blockers: [blocker],
  evidence_contract: {
    test_id: "MCR067-PREFLIGHT-NFR-D04-001",
    cs_variant_identity: "CS-030 / quantitative NFR qualification gate",
    obligation_ids: [MONTHLY_AVAILABILITY_OBLIGATION],
    vp_hrt_ids: [],
    frozen_authority_reference: `MVM-TOR-001 v0.8 / ${TOR_FILE_ID}`,
    fixture_precondition: "Exact immutable Product baseline + admitted carrier; no external controlled availability basis supplied by MCR067",
    ordered_stimulus: [
      "bind exact Product and accepted carrier identities",
      "resolve complete frozen MVM catalog",
      "inspect Product NFR qualification entrypoint without mutating Product",
      "resolve MCR067-supplied controlled availability basis/evidence inputs",
      "classify whether monthly availability obligation is executable without semantic substitution"
    ],
    expected_result: "A controlled availability basis and reconstructible monthly availability evidence sufficient to evaluate >=99.90% are available.",
    prohibited_result: "Do not replace monthly availability with a short synthetic run, invent an availability basis, infer a numeric result, or award campaign credit without evidence.",
    actual_result: blocker.observed,
    deterministic_output: blocker,
    timestamp_context: new Date().toISOString(),
    discrepancy_classification: blocker.classification,
    disposition: "BLOCKED",
  },
  aggregate_accounting: {
    obligations: obligationAccounting,
    value_pairs: vpAccounting,
    high_risk_tuples: hrtAccounting,
    scenarios: scenarioAccounting,
    mandatory_variants: variantAccounting,
    exact_f01_bindings: exactBindingAccounting,
    summary: {
      obligations: { PROVEN: 0, PARTIAL: 0, FAILED: 0, BLOCKED: obligations.length, N_A_WITH_AUTHORITY: 0 },
      value_pairs: { PROVEN: 0, FAILED: 0, BLOCKED: vps.length },
      high_risk_tuples: { PROVEN: 0, FAILED: 0, BLOCKED: hrts.length },
      scenarios: { PROVEN: 0, FAILED: 0, BLOCKED: scenarios.size },
      mandatory_variants: { PROVEN: 0, FAILED: 0, BLOCKED: variants.length },
      exact_f01_bindings: { PROVEN: 0, FAILED: 0, BLOCKED: exactBindings.length },
    },
  },
  lifecycle_matrix: { status: "BLOCKED", reason: blockedByGate },
  global_invariant_sweep: { status: "BLOCKED", reason: blockedByGate },
  nfr_boundary_status: { status: "BLOCKED", material_blocker: blocker.blocker_id },
  browser_console_status: { status: "BLOCKED", reason: blockedByGate },
  replay_currentness_concurrency_adverse_status: { status: "BLOCKED", reason: blockedByGate },
  invalidated_prior_evidence: ["CODEX070 readiness smoke remains NO_FROZEN_CAMPAIGN_CREDIT and was not promoted"],
  product_or_frozen_source_repair_performed: false,
  required_next_authority: "MCR disposition/admission of a controlled availability basis and reconstructible monthly availability evidence source, or an explicit authoritative disposition for MVM-OBL-NFR-D04-001; then fresh campaign rerun from zero credit.",
};

const evidenceDir = new URL("../evidence/mcr067/", import.meta.url);
fs.mkdirSync(evidenceDir, { recursive: true });
fs.writeFileSync(new URL("campaign-preflight-stop.json", evidenceDir), JSON.stringify(evidence, null, 2) + "\n");
fs.writeFileSync(new URL("aggregate-accounting-stop.json", evidenceDir), JSON.stringify(evidence.aggregate_accounting, null, 2) + "\n");
console.log(JSON.stringify({ disposition: evidence.disposition, scope: evidence.scope, blocker: blocker.blocker_id, campaign_credit_awarded: false, population: evidence.frozen_catalog.population, product_diff: "NONE" }));
