import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { ACCEPTANCE_CODES, COMMON_ENVELOPE_IDENTITY, COMMON_RESULT_IDENTITY, INT_RUN_TD_TRACE, blindRetryIsProhibited, classifyReplay, validateEnvelope, validateProcessingResult } from "../../packages/contracts/src/index.ts";

const time = "2026-01-02T03:04:05.006Z";
const result = (acceptance_code: "ACK" | "NACK" | "HOLD", reconciliation_required: boolean, effect_disposition_code?: "EFFECT_APPLIED" | "NO_EFFECT") => ({ result_id: "r-1", message_id: "m-1", correlation_id: "c-1", acceptance_code, ...(effect_disposition_code === undefined ? {} : { effect_disposition_code }), reconciliation_required, durable_result_ref: "dr-1", result_at: time });

test("CF05-CT-001 common identities and exact envelope profile fail closed", () => {
  assert.equal(COMMON_ENVELOPE_IDENTITY, "CF02-ENV-1.0.0");
  assert.equal(COMMON_RESULT_IDENTITY, "CF02-RESULT-1.0.0");
  const issues = validateEnvelope({ interface_identity: "WRONG", semantic_version: "1.0.0", profile_identity: "P", message_id: "m", idempotency_key: "i", correlation_id: "c", producer_ref: "p", subject_ref: "s", produced_at: time, payload_hash: "h", payload: {} }, { interfaceIdentity: "I", semanticVersion: "1.0.0", profileIdentity: "P" });
  assert.ok(issues.some((entry) => entry.code === "IDENTITY_MISMATCH"));
});

test("CF05-CT-002 required common fields and controlled result values are rejected when malformed", () => {
  assert.equal(validateProcessingResult({ ...result("ACK", false), message_id: "" }).ok, false);
  assert.equal(validateProcessingResult({ ...result("ACK", false), acceptance_code: "SUCCESS" }).ok, false);
});

test("CF05-CT-003 identical replay reuses the prior identity", () => {
  const identity = { message_id: "m", idempotency_key: "i", payload_hash: "h" };
  assert.equal(classifyReplay(identity, identity), "IDENTICAL_REPLAY");
});

test("CF05-CT-004 conflicting replay is distinguished from an identical replay", () => {
  assert.equal(classifyReplay({ message_id: "m", idempotency_key: "i", payload_hash: "h1" }, { message_id: "m", idempotency_key: "i", payload_hash: "h2" }), "CONFLICTING_REPLAY");
});

test("CF05-CT-005 uncertain acceptance prohibits blind retry", () => {
  const uncertain = result("HOLD", true);
  assert.equal(validateProcessingResult(uncertain).ok, true);
  assert.equal(blindRetryIsProhibited(uncertain), true);
  assert.equal(validateProcessingResult(result("HOLD", false)).ok, false);
});

test("CF05-CT-007 ACK NACK HOLD remain separate and NACK cannot apply an effect", () => {
  assert.deepEqual(ACCEPTANCE_CODES, ["ACK", "NACK", "HOLD"]);
  assert.equal(validateProcessingResult(result("ACK", false)).ok, true);
  assert.equal(validateProcessingResult(result("NACK", false, "NO_EFFECT")).ok, true);
  assert.equal(validateProcessingResult(result("NACK", false, "EFFECT_APPLIED")).ok, false);
  assert.equal(validateProcessingResult(result("HOLD", true)).ok, true);
});

function filesUnder(path: string): string[] {
  if (!statSync(path).isDirectory()) return [path];
  return readdirSync(path).flatMap((name) => filesUnder(join(path, name)));
}

test("CF05-NI-001 and CF05-NI-008 six INT-RUN-TD identities have one canonical representation and bidirectional trace", () => {
  assert.equal(INT_RUN_TD_TRACE.length, 6);
  assert.equal(new Set(INT_RUN_TD_TRACE.map((entry) => entry.identity)).size, 6);
  assert.equal(new Set(INT_RUN_TD_TRACE.map((entry) => entry.representation)).size, 6);
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const sourceFiles = filesUnder(join(root, "packages", "contracts", "src", "runtime")).filter((path) => path.endsWith(".ts"));
  for (const entry of INT_RUN_TD_TRACE) {
    const definingFiles = sourceFiles.filter((path) => readFileSync(path, "utf8").includes(`\"${entry.identity}\"`));
    assert.equal(definingFiles.length, 1, `${entry.identity} must have exactly one defining source file`);
    assert.ok(entry.source.startsWith("CF-02 Section 8."));
  }
});
test("CF05-NI no private competing INT-RUN-TD representation exists outside packages/contracts", () => {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const candidateRoots = [join(root, "apps"), join(root, "packages")];
  const files = candidateRoots.flatMap((path) => filesUnder(path)).filter((path) => path.endsWith(".ts") && !path.includes(`${join("packages", "contracts")}`));
  for (const path of files) {
    const content = readFileSync(path, "utf8");
    for (const entry of INT_RUN_TD_TRACE) assert.equal(content.includes(entry.identity), false, `${entry.identity} privately redefined in ${path}`);
  }
});
