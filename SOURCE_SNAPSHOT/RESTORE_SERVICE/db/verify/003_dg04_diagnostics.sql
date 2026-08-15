\set ON_ERROR_STOP on

BEGIN;

DO $$
DECLARE
  diagnostic_table_total integer;
  required_constraint text;
  forbidden_fk_total integer;
BEGIN
  SELECT count(*) INTO diagnostic_table_total
    FROM information_schema.tables
   WHERE table_schema = 'appts'
     AND table_type = 'BASE TABLE'
     AND table_name IN (
       'diagnostic_error_event','diagnostic_event_subject','secure_diagnostic_bundle',
       'diagnostic_bundle_member','diagnostic_dependency_evidence',
       'diagnostic_mapping_registry_version','diagnostic_mapping_entry',
       'diagnostic_notification','diagnostic_notification_attempt',
       'diagnostic_notification_result','diagnostic_notification_dead_letter',
       'diagnostic_notification_acknowledgment','diagnostic_aggregation_group',
       'diagnostic_aggregation_member','diagnostic_storm_control_decision',
       'diagnostic_notification_failure_link','diagnostic_event_correction'
     );
  IF diagnostic_table_total <> 17 THEN
    RAISE EXCEPTION 'expected 17 DG04 tables; found %', diagnostic_table_total;
  END IF;

  FOREACH required_constraint IN ARRAY ARRAY[
    'ck_diagnostic_error_event__effect_status',
    'ck_diagnostic_error_event__root_cause',
    'ck_diagnostic_event_subject__subject_branch',
    'uq_diagnostic_mapping_registry_version__identity_version',
    'uq_diagnostic_mapping_entry__failure',
    'fk_diag_notif__bndl_evt__secure_diag_bndl'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE n.nspname = 'appts' AND c.conname = required_constraint
    ) THEN
      RAISE EXCEPTION 'missing DG04 constraint %', required_constraint;
    END IF;
  END LOOP;

  IF to_regclass('appts.uq_secure_diagnostic_bundle__current_event') IS NULL THEN
    RAISE EXCEPTION 'missing current-bundle partial index';
  END IF;

  SELECT count(*) INTO forbidden_fk_total
    FROM pg_constraint c
    JOIN pg_class src ON src.oid = c.conrelid
    JOIN pg_class dst ON dst.oid = c.confrelid
    JOIN pg_namespace n ON n.oid = src.relnamespace
   WHERE n.nspname = 'appts'
     AND src.relname = 'diagnostic_notification_acknowledgment'
     AND c.contype = 'f'
     AND dst.relname IN (
       'runtime_state_transition','authority_projection','gate_projection',
       'responsible_assignment','progression_envelope'
     );
  IF forbidden_fk_total <> 0 THEN
    RAISE EXCEPTION 'diagnostic acknowledgment must not imply lifecycle/authority/gate responsibility';
  END IF;
END
$$;

ROLLBACK;
