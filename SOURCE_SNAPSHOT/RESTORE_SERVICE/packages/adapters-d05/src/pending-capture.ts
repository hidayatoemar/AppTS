export interface PendingCapture { readonly captureId: string; readonly actorRef: string; readonly deviceRef: string; readonly localSequence: number; readonly sourceTime: string; readonly timeConfidence: "TRUSTED" | "UNCERTAIN"; readonly payloadHash: string; readonly authorizationSnapshotRef: string; readonly finalEffectClaimed: false; }
export function validatePendingBatch(items: readonly PendingCapture[], currentAuthorityConfirmed: boolean): { readonly accepted: readonly PendingCapture[]; readonly sensitiveEffectAllowed: boolean } {
  if (items.length > 250) throw new Error("PENDING_CAPTURE_LIMIT_EXCEEDED");
  const sequences = new Set<number>(); for (const item of items) { if (sequences.has(item.localSequence)) throw new Error("DUPLICATE_LOCAL_SEQUENCE"); sequences.add(item.localSequence); }
  return Object.freeze({ accepted: Object.freeze([...items]), sensitiveEffectAllowed: currentAuthorityConfirmed });
}
