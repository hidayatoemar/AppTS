-- MCR-to-CODEX-071 / ARC-to-MCR-013
-- RESTORE_SERVICE accepted Entity-axis bounded successor migration.
-- Historical rows remain explicitly unbound (NULL); no Entity is inferred or backfilled.
SET TIME ZONE 'UTC';
SET search_path = appts, pg_catalog;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='appts' AND c.relname='ticket_identity')
     OR NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='appts' AND c.relname='runtime_ticket')
     OR NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='appts' AND c.relname='action_intent') THEN
    RAISE EXCEPTION 'MCR071 V005 STOP: exact V001-V004 predecessor schema is not present.';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='appts' AND table_name='ticket_identity' AND column_name='entity_ref') THEN
    RAISE EXCEPTION 'MCR071 V005 STOP: Entity axis already present; migration must not be re-applied or substituted.';
  END IF;
END $$;

-- D-01: immutable ticket identity/formation gains an orthogonal Entity reference.
ALTER TABLE appts.ticket_identity ADD COLUMN entity_ref text COLLATE "C" NULL;
ALTER TABLE appts.ticket_formation_record ADD COLUMN entity_ref text COLLATE "C" NULL;
ALTER TABLE appts.ticket_identity ADD CONSTRAINT ck_ticket_identity__entity_ref_nonblank CHECK (entity_ref IS NULL OR btrim(entity_ref) <> '');
ALTER TABLE appts.ticket_formation_record ADD CONSTRAINT ck_ticket_formation_record__entity_ref_nonblank CHECK (entity_ref IS NULL OR btrim(entity_ref) <> '');

-- D-02: Assignment/Responsibility/Authority preserve explicit Entity and authority basis.
ALTER TABLE appts.assignment_snapshot
  ADD COLUMN entity_ref text COLLATE "C" NULL,
  ADD COLUMN authority_basis_ref text COLLATE "C" NULL;
ALTER TABLE appts.assignment_snapshot ADD CONSTRAINT ck_assignment_snapshot__entity_basis_pair
  CHECK (num_nonnulls(entity_ref, authority_basis_ref) IN (0,2));
ALTER TABLE appts.assignment_snapshot ADD CONSTRAINT ck_assignment_snapshot__entity_ref_nonblank CHECK (entity_ref IS NULL OR btrim(entity_ref) <> '');
ALTER TABLE appts.assignment_snapshot ADD CONSTRAINT ck_assignment_snapshot__authority_basis_nonblank CHECK (authority_basis_ref IS NULL OR btrim(authority_basis_ref) <> '');

ALTER TABLE appts.responsible_assignment ADD COLUMN entity_ref text COLLATE "C" NULL;
ALTER TABLE appts.responsible_assignment ADD CONSTRAINT ck_responsible_assignment__entity_ref_nonblank CHECK (entity_ref IS NULL OR btrim(entity_ref) <> '');

ALTER TABLE appts.authority_envelope
  ADD COLUMN entity_ref text COLLATE "C" NULL,
  ADD COLUMN acting_holder_ref text COLLATE "C" NULL,
  ADD COLUMN acting_role_instance_ref text COLLATE "C" NULL,
  ADD COLUMN acting_assignment_ref text COLLATE "C" NULL,
  ADD COLUMN authority_basis_ref text COLLATE "C" NULL;
ALTER TABLE appts.authority_envelope ADD CONSTRAINT ck_authority_envelope__entity_authority_attribution
  CHECK (num_nonnulls(entity_ref, acting_holder_ref, acting_role_instance_ref, acting_assignment_ref, authority_basis_ref) IN (0,5));
ALTER TABLE appts.authority_envelope ADD CONSTRAINT ck_authority_envelope__entity_ref_nonblank CHECK (entity_ref IS NULL OR btrim(entity_ref) <> '');

