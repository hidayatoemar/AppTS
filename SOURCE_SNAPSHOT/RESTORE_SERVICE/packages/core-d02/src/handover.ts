export interface ResponsibilityState { readonly responsibilityId: string; readonly assignmentRef: string; }
export interface HandoverProposal { readonly proposalId: string; readonly current: ResponsibilityState; readonly proposedAssignmentRef: string; }
export type HandoverResponse = { readonly status: "ACCEPTED"; readonly acceptanceRef: string } | { readonly status: "REJECTED" | "UNAVAILABLE" | "NO_RECEIVER"; readonly reasonRef: string };
export interface HandoverResult { readonly responsibility: ResponsibilityState; readonly fallbackRequired: boolean; readonly escalationRequired: boolean; }
export function resolveHandover(proposal: HandoverProposal, response: HandoverResponse): HandoverResult {
  if (response.status === "ACCEPTED") return Object.freeze({ responsibility: Object.freeze({ responsibilityId: proposal.current.responsibilityId, assignmentRef: proposal.proposedAssignmentRef }), fallbackRequired: false, escalationRequired: false });
  return Object.freeze({ responsibility: proposal.current, fallbackRequired: true, escalationRequired: true });
}
