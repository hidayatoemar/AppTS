export type CaptureKindRef = "OBSERVATION" | "DRAFT_EVIDENCE";

export interface ProvisionalPayloadInlineCapture {
  readonly representationKind: "INLINE_STRUCT";
  readonly inlineContent: Record<string, unknown>;
}

export interface ProvisionalPayloadDurableCapture {
  readonly representationKind: "DURABLE_REFERENCE";
  readonly durableReference: string;
}

export type ProvisionalCapturePayload =
  | ProvisionalPayloadInlineCapture
  | ProvisionalPayloadDurableCapture;

export interface PendingCapture {
  readonly clientCaptureId: string;
  readonly localSequence: number;
  readonly captureKindRef: CaptureKindRef;
  readonly sourceSystemRef: string;
  readonly sourceLabelRef: string;
  readonly capturedByRef: string;
  readonly deviceContextRef: string;
  readonly captureTime: string;
  readonly sourceOffset?: string;
  readonly timeConfidenceRef: string;
  readonly provisionalPayload: ProvisionalCapturePayload;
  readonly payloadRepresentationProfileRef?: string;
  readonly payloadRepresentationVersion?: string;
  readonly payloadHash: string;
  readonly authorizationSnapshotRef: string;
  readonly supersedesCaptureRef?: string;
  readonly finalEffectClaimed: false;
}

export function validatePendingBatch(
  items: readonly PendingCapture[],
  currentAuthorityConfirmed: boolean,
): { readonly accepted: readonly PendingCapture[]; readonly sensitiveEffectAllowed: boolean } {
  if (items.length > 250) throw new Error("PENDING_CAPTURE_LIMIT_EXCEEDED");
  const sequences = new Set<number>();
  for (const item of items) {
    if (sequences.has(item.localSequence)) throw new Error("DUPLICATE_LOCAL_SEQUENCE");
    sequences.add(item.localSequence);
  }
  return Object.freeze({
    accepted: Object.freeze([...items]),
    sensitiveEffectAllowed: currentAuthorityConfirmed,
  });
}
