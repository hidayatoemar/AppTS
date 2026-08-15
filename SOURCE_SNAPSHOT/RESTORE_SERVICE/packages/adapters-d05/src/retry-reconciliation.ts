import type { InteractionJournal } from "./interaction-journal.ts";
export type RetryDecision = "RETRY_ALLOWED" | "RECONCILIATION_REQUIRED" | "NO_RETRY";
export function decideRetry(journal: InteractionJournal, authoritativeNoEffect: boolean): RetryDecision {
  if (journal.state === "UNCERTAIN" || journal.state === "RECONCILIATION_PENDING") return "RECONCILIATION_REQUIRED";
  if ((journal.state === "FAILED" || journal.state === "TIMED_OUT") && authoritativeNoEffect) return "RETRY_ALLOWED";
  return "NO_RETRY";
}
export function resolveReplay(prior: InteractionJournal | undefined, identity: string, payloadHash: string): "NEW" | "IDENTICAL_REPLAY" | "CONFLICTING_REPLAY" { if (!prior) return "NEW"; return prior.interactionIdentity === identity && prior.payloadHash === payloadHash ? "IDENTICAL_REPLAY" : "CONFLICTING_REPLAY"; }
