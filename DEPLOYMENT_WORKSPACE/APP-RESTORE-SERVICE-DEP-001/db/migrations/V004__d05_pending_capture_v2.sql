-- MCR-006 / D-05 Pending Capture Physical Persistence (PC-MIG-01)
-- Authority: MCR-to-BUILDER-006 / DS-A011 (READY/ACCEPTED)
-- Addendum: AppTS_RESTORE_SERVICE_CF01_D05_Pending_Capture_Persistence_Addendum_v0.1_WD
-- Scope: T118 new; T74 amended +10 cols; T119 new; T76 amended +17 cols
--        PC-C01..PC-C21 | PC-IX01..PC-IX11 | PC-TX-01..PC-TX-07 (app-enforced) | PC-MIG-01

SET TIME ZONE 'UTC';
SET search_path = appts, pg_catalog;

-- ─────────────────────────────────────────────────────────────────────────────
-- PC-MIG-01 Step 1: accepted schema identity and engine precheck
-- ─────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'appts' AND c.relname = 'pending_capture'
  ) THEN
    RAISE EXCEPTION 'PC-MIG-01 STOP: T74 pending_capture not found; V001–V003 must precede V004.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'appts' AND c.relname = 'provisional_capture_payload_resource'
  ) THEN
    RAISE EXCEPTION 'PC-MIG-01 STOP: T118 provisional_capture_payload_resource already exists; V004 must not be re-applied.';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- PC-MIG-01 Step 2: row-presence precheck (PC-V19: fail closed, no backfill)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM appts.pending_capture LIMIT 1) THEN
    RAISE EXCEPTION 'PC-MIG-01 STOP: T74 pending_capture has existing rows without authoritative new-field values. '
                    'Migration must STOP for controlled lineage/backfill disposition per PC-MIG-01 §8. '
                    'NULL/default/placeholder backfill is prohibited.';
  END IF;
  IF EXISTS (SELECT 1 FROM appts.sync_result LIMIT 1) THEN
    RAISE EXCEPTION 'PC-MIG-01 STOP: T76 sync_result has existing rows. '
                    'Migration must STOP for controlled lineage/backfill disposition per PC-MIG-01 §8.';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- PC-MIG-01 Step 3a: Create T118 provisional_capture_payload_resource (Owner D-05)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE appts.provisional_capture_payload_resource (
  provisional_payload_ref                uuid            NOT NULL,
  representation_kind                    text COLLATE "C" NOT NULL,
  inline_content                         jsonb           NULL,
  durable_reference                      text COLLATE "C" NULL,
  payload_hash                           bytea           NOT NULL,
  payload_representation_profile_ref     text COLLATE "C" NULL,
  payload_representation_version         text COLLATE "C" NULL,
  integrity_envelope_id                  uuid            NULL,
  resource_committed_at                  timestamptz(3)  NOT NULL,
  CONSTRAINT pk_provisional_capture_payload_resource
    PRIMARY KEY (provisional_payload_ref),
  -- accepted v1.0 representation_kind values
  CONSTRAINT ck_t118__representation_kind
    CHECK (representation_kind IN ('INLINE_STRUCT', 'DURABLE_REFERENCE')),
  -- PC-C01: exactly one content branch populated
  CONSTRAINT ck_t118__content_branch CHECK (
    (representation_kind = 'INLINE_STRUCT'
       AND inline_content IS NOT NULL
       AND durable_reference IS NULL)
    OR
    (representation_kind = 'DURABLE_REFERENCE'
       AND durable_reference IS NOT NULL
       AND inline_content IS NULL)
  ),
  -- PC-C02: representation_version requires profile
  CONSTRAINT ck_t118__version_requires_profile CHECK (
    payload_representation_version IS NULL
    OR payload_representation_profile_ref IS NOT NULL
  )
  -- PC-C04: payload_hash verified by application before durable acceptance (runtime rule)
  -- PC-C05: no FK to T03/T25/T72 — enforced by schema absence of such columns
);

