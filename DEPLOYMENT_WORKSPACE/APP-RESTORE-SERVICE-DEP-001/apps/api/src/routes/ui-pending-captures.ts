import {
  validatePendingCaptureSyncSubmission,
  D05_SUBMISSION_INTERFACE_IDENTITY,
  type PendingCaptureSyncPendingAcceptancePayload,
} from "@appts-restore-service/contracts";

export { UI_PENDING_CAPTURE_PATH } from "./ui-intents.ts";

export interface PendingCapturePort {
  submit(envelope: unknown): Promise<PendingCaptureSyncPendingAcceptancePayload>;
}

export class PendingCaptureValidationError extends Error {
  public readonly issues: readonly { readonly path: string; readonly code: string }[];
  public constructor(issues: readonly { readonly path: string; readonly code: string }[]) {
    super("PENDING_CAPTURE_VALIDATION_FAILED");
    this.name = "PendingCaptureValidationError";
    this.issues = issues;
  }
}

export async function handlePendingCaptureSubmission(
  port: PendingCapturePort,
  body: unknown,
): Promise<PendingCaptureSyncPendingAcceptancePayload> {
  const result = validatePendingCaptureSyncSubmission(body);
  if (!result.ok) throw new PendingCaptureValidationError(result.issues);
  return port.submit(body);
}
