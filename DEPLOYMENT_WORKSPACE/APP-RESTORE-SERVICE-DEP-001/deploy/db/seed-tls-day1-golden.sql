-- MCR-to-CODEX-051 / TLS Day-1 controlled non-production runtime fixture.
-- Purpose: provide static source/Purpose/Role bindings required by the accepted
-- D-01 -> D-04 Golden Path. This file MUST run under migration/deployment identity.
-- It MUST NOT be run as appts_runtime and it never inserts Ticket/runtime business state.
SET TIME ZONE 'UTC';
SET search_path = appts, pg_catalog;

DO $$
BEGIN
  IF current_user = 'appts_runtime' THEN
    RAISE EXCEPTION 'TLS-DAY1 STOP: static Trial binding seed must not run as appts_runtime';
  END IF;
END $$;

INSERT INTO appts.source_ref(
  source_ref_id, source_identity, source_owner_ref, source_class_ref,
  authoritative_scope_ref, authoritative_scope_ref_schema_version, effective_from
) VALUES (
  '51010000-0000-4000-8000-000000000001',
  'TLS-DAY1-GOLDEN-SIMULATED-EXTERNAL-SOURCE',
  'MCR-TLS-DAY1-TRIAL',
  'CONTROLLED_SIMULATOR_SOURCE',
  '{"scope":"RESTORE_SERVICE_TLS_DAY1_GOLDEN","environment":"NON_PRODUCTION_TRIAL"}'::jsonb,
  '1.0.0', '2026-08-22T00:00:00Z'
) ON CONFLICT (source_ref_id) DO NOTHING;

INSERT INTO appts.source_version_ref(
  source_version_ref_id, source_ref_id, source_version_identity,
  retrieved_at, effective_from, currentness_ref
) VALUES (
  '51010000-0000-4000-8000-000000000002',
  '51010000-0000-4000-8000-000000000001',
  'TLS-DAY1-GOLDEN-SOURCE-v1',
  '2026-08-22T00:00:00Z', '2026-08-22T00:00:00Z', 'CURRENT'
) ON CONFLICT (source_version_ref_id) DO NOTHING;

INSERT INTO appts.release_identity(
  release_identity_id, release_class_ref, identity, version,
  effective_from, status_ref
) VALUES (
  '51010000-0000-4000-8000-000000000003',
  'RESTORE_SERVICE_PACKAGE', 'APP-RESTORE-SERVICE', '1.0.0',
  '2026-08-22T00:00:00Z', 'ACTIVE_TRIAL_BINDING'
) ON CONFLICT (release_identity_id) DO NOTHING;

INSERT INTO appts.compatibility_declaration(
  compatibility_declaration_id, successor_release_ref,
  compatibility_class_ref, profile_or_access_impact_ref,
  profile_or_access_impact_ref_schema_version, declared_at, authority_ref
) VALUES (
  '51010000-0000-4000-8000-000000000004',
  '51010000-0000-4000-8000-000000000003',
  'TLS_DAY1_ACCEPTED_TRIAL_COMPATIBILITY',
  '{"scope":"TLS-DAY1-GOLDEN","product_default":false}'::jsonb,
  '1.0.0', '2026-08-22T00:00:00Z',
  '51010000-0000-4000-8000-00000000000c'
) ON CONFLICT (compatibility_declaration_id) DO NOTHING;

INSERT INTO appts.purpose_extension_binding(
  record_version, committed_at, disclosure_label_ref,
  binding_id, purpose_identity, purpose_version,
  package_identity, package_version, ticket_core_version,
  hook_contract_version, capability_declaration_ref_json,
  capability_declaration_ref_json_schema_version, extension_namespace,
  authorization_basis_ref, compatibility_declaration_id, accepted_at
) VALUES (
  1, '2026-08-22T00:00:00Z', '6f79da70-412f-469e-bcf7-f544f81b8aa7',
  '51010000-0000-4000-8000-000000000005',
  'RESTORE_SERVICE', '1.0.0',
  'APP-RESTORE-SERVICE', '1.0.0', '1.0.0', '1.0.0',
  '{"fixture":"TLS-DAY1-GOLDEN","allowed_initial_action":"ACTIVATE","product_default":false}'::jsonb,
  '1.0.0', 'appts.trial.tls-day1-golden',
  '51010000-0000-4000-8000-00000000000c',
  '51010000-0000-4000-8000-000000000004',
  '2026-08-22T00:00:00Z'
) ON CONFLICT (binding_id) DO NOTHING;

INSERT INTO appts.assignment_snapshot(
  record_version, purpose_binding_id, source_ref_id, observed_at, received_at,
  committed_at, disclosure_label_ref, assignment_snapshot_id,
  role_type_ref, role_instance_ref, holder_ref, assignment_ref,
  source_version_ref_id, scope_ref_json, scope_ref_json_schema_version,
  domain_id, eligible_from, qualification_ref, retrieved_at, verified_at
) VALUES (
  1,
  '51010000-0000-4000-8000-000000000005',
  '51010000-0000-4000-8000-000000000001',
  '2026-08-22T00:00:00Z', '2026-08-22T00:00:00Z', '2026-08-22T00:00:00Z',
  '6f79da70-412f-469e-bcf7-f544f81b8aa7',
  '51010000-0000-4000-8000-000000000006',
  '51010000-0000-4000-8000-000000000008',
  '51010000-0000-4000-8000-000000000009',
  '51010000-0000-4000-8000-00000000000a',
  '51010000-0000-4000-8000-00000000000b',
  '51010000-0000-4000-8000-000000000002',
  '{"domain":"RESTORE_SERVICE","trial":"TLS-DAY1-GOLDEN"}'::jsonb,
  '1.0.0',
  '51010000-0000-4000-8000-000000000007',
  '2026-08-22T00:00:00Z',
  '51010000-0000-4000-8000-00000000000d',
  '2026-08-22T00:00:00Z', '2026-08-22T00:00:00Z'
) ON CONFLICT (assignment_snapshot_id) DO NOTHING;
