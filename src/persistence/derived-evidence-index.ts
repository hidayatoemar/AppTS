import type { EvidenceProvenanceRef, ScopeRef } from "../contracts/ce-di.js";
import type { Ref } from "../contracts/ids.js";
import type { LocalJsonlStore } from "./jsonl-store.js";

export class DerivedEvidenceIndex {
  private readonly evidence = new Map<Ref, EvidenceProvenanceRef>();

  indexCommittedEvidence(items: EvidenceProvenanceRef[]): void {
    for (const item of items) this.evidence.set(item.evidenceId, structuredClone(item));
  }

  readIndex(refs: Ref[]): EvidenceProvenanceRef[] {
    return refs.flatMap((ref) => {
      const item = this.evidence.get(ref);
      return item ? [structuredClone(item)] : [];
    });
  }

  clear(): void {
    this.evidence.clear();
  }

  async rebuildFromAuthoritativeHistory(scopeRef: ScopeRef, store: LocalJsonlStore): Promise<void> {
    const recovery = await store.recoverRecords(scopeRef);
    for (const record of recovery.records) this.indexCommittedEvidence(record.batch.evidenceProvenance);
  }
}
