import type { DiagnosticNotificationDeliveryResult, DiagnosticNotificationDeadLetter } from "@appts-restore-service/contracts";
export function recordDiagnosticDelivery(result: DiagnosticNotificationDeliveryResult): DiagnosticNotificationDeliveryResult { return Object.freeze({ ...result }); }
export function requiresDiagnosticRetry(result: DiagnosticNotificationDeliveryResult): boolean { return result.delivery_result_class_ref === "FAILED_RETRYABLE" || result.delivery_result_class_ref === "RETRY_PENDING"; }
export function toDeadLetter(input: DiagnosticNotificationDeadLetter): DiagnosticNotificationDeadLetter { return Object.freeze({ ...input }); }
export function affectsBusinessTransaction(): false { return false; }
