import type { AuthorityResolutionPayload, CompoundContextMessage, ValidationResult } from "@appts-restore-service/contracts";
import type { AssignmentSnapshot } from "./assignment-snapshot.ts";
export interface AuthorityCandidate { readonly responsibilityId: string; readonly snapshot: AssignmentSnapshot; readonly scopeMatches: boolean; readonly ticketContextMatches: boolean; readonly evidenceSatisfied: boolean; readonly sodSatisfied: boolean; readonly policySatisfied: boolean; readonly actions: readonly { readonly action_class_ref: string; readonly permission_code: string }[]; }
export interface AuthorityInput { readonly resultId: string; readonly ticketId: string; readonly domainId: string; readonly contextRef: string; readonly currentnessRef: string; readonly effectiveFrom: string; readonly candidates: readonly AuthorityCandidate[]; }
export function resolveAuthority(input: AuthorityInput): AuthorityResolutionPayload {
  const valid = input.candidates.filter((candidate) => candidate.snapshot.state === "CURRENT" && candidate.snapshot.domainId === input.domainId && candidate.scopeMatches && candidate.ticketContextMatches && candidate.evidenceSatisfied && candidate.sodSatisfied && candidate.policySatisfied);
  const selected = valid.length === 1 ? valid[0] : undefined;
  return Object.freeze({ authority_result_id: input.resultId, ticket_id: input.ticketId, domain_id: input.domainId, context_ref: input.contextRef, assignment_snapshot_refs: Object.freeze(input.candidates.map((item) => item.snapshot.snapshotId)), ...(selected ? { responsibility_id: selected.responsibilityId, responsible_assignment_ref: selected.snapshot.assignmentRef, authority_actions: Object.freeze([...selected.actions]), result_status_ref: "AUTHORIZED" } : { authority_actions: Object.freeze([]), result_status_ref: valid.length > 1 ? "UNRESOLVED_CONFLICT" : "NO_VALID_AUTHORITY" }), currentness_ref: input.currentnessRef, effective_from: input.effectiveFrom });
}
export function consumeD02CompoundContext(message: CompoundContextMessage, validation: ValidationResult): Readonly<Record<string, unknown>> {
  if (!validation.ok || message.payload.access_set_identity !== "I04-ACCESS-D02-1.0.0") throw new Error("INVALID_I04_D02_PAIRING");
  return Object.freeze({ ...message.payload.access_set_payload });
}
