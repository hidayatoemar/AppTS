import type {
  ActionExecutionRecord,
  EvidenceProvenanceRef,
  MaterialEffectRecord,
  ScopeRef,
} from "../contracts/ce-di.js";
import type { DependencyWaitingRecord, ResponsibilityHandoverRecord } from "../contracts/b6.js";
import type { VerificationClosureEvaluation } from "../contracts/b7.js";
import type { Ref } from "../contracts/ids.js";
import type { AuthoritativeP01ToP10Record, ScopeSnapshot } from "../runtime/runtime-composition.js";

export interface StoredCommandIdentity {
  commandId: Ref;
  normalizedEnvelope: string;
  execution: ActionExecutionRecord;
  effects: MaterialEffectRecord[];
}

export interface AppendBatch {
  commitId: Ref;
  scopeRef: ScopeRef;
  commandReplayIdentity?: StoredCommandIdentity;
  actionExecutions: ActionExecutionRecord[];
  materialEffects: MaterialEffectRecord[];
  evidenceProvenance: EvidenceProvenanceRef[];
  responsibilityHandoverEffects: ResponsibilityHandoverRecord[];
  dependencyWaitingUpdates: DependencyWaitingRecord[];
  residualObligationRefs: Ref[];
  verificationClosureEffects: VerificationClosureEvaluation[];
  otherAuthoritativeP01ToP10Records: readonly AuthoritativeP01ToP10Record[];
}

export interface ScopeRepository {
  load(scopeRef: ScopeRef): Promise<ScopeSnapshot>;
  append(expectedVersion: number, batch: AppendBatch): Promise<{ newVersion: number; commitId: Ref }>;
  replay(scopeRef: ScopeRef): Promise<ScopeSnapshot>;
  findCommand(commandId: Ref): Promise<StoredCommandIdentity | null>;
}
