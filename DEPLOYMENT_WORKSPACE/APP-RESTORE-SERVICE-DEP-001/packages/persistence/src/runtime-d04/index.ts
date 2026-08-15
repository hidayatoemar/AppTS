/** D-04 is the single mechanical lifecycle-effect writer. */
export const runtimeD04Relations = [
  "runtime_ticket", "runtime_context", "runtime_state_transition",
  "lifecycle_effect_request", "lifecycle_effect_result", "authority_projection",
  "gate_projection", "action_set_snapshot", "action_set_member", "next_control",
  "operational_obligation", "waiting_interval", "runtime_blocker",
  "runtime_escalation", "acknowledgment", "runtime_handover_context",
  "subordinate_projection", "dependency_context", "residual_obligation",
  "aoua_record", "authorization_transition", "restriction_profile_ref",
  "package_binding_runtime", "hook_invocation", "hook_result", "stub_result",
] as const;
