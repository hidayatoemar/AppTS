import type {
  ActionCommandEnvelope,
  ActionExecutionRecord,
  EvidenceProvenanceRef,
  MaterialEffectRecord,
  ScopeRef,
} from "../contracts/ce-di.js";
import type { Ref } from "../contracts/ids.js";
import type { ScopeSnapshot } from "../runtime/runtime-composition.js";

export interface StoredCommandIdentity {
  commandId: Ref;
  normalizedEnvelope: string;
  execution: ActionExecutionRecord;
  effects: MaterialEffectRecord[];
}

export interface AppendBatch {
  commitId: Ref;
  scopeRef: ScopeRef;
  normalizedCommandIdentity?: string;
  command?: ActionCommandEnvelope;
  executionRecords: ActionExecutionRecord[];
  materialEffects: MaterialEffectRecord[];
  determiningEvidence: EvidenceProvenanceRef[];
  responsibilityHandoverRefs: Ref[];
  dependencyWaitingRefs: Ref[];
  residualObligationRefs: Ref[];
  verificationClosureRefs: Ref[];
  otherAuthoritativeRefs: Ref[];
}

export interface ScopeRepository {
  load(scopeRef: ScopeRef): Promise<ScopeSnapshot>;
  append(expectedVersion: number, batch: AppendBatch): Promise<{ newVersion: number }>;
  replay(scopeRef: ScopeRef): Promise<ScopeSnapshot>;
  findCommand(commandId: Ref): Promise<StoredCommandIdentity | null>;
}
