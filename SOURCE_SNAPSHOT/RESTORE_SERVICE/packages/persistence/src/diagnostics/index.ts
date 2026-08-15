/** DG-04 persistence cannot create business authority or lifecycle effects. */
export const diagnosticRelations = [
  "diagnostic_error_event", "diagnostic_event_subject", "secure_diagnostic_bundle",
  "diagnostic_bundle_member", "diagnostic_dependency_evidence",
  "diagnostic_mapping_registry_version", "diagnostic_mapping_entry",
  "diagnostic_notification", "diagnostic_notification_attempt",
  "diagnostic_notification_result", "diagnostic_notification_dead_letter",
  "diagnostic_notification_acknowledgment", "diagnostic_aggregation_group",
  "diagnostic_aggregation_member", "diagnostic_storm_control_decision",
  "diagnostic_notification_failure_link", "diagnostic_event_correction",
] as const;