-- D-03: materially attributable evidence and gate decisions preserve the same explicit authority tuple.
ALTER TABLE appts.evidence_object
  ADD COLUMN entity_ref text COLLATE "C" NULL,
  ADD COLUMN acting_holder_ref text COLLATE "C" NULL,
  ADD COLUMN acting_role_instance_ref text COLLATE "C" NULL,
  ADD COLUMN acting_assignment_ref text COLLATE "C" NULL,
  ADD COLUMN authority_basis_ref text COLLATE "C" NULL;
ALTER TABLE appts.evidence_object ADD CONSTRAINT ck_evidence_object__entity_authority_attribution
  CHECK (num_nonnulls(entity_ref, acting_holder_ref, acting_role_instance_ref, acting_assignment_ref, authority_basis_ref) IN (0,5));
ALTER TABLE appts.evidence_object ADD CONSTRAINT ck_evidence_object__entity_ref_nonblank CHECK (entity_ref IS NULL OR btrim(entity_ref) <> '');

ALTER TABLE appts.gate_evaluation
  ADD COLUMN entity_ref text COLLATE "C" NULL,
  ADD COLUMN acting_holder_ref text COLLATE "C" NULL,
  ADD COLUMN acting_role_instance_ref text COLLATE "C" NULL,
  ADD COLUMN acting_assignment_ref text COLLATE "C" NULL,
  ADD COLUMN authority_basis_ref text COLLATE "C" NULL;
ALTER TABLE appts.gate_evaluation ADD CONSTRAINT ck_gate_evaluation__entity_authority_attribution
  CHECK (num_nonnulls(entity_ref, acting_holder_ref, acting_role_instance_ref, acting_assignment_ref, authority_basis_ref) IN (0,5));
ALTER TABLE appts.gate_evaluation ADD CONSTRAINT ck_gate_evaluation__entity_ref_nonblank CHECK (entity_ref IS NULL OR btrim(entity_ref) <> '');

-- D-04: runtime identity and projections retain Entity; historical rows remain NULL/unbound.
ALTER TABLE appts.runtime_ticket ADD COLUMN entity_ref text COLLATE "C" NULL;
ALTER TABLE appts.runtime_context ADD COLUMN entity_ref text COLLATE "C" NULL;
ALTER TABLE appts.authority_projection ADD COLUMN entity_ref text COLLATE "C" NULL;
ALTER TABLE appts.gate_projection ADD COLUMN entity_ref text COLLATE "C" NULL;
ALTER TABLE appts.runtime_ticket ADD CONSTRAINT ck_runtime_ticket__entity_ref_nonblank CHECK (entity_ref IS NULL OR btrim(entity_ref) <> '');
ALTER TABLE appts.runtime_context ADD CONSTRAINT ck_runtime_context__entity_ref_nonblank CHECK (entity_ref IS NULL OR btrim(entity_ref) <> '');
ALTER TABLE appts.authority_projection ADD CONSTRAINT ck_authority_projection__entity_ref_nonblank CHECK (entity_ref IS NULL OR btrim(entity_ref) <> '');
ALTER TABLE appts.gate_projection ADD CONSTRAINT ck_gate_projection__entity_ref_nonblank CHECK (entity_ref IS NULL OR btrim(entity_ref) <> '');

-- Material command/effect/audit lineage. The tuple is either wholly absent (legacy/unbound) or wholly explicit.
ALTER TABLE appts.lifecycle_effect_request
  ADD COLUMN entity_ref text COLLATE "C" NULL,
  ADD COLUMN acting_holder_ref text COLLATE "C" NULL,
  ADD COLUMN acting_role_instance_ref text COLLATE "C" NULL,
  ADD COLUMN acting_assignment_ref text COLLATE "C" NULL,
  ADD COLUMN authority_basis_ref text COLLATE "C" NULL;
ALTER TABLE appts.lifecycle_effect_request ADD CONSTRAINT ck_lifecycle_effect_request__entity_authority_attribution
  CHECK (num_nonnulls(entity_ref, acting_holder_ref, acting_role_instance_ref, acting_assignment_ref, authority_basis_ref) IN (0,5));
