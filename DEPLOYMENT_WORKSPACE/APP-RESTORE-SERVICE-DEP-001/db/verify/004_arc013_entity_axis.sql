-- MCR-to-CODEX-071 / ARC013 Entity-axis migration verification.
-- Synthetic schema verification only; no Production/UAT/Human-Trial mapping is introduced.
SET TIME ZONE 'UTC';
SET search_path = appts, pg_catalog;

DO $$
DECLARE
  missing_count integer;
  nonnullable_or_defaulted integer;
  missing_constraints integer;
  missing_indexes integer;
BEGIN
  WITH required(table_name,column_name) AS (VALUES
    ('ticket_identity','entity_ref'),
    ('ticket_formation_record','entity_ref'),
    ('assignment_snapshot','entity_ref'),('assignment_snapshot','authority_basis_ref'),
    ('responsible_assignment','entity_ref'),
    ('authority_envelope','entity_ref'),('authority_envelope','acting_holder_ref'),('authority_envelope','acting_role_instance_ref'),('authority_envelope','acting_assignment_ref'),('authority_envelope','authority_basis_ref'),
    ('evidence_object','entity_ref'),('evidence_object','acting_holder_ref'),('evidence_object','acting_role_instance_ref'),('evidence_object','acting_assignment_ref'),('evidence_object','authority_basis_ref'),
    ('gate_evaluation','entity_ref'),('gate_evaluation','acting_holder_ref'),('gate_evaluation','acting_role_instance_ref'),('gate_evaluation','acting_assignment_ref'),('gate_evaluation','authority_basis_ref'),
    ('runtime_ticket','entity_ref'),('runtime_context','entity_ref'),('authority_projection','entity_ref'),('gate_projection','entity_ref'),
    ('lifecycle_effect_request','entity_ref'),('lifecycle_effect_request','acting_holder_ref'),('lifecycle_effect_request','acting_role_instance_ref'),('lifecycle_effect_request','acting_assignment_ref'),('lifecycle_effect_request','authority_basis_ref'),
    ('lifecycle_effect_result','entity_ref'),('lifecycle_effect_result','acting_holder_ref'),('lifecycle_effect_result','acting_role_instance_ref'),('lifecycle_effect_result','acting_assignment_ref'),('lifecycle_effect_result','authority_basis_ref'),
    ('action_intent','entity_ref'),('action_intent','acting_holder_ref'),('action_intent','acting_role_instance_ref'),('action_intent','acting_assignment_ref'),('action_intent','authority_basis_ref')
  )
  SELECT count(*) INTO missing_count
  FROM required r
  LEFT JOIN information_schema.columns c ON c.table_schema='appts' AND c.table_name=r.table_name AND c.column_name=r.column_name
  WHERE c.column_name IS NULL;
  IF missing_count <> 0 THEN RAISE EXCEPTION 'MCR071 Entity verification: % required columns missing', missing_count; END IF;

  WITH compatibility(table_name,column_name) AS (VALUES
    ('ticket_identity','entity_ref'),('ticket_formation_record','entity_ref'),('assignment_snapshot','entity_ref'),('assignment_snapshot','authority_basis_ref'),('responsible_assignment','entity_ref'),
    ('authority_envelope','entity_ref'),('authority_envelope','acting_holder_ref'),('authority_envelope','acting_role_instance_ref'),('authority_envelope','acting_assignment_ref'),('authority_envelope','authority_basis_ref'),
    ('evidence_object','entity_ref'),('evidence_object','acting_holder_ref'),('evidence_object','acting_role_instance_ref'),('evidence_object','acting_assignment_ref'),('evidence_object','authority_basis_ref'),
    ('gate_evaluation','entity_ref'),('gate_evaluation','acting_holder_ref'),('gate_evaluation','acting_role_instance_ref'),('gate_evaluation','acting_assignment_ref'),('gate_evaluation','authority_basis_ref'),
    ('runtime_ticket','entity_ref'),('runtime_context','entity_ref'),('authority_projection','entity_ref'),('gate_projection','entity_ref'),
    ('lifecycle_effect_request','entity_ref'),('lifecycle_effect_request','acting_holder_ref'),('lifecycle_effect_request','acting_role_instance_ref'),('lifecycle_effect_request','acting_assignment_ref'),('lifecycle_effect_request','authority_basis_ref'),
    ('lifecycle_effect_result','entity_ref'),('lifecycle_effect_result','acting_holder_ref'),('lifecycle_effect_result','acting_role_instance_ref'),('lifecycle_effect_result','acting_assignment_ref'),('lifecycle_effect_result','authority_basis_ref'),
    ('action_intent','entity_ref'),('action_intent','acting_holder_ref'),('action_intent','acting_role_instance_ref'),('action_intent','acting_assignment_ref'),('action_intent','authority_basis_ref')
  )
  SELECT count(*) INTO nonnullable_or_defaulted
  FROM compatibility r JOIN information_schema.columns c ON c.table_schema='appts' AND c.table_name=r.table_name AND c.column_name=r.column_name
  WHERE c.is_nullable <> 'YES' OR c.column_default IS NOT NULL;
  IF nonnullable_or_defaulted <> 0 THEN RAISE EXCEPTION 'MCR071 compatibility violation: % Entity columns are non-null/defaulted', nonnullable_or_defaulted; END IF;

  WITH required(name) AS (VALUES
    ('ck_assignment_snapshot__entity_basis_pair'),
    ('ck_authority_envelope__entity_authority_attribution'),
    ('ck_evidence_object__entity_authority_attribution'),
    ('ck_gate_evaluation__entity_authority_attribution'),
    ('ck_lifecycle_effect_request__entity_authority_attribution'),
    ('ck_lifecycle_effect_result__entity_authority_attribution'),
    ('ck_action_intent__entity_authority_attribution')
  )
  SELECT count(*) INTO missing_constraints FROM required r LEFT JOIN pg_constraint c ON c.conname=r.name WHERE c.oid IS NULL;
  IF missing_constraints <> 0 THEN RAISE EXCEPTION 'MCR071 Entity verification: % attribution constraints missing', missing_constraints; END IF;

  WITH required(name) AS (VALUES
    ('ix_mcr071_ticket_entity'),('ix_mcr071_assignment_entity'),('ix_mcr071_responsibility_entity'),('ix_mcr071_authority_entity'),('ix_mcr071_gate_entity'),('ix_mcr071_runtime_entity'),('ix_mcr071_effect_entity'),('ix_mcr071_intent_entity')
  )
  SELECT count(*) INTO missing_indexes FROM required r LEFT JOIN pg_class c ON c.relname=r.name AND c.relkind='i' WHERE c.oid IS NULL;
  IF missing_indexes <> 0 THEN RAISE EXCEPTION 'MCR071 Entity verification: % bounded lookup indexes missing', missing_indexes; END IF;
END $$;

SELECT 'PASS: MCR071 ARC013 Entity-axis schema, compatibility posture, constraints and indexes verified' AS result;
