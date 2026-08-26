import fs from "node:fs";
import crypto from "node:crypto";

const source = new URL("../manifest/frozen-mvm.catalog.spec", import.meta.url);
const text = fs.readFileSync(source, "utf8");
const fileSha = crypto.createHash("sha256").update(text).digest("hex");
if (fileSha !== "662d688ae96c8a161b5ddff607d03ea9ac201ae3636af6be475112485acdb1b7") {
  throw new Error(`CATALOG_SPEC_SHA_MISMATCH:${fileSha}`);
}
const rows = text.trimEnd().split("\n");
if (rows.shift() !== "APPTS_MCR066_FROZEN_MVM_CATALOG_SPEC_V1") throw new Error("CATALOG_SPEC_HEADER_MISMATCH");
const splitList = (s) => s ? s.split(",") : [];
const authority = { value: undefined };
const credit = { value: undefined };
let product;
const sources = {};
const aliases = [];
const obligation_to_scenarios = {};
const vp_to_carrier = {};
const hrt_to_scenarios = {};
const variant_to_scenario = {};
const obligation_to_exact_variant = {};
for (const line of rows) {
  const p = line.split("|");
  switch (p[0]) {
    case "AUTHORITY": authority.value = p[1]; break;
    case "CREDIT": credit.value = p[1]; break;
    case "PRODUCT": product = { repository:p[1], branch:p[2], commit:p[3], tree:p[4] }; break;
    case "SOURCE": sources[p[1]] = { version:p[2], file_id:p[3], revision_id:p[4], sha256_text_export:p[5] }; break;
    case "ALIAS": aliases.push(p[1]); break;
    case "OBL": obligation_to_scenarios[p[1]] = splitList(p[2]); break;
    case "VP": vp_to_carrier[p[1]] = { scenarios:splitList(p[2]), hrts:splitList(p[3]), variants:splitList(p[4]) }; break;
    case "HRT": hrt_to_scenarios[p[1]] = splitList(p[2]); break;
    case "VAR": variant_to_scenario[p[1]] = p[2]; break;
    case "EXACT": obligation_to_exact_variant[p[1]] = splitList(p[2]); break;
    default: throw new Error(`UNKNOWN_SPEC_RECORD:${p[0]}`);
  }
}
const unique = (a) => new Set(a).size === a.length;
const assert = (cond, code) => { if (!cond) throw new Error(code); };
assert(authority.value === "MCR-to-CODEX-066", "AUTHORITY_MISMATCH");
assert(credit.value === "READINESS_ONLY_NO_FROZEN_CAMPAIGN_CREDIT", "CREDIT_POLICY_MISMATCH");
assert(product?.repository === "hidayatoemar/AppTS", "PRODUCT_REPO_MISMATCH");
assert(product?.branch === "codex/mcr062-cf06-pretrial-successor", "PRODUCT_BRANCH_MISMATCH");
assert(product?.commit === "685e900545c686f1c2e802ff1e712394d1d324f6", "PRODUCT_COMMIT_MISMATCH");
assert(product?.tree === "440b4a5b2a402d929b0a398d51733e9bc1ede292", "PRODUCT_TREE_MISMATCH");
assert(Object.keys(sources).length === 4, "SOURCE_SET_NOT_4");
assert(aliases.length === 15 && unique(aliases), "ALIAS_SET_NOT_15_UNIQUE");
assert(Object.keys(obligation_to_scenarios).length === 344, "OBLIGATION_MAP_NOT_344");
assert(Object.keys(vp_to_carrier).length === 527, "VP_MAP_NOT_527");
assert(Object.keys(hrt_to_scenarios).length === 42, "HRT_MAP_NOT_42");
assert(Object.keys(variant_to_scenario).length === 217, "VARIANT_MAP_NOT_217");
assert(Object.keys(obligation_to_exact_variant).length === 68, "EXACT_F01_BINDING_NOT_68");
for (const [id, list] of Object.entries(obligation_to_scenarios)) assert(/^MVM-OBL-/.test(id) && list.length > 0 && unique(list), `BAD_OBLIGATION_ROW:${id}`);
for (const [id, row] of Object.entries(vp_to_carrier)) assert(/^VP-\d{3}$/.test(id) && row.scenarios.length > 0 && unique(row.scenarios) && unique(row.hrts) && unique(row.variants), `BAD_VP_ROW:${id}`);
for (const [id, list] of Object.entries(hrt_to_scenarios)) assert(/^HRT-\d{3}$/.test(id) && list.length > 0 && unique(list), `BAD_HRT_ROW:${id}`);
for (const [id, cs] of Object.entries(variant_to_scenario)) assert(/^V(?:08|09|10)-/.test(id) && /^CS-\d{3}$/.test(cs), `BAD_VARIANT_ROW:${id}`);
for (const [id, vars] of Object.entries(obligation_to_exact_variant)) assert(obligation_to_scenarios[id] && vars.length === 1 && variant_to_scenario[vars[0]], `BAD_EXACT_BINDING:${id}`);
const usedScenarios = new Set();
for (const v of Object.values(obligation_to_scenarios)) v.forEach(x=>usedScenarios.add(x));
for (const v of Object.values(vp_to_carrier)) v.scenarios.forEach(x=>usedScenarios.add(x));
for (const v of Object.values(hrt_to_scenarios)) v.forEach(x=>usedScenarios.add(x));
Object.values(variant_to_scenario).forEach(x=>usedScenarios.add(x));
const expectedScenarios = Array.from({length:35}, (_,i)=>`CS-${String(i+1).padStart(3,"0")}`);
assert(expectedScenarios.every(x=>usedScenarios.has(x)) && usedScenarios.size === 35, "SCENARIO_POPULATION_NOT_EXACT_35");
const requiredCs001Variants = ["V08-VP-034","V08-VP-070","V08-VP-142","V08-VP-479"];
for (const id of requiredCs001Variants) assert(variant_to_scenario[id] === "CS-001", `CS001_VARIANT_BINDING_MISMATCH:${id}`);

const semantic = {
  authority: authority.value,
  credit: credit.value,
  product,
  sources,
  aliases: [...aliases].sort(),
  obligation_to_scenarios,
  vp_to_carrier,
  hrt_to_scenarios,
  variant_to_scenario,
  obligation_to_exact_variant
};
const canonicalize = (value) => Array.isArray(value)
  ? value.map(canonicalize)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonicalize(value[k])]))
    : value;
const semanticText = JSON.stringify(canonicalize(semantic));
const semanticSha = crypto.createHash("sha256").update(semanticText).digest("hex");
if (semanticSha !== "315296b07671988961cb8b8369dcab2c952ea2d93380941ff11c45f6bb128d14") {
  throw new Error(`CATALOG_SEMANTIC_SHA_MISMATCH:${semanticSha}`);
}
const result = {
  disposition:"PASS",
  scope:"MCR066_CARRIER_CATALOG_READINESS_ONLY",
  no_frozen_campaign_credit:true,
  catalog_spec_sha256:fileSha,
  catalog_semantic_sha256:semanticSha,
  population:{ obligations:344, normalized_aliases:15, value_pairs:527, high_risk_tuples:42, scenarios:35, mandatory_variants:217, exact_f01_bindings:68 }
};
fs.mkdirSync(new URL("../evidence/", import.meta.url), {recursive:true});
fs.writeFileSync(new URL("../evidence/catalog-readiness.json", import.meta.url), JSON.stringify(result,null,2)+"\n");
console.log(JSON.stringify(result));
