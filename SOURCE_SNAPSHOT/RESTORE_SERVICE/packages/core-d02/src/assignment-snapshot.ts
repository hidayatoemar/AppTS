export type SnapshotState = "CURRENT" | "STALE" | "INVALID" | "MISSING";
export interface AssignmentSnapshot { readonly snapshotId: string; readonly roleRef: string; readonly holderRef: string; readonly assignmentRef: string; readonly domainId: string; readonly effectiveFrom: string; readonly effectiveTo?: string; readonly state: SnapshotState; readonly sourceRef: string; }
export function materializeAssignmentSnapshot(input: AssignmentSnapshot): AssignmentSnapshot {
  if (!input.snapshotId || !input.roleRef || !input.holderRef || !input.assignmentRef || !input.sourceRef) throw new Error("ASSIGNMENT_SNAPSHOT_REQUIRED_FACT_MISSING");
  return Object.freeze({ ...input });
}
