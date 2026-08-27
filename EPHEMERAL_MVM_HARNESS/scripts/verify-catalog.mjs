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

const baseText = fs.readFileSync(new URL("../manifest/frozen-mvm.catalog.spec", import.meta.url), "utf8");
const variantToScenario = {};
for (const line of baseText.trimEnd().split("\n")) {
  const p = line.split("|");
  if (p[0] === "VAR") variantToScenario[p[1]] = p[2];
}

const encoded = fs.readFileSync(new URL("../manifest/frozen-mvm.catalog.json.gz.b64", import.meta.url), "utf8").trim();
const compressed = Buffer.from(encoded, "base64");
let raw;
try {
  raw = zlib.gunzipSync(compressed).toString("utf8");
} catch (error) {
  if (!(error && error.code === "Z_DATA_ERROR") || compressed.length <= 18 || compressed[0] !== 0x1f || compressed[1] !== 0x8b) throw error;
  raw = zlib.inflateRawSync(compressed.subarray(10, -8)).toString("utf8");
}

const marker = '"variant_to_scenario":';
const markerPos = raw.indexOf(marker);
if (markerPos < 0) throw new Error("SNAPSHOT_VARIANT_MARKER_MISSING");
const start = raw.indexOf("{", markerPos + marker.length);
if (start < 0) throw new Error("SNAPSHOT_VARIANT_OBJECT_START_MISSING");
let depth = 0;
let inString = false;
let escaped = false;
let end = -1;
for (let i = start; i < raw.length; i++) {
  const ch = raw[i];
  if (inString) {
    if (escaped) escaped = false;
    else if (ch === "\\") escaped = true;
    else if (ch === '"') inString = false;
    continue;
  }
  if (ch === '"') { inString = true; continue; }
  if (ch === "{") depth++;
  else if (ch === "}") {
    depth--;
    if (depth === 0) { end = i + 1; break; }
  }
}
if (end < 0) throw new Error("SNAPSHOT_VARIANT_OBJECT_UNTERMINATED");
const snapshotVariantToScenario = JSON.parse(raw.slice(start, end));

const keys = Array.from(new Set([...Object.keys(snapshotVariantToScenario), ...Object.keys(variantToScenario)])).sort();
const diffs = keys
  .filter((id) => snapshotVariantToScenario[id] !== variantToScenario[id])
  .map((id) => ({ id, snapshot: snapshotVariantToScenario[id] ?? null, clean_spec: variantToScenario[id] ?? null }));
const result = {
  scope: "MCR066_VARIANT_MAP_EXACT_DRIFT_DIAGNOSTIC",
  snapshot_count: Object.keys(snapshotVariantToScenario).length,
  clean_spec_count: Object.keys(variantToScenario).length,
  snapshot_hash: hash(snapshotVariantToScenario),
  clean_spec_hash: hash(variantToScenario),
  frozen_expected_hash: "8cb50bab417dc1d8dc780c7f3886770e9fa20bbaea507258cac4a3d2c6d39fad",
  diff_count: diffs.length,
  diffs
};
console.log(JSON.stringify(result));
throw new Error(`DIAGNOSTIC_COMPLETE_DIFF_COUNT_${diffs.length}`);
