import type { FieldWorkEvaluation, FieldWorkRecord } from "../contracts/b6.js";

export function evaluateFieldWork(record: FieldWorkRecord): FieldWorkEvaluation {
  return {
    fieldWorkRef: record.fieldWorkRef,
    progress: record.progress,
    purposeResponsibilityTransferred: false,
    workCompleted: record.progress === "COMPLETED",
    restorationEstablished: false,
    serviceVerificationEstablished: false,
  };
}
