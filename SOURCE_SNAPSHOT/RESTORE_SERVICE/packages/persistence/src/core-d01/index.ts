/** D-01 relation ownership. SQL writers must remain inside this adapter boundary. */
export const coreD01Relations = [
  "ticket_identity", "intake_cue", "source_observation", "pre_ticket_case",
  "admission_assessment", "admission_predicate_result", "intake_decision",
  "ticket_formation_record", "incident_record", "relationship_record",
  "post_closure_correction", "successor_ticket_link", "purpose_extension_binding",
] as const;
