/** Shared source, exchange, audit, and rebuildable projection relations. */
export const exchangeRelations = [
  "authoritative_source_ref", "adapter_profile_ref", "qualified_external_record",
  "interaction_journal", "pending_capture", "sync_batch", "sync_result",
  "reconciliation_case", "operational_view_projection", "action_intent",
  "communication_obligation", "communication_attempt", "communication_result",
  "export_job", "source_ref", "source_version_ref", "policy_binding_ref",
  "configuration_snapshot", "missing_binding_result", "integrity_envelope",
  "provisional_capture_payload_resource", "pending_capture_idempotency_binding",
  "lineage_edge", "idempotency_ledger", "inbox_entry", "outbox_entry",
  "commit_marker", "audit_event", "access_audit", "export_manifest",
  "export_manifest_item", "release_identity", "compatibility_declaration",
] as const;
