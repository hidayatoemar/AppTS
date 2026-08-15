export interface DurableObligation { readonly obligationId: string; readonly ticketId: string; readonly sourceRef: string; readonly effectiveAt: string; readonly dueBasisRef: string; readonly nextEvaluationAt: string; readonly status: "OPEN" | "SATISFIED" | "EXPIRED" | "UNRESOLVED_NO_DEFAULT"; }
export function createDurableObligation(input: DurableObligation): DurableObligation {
  if (!input.obligationId || !input.sourceRef || !input.dueBasisRef || !input.nextEvaluationAt) throw new Error("DURABLE_OBLIGATION_FACT_MISSING");
  return Object.freeze({ ...input });
}
export function evaluateObligation(obligation: DurableObligation, authoritativeTime: string | undefined): DurableObligation {
  if (!authoritativeTime) return Object.freeze({ ...obligation, status: "UNRESOLVED_NO_DEFAULT" });
  if (obligation.status !== "OPEN") return obligation;
  return authoritativeTime >= obligation.nextEvaluationAt ? Object.freeze({ ...obligation, status: "EXPIRED" }) : obligation;
}
