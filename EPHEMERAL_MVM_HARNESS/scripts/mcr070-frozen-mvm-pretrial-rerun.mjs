import fs from "node:fs";
import crypto from "node:crypto";
import childProcess from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AUTHORITY = { id: "MCR-to-CODEX-070", file_id: "1e_k2BORRwVLWzjt_v9OG4xerJi72eRlw2mf6_6r-SUs" };
const PRIMARY_DISPOSITION = { id: "MCR-CODEX073-DISP-001", file_id: "1p2magEU2bmqbRCMcRAzwVU-3N_gDSu28aWy9oaoOp7E" };
const D04_001_DISPOSITION = { id: "MCR-CODEX071-DISP-001", file_id: "19duxv_u8rs7IzN0r0wHElZYRdprKtpb47UqUzHYiwvo" };
const D04_002_DISPOSITION = { id: "MCR-CODEX072-DISP-001", file_id: "1QQxDjGcTsHU7hq4Qe4P0fataV-NCBXIHzDfAxfbmD40" };
const TOR = { id: "MVM-TOR-001 v0.8", file_id: "1dlBRa7f38OxaatTMCewEbvQgSBTwqUxCKysTGsf8nro", revision: "AIroW377aR58SETgpJ26bvvF8CSkN6Eq8l1c0RkC7xYUraEQe-fxSDN5ivsEeEwOvPhIMo8A7HF0CMZ4ytWBDl2gLuM-VqUxQN3H4V3gyVY" };
const IR_MATRIX = { id: "REFERENCE_ONLY__DO_NOT_FILL__IR-MX-001_Readiness_Assessment_Matrix_ACCEPTED_INPUT", file_id: "1AEKXnvmGxmfen7p9Q_Z-_0mIx0X82Oew7lKlJy4XQ2Q" };
const PRODUCT = { repository: "hidayatoemar/AppTS", branch: "codex/mcr062-cf06-pretrial-successor", commit: "685e900545c686f1c2e802ff1e712394d1d324f6", tree: "440b4a5b2a402d929b0a398d51733e9bc1ede292" };
const ACCEPTED_CARRIER = { commit: "17b1c4211ae35487b4fd2c7a4aef8a31889db4dd", tree: "1eaa2c612f6251dcd6ac2e60d86ba4835ad3a7cc" };
const ACCEPTED_PREFLIGHT = { commit: "1408cc123803c2dfe8d9401257acb029f7b2cd0a" };
const ACCEPTED_PRIOR_RERUN = { commit: "d1bca986df2ca3ef6561c8566eb594da4b2f4ca2" };
const ACCEPTED_MCR069_MECHANICS = { commit: "cb18721f250a76c27c57929d9b53dd7bfd8f6d09" };
const CATALOG_SHA = "662d688ae96c8a161b5ddff607d03ea9ac201ae3636af6be475112485acdb1b7";
const NEXT_OBL = "MVM-OBL-NFR-D04-005";
const FINDING_ID = "MCR070-FIND-NFR-D04-005-DEGRADED-MINIMUM-CAPABILITY-PARTIAL-001";
const HALT_REASON = "MCR070_STOP_AFTER_FIRST_APPLICABLE_PARTIAL_OBLIGATION";
const FROZEN_MEANING = "Minimum degraded capability is preserved and sensitive final effects remain fail closed during degradation.";
const ACC_001 = "Silent failure, unacknowledged loss or hidden responsibility is counted as unavailability rather than hidden behind infrastructure-up status.";
const ACC_002 = "Degraded operation preserves current responsibility and authoritative-state read, pending Intake/evidence capture, critical Incident/blocker/queue/communication-failure visibility, and fail-closed sensitive final effects.";
const AUTHORIZED_NA = new Map([
  ["MVM-OBL-NFR-D04-001", D04_001_DISPOSITION],
  ["MVM-OBL-NFR-D04-002", D04_002_DISPOSITION],
  ["MVM-OBL-NFR-D04-003", PRIMARY_DISPOSITION],
  ["MVM-OBL-NFR-D04-004", PRIMARY_DISPOSITION],
]);

const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");
const exec = (cmd, opts = {}) => childProcess.execFileSync("bash", ["-lc", cmd], { encoding: "utf8", ...opts }).trim();
const root = fileURLToPath(new URL("../../", import.meta.url));
const productRel = "DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001";
const productRoot = path.resolve(root, productRel);
const catalogPath = path.resolve(root, "EPHEMERAL_MVM_HARNESS/manifest/frozen-mvm.catalog.spec");

