\set ON_ERROR_STOP on

BEGIN;

DO $$
DECLARE
  table_total integer;
  primary_key_total integer;
  unexpected_defaults integer;
  naive_timestamps integer;
  required_constraint text;
BEGIN
  IF current_setting('server_version_num')::integer < 170000
     OR current_setting('server_version_num')::integer >= 180000 THEN
    RAISE EXCEPTION 'CF01 requires PostgreSQL 17.x; found %', current_setting('server_version');
  END IF;
  IF current_setting('server_encoding') <> 'UTF8' THEN
    RAISE EXCEPTION 'CF01 requires UTF8 server encoding; found %', current_setting('server_encoding');
  END IF;
  IF current_setting('TimeZone') <> 'UTC' THEN
    RAISE EXCEPTION 'CF01 requires UTC session time zone; found %', current_setting('TimeZone');
  END IF;

  SELECT count(*) INTO table_total
    FROM information_schema.tables
   WHERE table_schema = 'appts' AND table_type = 'BASE TABLE';
  IF table_total <> 117 THEN
    RAISE EXCEPTION 'expected 117 CF01/DG04 tables; found %', table_total;
  END IF;

  SELECT count(*) INTO primary_key_total
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
   WHERE n.nspname = 'appts' AND c.contype = 'p';
  IF primary_key_total <> 117 THEN
    RAISE EXCEPTION 'expected one primary key per CF01/DG04 table; found %', primary_key_total;
  END IF;

  SELECT count(*) INTO unexpected_defaults
    FROM information_schema.columns
   WHERE table_schema = 'appts'
     AND column_default IS NOT NULL
     AND column_default !~ '^gen_random_uuid\(\)$';
  IF unexpected_defaults <> 0 THEN
    RAISE EXCEPTION 'semantic defaults are forbidden; found % unexpected defaults', unexpected_defaults;
  END IF;

  SELECT count(*) INTO naive_timestamps
    FROM information_schema.columns
   WHERE table_schema = 'appts' AND data_type = 'timestamp without time zone';
  IF naive_timestamps <> 0 THEN
    RAISE EXCEPTION 'timestamp without time zone is forbidden; found %', naive_timestamps;
  END IF;

  FOREACH required_constraint IN ARRAY ARRAY[
    'ck_interaction_journal__state',
    'ck_interaction_journal__attempt_count_nonnegative',
    'ck_diagnostic_error_event__effect_status',
    'ck_diagnostic_error_event__root_cause',
    'ck_diagnostic_event_subject__subject_branch',
    'uq_idempotency_ledger__owner_key'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE n.nspname = 'appts' AND c.conname = required_constraint
    ) THEN
      RAISE EXCEPTION 'missing required constraint %', required_constraint;
    END IF;
  END LOOP;
END
$$;

ROLLBACK;
