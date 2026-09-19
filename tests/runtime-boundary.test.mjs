import assert from "node:assert/strict";
import test from "node:test";
import { createServer as createNetServer } from "node:net";
import { firstSlicePolicy } from "../dist/src/config/policy-config.js";
import {
  createLocalBoundary,
  parseCommandEnvelope,
} from "../dist/src/staging/local-boundary.js";
import {
  LOOPBACK_ADDRESS,
  REGRESSION_GATES,
  RUNTIME_DATA_ROOT,
  TRIAL_FIXTURE_PATH,
  validateRuntimeConfigObject,
  validateSyntheticTrialFixtureObject,
} from "../dist/src/staging/runtime-config.js";
import {
  STAGING_ACTION_ID,
  STAGING_EFFECT_TYPE_REF,
  STAGING_FUNCTIONAL_BINDING,
  STAGING_REQUIRED_AUTHORITY_REF,
} from "../dist/src/staging/runtime-composition.js";

const validConfig = (overrides = {}) => ({
  profile: "SYNTHETIC_TRIAL_LOCAL_ONLY",
  bindAddress: LOOPBACK_ADDRESS,
  port: 8080,
  dataDir: RUNTIME_DATA_ROOT,
  trialFixturePath: TRIAL_FIXTURE_PATH,
  ...overrides,
});

const command = (overrides = {}) => ({
  commandId: "CMD-STAGING-001",
  actionId: "RS-A-022",
  purposeRef: {
    purpose: "RESTORE_SERVICE",
    situationId: "SIT-STAGING-001",
    compositionInstanceId: "COMP-STAGING-001",
    startedFromBasisRef: "EV-INTAKE-STAGING",
  },
  scopeRef: {
    situationId: "SIT-STAGING-001",
    subjectType: "SERVICE",
    subjectId: "SVC-STAGING-001",
  },
  requestedByActorOrMachineRef: "PERSON-STAGING-001",
  actingContextRef: "CTX-STAGING-001",
  expectedInputVersion: 0,
  requestTime: "2026-09-19T00:00:00.000Z",
  evidenceRefs: ["EV-DIAGNOSIS-STAGING"],
  ...overrides,
});

const baseline = () => {
  const scopeRef = {
    situationId: "SIT-STAGING-001",
    subjectType: "SERVICE",
    subjectId: "SVC-STAGING-001",
  };
  return {
    scopeRef,
    version: 0,
    truthRefs: ["TRUTH-DOWN-STAGING"],
    evidenceRefs: ["EV-DIAGNOSIS-STAGING"],
    responsibility: {
      responsibilityRef: "RESP-STAGING-001",
      scopeRef,
      holderPersonRef: "PERSON-STAGING-001",
      roleRef: "ROLE-NOC-STAGING",
      assignmentRef: "ASSIGN-STAGING-001",
      dutyRef: "DUTY-STAGING-001",
      availabilityRef: "AVAIL-STAGING-001",
      authorityBasisRef: "AUTH-RS-A022",
      effectiveTime: "2026-09-19T00:00:00.000Z",
      currentness: { status: "CURRENT" },
      provenance: { sourceRefs: ["EV-RESP-STAGING"], chainRefs: [] },
    },
    actingContextCandidates: [{
      contextRef: "CTX-STAGING-001",
      personRef: "PERSON-STAGING-001",
      roleRef: "ROLE-NOC-STAGING",
      assignmentRef: "ASSIGN-STAGING-001",
      dutyRef: "DUTY-STAGING-001",
      availabilityRef: "AVAIL-STAGING-001",
      responsibilityRef: "RESP-STAGING-001",
      authorityBasisRef: "AUTH-RS-A022",
      scopeRef,
      validity: { conditionRef: "COND-VALID-STAGING", satisfied: true, evidenceRefs: ["EV-VALID-STAGING"] },
      applicability: { conditionRef: "COND-APPLICABLE-STAGING", satisfied: true, evidenceRefs: ["EV-APPLICABLE-STAGING"] },
      currentness: { status: "CURRENT" },
      integrity: { sufficient: true, conflict: false, evidenceRefs: ["EV-INTEGRITY-STAGING"] },
      provenance: { sourceRefs: ["EV-CTX-STAGING"], chainRefs: [] },
    }],
    dependencyRefs: [],
    actionExecutions: [],
    materialEffects: [],
    evidenceProvenance: [],
    responsibilityHandoverEffects: [],
    dependencyWaitingUpdates: [],
    residualObligationRefs: [],
    verificationClosureEffects: [],
    otherAuthoritativeP01ToP10Records: [],
  };
};

const fixture = (overrides = {}) => ({
  syntheticTrial: true,
  trialId: "TRIAL-LOCAL-001",
  scopeBaselines: [baseline()],
  outcomeInstances: [{
    commandId: "CMD-STAGING-001",
    executorRef: "EXECUTOR-STAGING",
    responseRef: "RESP-EXEC-STAGING",
    executionEvidenceRefs: ["EV-EXEC-STAGING"],
    beforeTruthRefs: ["TRUTH-DOWN-STAGING"],
    afterTruthRefs: ["TRUTH-UP-STAGING"],
    effectEvidenceRefs: ["EV-RECOVERY-STAGING"],
  }],
  ...overrides,
});