const specText = fs.readFileSync(catalogPath, "utf8");
if (sha256(specText) !== CATALOG_SHA) throw new Error("CATALOG_IDENTITY_MISMATCH");
const lines = specText.trimEnd().split("\n");
if (lines.shift() !== "APPTS_MCR066_FROZEN_MVM_CATALOG_SPEC_V1") throw new Error("CATALOG_HEADER_MISMATCH");
const obligations = [], vps = [], hrts = [], variants = [], exactBindings = [], scenarios = new Set();
const vpCarrier = new Map(), hrtCarrier = new Map(), variantCarrier = new Map();
for (const line of lines) {
  const p = line.split("|");
  if (p[0] === "OBL") { obligations.push(p[1]); (p[2] || "").split(",").filter(Boolean).forEach((x) => scenarios.add(x)); }
  if (p[0] === "VP") { vps.push(p[1]); vpCarrier.set(p[1], (p[2] || "").split(",").filter(Boolean)); (p[2] || "").split(",").filter(Boolean).forEach((x) => scenarios.add(x)); }
  if (p[0] === "HRT") { hrts.push(p[1]); hrtCarrier.set(p[1], (p[2] || "").split(",").filter(Boolean)); (p[2] || "").split(",").filter(Boolean).forEach((x) => scenarios.add(x)); }
  if (p[0] === "VAR") { variants.push(p[1]); variantCarrier.set(p[1], p[2] || null); if (p[2]) scenarios.add(p[2]); }
  if (p[0] === "EXACT") exactBindings.push([p[1], p[2]]);
}
const requireCount = (name, actual, expected) => { if (actual !== expected) throw new Error(`${name}_COUNT_MISMATCH:${actual}`); };
requireCount("OBL", obligations.length, 344);
requireCount("VP", vps.length, 527);
requireCount("HRT", hrts.length, 42);
requireCount("CS", scenarios.size, 35);
requireCount("VAR", variants.length, 217);
requireCount("EXACT", exactBindings.length, 68);
for (const id of AUTHORIZED_NA.keys()) if (!obligations.includes(id)) throw new Error(`AUTHORIZED_NA_MISSING:${id}`);
if (!obligations.includes(NEXT_OBL)) throw new Error("D04_005_MISSING_FROM_FROZEN_CATALOG");

if (exec(`git rev-parse ${PRODUCT.commit}^{tree}`, { cwd: root }) !== PRODUCT.tree) throw new Error("PRODUCT_TREE_MISMATCH");
if (exec(`git rev-parse ${ACCEPTED_CARRIER.commit}^{tree}`, { cwd: root }) !== ACCEPTED_CARRIER.tree) throw new Error("ACCEPTED_CARRIER_TREE_MISMATCH");
const productDiff = exec(`git diff --name-only ${PRODUCT.commit} -- ${productRel}`, { cwd: root });
if (productDiff) throw new Error(`PRODUCT_MUTATION:${productDiff}`);

const acceptedTestCmd = "node --experimental-strip-types --test tests/adverse/ui-stale-offline.adverse.test.ts && printf '\\nMCR070_ACCEPTED_TEST_EXIT_ZERO\\n'";
const acceptedTestOutput = exec(acceptedTestCmd, { cwd: productRoot });
if (!acceptedTestOutput.includes("MCR070_ACCEPTED_TEST_EXIT_ZERO")) throw new Error("ACCEPTED_UI_STALE_OFFLINE_TEST_NOT_PASSING_FRESH");

const pendingSource = fs.readFileSync(path.resolve(productRoot, "apps/web/src/offline/pending-capture.ts"), "utf8");
const swSource = fs.readFileSync(path.resolve(productRoot, "apps/web/src/offline/service-worker.ts"), "utf8");
const apiSource = fs.readFileSync(path.resolve(productRoot, "apps/web/src/api.ts"), "utf8");
const acceptedTestSource = fs.readFileSync(path.resolve(productRoot, "tests/adverse/ui-stale-offline.adverse.test.ts"), "utf8");
const offlineFiles = exec(`git ls-tree -r --name-only ${PRODUCT.commit} -- ${productRel}/apps/web/src/offline`, { cwd: root }).split("\n").filter(Boolean);

