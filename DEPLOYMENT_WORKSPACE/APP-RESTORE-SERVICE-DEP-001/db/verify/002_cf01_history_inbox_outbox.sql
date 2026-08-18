\set ON_ERROR_STOP on

BEGIN;

DO $$
DECLARE
  append_only_trigger_total integer;
  required_relation text;
  required_index text;
BEGIN
  SELECT count(*) INTO append_only_trigger_total
    FROM pg_trigger t
    JOIN pg_class r ON r.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = r.relnamespace
   WHERE n.nspname = 'appts'
     AND NOT t.tgisinternal
     AND t.tgname LIKE 'trg_%__append_only';
  IF append_only_trigger_total <> 93 THEN
    RAISE EXCEPTION 'expected 93 append-only guards; found %', append_only_trigger_total;
  END IF;

  FOREACH required_relation IN ARRAY ARRAY[
    'idempotency_ledger', 'inbox_entry', 'outbox_entry',
    'audit_event', 'access_audit', 'runtime_state_transition',
    'interaction_journal', 'operational_view_projection'
  ] LOOP
    IF to_regclass('appts.' || required_relation) IS NULL THEN
      RAISE EXCEPTION 'missing history/exchange relation appts.%', required_relation;
    END IF;
  END LOOP;

  FOREACH required_index IN ARRAY ARRAY[
    'uq_idempotency_ledger__owner_key',
    'uq_inbox_entry__message_identity',
    'ix_outbox_entry__pending',
    'ix_outbox_entry__commit',
    'ix_inbox_entry__correlation'
  ] LOOP
    IF to_regclass('appts.' || required_index) IS NULL THEN
      RAISE EXCEPTION 'missing inbox/outbox/idempotency index appts.%', required_index;
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class r ON r.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = r.relnamespace
    WHERE n.nspname = 'appts' AND r.relname = 'outbox_entry'
      AND NOT t.tgisinternal AND t.tgname LIKE 'trg_%__append_only'
  ) THEN
    RAISE EXCEPTION 'mutable outbox projection must not use append-only guard';
  END IF;
END
$$;

ROLLBACK;
