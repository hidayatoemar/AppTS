import type { ExternalExecutionObservation, ExternalReconciliationEvidence } from "../contracts/b8.js";
import type { Ref } from "../contracts/ids.js";

export interface ExternalEffectPort {
  observe(interactionRef: Ref): Promise<ExternalExecutionObservation>;
  reconcile(requestIdentityRef: Ref): Promise<ExternalReconciliationEvidence>;
}
