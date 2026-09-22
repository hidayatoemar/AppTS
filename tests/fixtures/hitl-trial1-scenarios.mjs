const scopeRef = () => ({
  situationId: "SIT-HITL1-001",
  subjectType: "SERVICE",
  subjectId: "SVC-HITL1-001",
});

const condition = (ref) => ({ conditionRef: ref, satisfied: true, evidenceRefs: ["EV-HITL1-GOV"] });
const integrity = () => ({ sufficient: true, conflict: false, evidenceRefs: ["EV-HITL1-INTEGRITY"] });
const provenance = () => ({ sourceRefs: ["EV-HITL1-GOV"], chainRefs: [] });

const candidate = ({ contextRef, roleRef, assignmentRef, authorityBasisRef }) => ({
  contextRef,
  personRef: "PERSON-HITL1-001",
  roleRef,
  assignmentRef,
  availabilityRef: "AVAIL-HITL1-001",
  responsibilityRef: "RESP-HITL1-001",
  authorityBasisRef,
  scopeRef: scopeRef(),
  validity: condition("COND-HITL1-VALID"),
  applicability: condition("COND-HITL1-APPLICABLE"),
  currentness: { status: "CURRENT", basisRef: "EV-HITL1-CURRENT" },
  integrity: integrity(),
  provenance: provenance(),
});

export const makeScopeBaseline = (overrides = {}) => {
  const candidates = [
    candidate({
      contextRef: "CTX-HITL1-RECOVERY",
      roleRef: "ROLE-HITL1-RECOVERY",
      assignmentRef: "ASG-HITL1-RECOVERY",
      authorityBasisRef: "AUTH-RS-A022",
    }),
    candidate({
      contextRef: "CTX-HITL1-SERVICE-VERIFICATION",
      roleRef: "ROLE-HITL1-SERVICE-VERIFICATION",
      assignmentRef: "ASG-HITL1-SERVICE-VERIFICATION",
      authorityBasisRef: "AUTH-HITL1-RS-A012",
    }),
    candidate({
      contextRef: "CTX-HITL1-CUSTOMER-VERIFICATION",
      roleRef: "ROLE-HITL1-CUSTOMER-VERIFICATION",
      assignmentRef: "ASG-HITL1-CUSTOMER-VERIFICATION",
      authorityBasisRef: "AUTH-HITL1-RS-A013",
    }),
    candidate({
      contextRef: "CTX-HITL1-CLOSURE-DECISION",
      roleRef: "ROLE-HITL1-CLOSURE-DECISION",
      assignmentRef: "ASG-HITL1-CLOSURE-DECISION",
      authorityBasisRef: "AUTH-HITL1-RS-A015",
    }),
  ];
  return {
    scopeRef: scopeRef(),
    version: 0,
    truthRefs: ["TRUTH-HITL1-DOWN"],
    evidenceRefs: ["EV-HITL1-GOV"],
    responsibility: {
      responsibilityRef: "RESP-HITL1-001",
      scopeRef: scopeRef(),
      holderPersonRef: "PERSON-HITL1-001",
      roleRef: "ROLE-HITL1-RECOVERY",
      assignmentRef: "ASG-HITL1-RECOVERY",
      dutyRef: "DUTY-HITL1-001",
      availabilityRef: "AVAIL-HITL1-001",
      authorityBasisRef: "AUTH-RS-A022",
      effectiveTime: "2026-09-21T00:00:00.000Z",
      currentness: { status: "CURRENT", basisRef: "EV-HITL1-CURRENT" },
      provenance: provenance(),
    },
    actingContextCandidates: candidates,
    dependencyRefs: [],
    actionExecutions: [],
    materialEffects: [],
    evidenceProvenance: [],
    responsibilityHandoverEffects: [],
    dependencyWaitingUpdates: [],
    residualObligationRefs: [],
    verificationClosureEffects: [],
    otherAuthoritativeP01ToP10Records: [],
    ...overrides,
  };
};

const binding = (actionId, requiredAuthorityRef, contextRef, baseline) => ({
  actingContextRef: contextRef,
  actionId,
  requiredAuthorityRef,
  candidate: baseline.actingContextCandidates.find((item) => item.contextRef === contextRef),
});

export const makeHitlScenario = (overrides = {}) => {
  const baseline = overrides.scopeBaseline ?? makeScopeBaseline();
  const evidence = {
    evidenceId: "EV-HITL1-GOV",
    sourceType: "SYNTHETIC_TRIAL",
    sourceRef: "SRC-HITL1-GOV",
    actorOrSystemRef: "SYSTEM-HITL1-FIXTURE",
    receivedTime: "2026-09-21T00:00:00.000Z",
    currentness: { status: "CURRENT", basisRef: "EV-HITL1-CURRENT" },
    payloadOrRecordRef: "PAYLOAD-HITL1-GOV",
    provenanceChain: [],
  };
  return {
    schemaVersion: "HITL1-RUNTIME-1",
    syntheticTrial: true,
    trialId: "TRIAL-HITL1-001",
    scenarioId: overrides.scenarioId ?? "SCENARIO-HITL1-S01",
    scopeBaseline: baseline,
    personRef: "PERSON-HITL1-001",
    responsibilityRef: "RESP-HITL1-001",
    actingContexts: [
      binding("RS-A-022", "AUTH-RS-A022", "CTX-HITL1-RECOVERY", baseline),
      binding("RS-A-012", "AUTH-HITL1-RS-A012", "CTX-HITL1-SERVICE-VERIFICATION", baseline),
      binding("RS-A-013", "AUTH-HITL1-RS-A013", "CTX-HITL1-CUSTOMER-VERIFICATION", baseline),
      binding("RS-A-015", "AUTH-HITL1-RS-A015", "CTX-HITL1-CLOSURE-DECISION", baseline),
    ],
    initialActiveActingContextRef: "CTX-HITL1-RECOVERY",
    evidenceBasis: overrides.evidenceBasis ?? {
      basisRef: "BASIS-HITL1-GOV",
      evidence: [evidence],
      integrityAssessments: [{
        evidenceId: "EV-HITL1-GOV",
        assessment: { sufficient: true, conflict: false, evidenceRefs: ["EV-HITL1-INTEGRITY"] },
      }],
      policyBasisRefs: ["POLICY-HITL1-CLOSURE"],
    },
    customerVerificationApplicability: overrides.customerVerificationApplicability ?? "REQUIRED",
    customerVerificationApplicabilityPolicyBasisRef:
      overrides.customerVerificationApplicabilityPolicyBasisRef ?? "POLICY-HITL1-CUSTOMER-REQUIRED",
    residualObligations: overrides.residualObligations ?? [],
  };
};

