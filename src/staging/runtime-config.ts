import { readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import type {
  ActingContextCandidate,
  Currentness,
  GovernedConditionAssessment,
  IntegrityAssessment,
  Provenance,
  ResponsibilityContext,
  ScopeRef,
} from "../contracts/ce-di.js";
import type { ScopeSnapshot } from "../runtime/runtime-composition.js";

export const RUNTIME_PROFILE = "SYNTHETIC_TRIAL_LOCAL_ONLY" as const;
export const LOOPBACK_ADDRESS = "127.0.0.1" as const;
export const DEFAULT_LOCAL_PORT = 8080 as const;
export const RUNTIME_DATA_ROOT = "/var/lib/appts-restore-service/runtime" as const;
export const RUNTIME_CONFIG_PATH = "/etc/appts-restore-service/runtime.json" as const;
export const TRIAL_FIXTURE_PATH = "/etc/appts-restore-service/synthetic-trial-fixture.json" as const;

export const REGRESSION_GATES = Object.freeze({
  productSemantic: {
    sha: "01097454cc73b9917b284c876af4c603856ebe6e",
    tests: 90,
  },
  admittedMain: {
    sha: "fc05398bb1e003a104cb644d6d4879f64b613be9",
    tests: 92,
  },
  candidate: {
    tests: 107,
  },
});

export interface LocalRuntimeConfig {
  profile: typeof RUNTIME_PROFILE;
  bindAddress: typeof LOOPBACK_ADDRESS;
  port: number;
  dataDir: string;
  trialFixturePath: typeof TRIAL_FIXTURE_PATH;
}

export interface SyntheticOutcomeInstance {
  commandId: string;
  executorRef: string;
  responseRef?: string;
  executionEvidenceRefs: string[];
  beforeTruthRefs: string[];
  afterTruthRefs: string[];
  effectEvidenceRefs: string[];
}

export interface SyntheticTrialFixture {
  syntheticTrial: true;
  trialId: string;
  scopeBaselines: ScopeSnapshot[];
  outcomeInstances: SyntheticOutcomeInstance[];
}

export interface LoadedLocalRuntimeConfig {
  config: LocalRuntimeConfig;
  fixture: SyntheticTrialFixture;
}

export async function loadLocalRuntimeConfig(configPath: string): Promise<LoadedLocalRuntimeConfig> {
  if (configPath !== RUNTIME_CONFIG_PATH) throw new Error("INVALID_RUNTIME_CONFIG_PATH");
  const configRaw = JSON.parse(await readFile(configPath, "utf8")) as unknown;
  const config = validateRuntimeConfigObject(configRaw);
  const fixtureRaw = JSON.parse(await readFile(config.trialFixturePath, "utf8")) as unknown;
  const fixture = validateSyntheticTrialFixtureObject(fixtureRaw);
  return { config, fixture };
}

export function validateRuntimeConfigObject(value: unknown): LocalRuntimeConfig {
  const record = asRecord(value, "INVALID_RUNTIME_CONFIG");
  assertExactKeys(record, ["profile", "bindAddress", "port", "dataDir", "trialFixturePath"]);

  if (record.profile !== RUNTIME_PROFILE) throw new Error("INVALID_RUNTIME_PROFILE");
  if (record.bindAddress !== LOOPBACK_ADDRESS) throw new Error("NON_LOOPBACK_BIND_REJECTED");
  if (!Number.isInteger(record.port) || typeof record.port !== "number" || record.port < 1024 || record.port > 65535) {
    throw new Error("INVALID_RUNTIME_PORT");
  }
  if (typeof record.dataDir !== "string" || !isWithinRuntimeRoot(record.dataDir)) {
    throw new Error("INVALID_RUNTIME_DATA_DIR");
  }
  if (record.trialFixturePath !== TRIAL_FIXTURE_PATH) throw new Error("INVALID_TRIAL_FIXTURE_PATH");

  return {
    profile: RUNTIME_PROFILE,
    bindAddress: LOOPBACK_ADDRESS,
    port: record.port,
    dataDir: record.dataDir,
    trialFixturePath: TRIAL_FIXTURE_PATH,
  };
}

export function validateSyntheticTrialFixtureObject(value: unknown): SyntheticTrialFixture {
  const record = asRecord(value, "INVALID_SYNTHETIC_FIXTURE");
  assertExactKeys(record, ["syntheticTrial", "trialId", "scopeBaselines", "outcomeInstances"]);

  if (record.syntheticTrial !== true) throw new Error("SYNTHETIC_TRIAL_MARKER_REQUIRED");
  assertNonEmptyString(record.trialId, "INVALID_TRIAL_ID");
  if (!Array.isArray(record.scopeBaselines) || record.scopeBaselines.length === 0) {
    throw new Error("SCOPE_BASELINE_REQUIRED");
  }
  if (!Array.isArray(record.outcomeInstances) || record.outcomeInstances.length === 0) {
    throw new Error("OUTCOME_INSTANCE_REQUIRED");
  }

  const scopeBaselines = record.scopeBaselines.map((entry, index) => validateScopeSnapshot(entry, index));
  const scopeKeys = new Set<string>();
  for (const baseline of scopeBaselines) {
    const key = scopeIdentity(baseline.scopeRef);
    if (scopeKeys.has(key)) throw new Error("DUPLICATE_SCOPE_BASELINE");
    scopeKeys.add(key);
  }

  const outcomeInstances = record.outcomeInstances.map((entry, index) => validateOutcomeInstance(entry, index));
  const commandIds = new Set<string>();
  for (const outcome of outcomeInstances) {
    if (commandIds.has(outcome.commandId)) throw new Error("DUPLICATE_OUTCOME_COMMAND_ID");
    commandIds.add(outcome.commandId);
  }

  return {
    syntheticTrial: true,
    trialId: record.trialId,
    scopeBaselines,
    outcomeInstances,
  };
}

function validateScopeSnapshot(value: unknown, index: number): ScopeSnapshot {
  const record = asRecord(value, `INVALID_SCOPE_BASELINE_${index}`);
  assertExactKeys(record, [
    "scopeRef",
    "version",
    "truthRefs",
    "evidenceRefs",
    "responsibility",
    "actingContextCandidates",
    "dependencyRefs",
    "actionExecutions",
    "materialEffects",
    "evidenceProvenance",
    "responsibilityHandoverEffects",
    "dependencyWaitingUpdates",
    "residualObligationRefs",
    "verificationClosureEffects",
    "otherAuthoritativeP01ToP10Records",
  ]);

  const scopeRef = validateScopeRef(record.scopeRef, true);
  if (record.version !== 0) throw new Error("SYNTHETIC_BASELINE_VERSION_MUST_BE_ZERO");

  const truthRefs = stringArray(record.truthRefs, "INVALID_TRUTH_REFS");
  const evidenceRefs = stringArray(record.evidenceRefs, "INVALID_EVIDENCE_REFS");
  const dependencyRefs = stringArray(record.dependencyRefs, "INVALID_DEPENDENCY_REFS");
  const responsibility = validateResponsibility(record.responsibility, scopeRef);

  if (!Array.isArray(record.actingContextCandidates) || record.actingContextCandidates.length === 0) {
    throw new Error("ACTING_CONTEXT_CANDIDATE_REQUIRED");
  }
  const actingContextCandidates = record.actingContextCandidates.map((candidate) =>
    validateActingContextCandidate(candidate, scopeRef),
  );

  assertEmptyArray(record.actionExecutions, "SYNTHETIC_BASELINE_ACTION_HISTORY_FORBIDDEN");
  assertEmptyArray(record.materialEffects, "SYNTHETIC_BASELINE_EFFECT_HISTORY_FORBIDDEN");
  assertEmptyArray(record.evidenceProvenance, "SYNTHETIC_BASELINE_PROVENANCE_HISTORY_FORBIDDEN");
  assertEmptyArray(record.responsibilityHandoverEffects, "SYNTHETIC_BASELINE_HANDOVER_HISTORY_FORBIDDEN");
  assertEmptyArray(record.dependencyWaitingUpdates, "SYNTHETIC_BASELINE_WAITING_HISTORY_FORBIDDEN");
  assertEmptyArray(record.residualObligationRefs, "SYNTHETIC_BASELINE_RESIDUAL_HISTORY_FORBIDDEN");
  assertEmptyArray(record.verificationClosureEffects, "SYNTHETIC_BASELINE_VERIFICATION_HISTORY_FORBIDDEN");
  assertEmptyArray(record.otherAuthoritativeP01ToP10Records, "SYNTHETIC_BASELINE_OTHER_HISTORY_FORBIDDEN");

  return {
    scopeRef,
    version: 0,
    truthRefs,
    evidenceRefs,
    responsibility,
    actingContextCandidates,
    dependencyRefs,
    actionExecutions: [],
    materialEffects: [],
    evidenceProvenance: [],
    responsibilityHandoverEffects: [],
    dependencyWaitingUpdates: [],
    residualObligationRefs: [],
    verificationClosureEffects: [],
    otherAuthoritativeP01ToP10Records: [],
  };
}

function validateOutcomeInstance(value: unknown, index: number): SyntheticOutcomeInstance {
  const record = asRecord(value, `INVALID_OUTCOME_INSTANCE_${index}`);
  assertExactKeys(
    record,
    [
      "commandId",
      "executorRef",
      "executionEvidenceRefs",
      "beforeTruthRefs",
      "afterTruthRefs",
      "effectEvidenceRefs",
    ],
    ["responseRef"],
  );
  assertNonEmptyString(record.commandId, "INVALID_OUTCOME_COMMAND_ID");
  assertNonEmptyString(record.executorRef, "INVALID_OUTCOME_EXECUTOR");
  if (record.responseRef !== undefined) assertNonEmptyString(record.responseRef, "INVALID_OUTCOME_RESPONSE_REF");
  return {
    commandId: record.commandId,
    executorRef: record.executorRef,
    ...(record.responseRef === undefined ? {} : { responseRef: record.responseRef }),
    executionEvidenceRefs: stringArray(record.executionEvidenceRefs, "INVALID_EXECUTION_EVIDENCE_REFS"),
    beforeTruthRefs: stringArray(record.beforeTruthRefs, "INVALID_BEFORE_TRUTH_REFS"),
    afterTruthRefs: stringArray(record.afterTruthRefs, "INVALID_AFTER_TRUTH_REFS"),
    effectEvidenceRefs: stringArray(record.effectEvidenceRefs, "INVALID_EFFECT_EVIDENCE_REFS"),
  };
}

function validateResponsibility(value: unknown, scopeRef: ScopeRef): ResponsibilityContext {
  const record = asRecord(value, "INVALID_RESPONSIBILITY");
  assertExactKeys(
    record,
    ["responsibilityRef", "scopeRef", "effectiveTime", "currentness", "provenance"],
    ["holderPersonRef", "roleRef", "assignmentRef", "dutyRef", "availabilityRef", "authorityBasisRef"],
  );

  assertNonEmptyString(record.responsibilityRef, "INVALID_RESPONSIBILITY_REF");
  const nestedScope = validateScopeRef(record.scopeRef, true);
  if (scopeIdentity(nestedScope) !== scopeIdentity(scopeRef)) throw new Error("RESPONSIBILITY_SCOPE_MISMATCH");
  assertNonEmptyString(record.effectiveTime, "INVALID_RESPONSIBILITY_EFFECTIVE_TIME");

  for (const key of ["holderPersonRef", "roleRef", "assignmentRef", "dutyRef", "availabilityRef", "authorityBasisRef"]) {
    if (record[key] !== undefined) assertNonEmptyString(record[key], `INVALID_RESPONSIBILITY_${key}`);
  }

  return {
    responsibilityRef: record.responsibilityRef,
    scopeRef: nestedScope,
    ...(record.holderPersonRef === undefined ? {} : { holderPersonRef: record.holderPersonRef }),
    ...(record.roleRef === undefined ? {} : { roleRef: record.roleRef }),
    ...(record.assignmentRef === undefined ? {} : { assignmentRef: record.assignmentRef }),
    ...(record.dutyRef === undefined ? {} : { dutyRef: record.dutyRef }),
    ...(record.availabilityRef === undefined ? {} : { availabilityRef: record.availabilityRef }),
    ...(record.authorityBasisRef === undefined ? {} : { authorityBasisRef: record.authorityBasisRef }),
    effectiveTime: record.effectiveTime,
    currentness: validateCurrentness(record.currentness),
    provenance: validateProvenance(record.provenance),
  } as unknown as ResponsibilityContext;
}

function validateActingContextCandidate(value: unknown, scopeRef: ScopeRef): ActingContextCandidate {
  const record = asRecord(value, "INVALID_ACTING_CONTEXT_CANDIDATE");
  assertExactKeys(
    record,
    [
      "contextRef",
      "personRef",
      "roleRef",
      "assignmentRef",
      "availabilityRef",
      "responsibilityRef",
      "authorityBasisRef",
      "scopeRef",
      "validity",
      "applicability",
      "currentness",
      "integrity",
      "provenance",
    ],
    ["entityRef", "dutyRef"],
  );

  for (const key of [
    "contextRef",
    "personRef",
    "roleRef",
    "assignmentRef",
    "availabilityRef",
    "responsibilityRef",
    "authorityBasisRef",
  ]) {
    assertNonEmptyString(record[key], `INVALID_ACTING_CONTEXT_${key}`);
  }
  if (record.entityRef !== undefined) assertNonEmptyString(record.entityRef, "INVALID_ACTING_CONTEXT_ENTITY");
  if (record.dutyRef !== undefined) assertNonEmptyString(record.dutyRef, "INVALID_ACTING_CONTEXT_DUTY");

  const nestedScope = validateScopeRef(record.scopeRef, true);
  if (scopeIdentity(nestedScope) !== scopeIdentity(scopeRef)) throw new Error("ACTING_CONTEXT_SCOPE_MISMATCH");

  return {
    contextRef: record.contextRef,
    personRef: record.personRef,
    ...(record.entityRef === undefined ? {} : { entityRef: record.entityRef }),
    roleRef: record.roleRef,
    assignmentRef: record.assignmentRef,
    ...(record.dutyRef === undefined ? {} : { dutyRef: record.dutyRef }),
    availabilityRef: record.availabilityRef,
    responsibilityRef: record.responsibilityRef,
    authorityBasisRef: record.authorityBasisRef,
    scopeRef: nestedScope,
    validity: validateCondition(record.validity),
    applicability: validateCondition(record.applicability),
    currentness: validateCurrentness(record.currentness),
    integrity: validateIntegrity(record.integrity),
    provenance: validateProvenance(record.provenance),
  } as unknown as ActingContextCandidate;
}

function validateScopeRef(value: unknown, requireService: boolean): ScopeRef {
  const record = asRecord(value, "INVALID_SCOPE_REF");
  assertExactKeys(record, ["situationId", "subjectType", "subjectId"], ["parentScopeRef", "relationRef"]);
  assertNonEmptyString(record.situationId, "INVALID_SCOPE_SITUATION");
  assertNonEmptyString(record.subjectType, "INVALID_SCOPE_SUBJECT_TYPE");
  assertNonEmptyString(record.subjectId, "INVALID_SCOPE_SUBJECT");
  if (requireService && record.subjectType !== "SERVICE") throw new Error("STAGING_SERVICE_SCOPE_ONLY");
  if (record.parentScopeRef !== undefined) assertNonEmptyString(record.parentScopeRef, "INVALID_PARENT_SCOPE_REF");
  if (record.relationRef !== undefined) assertNonEmptyString(record.relationRef, "INVALID_RELATION_REF");
  return {
    situationId: record.situationId,
    subjectType: record.subjectType,
    subjectId: record.subjectId,
    ...(record.parentScopeRef === undefined ? {} : { parentScopeRef: record.parentScopeRef }),
    ...(record.relationRef === undefined ? {} : { relationRef: record.relationRef }),
  };
}

function validateCurrentness(value: unknown): Currentness {
  const record = asRecord(value, "INVALID_CURRENTNESS");
  assertExactKeys(record, ["status"], ["basisRef"]);
  if (!["CURRENT", "STALE", "CONFLICT", "UNKNOWN"].includes(String(record.status))) {
    throw new Error("INVALID_CURRENTNESS_STATUS");
  }
  if (record.basisRef !== undefined) assertNonEmptyString(record.basisRef, "INVALID_CURRENTNESS_BASIS");
  return {
    status: record.status as Currentness["status"],
    ...(record.basisRef === undefined ? {} : { basisRef: record.basisRef }),
  };
}

function validateCondition(value: unknown): GovernedConditionAssessment {
  const record = asRecord(value, "INVALID_CONDITION_ASSESSMENT");
  assertExactKeys(record, ["conditionRef", "satisfied", "evidenceRefs"]);
  assertNonEmptyString(record.conditionRef, "INVALID_CONDITION_REF");
  if (typeof record.satisfied !== "boolean") throw new Error("INVALID_CONDITION_SATISFIED");
  return {
    conditionRef: record.conditionRef,
    satisfied: record.satisfied,
    evidenceRefs: stringArray(record.evidenceRefs, "INVALID_CONDITION_EVIDENCE"),
  };
}

function validateIntegrity(value: unknown): IntegrityAssessment {
  const record = asRecord(value, "INVALID_INTEGRITY");
  assertExactKeys(record, ["sufficient", "conflict", "evidenceRefs"]);
  if (typeof record.sufficient !== "boolean" || typeof record.conflict !== "boolean") {
    throw new Error("INVALID_INTEGRITY_FLAGS");
  }
  return {
    sufficient: record.sufficient,
    conflict: record.conflict,
    evidenceRefs: stringArray(record.evidenceRefs, "INVALID_INTEGRITY_EVIDENCE"),
  };
}

function validateProvenance(value: unknown): Provenance {
  const record = asRecord(value, "INVALID_PROVENANCE");
  assertExactKeys(record, ["sourceRefs", "chainRefs"]);
  return {
    sourceRefs: stringArray(record.sourceRefs, "INVALID_PROVENANCE_SOURCE_REFS"),
    chainRefs: stringArray(record.chainRefs, "INVALID_PROVENANCE_CHAIN_REFS"),
  };
}

function isWithinRuntimeRoot(path: string): boolean {
  if (!isAbsolute(path)) return false;
  const root = resolve(RUNTIME_DATA_ROOT);
  const candidate = resolve(path);
  return candidate === root || candidate.startsWith(`${root}/`);
}

function scopeIdentity(scope: ScopeRef): string {
  return [scope.situationId, scope.subjectType, scope.subjectId, scope.parentScopeRef ?? "", scope.relationRef ?? ""].join("|");
}

function assertEmptyArray(value: unknown, code: string): void {
  if (!Array.isArray(value) || value.length !== 0) throw new Error(code);
}

function stringArray(value: unknown, code: string): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string" || entry.length === 0)) {
    throw new Error(code);
  }
  return [...value];
}

function assertNonEmptyString(value: unknown, code: string): asserts value is string {
  if (typeof value !== "string" || value.length === 0) throw new Error(code);
}

function asRecord(value: unknown, code: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(code);
  return value as Record<string, unknown>;
}

function assertExactKeys(
  record: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = [],
): void {
  const allowed = new Set([...required, ...optional]);
  for (const key of required) {
    if (!(key in record)) throw new Error(`MISSING_REQUIRED_FIELD:${key}`);
  }
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) throw new Error(`FORBIDDEN_OR_UNKNOWN_FIELD:${key}`);
  }
}
