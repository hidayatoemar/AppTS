\set ON_ERROR_STOP on

BEGIN;

INSERT INTO appts.configuration_snapshot (
  configuration_snapshot_id, configuration_source_ref,
  configuration_version_ref, scope_ref, scope_ref_schema_version,
  captured_at, qualification_ref, payload_or_reference_ref
) VALUES (
  '20000000-0000-0000-0000-000000000010',
  '20000000-0000-0000-0000-000000000011', 'B01-NEGATIVE-1',
  '{"scope":"negative-verification"}'::jsonb, '1', clock_timestamp(),
  '20000000-0000-0000-0000-000000000012',
  '20000000-0000-0000-0000-000000000013'
);

INSERT INTO appts.diagnostic_mapping_registry_version (
  registry_version_id, registry_identity, registry_version,
  configuration_snapshot_id, effective_from, currentness_ref, status_ref
) VALUES (
  '20000000-0000-0000-0000-000000000020', 'DG04-NEGATIVE', '1',
  '20000000-0000-0000-0000-000000000010', clock_timestamp(),
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
  '20000000-0000-0000-0000-000000000021',
  '20000000-0000-0000-0000-000000000020', 'fixture.negative',
  'CF01-NEGATIVE-001', 'PERSISTENCE', 'ERROR', 'NO_EFFECT',
  'NOT_RETRYABLE', 'NONE', 'fixture.safe', 'diagnostic.fixture',
  'DG04-EVIDENCE-NEGATIVE', 'DG04-TV-NEGATIVE'
);

INSERT INTO appts.diagnostic_error_event (
  error_event_id, occurred_at, correlation_id, environment_ref,
  application_ref, component_ref, build_version_ref,
  source_revision_or_commit_ref, configuration_version_ref,
  configuration_snapshot_id, operation_identity, mapping_entry_id,
  canonical_error_code, error_category_ref, severity_ref,
  diagnostic_effect_status, retryability_status_ref, root_cause_status,
  diagnostic_owner_or_queue_ref, safe_user_reference_code,
  safe_message_key, committed_at, disclosure_label_ref
) VALUES (
  '20000000-0000-0000-0000-000000000030', clock_timestamp(),
  '20000000-0000-0000-0000-000000000031', 'verification',
  'restore-service', 'fixture', 'B01', 'B01-NEGATIVE', 'B01-NEGATIVE-1',
  '20000000-0000-0000-0000-000000000010', 'fixture.negative',
  '20000000-0000-0000-0000-000000000021', 'CF01-NEGATIVE-001',
  'PERSISTENCE', 'ERROR', 'NO_EFFECT', 'NOT_RETRYABLE', 'CONFIRMED',
  'diagnostic.fixture', 'SAFE-NEGATIVE-001', 'fixture.safe',
  clock_timestamp(), '20000000-0000-0000-0000-000000000032'
);

DO $$
BEGIN
  BEGIN
    INSERT INTO appts.idempotency_ledger (
      owner_domain_ref, idempotency_key, command_or_message_identity,
      payload_hash, first_seen_at, last_seen_at, conflict_status_ref
    ) VALUES
      ('CF01-B01', '20000000-0000-0000-0000-000000000040', 'one', 'a', now(), now(), 'NONE'),
      ('CF01-B01', '20000000-0000-0000-0000-000000000040', 'two', 'b', now(), now(), 'NONE');
    RAISE EXCEPTION 'negative fixture failed: duplicate idempotency key was accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO appts.diagnostic_event_subject (
      error_event_id, subject_type_ref, subject_ref_id, subject_ref_code, linked_at
    ) VALUES (
      '20000000-0000-0000-0000-000000000030', 'INVALID_BOTH',
      '20000000-0000-0000-0000-000000000041', 'ALSO-SET', now()
    );
    RAISE EXCEPTION 'negative fixture failed: invalid subject branch was accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    UPDATE appts.diagnostic_error_event
       SET safe_message_key = 'mutation-not-allowed'
     WHERE error_event_id = '20000000-0000-0000-0000-000000000030';
    RAISE EXCEPTION 'negative fixture failed: append-only diagnostic event was mutable';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'negative fixture failed:%' THEN RAISE; END IF;
  END;

  BEGIN
    INSERT INTO appts.interaction_journal (
      source_system_ref_id, adapter_profile_ref_id, interaction_identity,
      request_ref, state_code, attempt_count, last_transition_at
    ) VALUES (
      '20000000-0000-0000-0000-000000000050',
      '20000000-0000-0000-0000-000000000051', 'fixture.invalid',
      '20000000-0000-0000-0000-000000000052', 'NOT_A_STATE', 0, now()
    );
    RAISE EXCEPTION 'negative fixture failed: invalid interaction state was accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END
$$;

ROLLBACK;
