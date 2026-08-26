import fs from "node:fs";
import os from "node:os";
import { execFileSync } from "node:child_process";

const BASE = "685e900545c686f1c2e802ff1e712394d1d324f6";
const TREE = "440b4a5b2a402d929b0a398d51733e9bc1ede292";
const WORKSPACE = "DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001";
const WORKFLOW = ".github/workflows/mcr066-ephemeral-mvm-carrier.yml";
const run = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const assert = (cond, code) => { if (!cond) throw new Error(code); };

run("cat-file", "-e", `${BASE}^{commit}`);
const baseTree = run("show", "-s", "--format=%T", BASE);
assert(baseTree === TREE, `BOUND_PRODUCT_TREE_MISMATCH:${baseTree}`);

const productDiff = run("diff", "--name-only", `${BASE}..HEAD`, "--", WORKSPACE);
assert(productDiff === "", `PRODUCT_WORKSPACE_MUTATED:${productDiff}`);

const changed = run("diff", "--name-only", `${BASE}..HEAD`).split("\n").filter(Boolean);
const unauthorized = changed.filter((p) => !(p.startsWith("EPHEMERAL_MVM_HARNESS/") || p === WORKFLOW));
assert(unauthorized.length === 0, `HARNESS_BOUNDARY_VIOLATION:${unauthorized.join(",")}`);
assert(process.version === "v24.19.0", `NODE_VERSION_MISMATCH:${process.version}`);

const result = {
  disposition: "PASS",
  scope: "MCR066_CARRIER_IDENTITY_AND_PRODUCT_IMMUTABILITY",
  no_frozen_campaign_credit: true,
  product: {
    repository: "hidayatoemar/AppTS",
    branch_identity: "codex/mcr062-cf06-pretrial-successor",
    bound_commit: BASE,
    bound_tree: baseTree,
    workspace: WORKSPACE,
    diff_against_bound_commit: "NONE"
  },
  carrier: {
    branch: process.env.GITHUB_REF_NAME ?? "LOCAL",
    head_commit: run("rev-parse", "HEAD"),
    head_tree: run("show", "-s", "--format=%T", "HEAD"),
    changed_paths: changed,
    boundary: "EPHEMERAL_MVM_HARNESS + MCR066_WORKFLOW_ONLY"
  },
  environment: {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    runner_os: process.env.RUNNER_OS ?? os.platform(),
    github_run_id: process.env.GITHUB_RUN_ID ?? null,
    github_run_attempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
    github_workflow: process.env.GITHUB_WORKFLOW ?? null
  }
};
fs.mkdirSync(new URL("../evidence/", import.meta.url), { recursive: true });
fs.writeFileSync(new URL("../evidence/carrier-identity.json", import.meta.url), JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result));
