import assert from "node:assert/strict";
import test from "node:test";
import { validateDiagnosticEvent, validateSafeErrorEnvelope, type DiagnosticMappingEntry, type DiagnosticRegistryVersion } from "../../packages/contracts/src/index.ts";
import { createDiagnosticEvent, createSafeErrorEnvelope, resolveDiagnosticMapping } from "../../packages/diagnostics/src/index.ts";

const version: DiagnosticRegistryVersion = { registry_version_id: "rv", registry_identity: "diagnostics", registry_version: "1", configuration_snapshot_id: "cfg", effective_from: "2026-08-11T00:00:00Z", currentness_ref: "current", status_ref: "ACTIVE" };
const unexpected: DiagnosticMappingEntry = { mapping_entry_id: "m-unexpected", registry_version_id: "rv", implementation_failure_identity: "UNEXPECTED", canonical_error_code: "CONTROLLED_UNEXPECTED", error_category_ref: "TECHNICAL", severity_ref: "ERROR", effect_classification_rule_ref: "FROM_COMMIT_EVIDENCE", retryability_rule_ref: "NO_RETRY_UNTIL_CLASSIFIED", reconciliation_rule_ref: "RECONCILE_IF_UNCERTAIN", safe_user_message_key: "safe.unexpected", diagnostic_owner_or_queue_ref: "techlead", required_evidence_set_ref: "evidence", required_test_vector_ref: "dg04" };

test("DG04 trapped failure creates a valid event with distinct diagnostic certainty", () => {
  const mapping = resolveDiagnosticMapping({ version, entries: [unexpected], unexpectedMappingIdentity: "UNEXPECTED" }, "unmapped.exception");
  const event = createDiagnosticEvent({ errorEventId: "err-1", occurredAt: "2026-08-11T01:00:00Z", committedAt: "2026-08-11T01:00:01Z", correlationId: "corr", environmentRef: "env", applicationRef: "app", componentRef: "runtime", buildVersionRef: "build", sourceRevisionRef: "commit", configurationVersionRef: "cfg-v", operationIdentity: "effect", transactionCommitStatusRef: "UNKNOWN", effectStatus: "EFFECT_UNCERTAIN_RECONCILIATION_REQUIRED", reconciliationCaseId: "recon", rootCauseStatus: "UNDETERMINED", secureBundleRef: "bundle", disclosureLabelRef: "restricted" }, mapping);
  assert.deepEqual(validateDiagnosticEvent(event), { ok: true });
  assert.equal(event.diagnostic_effect_status, "EFFECT_UNCERTAIN_RECONCILIATION_REQUIRED");
  assert.equal(event.canonical_error_code, "CONTROLLED_UNEXPECTED");
});

test("safe envelope contains no secure diagnostic detail", () => {
  const event = createDiagnosticEvent({ errorEventId: "err-2", occurredAt: "2026-08-11T01:00:00Z", committedAt: "2026-08-11T01:00:01Z", correlationId: "corr", environmentRef: "env", applicationRef: "app", componentRef: "runtime", buildVersionRef: "build", sourceRevisionRef: "commit", configurationVersionRef: "cfg-v", operationIdentity: "effect", effectStatus: "NO_EFFECT", rootCauseStatus: "SUSPECTED", secureBundleRef: "bundle-secret", disclosureLabelRef: "restricted" }, unexpected);
  const safe = createSafeErrorEnvelope(event);
  assert.deepEqual(validateSafeErrorEnvelope(safe), { ok: true });
  assert.equal(JSON.stringify(safe).includes("bundle-secret"), false);
});
