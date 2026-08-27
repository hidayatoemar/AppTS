import fs from "node:fs";
import crypto from "node:crypto";
import zlib from "node:zlib";

const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");
const canonicalize = (value) => Array.isArray(value)
  ? value.map(canonicalize)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.keys(value).sort().map((k) => [k, canonicalize(value[k])]))
    : value;
const hash = (value) => sha256(JSON.stringify(canonicalize(value)));
const splitList = (s) => s ? s.split(",") : [];
const unique = (a) => new Set(a).size === a.length;
const assert = (c, e) => { if (!c) throw new Error(e); };

const baseText = fs.readFileSync(new URL("../manifest/frozen-mvm.catalog.spec", import.meta.url), "utf8");
const overrideText = fs.readFileSync(new URL("../manifest/frozen-mvm.catalog.override.spec", import.meta.url), "utf8");
assert(sha256(baseText) === "662d688ae96c8a161b5ddff607d03ea9ac201ae3636af6be475112485acdb1b7", "CATALOG_SPEC_SHA_MISMATCH");
assert(sha256(overrideText) === "1e23b5f1cc89d5aa400a58d31af21e4ad7d5cfb94645ef0abf68636ea22cb904", "CATALOG_OVERRIDE_SHA_MISMATCH");

const rows = baseText.trimEnd().split("\n");
assert(rows.shift() === "APPTS_MCR066_FROZEN_MVM_CATALOG_SPEC_V1", "CATALOG_SPEC_HEADER_MISMATCH");
const authority = { value: undefined }, credit = { value: undefined };
let product;
const sources = {}, aliases = [], obligation_to_scenarios = {}, vp_to_carrier = {}, hrt_to_scenarios = {}, variant_to_scenario = {}, obligation_to_exact_variant = {};
for (const line of rows) {
  const p = line.split("|");
  switch (p[0]) {
    case "AUTHORITY": authority.value = p[1]; break;
    case "CREDIT": credit.value = p[1]; break;
    case "PRODUCT": product = { repository: p[1], branch: p[2], commit: p[3], tree: p[4] }; break;
    case "SOURCE": sources[p[1]] = { version: p[2], file_id: p[3], revision_id: p[4], sha256_text_export: p[5] }; break;
    case "ALIAS": aliases.push(p[1]); break;
    case "OBL": obligation_to_scenarios[p[1]] = splitList(p[2]); break;
    case "VP": vp_to_carrier[p[1]] = { scenarios: splitList(p[2]), hrts: splitList(p[3]), variants: splitList(p[4]) }; break;
    case "HRT": hrt_to_scenarios[p[1]] = splitList(p[2]); break;
    case "VAR": variant_to_scenario[p[1]] = p[2]; break;
    case "EXACT": obligation_to_exact_variant[p[1]] = splitList(p[2]); break;
    default: throw new Error(`UNKNOWN_SPEC_RECORD:${p[0]}`);
  }
}
const overrideRows = overrideText.trimEnd().split("\n");
assert(overrideRows.shift() === "APPTS_MCR066_CATALOG_OVERRIDE_V1", "CATALOG_OVERRIDE_HEADER_MISMATCH");
for (const line of overrideRows) {
  const p = line.split("|");
  assert(p[0] === "OBL_OVERRIDE", `UNKNOWN_OVERRIDE_RECORD:${p[0]}`);
  assert(p[1] === "MVM-OBL-D07-NFR-002", `UNAUTHORIZED_OVERRIDE_KEY:${p[1]}`);
  obligation_to_scenarios[p[1]] = splitList(p[2]);
}

// Independently recover only the checksum-bound snapshot variant map and require exact equality.
const encoded = fs.readFileSync(new URL("../manifest/frozen-mvm.catalog.json.gz.b64", import.meta.url), "utf8").trim();
const compressed = Buffer.from(encoded, "base64");
let raw;
try { raw = zlib.gunzipSync(compressed).toString("utf8"); }
catch (error) {
  if (!(error && error.code === "Z_DATA_ERROR") || compressed.length <= 18 || compressed[0] !== 0x1f || compressed[1] !== 0x8b) throw error;
  raw = zlib.inflateRawSync(compressed.subarray(10, -8)).toString("utf8");
}
const marker = '"variant_to_scenario":';
const markerPos = raw.indexOf(marker);
assert(markerPos >= 0, "SNAPSHOT_VARIANT_MARKER_MISSING");
const start = raw.indexOf("{", markerPos + marker.length);
let depth = 0, inString = false, escaped = false, end = -1;
for (let i = start; i < raw.length; i++) {
  const ch = raw[i];
  if (inString) { if (escaped) escaped = false; else if (ch === "\\") escaped = true; else if (ch === '"') inString = false; continue; }
  if (ch === '"') { inString = true; continue; }
  if (ch === "{") depth++;
  else if (ch === "}" && --depth === 0) { end = i + 1; break; }
}
assert(start >= 0 && end > start, "SNAPSHOT_VARIANT_OBJECT_INVALID");
const snapshotVariantMap = JSON.parse(raw.slice(start, end));
assert(Object.keys(snapshotVariantMap).length === 217, "SNAPSHOT_VARIANT_COUNT_NOT_217");
assert(hash(snapshotVariantMap) === hash(variant_to_scenario), "SNAPSHOT_SPEC_VARIANT_MAP_MISMATCH");

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

const sectionValues = {
  product,
  sources,
  aliases: [...aliases].sort(),
  obligation_to_scenarios,
  vp_to_carrier,
  hrt_to_scenarios,
  variant_to_scenario,
  obligation_to_exact_variant
};
const sectionHashes = Object.fromEntries(Object.entries(sectionValues).map(([k, v]) => [k, hash(v)]));
const semantic = { authority: authority.value, credit: credit.value, ...sectionValues };
const semanticSha = hash(semantic);
console.log(JSON.stringify({
  scope: "MCR066_CATALOG_DIGEST_REDERIVATION",
  snapshot_variant_hash: hash(snapshotVariantMap),
  section_hashes: sectionHashes,
  semantic_sha256: semanticSha,
  catalog_spec_sha256: sha256(baseText),
  catalog_override_sha256: sha256(overrideText)
}));
throw new Error("DIGEST_REDERIVATION_COMPLETE");
