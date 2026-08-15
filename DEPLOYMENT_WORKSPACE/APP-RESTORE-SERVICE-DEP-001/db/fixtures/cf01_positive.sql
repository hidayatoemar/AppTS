\set ON_ERROR_STOP on

BEGIN;

INSERT INTO appts.idempotency_ledger (
  idempotency_ledger_id, owner_domain_ref, idempotency_key,
  command_or_message_identity, payload_hash, first_seen_at, last_seen_at,
  conflict_status_ref
) VALUES (
  '10000000-0000-0000-0000-000000000001', 'CF01-B01',
  '10000000-0000-0000-0000-000000000002', 'fixture.positive',
  'sha256:positive', clock_timestamp(), clock_timestamp(), 'NO_CONFLICT'
);

INSERT INTO appts.configuration_snapshot (
  configuration_snapshot_id, configuration_source_ref,
  configuration_version_ref, scope_ref, scope_ref_schema_version,
  captured_at, qualification_ref, payload_or_reference_ref
) VALUES (
  '10000000-0000-0000-0000-000000000010',
  '10000000-0000-0000-0000-000000000011', 'B01-FIXTURE-1',
  '{"scope":"verification"}'::jsonb, '1', clock_timestamp(),
  '10000000-0000-0000-0000-000000000012',
  '10000000-0000-0000-0000-000000000013'
);

INSERT INTO appts.diagnostic_mapping_registry_version (
  registry_version_id, registry_identity, registry_version,
  configuration_snapshot_id, effective_from, currentness_ref, status_ref
) VALUES (
  '10000000-0000-0000-0000-000000000020', 'DG04-FIXTURE', '1',
  '10000000-0000-0000-0000-000000000010', clock_timestamp(),
  'CURRENT', 'ACTIVE'
);

INSERT INTO appts.diagnostic_mapping_entry (
  mapping_entry_id, registry_version_id, implementation_failure_identity,
  canonical_error_code, error_category_ref, severity_ref,
  effect_classification_rule_ref, retryability_rule_ref,
  reconciliation_rule_ref, safe_user_message_key,
  diagnostic_owner_or_queue_ref, required_evidence_set_ref,
  required_test_vector_ref
) VALUES (
  '10000000-0000-0000-0000-000000000021',
  '10000000-0000-0000-0000-000000000020', 'fixture.failure',
  'CF01-FIXTURE-001', 'PERSISTENCE', 'ERROR', 'NO_EFFECT',
  'NOT_RETRYABLE', 'NONE', 'fixture.safe', 'diagnostic.fixture',
  'DG04-EVIDENCE-FIXTURE', 'DG04-TV-FIXTURE'
);

INSERT INTO appts.diagnostic_error_event (
  error_event_id, occurred_at, correlation_id, environment_ref,
  application_ref, service_ref, module_ref, component_ref,
  build_version_ref, source_revision_or_commit_ref,
  configuration_version_ref, configuration_snapshot_id,
  operation_identity, mapping_entry_id, canonical_error_code,
  error_category_ref, severity_ref, transaction_commit_status_ref,
  diagnostic_effect_status, retryability_status_ref, root_cause_status,
  diagnostic_owner_or_queue_ref, safe_user_reference_code,
  safe_message_key, committed_at, disclosure_label_ref
) VALUES (
  '10000000-0000-0000-0000-000000000030', clock_timestamp(),
  '10000000-0000-0000-0000-000000000031', 'verification', 'restore-service',
  'persistence', 'diagnostics', 'fixture', 'B01', 'B01-FIXTURE',
  'B01-FIXTURE-1', '10000000-0000-0000-0000-000000000010',
  'fixture.positive', '10000000-0000-0000-0000-000000000021',
  'CF01-FIXTURE-001', 'PERSISTENCE', 'ERROR', 'ROLLED_BACK',
  'NO_EFFECT', 'NOT_RETRYABLE', 'CONFIRMED', 'diagnostic.fixture',
  'SAFE-FIXTURE-001', 'fixture.safe', clock_timestamp(),
  '10000000-0000-0000-0000-000000000032'
);

INSERT INTO appts.diagnostic_event_subject (
  diagnostic_event_subject_id, error_event_id, subject_type_ref,
  subject_ref_code, linked_at
) VALUES (
  '10000000-0000-0000-0000-000000000040',
  '10000000-0000-0000-0000-000000000030',
  'VERIFICATION_FIXTURE', 'CF01-B01', clock_timestamp()
);

ROLLBACK;
