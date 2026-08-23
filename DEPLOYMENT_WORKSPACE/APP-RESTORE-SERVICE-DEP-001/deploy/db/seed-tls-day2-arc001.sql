-- MCR-to-CODEX-055 / ARC-to-MCR-001 controlled TLS Day-2 Trial binding.
-- Static non-production configuration only. MUST run under migration/deployment identity.
-- It MUST NOT be run as appts_runtime and MUST NOT create Ticket or lifecycle business state.
SET TIME ZONE 'UTC';
SET search_path = appts, pg_catalog;

DO $$
BEGIN
  IF current_user = 'appts_runtime' THEN
    RAISE EXCEPTION 'TLS-DAY2 STOP: ARC001 static Trial binding seed must not run as appts_runtime';
  END IF;
END $$;

-- ARC symbolic source SIM-NMS-RS-TLS-D2-01 and adapter SIM-RS-QER-PROFILE-V1.
INSERT INTO appts.source_ref(
  source_ref_id, source_identity, source_owner_ref, source_class_ref,
  authoritative_scope_ref, authoritative_scope_ref_schema_version, effective_from
) VALUES (
  '52010000-0000-4000-8000-000000000001',
  'SIM-NMS-RS-TLS-D2-01', 'ARC001-TLS-D2-TRIAL', 'CONTROLLED_SIMULATED_EXTERNAL_SOURCE',
  '{"scenario":"TLS-D2-RS-SCN-01","purpose":"RESTORE_SERVICE","environment":"NON_PRODUCTION_TRIAL","subject":"TRIAL-RS-SERVICE-001"}'::jsonb,
  '1.0.0', '2026-08-23T00:00:00Z'
) ON CONFLICT (source_ref_id) DO NOTHING;

INSERT INTO appts.source_version_ref(
  source_version_ref_id, source_ref_id, source_version_identity,
  retrieved_at, effective_from, currentness_ref
) VALUES (
  '52010000-0000-4000-8000-000000000002',
  '52010000-0000-4000-8000-000000000001',
  'SIM-NMS-RS-TLS-D2-01:v1',
  '2026-08-23T00:00:00Z', '2026-08-23T00:00:00Z', 'CURRENT'
) ON CONFLICT (source_version_ref_id) DO NOTHING;

INSERT INTO appts.authoritative_source_ref(
  source_system_ref_id, source_identity, source_version_or_profile_ref,
  authoritative_subject_class_ref, owner_ref, currentness_ref, effective_from
) VALUES (
  '52010000-0000-4000-8000-000000000003',
  'SIM-NMS-RS-TLS-D2-01', 'SIM-RS-QER-PROFILE-V1',
  'SERVICE_RESTORATION_INDICATION', 'ARC001-TLS-D2-TRIAL', 'CURRENT',
  '2026-08-23T00:00:00Z'
) ON CONFLICT (source_system_ref_id) DO NOTHING;

INSERT INTO appts.adapter_profile_ref(
  adapter_profile_ref_id, source_system_ref_id, adapter_profile_identity,
  adapter_profile_version, qualification_rules_ref, effective_from
) VALUES (
  '52010000-0000-4000-8000-000000000004',
  '52010000-0000-4000-8000-000000000003',
  'SIM-RS-QER-PROFILE-V1', 1,
  '52010000-0000-4000-8000-000000000005',
  '2026-08-23T00:00:00Z'
) ON CONFLICT (adapter_profile_ref_id) DO NOTHING;

-- Responsible Role A is deliberately mapped to the already-current Day-1 opaque
-- assignment so Day-2 initialization does not manufacture a responsibility transfer:
-- TRIAL-RS-RESPONSIBLE-ROLE-01 -> role 5101...0009
-- TRIAL-HOLDER-OPS-A            -> holder 5101...000a
-- assignment                    -> 5101...000b / snapshot 5101...0006

