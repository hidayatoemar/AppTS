import { assertExactKeys, hasOwn, isRecord, issue, optionalNonEmptyString, requireBoolean, requireNonEmptyString, requireTimestamp, resultFromIssues, type ContractCode, type ContractId, type ContractReference, type ContractTime, type ValidationIssue, type ValidationResult } from "./envelope.ts";

export const COMMON_RESULT_IDENTITY = "CF02-RESULT-1.0.0" as const;
export const ACCEPTANCE_CODES = ["ACK", "NACK", "HOLD"] as const;
export const EFFECT_DISPOSITION_CODES = ["EFFECT_APPLIED", "NO_EFFECT"] as const;
export type AcceptanceCode = (typeof ACCEPTANCE_CODES)[number];
export type EffectDispositionCode = (typeof EFFECT_DISPOSITION_CODES)[number];

export interface ContractProcessingResult {
  readonly result_id: ContractId;
  readonly message_id: ContractId;
  readonly correlation_id: ContractId;
  readonly acceptance_code: AcceptanceCode;
  readonly effect_disposition_code?: EffectDispositionCode;
  readonly reconciliation_required: boolean;
  readonly reason_ref?: ContractReference;
  readonly durable_result_ref: ContractReference;
  readonly result_at: ContractTime;
}

export interface ReplayIdentity { readonly message_id: ContractId; readonly idempotency_key: ContractId; readonly payload_hash: ContractCode; }
export type ReplayClassification = "NEW" | "IDENTICAL_REPLAY" | "CONFLICTING_REPLAY";
const RESULT_KEYS = new Set(["result_id", "message_id", "correlation_id", "acceptance_code", "effect_disposition_code", "reconciliation_required", "reason_ref", "durable_result_ref", "result_at"]);

export function validateProcessingResult(input: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (!isRecord(input)) return { ok: false, issues: [issue("$", "REQUIRED_RESULT_STRUCT")] };
  assertExactKeys(input, RESULT_KEYS, issues);
  for (const key of ["result_id", "message_id", "correlation_id", "durable_result_ref"]) requireNonEmptyString(input, key, issues);
  requireTimestamp(input, "result_at", issues);
  requireBoolean(input, "reconciliation_required", issues);
  optionalNonEmptyString(input, "reason_ref", issues);
  if (!ACCEPTANCE_CODES.includes(input.acceptance_code as AcceptanceCode)) issues.push(issue("acceptance_code", "INVALID_ACCEPTANCE_CODE"));
  if (hasOwn(input, "effect_disposition_code") && !EFFECT_DISPOSITION_CODES.includes(input.effect_disposition_code as EffectDispositionCode)) issues.push(issue("effect_disposition_code", "INVALID_EFFECT_DISPOSITION_CODE"));
  if (input.acceptance_code === "NACK" && input.effect_disposition_code === "EFFECT_APPLIED") issues.push(issue("effect_disposition_code", "NACK_CANNOT_APPLY_EFFECT"));
  if (input.acceptance_code === "HOLD" && input.reconciliation_required !== true) issues.push(issue("reconciliation_required", "HOLD_REQUIRES_RECONCILIATION"));
  return resultFromIssues(issues);
}

export function classifyReplay(prior: ReplayIdentity | undefined, incoming: ReplayIdentity): ReplayClassification {
  if (prior === undefined || prior.message_id !== incoming.message_id || prior.idempotency_key !== incoming.idempotency_key) return "NEW";
  return prior.payload_hash === incoming.payload_hash ? "IDENTICAL_REPLAY" : "CONFLICTING_REPLAY";
}

export function blindRetryIsProhibited(result: ContractProcessingResult): boolean { return result.reconciliation_required; }
