export const ADMISSION_PREDICATES = ["APPLICABILITY", "SUBJECT_BOUNDARY", "COMPLETENESS", "CONSISTENCY", "CURRENTNESS", "DUPLICATE_CORRELATION", "AUTHORITY", "EVIDENCE", "PURPOSE_BINDING", "RESPONSIBILITY"] as const;
export type AdmissionPredicate = (typeof ADMISSION_PREDICATES)[number];
export type PredicateStatus = "SATISFIED" | "MISSING" | "UNKNOWN" | "STALE" | "CONTRADICTORY" | "REJECTED";
export interface PredicateResult { readonly predicate: AdmissionPredicate; readonly status: PredicateStatus; readonly reasonRef?: string; }
export interface AdmissionAssessment { readonly assessmentId: string; readonly caseId: string; readonly result: "ACCEPTABLE" | "NOT_ACCEPTABLE"; readonly predicates: readonly PredicateResult[]; }
export function evaluateAdmission(assessmentId: string, caseId: string, predicates: readonly PredicateResult[]): AdmissionAssessment {
  const byName = new Map(predicates.map((result) => [result.predicate, result]));
  const normalized = ADMISSION_PREDICATES.map((predicate) => byName.get(predicate) ?? { predicate, status: "MISSING" as const, reasonRef: "PREDICATE_NOT_PROVIDED" });
  return Object.freeze({ assessmentId, caseId, result: normalized.every((item) => item.status === "SATISFIED") ? "ACCEPTABLE" : "NOT_ACCEPTABLE", predicates: Object.freeze(normalized) });
}
