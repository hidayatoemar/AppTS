export type SnapshotState = "CURRENT" | "STALE" | "INVALID" | "MISSING";
export interface AssignmentSnapshot { readonly snapshotId: string; readonly roleRef: string; readonly roleInstanceRef?: string; readonly holderRef: string; readonly assignmentRef: string; readonly entityRef?: string; readonly domainId: string; readonly authorityBasisRef?: string; readonly effectiveFrom: string; readonly effectiveTo?: string; readonly state: SnapshotState; readonly sourceRef: string; }
export function materializeAssignmentSnapshot(input: AssignmentSnapshot): AssignmentSnapshot {
  if (!input.snapshotId || !input.roleRef || !input.roleInstanceRef || !input.holderRef || !input.assignmentRef || !input.entityRef || !input.authorityBasisRef || !input.sourceRef) throw new Error("ASSIGNMENT_SNAPSHOT_REQUIRED_FACT_MISSING");
  return Object.freeze({ ...input });
}