-- Independent Verification Role B.
INSERT INTO appts.assignment_snapshot(
  record_version, purpose_binding_id, source_ref_id, observed_at, received_at, committed_at,
  disclosure_label_ref, assignment_snapshot_id, role_type_ref, role_instance_ref, holder_ref,
  assignment_ref, source_version_ref_id, scope_ref_json, scope_ref_json_schema_version,
  domain_id, eligible_from, qualification_ref, retrieved_at, verified_at
) VALUES (
  1, '51010000-0000-4000-8000-000000000005', '52010000-0000-4000-8000-000000000001',
  '2026-08-23T00:00:00Z','2026-08-23T00:00:00Z','2026-08-23T00:00:00Z',
  '6f79da70-412f-469e-bcf7-f544f81b8aa7',
  '52010000-0000-4000-8000-000000000014', '52010000-0000-4000-8000-000000000010',
  '52010000-0000-4000-8000-000000000011', '52010000-0000-4000-8000-000000000012',
  '52010000-0000-4000-8000-000000000013', '52010000-0000-4000-8000-000000000002',
  '{"scenario":"TLS-D2-RS-SCN-01","role":"TRIAL-RS-VERIFICATION-ROLE-01","holder":"TRIAL-HOLDER-VERIFY-B","capacity":"Verification"}'::jsonb,
  '1.0.0', '51010000-0000-4000-8000-000000000007', '2026-08-23T00:00:00Z',
  '51010000-0000-4000-8000-00000000000d', '2026-08-23T00:00:00Z','2026-08-23T00:00:00Z'
) ON CONFLICT (assignment_snapshot_id) DO NOTHING;

-- Terminal Disposition Authority Role C.
INSERT INTO appts.assignment_snapshot(
  record_version, purpose_binding_id, source_ref_id, observed_at, received_at, committed_at,
  disclosure_label_ref, assignment_snapshot_id, role_type_ref, role_instance_ref, holder_ref,
  assignment_ref, source_version_ref_id, scope_ref_json, scope_ref_json_schema_version,
  domain_id, eligible_from, qualification_ref, retrieved_at, verified_at
) VALUES (
  1, '51010000-0000-4000-8000-000000000005', '52010000-0000-4000-8000-000000000001',
  '2026-08-23T00:00:00Z','2026-08-23T00:00:00Z','2026-08-23T00:00:00Z',
  '6f79da70-412f-469e-bcf7-f544f81b8aa7',
  '52010000-0000-4000-8000-000000000024', '52010000-0000-4000-8000-000000000020',
  '52010000-0000-4000-8000-000000000021', '52010000-0000-4000-8000-000000000022',
  '52010000-0000-4000-8000-000000000023', '52010000-0000-4000-8000-000000000002',
  '{"scenario":"TLS-D2-RS-SCN-01","role":"TRIAL-RS-TERMINAL-DISPOSITION-ROLE-01","holder":"TRIAL-HOLDER-DISP-C","capacity":"Terminal Disposition Authority"}'::jsonb,
  '1.0.0', '51010000-0000-4000-8000-000000000007', '2026-08-23T00:00:00Z',
  '51010000-0000-4000-8000-00000000000d', '2026-08-23T00:00:00Z','2026-08-23T00:00:00Z'
) ON CONFLICT (assignment_snapshot_id) DO NOTHING;

-- Closure Authority readiness Role D. No CLOSE action is created by this seed.
INSERT INTO appts.assignment_snapshot(
  record_version, purpose_binding_id, source_ref_id, observed_at, received_at, committed_at,
  disclosure_label_ref, assignment_snapshot_id, role_type_ref, role_instance_ref, holder_ref,
  assignment_ref, source_version_ref_id, scope_ref_json, scope_ref_json_schema_version,
  domain_id, eligible_from, qualification_ref, retrieved_at, verified_at
) VALUES (
  1, '51010000-0000-4000-8000-000000000005', '52010000-0000-4000-8000-000000000001',
  '2026-08-23T00:00:00Z','2026-08-23T00:00:00Z','2026-08-23T00:00:00Z',
  '6f79da70-412f-469e-bcf7-f544f81b8aa7',
  '52010000-0000-4000-8000-000000000034', '52010000-0000-4000-8000-000000000030',
  '52010000-0000-4000-8000-000000000031', '52010000-0000-4000-8000-000000000032',
  '52010000-0000-4000-8000-000000000033', '52010000-0000-4000-8000-000000000002',
  '{"scenario":"TLS-D2-RS-SCN-01","role":"TRIAL-RS-CLOSURE-AUTHORITY-ROLE-01","holder":"TRIAL-HOLDER-CLOSE-D","capacity":"Closure Authority readiness","day2_close_action":"WITHHELD"}'::jsonb,
  '1.0.0', '51010000-0000-4000-8000-000000000007', '2026-08-23T00:00:00Z',
  '51010000-0000-4000-8000-00000000000d', '2026-08-23T00:00:00Z','2026-08-23T00:00:00Z'
) ON CONFLICT (assignment_snapshot_id) DO NOTHING;
