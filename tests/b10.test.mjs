import assert from "node:assert/strict";
import test from "node:test";
import { observeAuthenticatedIdentity } from "../dist/src/adapters/identity-input-port.js";
import { observeFieldSync } from "../dist/src/adapters/field-sync-port.js";
import { createInProcessCommandPort } from "../dist/src/adapters/command-port.js";

test("B10 authentication observation does not create authority or Acting Context", () => {
  const result = observeAuthenticatedIdentity({
    authenticatedPersonRef: "P1",
    authenticationEvidenceRefs: ["AUTH-EV"],
    receivedTime: "2026-09-18T00:00:00Z",
  });
  assert.equal(result.authorityCreated, false);
  assert.equal(result.actingContextCreated, false);
  assert.equal("roleRef" in result, false);
  assert.equal("authorityBasisRef" in result, false);
});

test("B10 field sync observation does not infer restoration verification or Purpose responsibility transfer", () => {
  const result = observeFieldSync({
    record: {
      fieldWorkRef: "FW1",
      scopeRef: { situationId: "S1", subjectType: "SERVICE", subjectId: "SV1" },
      progress: "COMPLETED",
      evidenceRefs: ["EV-FW"],
      currentness: { status: "CURRENT" },
      provenance: { sourceRefs: ["EV-FW"], chainRefs: [] },
    },
    syncEvidenceRefs: ["EV-SYNC"],
    receivedTime: "2026-09-18T00:00:00Z",
  });
  assert.equal(result.purposeResponsibilityTransferred, false);
  assert.equal(result.restorationEstablished, false);
  assert.equal(result.serviceVerificationEstablished, false);
});

test("B10 in-process command port passes typed command unchanged to governed handler", async () => {
  let seen;
  const port = createInProcessCommandPort(async (envelope) => {
    seen = envelope;
    return { kind: "HANDLED" };
  });
  const envelope = {
    commandId: "C1",
    actionId: "RS-A-022",
    purposeRef: {
      purpose: "RESTORE_SERVICE",
      situationId: "S1",
      compositionInstanceId: "COMP1",
      startedFromBasisRef: "EV1",
    },
    scopeRef: { situationId: "S1", subjectType: "SERVICE", subjectId: "SV1" },
    requestedByActorOrMachineRef: "P1",
    expectedInputVersion: 0,
    requestTime: "2026-09-18T00:00:00Z",
    evidenceRefs: [],
  };
  const result = await port.execute(envelope);
  assert.equal(seen, envelope);
  assert.deepEqual(result, { kind: "HANDLED" });
});
