import type { FieldWorkRecord } from "../contracts/b6.js";
import type { IsoInstant, Ref } from "../contracts/ids.js";

export interface FieldSyncInput {
  record: FieldWorkRecord;
  syncEvidenceRefs: Ref[];
  receivedTime: IsoInstant;
}

export interface FieldSyncPort {
  receive(): Promise<FieldSyncInput[]>;
}

export interface FieldSyncBoundaryObservation extends FieldSyncInput {
  purposeResponsibilityTransferred: false;
  restorationEstablished: false;
  serviceVerificationEstablished: false;
}

export const observeFieldSync = (
  input: FieldSyncInput,
): FieldSyncBoundaryObservation => ({
  ...input,
  purposeResponsibilityTransferred: false,
  restorationEstablished: false,
  serviceVerificationEstablished: false,
});