export const HITL_TRIAL1_SCENARIOS = Object.freeze({
  S01_SUCCESS_REQUIRED: makeHitlScenario({ scenarioId: "S01_SUCCESS_REQUIRED" }),
  S02_SERVICE_VERIFICATION_NEGATIVE: makeHitlScenario({
    scenarioId: "S02_SERVICE_VERIFICATION_NEGATIVE",
    customerVerificationApplicability: "NOT_REQUIRED",
    customerVerificationApplicabilityPolicyBasisRef: "POLICY-HITL1-CUSTOMER-NOT-REQUIRED",
  }),
  S03_CUSTOMER_VERIFICATION_NOT_OK: makeHitlScenario({ scenarioId: "S03_CUSTOMER_VERIFICATION_NOT_OK" }),
  S04_CUSTOMER_VERIFICATION_NOT_REQUIRED: makeHitlScenario({
    scenarioId: "S04_CUSTOMER_VERIFICATION_NOT_REQUIRED",
    customerVerificationApplicability: "NOT_REQUIRED",
    customerVerificationApplicabilityPolicyBasisRef: "POLICY-HITL1-CUSTOMER-NOT-REQUIRED",
  }),
  S05_CLOSURE_BLOCKING_RESIDUAL: makeHitlScenario({
    scenarioId: "S05_CLOSURE_BLOCKING_RESIDUAL",
    scopeBaseline: makeScopeBaseline({ residualObligationRefs: ["OBL-HITL1-BLOCK"] }),
    residualObligations: [{
      obligationRef: "OBL-HITL1-BLOCK",
      closureBlocking: true,
      policyBasisRef: "POLICY-HITL1-BLOCK",
    }],
  }),
  S06_UNKNOWN_BASIS: makeHitlScenario({
    scenarioId: "S06_UNKNOWN_BASIS",
    evidenceBasis: {
      basisRef: "BASIS-HITL1-UNKNOWN",
      evidence: [{
        evidenceId: "EV-HITL1-GOV",
        sourceType: "SYNTHETIC_TRIAL",
        sourceRef: "SRC-HITL1-GOV",
        actorOrSystemRef: "SYSTEM-HITL1-FIXTURE",
        receivedTime: "2026-09-21T00:00:00.000Z",
        currentness: { status: "UNKNOWN", basisRef: "EV-HITL1-UNKNOWN" },
        payloadOrRecordRef: "PAYLOAD-HITL1-GOV",
        provenanceChain: [],
      }],
      integrityAssessments: [{
        evidenceId: "EV-HITL1-GOV",
        assessment: { sufficient: true, conflict: false, evidenceRefs: ["EV-HITL1-INTEGRITY"] },
      }],
      policyBasisRefs: ["POLICY-HITL1-CLOSURE"],
    },
  }),
  S07_CONFLICT_BASIS: makeHitlScenario({
    scenarioId: "S07_CONFLICT_BASIS",
    evidenceBasis: {
      basisRef: "BASIS-HITL1-CONFLICT",
      evidence: [{
        evidenceId: "EV-HITL1-GOV",
        sourceType: "SYNTHETIC_TRIAL",
        sourceRef: "SRC-HITL1-GOV",
        actorOrSystemRef: "SYSTEM-HITL1-FIXTURE",
        receivedTime: "2026-09-21T00:00:00.000Z",
        currentness: { status: "CONFLICT", basisRef: "EV-HITL1-CONFLICT" },
        integrityConflictRef: "CONFLICT-HITL1-001",
        payloadOrRecordRef: "PAYLOAD-HITL1-GOV",
        provenanceChain: [],
      }],
      integrityAssessments: [{
        evidenceId: "EV-HITL1-GOV",
        assessment: { sufficient: false, conflict: true, evidenceRefs: ["EV-HITL1-INTEGRITY-CONFLICT"] },
      }],
      policyBasisRefs: ["POLICY-HITL1-CLOSURE"],
    },
  }),
  S08_INVALID_OR_STALE_CONTEXT: makeHitlScenario({ scenarioId: "S08_INVALID_OR_STALE_CONTEXT" }),
  S09_REPLAY: makeHitlScenario({ scenarioId: "S09_REPLAY" }),
  S10_REPLAY_CONFLICT: makeHitlScenario({ scenarioId: "S10_REPLAY_CONFLICT" }),
});