const observations = {
  fresh_accepted_product_test: { command: acceptedTestCmd, status: "PASS", output_sha256: sha256(acceptedTestOutput) },
  offline_authority_label_is_non_authoritative_current_context: pendingSource.includes('OFFLINE / NOT AUTHORITATIVE CURRENT CONTEXT'),
  pending_observation_or_draft_evidence_supported: pendingSource.includes('"OBSERVATION"|"DRAFT_EVIDENCE"'),
  sensitive_final_effect_forbidden: pendingSource.includes("OFFLINE_SENSITIVE_EFFECT_FORBIDDEN") && acceptedTestSource.includes("sensitiveFinalEffect:true"),
  offline_capture_bounded: pendingSource.includes("count()>=250") && pendingSource.includes("OFFLINE_CAPTURE_BOUND_REACHED"),
  static_shell_cached: swSource.includes('STATIC_ASSETS=["/","/index.html"]'),
  api_requests_explicitly_bypass_service_worker_cache: swSource.includes('pathname.startsWith("/api/")'),
  authoritative_ui_read_is_api_backed: apiSource.includes('fetcher(`/api/v1/ui${path}`') && apiSource.includes("read:(path:string)=>request(path)"),
  offline_subtree_files: offlineFiles,
  offline_subtree_exactly_pending_capture_and_service_worker: offlineFiles.length === 2 && offlineFiles.some((x) => x.endsWith("pending-capture.ts")) && offlineFiles.some((x) => x.endsWith("service-worker.ts")),
};
for (const [k, v] of Object.entries(observations)) {
  if (k === "fresh_accepted_product_test" || k === "offline_subtree_files") continue;
  if (v !== true) throw new Error(`D04_005_OBSERVATION_NOT_DETERMINISTIC:${k}`);
}

const capability = {
  current_responsibility_preserved_in_degraded_offline_path: { status: "UNPROVEN", basis: "offline path declares NOT AUTHORITATIVE CURRENT CONTEXT and contains no responsibility/state snapshot carrier" },
  authoritative_state_read_preserved_in_degraded_offline_path: { status: "UNPROVEN", basis: "authoritative UI read is /api-backed while service worker explicitly bypasses /api caching" },
  pending_intake_or_evidence_capture_preserved: { status: "PROVEN", basis: "fresh accepted offline adverse test plus pending-capture Product source" },
  critical_incident_blocker_queue_communication_failure_visibility_preserved: { status: "UNPROVEN", basis: "offline carrier caches shell only; no authoritative API projection or dedicated offline critical-visibility carrier is present" },
  sensitive_final_effects_fail_closed: { status: "PROVEN", basis: "fresh accepted offline adverse test plus OFFLINE_SENSITIVE_EFFECT_FORBIDDEN Product source" },
};
const provenCapabilityCount = Object.values(capability).filter((x) => x.status === "PROVEN").length;
const requiredCapabilityCount = Object.keys(capability).length;
if (provenCapabilityCount !== 2 || requiredCapabilityCount !== 5) throw new Error("D04_005_CAPABILITY_CLASSIFICATION_CHANGED");

const finding = {
  finding_id: FINDING_ID,
  obligation: NEXT_OBL,
  disposition: "PARTIAL",
  product_obligation_finding: "DEGRADED_MINIMUM_CAPABILITY_IMPLEMENTATION_GAP",
  product_wide_failure_claimed: false,
  frozen_meaning: FROZEN_MEANING,
  frozen_acceptance_context: { D04_ACC_001: ACC_001, D04_ACC_002: ACC_002 },
  capability,
  observed: observations,
  reason: "The immutable Product provides bounded pending observation/draft-evidence capture and fail-closed sensitive final effects, but fresh evidence does not establish preserved current responsibility, authoritative-state read, or critical Incident/blocker/queue/communication-failure visibility in the degraded/offline path. Therefore the mandatory minimum degraded-capability set is only partially realized.",
  required_campaign_disposition: "STOP",
};

const obligationAccounting = {};
for (const id of obligations) {
  if (AUTHORIZED_NA.has(id)) obligationAccounting[id] = { status: "N/A-WITH-AUTHORITY", proof: false, authority: AUTHORIZED_NA.get(id), reason: "DEFERRED-STAGE-QUALIFICATION FOR CURRENT PRE-TRIAL CAMPAIGN ONLY" };
  else if (id === NEXT_OBL) obligationAccounting[id] = { status: "PARTIAL", finding: FINDING_ID };
  else obligationAccounting[id] = { status: "BLOCKED", reason: HALT_REASON };
}
const vpAccounting = Object.fromEntries(vps.map((id) => [id, { status: "BLOCKED", reason: HALT_REASON, carrier_impact: vpCarrier.get(id)?.some((x) => x === "CS-017" || x === "CS-030") ? "D04_005_PARTIAL_CARRIER" : undefined }]));
const hrtAccounting = Object.fromEntries(hrts.map((id) => [id, id === "HRT-029" || id === "HRT-032" ? { status: "PARTIAL", finding: FINDING_ID, carriers: hrtCarrier.get(id) } : { status: "BLOCKED", reason: HALT_REASON }]));
const scenarioAccounting = Object.fromEntries([...scenarios].sort().map((id) => [id, id === "CS-017" || id === "CS-030" ? { status: "PARTIAL", finding: FINDING_ID } : { status: "BLOCKED", reason: HALT_REASON }]));
const variantAccounting = Object.fromEntries(variants.map((id) => [id, { status: "BLOCKED", reason: HALT_REASON, carrier_impact: ["CS-017","CS-030"].includes(variantCarrier.get(id)) ? "D04_005_PARTIAL_CARRIER" : undefined }]));
const exactAccounting = Object.fromEntries(exactBindings.map(([o,v]) => [`${o}->${v}`, { status: "BLOCKED", reason: HALT_REASON }]));

