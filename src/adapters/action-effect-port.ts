import type { ActionCommandEnvelope } from "../contracts/ce-di.js";
import type { Ref } from "../contracts/ids.js";

export interface GovernedExecutionOutcome {
  executionResult: string;
  executorRef: Ref;
  responseRef?: Ref;
  executionEvidenceRefs: Ref[];
  uncertaintyFlag: boolean;
  resultantEffect?: {
    effectTypeRef: Ref;
    beforeTruthRefs: Ref[];
    afterTruthRefs: Ref[];
    evidenceRefs: Ref[];
    materialEffectEstablished: boolean;
    noEffectOrFailureReason?: string;
  };
}

export interface ActionEffectPort {
  execute(command: ActionCommandEnvelope, activeFunctionalBindings: readonly Ref[]): Promise<GovernedExecutionOutcome>;
}
