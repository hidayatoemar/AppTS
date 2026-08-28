import type { AuthorityResolutionPayload, EvidenceGateResultPayload } from "@appts-restore-service/contracts";

type EntityAttribution = Readonly<{ entity_ref?: string; actor_holder_ref?: string; acting_role_instance_ref?: string; acting_assignment_ref?: string; authority_basis_ref?: string }>;
const complete = (value: EntityAttribution): value is Required<EntityAttribution> => [value.entity_ref, value.actor_holder_ref, value.acting_role_instance_ref, value.acting_assignment_ref, value.authority_basis_ref].every((item) => typeof item === "string" && item.length > 0);
const sameAttribution = (authority: EntityAttribution, gate: EntityAttribution): boolean => complete(authority) && complete(gate) && authority.entity_ref === gate.entity_ref && authority.actor_holder_ref === gate.actor_holder_ref && authority.acting_role_instance_ref === gate.acting_role_instance_ref && authority.acting_assignment_ref === gate.acting_assignment_ref && authority.authority_basis_ref === gate.authority_basis_ref;

export function deriveAvailableActions(authority: AuthorityResolutionPayload, gate: EvidenceGateResultPayload, restrictiveContext: readonly string[]): readonly string[] {
  if (authority.result_status_ref !== "AUTHORIZED" || !authority.responsible_assignment_ref) return Object.freeze([]);
  if (!sameAttribution(authority, gate) || authority.responsible_assignment_ref !== authority.acting_assignment_ref) return Object.freeze([]);
  const allowed = new Set(authority.authority_actions.filter((item) => item.permission_code === "ALLOW").map((item) => item.action_class_ref));
  const gated = new Set(gate.permitted_progression_classes);
  const restricted = new Set(restrictiveContext);
  return Object.freeze([...allowed].filter((action) => gated.has(action) && !restricted.has(action)).sort());
}
