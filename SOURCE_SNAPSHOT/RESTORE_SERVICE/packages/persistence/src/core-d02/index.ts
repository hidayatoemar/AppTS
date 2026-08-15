/** D-02 relation ownership. SQL writers must remain inside this adapter boundary. */
export const coreD02Relations = [
  "assignment_snapshot", "authority_envelope", "authority_action",
  "responsible_assignment", "handover_proposal", "handover_response",
  "responsibility_change", "delegation_grant", "escalation_obligation_core",
  "sod_decision", "authority_refresh",
] as const;