async function freePort() {
  const server = createNetServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("FREE_PORT_FAILED");
  const port = address.port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

test("RB-01 rejects non-loopback runtime binding", () => {
  assert.throws(
    () => validateRuntimeConfigObject(validConfig({ bindAddress: "0.0.0.0" })),
    /NON_LOOPBACK_BIND_REJECTED/,
  );
});

test("RB-02 missing deployment config or semantic fixture override fails closed", () => {
  const missing = validConfig();
  delete missing.trialFixturePath;
  assert.throws(() => validateRuntimeConfigObject(missing), /MISSING_REQUIRED_FIELD/);
  assert.throws(
    () => validateSyntheticTrialFixtureObject({ ...fixture(), policyConfig: firstSlicePolicy }),
    /FORBIDDEN_OR_UNKNOWN_FIELD:policyConfig/,
  );
  assert.throws(
    () => validateRuntimeConfigObject(validConfig({ dataDir: `${RUNTIME_DATA_ROOT}/../../outside` })),
    /INVALID_RUNTIME_DATA_DIR/,
  );
});

test("RB-03 health and readiness expose infrastructure observations only", async () => {
  const port = await freePort();
  const boundary = createLocalBoundary({
    port,
    execute: async () => ({ kind: "REJECTED", reasons: ["not-used"] }),
  });
  await boundary.listen();
  try {
    const health = await fetch(`http://127.0.0.1:${port}/healthz`);
    assert.equal(health.status, 200);
    const healthText = await health.text();
    assert.doesNotMatch(healthText, /restor|verification|closure|responsibility|purpose/i);

    const before = await fetch(`http://127.0.0.1:${port}/readyz`);
    assert.equal(before.status, 503);
    boundary.setReady(true);
    const after = await fetch(`http://127.0.0.1:${port}/readyz`);
    assert.equal(after.status, 200);
    const readyText = await after.text();
    assert.doesNotMatch(readyText, /restor|verification|closure|responsibility|purpose/i);
  } finally {
    await boundary.close();
  }
});

test("RB-04 transport maps exact existing command without semantic defaults", () => {
  const input = command();
  const parsed = parseCommandEnvelope(input);
  assert.deepEqual(parsed, input);
  assert.equal(Object.keys(parsed).length, Object.keys(input).length);
});

test("RB-05 identity input cannot create authority or Acting Context", () => {
  const parsed = parseCommandEnvelope(command());
  assert.equal(parsed.requestedByActorOrMachineRef, "PERSON-STAGING-001");
  assert.equal(parsed.actingContextRef, "CTX-STAGING-001");
  assert.equal("roleRef" in parsed, false);
  assert.equal("authorityBasisRef" in parsed, false);
  assert.equal("boundedMachineAuthorityRef" in parsed, false);
});

test("RB-12 transport logging excludes raw request and fixture/secret material", async () => {
  const port = await freePort();
  const entries = [];
  const boundary = createLocalBoundary({
    port,
    execute: async () => ({ kind: "REJECTED", reasons: ["not-used"] }),
    logger: { log: (event, fields = {}) => entries.push(JSON.stringify({ event, ...fields })) },
  });
  await boundary.listen();
  try {
    const marker = "PRIVATE-MARKER-MUST-NOT-LOG";
    const response = await fetch(`http://127.0.0.1:${port}/commands`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...command(), forbiddenTransportField: marker }),
    });
    assert.equal(response.status, 400);
    assert.equal(entries.join("\n").includes(marker), false);
    assert.equal(entries.join("\n").includes("EV-DIAGNOSIS-STAGING"), false);

    const invalidMediaType = await fetch(`http://127.0.0.1:${port}/commands`, {
      method: "POST",
      headers: { "content-type": "application/jsonx" },
      body: JSON.stringify(command()),
    });
    assert.equal(invalidMediaType.status, 400);

    const charsetJson = await fetch(`http://127.0.0.1:${port}/commands`, {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify(command()),
    });
    assert.equal(charsetJson.status, 200);

    const oversizedUtf8 = await fetch(`http://127.0.0.1:${port}/commands`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...command(), payloadRef: "é".repeat(33000) }),
    });
    assert.equal(oversizedUtf8.status, 413);
  } finally {
    await boundary.close();
  }
});

test("RB-13 application listener is loopback-only", async () => {
  const port = await freePort();
  const boundary = createLocalBoundary({
    port,
    execute: async () => ({ kind: "REJECTED", reasons: ["not-used"] }),
  });
  await boundary.listen();
  try {
    const address = boundary.address();
    assert.ok(address && typeof address !== "string");
    assert.equal(address.address, "127.0.0.1");
    assert.equal(address.port, port);
  } finally {
    await boundary.close();
  }
});

test("RB-15 staging admission anchors remain source-backed and semantically narrow", () => {
  assert.equal(STAGING_ACTION_ID, "RS-A-022");
  assert.equal(STAGING_FUNCTIONAL_BINDING, "FB-SRV-15");
  assert.equal(STAGING_REQUIRED_AUTHORITY_REF, "AUTH-RS-A022");
  assert.equal(STAGING_EFFECT_TYPE_REF, "EFFECT-SERVICE-RECOVERED");
  assert.deepEqual(firstSlicePolicy.rsA022BindingsBySubjectType.SERVICE, ["FB-SRV-15"]);
  assert.equal(REGRESSION_GATES.productSemantic.sha, "01097454cc73b9917b284c876af4c603856ebe6e");
});
