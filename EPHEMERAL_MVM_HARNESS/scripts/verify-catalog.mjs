import fs from "node:fs";
import zlib from "node:zlib";
import crypto from "node:crypto";

const source = new URL("../manifest/frozen-mvm.catalog.json.gz.b64", import.meta.url);
const encoded = fs.readFileSync(source, "utf8").trim();
const compressed = Buffer.from(encoded, "base64");
const compressedSha = crypto.createHash("sha256").update(compressed).digest("hex");
if (compressedSha !== "621fcb1e4553990a6fc901a2b2c0b46908d0d6d758d65640fcde3dd33c3ae03c") {
  throw new Error(`CATALOG_COMPRESSED_SHA_MISMATCH:${compressedSha}`);
}
const catalogText = zlib.gunzipSync(compressed).toString("utf8");
const catalogSha = crypto.createHash("sha256").update(catalogText).digest("hex");
if (catalogSha !== "c14891f9ee412dc0afaee6b89d222a8fe4cf4fcf83da219ed54199aec136d71b") {
  throw new Error(`CATALOG_CONTENT_SHA_MISMATCH:${catalogSha}`);
}
const catalog = JSON.parse(catalogText);
const unique = (items) => new Set(items).size === items.length;
const assert = (cond, code) => { if (!cond) throw new Error(code); };

assert(catalog.schema === "APPTS_MCR066_FROZEN_MVM_CATALOG_V1", "CATALOG_SCHEMA_MISMATCH");
assert(catalog.credit_policy === "READINESS_ONLY_NO_FROZEN_CAMPAIGN_CREDIT", "CREDIT_POLICY_MISMATCH");
assert(catalog.product.commit === "685e900545c686f1c2e802ff1e712394d1d324f6", "PRODUCT_COMMIT_MISMATCH");
assert(catalog.product.tree === "440b4a5b2a402d929b0a398d51733e9bc1ede292", "PRODUCT_TREE_MISMATCH");

const p = catalog.population;
assert(p.obligations.length === 344 && unique(p.obligations), "OBLIGATION_POPULATION_NOT_344_UNIQUE");
assert(p.normalized_aliases.length === 15 && unique(p.normalized_aliases), "ALIAS_POPULATION_NOT_15_UNIQUE");
assert(p.value_pairs.length === 527 && unique(p.value_pairs), "VP_POPULATION_NOT_527_UNIQUE");
assert(p.high_risk_tuples.length === 42 && unique(p.high_risk_tuples), "HRT_POPULATION_NOT_42_UNIQUE");
assert(p.scenarios.length === 35 && unique(p.scenarios), "CS_POPULATION_NOT_35_UNIQUE");
assert(p.mandatory_variants.length === 217 && unique(p.mandatory_variants), "VARIANT_POPULATION_NOT_217_UNIQUE");

const cw = catalog.crosswalk;
assert(Object.keys(cw.obligation_to_scenarios).length === 344, "OBLIGATION_CROSSWALK_NOT_344");
assert(Object.keys(cw.vp_to_carrier).length === 527, "VP_CROSSWALK_NOT_527");
assert(Object.keys(cw.hrt_to_scenarios).length === 42, "HRT_CROSSWALK_NOT_42");
assert(Object.keys(cw.variant_to_scenario).length === 217, "VARIANT_CROSSWALK_NOT_217");
for (const id of p.obligations) assert(Array.isArray(cw.obligation_to_scenarios[id]) && cw.obligation_to_scenarios[id].length > 0, `OBLIGATION_UNRESOLVED:${id}`);
for (const id of p.value_pairs) {
  const row = cw.vp_to_carrier[id];
  assert(row && (row.scenarios.length || row.hrts.length || row.variants.length), `VP_UNRESOLVED:${id}`);
}
for (const id of p.high_risk_tuples) assert(cw.hrt_to_scenarios[id]?.length > 0, `HRT_UNRESOLVED:${id}`);
for (const id of p.mandatory_variants) assert(/^CS-\d{3}$/.test(cw.variant_to_scenario[id] ?? ""), `VARIANT_UNRESOLVED:${id}`);

const requiredCs001Variants = ["V08-VP-034","V08-VP-070","V08-VP-142","V08-VP-479"];
for (const id of requiredCs001Variants) assert(cw.variant_to_scenario[id] === "CS-001", `CS001_VARIANT_BINDING_MISMATCH:${id}`);

const result = {
  disposition: "PASS",
  scope: "MCR066_CARRIER_CATALOG_READINESS_ONLY",
  no_frozen_campaign_credit: true,
  catalog_sha256: catalogSha,
  compressed_catalog_sha256: compressedSha,
  population: {
    obligations: p.obligations.length,
    normalized_aliases: p.normalized_aliases.length,
    value_pairs: p.value_pairs.length,
    high_risk_tuples: p.high_risk_tuples.length,
    scenarios: p.scenarios.length,
    mandatory_variants: p.mandatory_variants.length
  },
  crosswalk: {
    obligations: Object.keys(cw.obligation_to_scenarios).length,
    value_pairs: Object.keys(cw.vp_to_carrier).length,
    high_risk_tuples: Object.keys(cw.hrt_to_scenarios).length,
    mandatory_variants: Object.keys(cw.variant_to_scenario).length
  }
};
fs.mkdirSync(new URL("../evidence/", import.meta.url), { recursive: true });
fs.writeFileSync(new URL("../evidence/catalog-readiness.json", import.meta.url), JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result));