-- PC-C03: T118 is immutable after durable acceptance (append-only)
CREATE TRIGGER trg_provisional_capture_payload_resource__append_only
  BEFORE UPDATE OR DELETE ON appts.provisional_capture_payload_resource
  FOR EACH ROW EXECUTE FUNCTION appts.reject_canonical_mutation();

-- ─────────────────────────────────────────────────────────────────────────────
-- PC-MIG-01 Step 3b: Create T119 pending_capture_idempotency_binding (Owner D-05)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE appts.pending_capture_idempotency_binding (
  idempotency_binding_id  uuid           DEFAULT gen_random_uuid() NOT NULL,
  producer_ref            text COLLATE "C"                         NOT NULL,
  device_context_ref      uuid                                     NOT NULL,
  idempotency_key         uuid                                     NOT NULL,
  client_capture_id       uuid                                     NOT NULL,
  pending_capture_id      uuid                                     NOT NULL,
  provisional_payload_ref uuid                                     NOT NULL,
  durable_result_ref      uuid                                     NOT NULL,
  first_message_id        uuid                                     NOT NULL,
  correlation_id          uuid                                     NOT NULL,
  bound_at                timestamptz(3)                           NOT NULL,
  CONSTRAINT pk_pending_capture_idempotency_binding
    PRIMARY KEY (idempotency_binding_id),
  -- PC-C10: one durable binding per producer/device/idempotency_key (PC-IX05 implicit)
  CONSTRAINT uq_t119__producer_device_idempotency
    UNIQUE (producer_ref, device_context_ref, idempotency_key)
  -- PC-C11: pending_capture_id must match T74 producer/device/client_capture_id — app-enforced
  -- PC-C12: provisional_payload_ref must equal T74.provisional_payload_ref — app-enforced
  -- PC-C13: additional bindings require identical material fields — app-enforced
);

-- T119 immutability
CREATE TRIGGER trg_pending_capture_idempotency_binding__append_only
  BEFORE UPDATE OR DELETE ON appts.pending_capture_idempotency_binding
  FOR EACH ROW EXECUTE FUNCTION appts.reject_canonical_mutation();

-- ─────────────────────────────────────────────────────────────────────────────
-- PC-MIG-01 Step 4: Amend T74 pending_capture (+10 columns)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE appts.pending_capture
  ADD COLUMN producer_ref                       text    COLLATE "C" NOT NULL,
  ADD COLUMN client_capture_id                  uuid                NOT NULL,
  ADD COLUMN device_context_ref                 uuid                NOT NULL,
  ADD COLUMN local_sequence                     bigint              NOT NULL,
  ADD COLUMN capture_kind_ref                   text    COLLATE "C" NOT NULL,
  ADD COLUMN capture_time_source_offset_minutes smallint            NULL,
  ADD COLUMN time_confidence_ref                text    COLLATE "C" NOT NULL,
  ADD COLUMN authorization_snapshot_ref         uuid                NOT NULL,
  ADD COLUMN supersedes_capture_ref             uuid                NULL,
  ADD COLUMN predecessor_pending_capture_id     uuid                NULL;

-- PC-C06: one durable pending item per accepted client capture in its producing context (PC-IX01 implicit)
ALTER TABLE appts.pending_capture
  ADD CONSTRAINT uq_t74__producer_device_client_capture
    UNIQUE (producer_ref, device_context_ref, client_capture_id);

-- PC-C07: local_sequence non-negative
ALTER TABLE appts.pending_capture
  ADD CONSTRAINT ck_t74__local_sequence_nonnegative
    CHECK (local_sequence >= 0);

-- PC-C08: correction self-referential guard
ALTER TABLE appts.pending_capture
  ADD CONSTRAINT ck_t74__predecessor_not_self CHECK (
    predecessor_pending_capture_id IS NULL
    OR predecessor_pending_capture_id <> pending_capture_id
  );

-- accepted v1.0 capture_kind_ref values (provisional classes only, not canonical T03/T25)
ALTER TABLE appts.pending_capture
  ADD CONSTRAINT ck_t74__capture_kind_ref
    CHECK (capture_kind_ref IN ('OBSERVATION', 'DRAFT_EVIDENCE'));

