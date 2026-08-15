import type { AuthorityResolutionPayload, EvidenceGateResultPayload } from "@appts-restore-service/contracts";

export function deriveAvailableActions(authority: AuthorityResolutionPayload, gate: EvidenceGateResultPayload, restrictiveContext: readonly string[]): readonly string[] {
  if (authority.result_status_ref !== "AUTHORIZED" || !authority.responsible_assignment_ref) return Object.freeze([]);
  const allowed = new Set(authority.authority_actions.filter((item) => item.permission_code === "ALLOW").map((item) => item.action_class_ref));
  const gated = new Set(gate.permitted_progression_classes);
  const restricted = new Set(restrictiveContext);
  return Object.freeze([...allowed].filter((action) => gated.has(action) && !restricted.has(action)).sort());
}