const execution = {
  repository: process.env.GITHUB_REPOSITORY || PRODUCT.repository,
  branch: process.env.GITHUB_REF_NAME || "harness/mcr070-frozen-mvm-pretrial-rerun",
  commit: process.env.GITHUB_SHA || exec("git rev-parse HEAD", { cwd: root }),
  tree: exec("git rev-parse HEAD^{tree}", { cwd: root }),
  workflow: process.env.GITHUB_WORKFLOW || null,
  run_id: process.env.GITHUB_RUN_ID || null,
  run_attempt: process.env.GITHUB_RUN_ATTEMPT || null,
  node: process.version,
  npm: exec("npm --version", { cwd: root }),
};

const evidence = {
  disposition: "STOP",
  scope: "MCR070_FRESH_ZERO_CREDIT_FROZEN_MVM_PRETRIAL_RERUN",
  campaign_credit_start: "ZERO",
  authority: AUTHORITY,
  primary_disposition: PRIMARY_DISPOSITION,
  frozen_authority: TOR,
  accepted_stage_source: IR_MATRIX,
  exact_product: { ...PRODUCT, diff_against_bound_commit: "NONE" },
  admitted_mechanics: { accepted_carrier: ACCEPTED_CARRIER, accepted_preflight: ACCEPTED_PREFLIGHT, accepted_prior_rerun: ACCEPTED_PRIOR_RERUN, accepted_mcr069_mechanics: ACCEPTED_MCR069_MECHANICS },
  execution,
  authorized_na: [...AUTHORIZED_NA.entries()].map(([obligation, authority]) => ({ obligation, status: "N/A-WITH-AUTHORITY", authority, proof: false })),
  first_material_finding: finding,
  frozen_catalog: { sha256: CATALOG_SHA, population: { obligations: 344, value_pairs: 527, high_risk_tuples: 42, scenarios: 35, mandatory_variants: 217, exact_f01_bindings: 68 } },
  aggregate_accounting: {
    obligations: obligationAccounting,
    value_pairs: vpAccounting,
    high_risk_tuples: hrtAccounting,
    scenarios: scenarioAccounting,
    mandatory_variants: variantAccounting,
    exact_f01_bindings: exactAccounting,
    summary: {
      obligations: { PROVEN: 0, PARTIAL: 1, FAILED: 0, BLOCKED: 339, N_A_WITH_AUTHORITY: 4 },
      value_pairs: { PROVEN: 0, PARTIAL: 0, FAILED: 0, BLOCKED: 527 },
      high_risk_tuples: { PROVEN: 0, PARTIAL: 2, FAILED: 0, BLOCKED: 40 },
      scenarios: { PROVEN: 0, PARTIAL: 2, FAILED: 0, BLOCKED: 33 },
      mandatory_variants: { PROVEN: 0, PARTIAL: 0, FAILED: 0, BLOCKED: 217 },
      exact_f01_bindings: { PROVEN: 0, PARTIAL: 0, FAILED: 0, BLOCKED: 68 },
    },
  },
  prior_stopped_run_evidence: { status: "NOT_PROMOTED", frozen_campaign_proof_credit: 0 },
  product_or_accepted_test_or_frozen_mvm_mutation_performed: false,
  human_trial: "HOLD / NOT AUTHORIZED",
  uat: "NOT AUTHORIZED",
  production: "NOT AUTHORIZED",
};

const evidenceDir = path.resolve(root, "EPHEMERAL_MVM_HARNESS/evidence/mcr070");
fs.mkdirSync(evidenceDir, { recursive: true });
const outPath = path.resolve(evidenceDir, "mcr070-frozen-mvm-stop-evidence.json");
fs.writeFileSync(outPath, JSON.stringify(evidence, null, 2) + "\n");
console.log(JSON.stringify({ disposition: evidence.disposition, first_material_finding: finding.finding_id, obligation: NEXT_OBL, obligation_status: "PARTIAL", fresh_accepted_product_test: "PASS", output: path.relative(root, outPath) }, null, 2));