-- source offset range per accepted CF-01 CK-OFFSET rule (UTC-12 to UTC+14 in minutes)
ALTER TABLE appts.pending_capture
  ADD CONSTRAINT ck_t74__source_offset_range CHECK (
    capture_time_source_offset_minutes IS NULL
    OR (capture_time_source_offset_minutes BETWEEN -720 AND 840)
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- PC-MIG-01 Step 6: T74.provisional_payload_ref → T118 FK + UNIQUE
-- ─────────────────────────────────────────────────────────────────────────────
-- One T74 pending capture binds exactly one T118 resource (PC-IX03 implicit via UNIQUE)
ALTER TABLE appts.pending_capture
  ADD CONSTRAINT uq_t74__provisional_payload_ref
    UNIQUE (provisional_payload_ref);

ALTER TABLE appts.pending_capture
  ADD CONSTRAINT fk_t74__provisional_payload_ref__t118
    FOREIGN KEY (provisional_payload_ref)
    REFERENCES appts.provisional_capture_payload_resource (provisional_payload_ref)
    ON DELETE RESTRICT;

ALTER TABLE appts.pending_capture
  ADD CONSTRAINT fk_t74__predecessor_pending_capture_id__t74
    FOREIGN KEY (predecessor_pending_capture_id)
    REFERENCES appts.pending_capture (pending_capture_id)
    ON DELETE RESTRICT;

-- ─────────────────────────────────────────────────────────────────────────────
-- PC-MIG-01 Step 5: Amend T76 sync_result (+17 columns)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE appts.sync_result
  ADD COLUMN result_phase_ref              text    COLLATE "C"  NULL,
  ADD COLUMN client_capture_id             uuid                 NULL,
  ADD COLUMN pending_capture_id            uuid                 NULL,
  ADD COLUMN provisional_payload_ref       uuid                 NULL,
  ADD COLUMN acceptance_code               text    COLLATE "C"  NULL,
  ADD COLUMN pending_disposition_code      text    COLLATE "C"  NULL,
  ADD COLUMN replay_disposition_code       text    COLLATE "C"  NULL,
  ADD COLUMN semantic_scope_code           text    COLLATE "C"  NULL,
  ADD COLUMN final_effect_asserted         boolean              NULL,
  ADD COLUMN outcome_code                  text    COLLATE "C"  NULL,
  ADD COLUMN outcome_reason_code           text    COLLATE "C"  NULL,
  ADD COLUMN downstream_result_class_ref   text    COLLATE "C"  NULL,
  ADD COLUMN downstream_result_ref         text    COLLATE "C"  NULL,
  ADD COLUMN reconciliation_case_id        uuid                 NULL,
  ADD COLUMN successor_pending_capture_id  uuid                 NULL,
  ADD COLUMN source_currentness_ref        text    COLLATE "C"  NULL,
  ADD COLUMN outcome_at                    timestamptz(3)       NULL;

-- T76 specialized FKs for pending-capture path
ALTER TABLE appts.sync_result
  ADD CONSTRAINT fk_t76__pending_capture_id__t74
    FOREIGN KEY (pending_capture_id)
    REFERENCES appts.pending_capture (pending_capture_id)
    ON DELETE RESTRICT;

ALTER TABLE appts.sync_result
  ADD CONSTRAINT fk_t76__provisional_payload_ref__t118
    FOREIGN KEY (provisional_payload_ref)
    REFERENCES appts.provisional_capture_payload_resource (provisional_payload_ref)
    ON DELETE RESTRICT;

ALTER TABLE appts.sync_result
  ADD CONSTRAINT fk_t76__reconciliation_case_id__t77
    FOREIGN KEY (reconciliation_case_id)
    REFERENCES appts.reconciliation_case (reconciliation_case_id)
    ON DELETE RESTRICT;

ALTER TABLE appts.sync_result
  ADD CONSTRAINT fk_t76__successor_pending_capture_id__t74
    FOREIGN KEY (successor_pending_capture_id)
    REFERENCES appts.pending_capture (pending_capture_id)
    ON DELETE RESTRICT;

-- PC-C14: PENDING_ACCEPTED requires ACK + both pending identities + semantic scope + effect=false
ALTER TABLE appts.sync_result
  ADD CONSTRAINT ck_t76__pending_accepted_requires_ack CHECK (
    pending_disposition_code IS NULL
    OR pending_disposition_code <> 'PENDING_ACCEPTED'
    OR (
      acceptance_code = 'ACK'
      AND pending_capture_id IS NOT NULL
      AND provisional_payload_ref IS NOT NULL
      AND semantic_scope_code = 'PENDING_ONLY_NO_FINAL_SEMANTIC_SUCCESS'
      AND final_effect_asserted = false
    )
  );

-- PC-C15: PENDING_REJECTED requires NACK and no newly created pending identities
ALTER TABLE appts.sync_result
  ADD CONSTRAINT ck_t76__pending_rejected_nack CHECK (
    pending_disposition_code IS NULL
    OR pending_disposition_code <> 'PENDING_REJECTED'
    OR (
      acceptance_code = 'NACK'
      AND pending_capture_id IS NULL
      AND provisional_payload_ref IS NULL
    )
  );

-- PC-C16: PENDING_HELD requires HOLD acceptance code
ALTER TABLE appts.sync_result
  ADD CONSTRAINT ck_t76__pending_held_acceptance_code CHECK (
    pending_disposition_code IS NULL
    OR pending_disposition_code <> 'PENDING_HELD'
    OR acceptance_code = 'HOLD'
  );

-- PC-C17: PROMOTED requires downstream class and ref
ALTER TABLE appts.sync_result
  ADD CONSTRAINT ck_t76__outcome_promoted_requires_downstream CHECK (
    outcome_code IS NULL
    OR outcome_code <> 'PROMOTED'
    OR (
      downstream_result_class_ref IS NOT NULL
      AND downstream_result_ref IS NOT NULL
    )
  );

-- PC-C18: RECONCILIATION_REQUIRED requires reconciliation_case_id
ALTER TABLE appts.sync_result
  ADD CONSTRAINT ck_t76__reconciliation_required_needs_case CHECK (
    outcome_code IS NULL
    OR outcome_code <> 'RECONCILIATION_REQUIRED'
    OR reconciliation_case_id IS NOT NULL
  );

-- PC-C20: final_effect_asserted must be false when present (D-04 effect never asserted by this path)
ALTER TABLE appts.sync_result
  ADD CONSTRAINT ck_t76__final_effect_not_asserted CHECK (
    final_effect_asserted IS NULL OR final_effect_asserted = false
  );

-- PC-C21: pending_capture_id / provisional_payload_ref same-pair check — app-enforced via T74 UNIQUE FK

-- T76 accepted code enum checks
ALTER TABLE appts.sync_result
  ADD CONSTRAINT ck_t76__result_phase_ref CHECK (
    result_phase_ref IS NULL
    OR result_phase_ref IN ('PENDING_ACCEPTANCE', 'OUTCOME')
  );

ALTER TABLE appts.sync_result
  ADD CONSTRAINT ck_t76__acceptance_code CHECK (
    acceptance_code IS NULL
    OR acceptance_code IN ('ACK', 'NACK', 'HOLD')
  );

ALTER TABLE appts.sync_result
  ADD CONSTRAINT ck_t76__pending_disposition_code CHECK (
    pending_disposition_code IS NULL
    OR pending_disposition_code IN ('PENDING_ACCEPTED', 'PENDING_REJECTED', 'PENDING_HELD')
  );

ALTER TABLE appts.sync_result
  ADD CONSTRAINT ck_t76__replay_disposition_code CHECK (
    replay_disposition_code IS NULL
    OR replay_disposition_code IN (
      'NEW_DURABLE_ACCEPTANCE', 'IDENTICAL_REPLAY_REUSED',
      'NOT_DURABLY_ACCEPTED', 'CONFLICTING_REPLAY_HELD'
    )
  );

ALTER TABLE appts.sync_result
  ADD CONSTRAINT ck_t76__outcome_code CHECK (
    outcome_code IS NULL
    OR outcome_code IN (
      'QUALIFIED', 'PROMOTED', 'REJECTED', 'HELD',
      'RECONCILIATION_REQUIRED', 'CORRECTED', 'SUPERSEDED'
    )
  );

ALTER TABLE appts.sync_result
  ADD CONSTRAINT ck_t76__outcome_reason_code CHECK (
    outcome_reason_code IS NULL
    OR outcome_reason_code IN (
      'INVALID', 'UNAUTHORIZED', 'STALE', 'UNSUPPORTED',
      'SOURCE_UNAVAILABLE', 'PAYLOAD_HASH_MISMATCH',
      'UNRESOLVABLE_PAYLOAD_REFERENCE', 'UNRESOLVED_SOURCE_BINDING',
      'CONFLICTING_REPLAY', 'CAPTURE_ID_CONFLICT', 'OUT_OF_ORDER_HELD',
      'CONTRADICTION', 'OFFLINE_FINAL_EFFECT_PROHIBITED',
      'UNKNOWN_OR_MISMATCHED_PROFILE'
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- T119 FKs (established after T74 and T76 with their new constraints exist)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE appts.pending_capture_idempotency_binding
  ADD CONSTRAINT fk_t119__pending_capture_id__t74
    FOREIGN KEY (pending_capture_id)
    REFERENCES appts.pending_capture (pending_capture_id)
    ON DELETE RESTRICT;

ALTER TABLE appts.pending_capture_idempotency_binding
  ADD CONSTRAINT fk_t119__provisional_payload_ref__t118
    FOREIGN KEY (provisional_payload_ref)
    REFERENCES appts.provisional_capture_payload_resource (provisional_payload_ref)
    ON DELETE RESTRICT;

ALTER TABLE appts.pending_capture_idempotency_binding
  ADD CONSTRAINT fk_t119__durable_result_ref__t76
    FOREIGN KEY (durable_result_ref)
    REFERENCES appts.sync_result (sync_result_id)
    ON DELETE RESTRICT;

-- ─────────────────────────────────────────────────────────────────────────────
-- Indexes: PC-IX01..PC-IX11
-- PC-IX01 (T74): covered by uq_t74__producer_device_client_capture UNIQUE constraint
-- PC-IX03 (T74): covered by uq_t74__provisional_payload_ref UNIQUE constraint
-- PC-IX05 (T119): covered by uq_t119__producer_device_idempotency UNIQUE constraint
-- ─────────────────────────────────────────────────────────────────────────────

-- PC-IX02: T74 device local sequence — diagnostic lookup only; order creates no truth precedence
CREATE INDEX pc_ix02 ON appts.pending_capture (device_context_ref, local_sequence);

-- PC-IX04: T74 correction lineage traversal
CREATE INDEX pc_ix04 ON appts.pending_capture (predecessor_pending_capture_id)
  WHERE predecessor_pending_capture_id IS NOT NULL;

-- PC-IX06: T119 pending_capture_id lookup
CREATE INDEX pc_ix06 ON appts.pending_capture_idempotency_binding (pending_capture_id);

-- PC-IX07: T119 client capture + context lookup
CREATE INDEX pc_ix07 ON appts.pending_capture_idempotency_binding (client_capture_id, producer_ref, device_context_ref);

-- PC-IX08: T76 pending capture result history
CREATE INDEX pc_ix08 ON appts.sync_result (pending_capture_id, processed_at)
  WHERE pending_capture_id IS NOT NULL;

-- PC-IX09: T76 client capture result history
CREATE INDEX pc_ix09 ON appts.sync_result (client_capture_id, processed_at)
  WHERE client_capture_id IS NOT NULL;

-- PC-IX10: T76 reconciliation lookup
CREATE INDEX pc_ix10 ON appts.sync_result (reconciliation_case_id)
  WHERE reconciliation_case_id IS NOT NULL;

-- PC-IX11: T76 downstream result lookup
CREATE INDEX pc_ix11 ON appts.sync_result (downstream_result_ref)
  WHERE downstream_result_ref IS NOT NULL;