ALTER TABLE appts.lifecycle_effect_request ADD CONSTRAINT ck_lifecycle_effect_request__entity_ref_nonblank CHECK (entity_ref IS NULL OR btrim(entity_ref) <> '');

ALTER TABLE appts.lifecycle_effect_result
  ADD COLUMN entity_ref text COLLATE "C" NULL,
  ADD COLUMN acting_holder_ref text COLLATE "C" NULL,
  ADD COLUMN acting_role_instance_ref text COLLATE "C" NULL,
  ADD COLUMN acting_assignment_ref text COLLATE "C" NULL,
  ADD COLUMN authority_basis_ref text COLLATE "C" NULL;
ALTER TABLE appts.lifecycle_effect_result ADD CONSTRAINT ck_lifecycle_effect_result__entity_authority_attribution
  CHECK (num_nonnulls(entity_ref, acting_holder_ref, acting_role_instance_ref, acting_assignment_ref, authority_basis_ref) IN (0,5));
ALTER TABLE appts.lifecycle_effect_result ADD CONSTRAINT ck_lifecycle_effect_result__entity_ref_nonblank CHECK (entity_ref IS NULL OR btrim(entity_ref) <> '');

-- D-06 material intent persistence can retain explicit context when a future controlled binding exists.
-- MCR071 does not authorize populating historical Trial aliases, therefore current legacy rows stay NULL.
ALTER TABLE appts.action_intent
  ADD COLUMN entity_ref text COLLATE "C" NULL,
  ADD COLUMN acting_holder_ref text COLLATE "C" NULL,
  ADD COLUMN acting_role_instance_ref text COLLATE "C" NULL,
  ADD COLUMN acting_assignment_ref text COLLATE "C" NULL,
  ADD COLUMN authority_basis_ref text COLLATE "C" NULL;
ALTER TABLE appts.action_intent ADD CONSTRAINT ck_action_intent__entity_authority_attribution
  CHECK (num_nonnulls(entity_ref, acting_holder_ref, acting_role_instance_ref, acting_assignment_ref, authority_basis_ref) IN (0,5));
ALTER TABLE appts.action_intent ADD CONSTRAINT ck_action_intent__entity_ref_nonblank CHECK (entity_ref IS NULL OR btrim(entity_ref) <> '');

-- Bounded lookup support. These indexes establish no precedence and create no factual mapping.
CREATE INDEX ix_mcr071_ticket_entity ON appts.ticket_identity (purpose_binding_id, primary_domain_id, entity_ref, ticket_id) WHERE entity_ref IS NOT NULL;
CREATE INDEX ix_mcr071_assignment_entity ON appts.assignment_snapshot (holder_ref, entity_ref, role_instance_ref, assignment_ref) WHERE entity_ref IS NOT NULL;
CREATE INDEX ix_mcr071_responsibility_entity ON appts.responsible_assignment (ticket_id, entity_ref, effective_to) WHERE entity_ref IS NOT NULL;
CREATE INDEX ix_mcr071_authority_entity ON appts.authority_envelope (ticket_id, entity_ref, effective_from) WHERE entity_ref IS NOT NULL;
CREATE INDEX ix_mcr071_gate_entity ON appts.gate_evaluation (ticket_id, entity_ref, evaluated_at) WHERE entity_ref IS NOT NULL;
CREATE INDEX ix_mcr071_runtime_entity ON appts.runtime_ticket (entity_ref, ticket_id) WHERE entity_ref IS NOT NULL;
CREATE INDEX ix_mcr071_effect_entity ON appts.lifecycle_effect_request (ticket_id, entity_ref, requested_at) WHERE entity_ref IS NOT NULL;
CREATE INDEX ix_mcr071_intent_entity ON appts.action_intent (ticket_id, entity_ref, intent_time) WHERE entity_ref IS NOT NULL;
