#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
# shellcheck disable=SC1091
. "$SCRIPT_DIR/lib.sh"

: "${PGHOST:?PGHOST is required.}"
: "${PGPORT:?PGPORT is required.}"
: "${PGDATABASE:?PGDATABASE is required.}"
: "${PGUSER:?PGUSER is required.}"
: "${PGPASSWORD:?PGPASSWORD is required.}"
: "${APPTS_DB_NAME:?APPTS_DB_NAME is required.}"
: "${APPTS_MIGRATION_ROLE:?APPTS_MIGRATION_ROLE is required.}"
: "${APPTS_RUNTIME_ROLE:?APPTS_RUNTIME_ROLE is required.}"
: "${APPTS_STAGING_LABEL:?APPTS_STAGING_LABEL is required.}"
: "${APPTS_DISPOSABLE_DATABASE:?APPTS_DISPOSABLE_DATABASE is required.}"

require_database_network
require_staging_database
require_identifier APPTS_MIGRATION_ROLE "$APPTS_MIGRATION_ROLE"
require_identifier APPTS_RUNTIME_ROLE "$APPTS_RUNTIME_ROLE"
require_value PGPASSWORD "$PGPASSWORD"
[ "$PGDATABASE" = "$APPTS_DB_NAME" ] || die "PGDATABASE must equal APPTS_DB_NAME."
[ "$PGUSER" = "$APPTS_MIGRATION_ROLE" ] || die "quarantine checks must run as APPTS_MIGRATION_ROLE."
[ "$APPTS_MIGRATION_ROLE" != "$APPTS_RUNTIME_ROLE" ] || die "migration and runtime roles must differ."
require_psql
require_postgresql17_client "$(psql --version)"

# This command intentionally performs no GRANT. Runtime application operations
# are not source-determined in the partial DEP construction and therefore have
# no accepted per-repository allowlist yet.
export APPTS_RUNTIME_ROLE_CHECK="$APPTS_RUNTIME_ROLE"
psql -X -v ON_ERROR_STOP=1 <<'SQL'
\set ON_ERROR_STOP on
\getenv runtime_role APPTS_RUNTIME_ROLE_CHECK

-- Remove any DEP-scoped privilege residue before the later source-backed
-- allowlist construction. These are privilege operations, never DDL.
SELECT format('REVOKE CONNECT, TEMPORARY ON DATABASE %I FROM PUBLIC', current_database())
\gexec
SELECT format('REVOKE ALL PRIVILEGES ON DATABASE %I FROM %I', current_database(), :'runtime_role')
\gexec
REVOKE ALL PRIVILEGES ON SCHEMA public FROM PUBLIC;
REVOKE ALL PRIVILEGES ON SCHEMA public FROM :"runtime_role";
SELECT format('REVOKE ALL PRIVILEGES ON SCHEMA %I FROM %I', nspname, :'runtime_role')
  FROM pg_namespace
 WHERE nspname IN ('appts', 'appts_sys')
\gexec
SELECT format('REVOKE ALL PRIVILEGES ON SCHEMA %I FROM PUBLIC', nspname)
  FROM pg_namespace
 WHERE nspname IN ('appts', 'appts_sys')
\gexec
SELECT format('REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA %I FROM %I', nspname, :'runtime_role')
  FROM pg_namespace
 WHERE nspname IN ('appts', 'appts_sys')
\gexec
SELECT format('REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA %I FROM PUBLIC', nspname)
  FROM pg_namespace
 WHERE nspname IN ('appts', 'appts_sys')
\gexec
SELECT format('REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA %I FROM %I', nspname, :'runtime_role')
  FROM pg_namespace
 WHERE nspname IN ('appts', 'appts_sys')
\gexec
SELECT format('REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA %I FROM %I', nspname, :'runtime_role')
  FROM pg_namespace
 WHERE nspname IN ('appts', 'appts_sys')
\gexec
SQL

quarantine_status=$(psql -X -Atqc "
WITH runtime_role AS (
  SELECT oid, rolname, rolsuper, rolinherit, rolcreaterole, rolcreatedb,
         rolreplication, rolbypassrls, rolcanlogin
    FROM pg_roles
   WHERE rolname = '$APPTS_RUNTIME_ROLE'
)
SELECT CASE WHEN
  EXISTS (SELECT 1 FROM runtime_role
           WHERE NOT rolsuper AND NOT rolinherit AND NOT rolcreaterole
             AND NOT rolcreatedb AND NOT rolreplication AND NOT rolbypassrls
             AND rolcanlogin)
  AND (SELECT count(*) FROM pg_auth_members memberships
         JOIN runtime_role ON runtime_role.oid = memberships.member) = 0
  AND NOT has_database_privilege('$APPTS_RUNTIME_ROLE', current_database(), 'CONNECT')
  AND NOT has_database_privilege('$APPTS_RUNTIME_ROLE', current_database(), 'TEMPORARY')
  AND NOT has_schema_privilege('$APPTS_RUNTIME_ROLE', 'public', 'USAGE')
  AND NOT has_schema_privilege('$APPTS_RUNTIME_ROLE', 'public', 'CREATE')
  AND NOT has_schema_privilege('$APPTS_RUNTIME_ROLE', 'appts', 'USAGE')
  AND NOT has_schema_privilege('$APPTS_RUNTIME_ROLE', 'appts', 'CREATE')
  AND NOT has_schema_privilege('$APPTS_RUNTIME_ROLE', 'appts_sys', 'USAGE')
  AND NOT has_schema_privilege('$APPTS_RUNTIME_ROLE', 'appts_sys', 'CREATE')
  AND NOT EXISTS (
    SELECT 1 FROM information_schema.role_table_grants grants
     WHERE grants.grantee = '$APPTS_RUNTIME_ROLE'
       AND grants.table_schema IN ('appts', 'appts_sys')
  )
THEN 'PASS' ELSE 'FAIL' END
")
[ "$quarantine_status" = PASS ] || die "runtime role privilege quarantine verification failed."

printf '%s\n' "PASS: runtime role has no elevated attributes, memberships, database/schema/table privileges, or appts_sys access."
# MCR-to-BUILDER-008 §2.A: minimum runtime grants from V001–V004 source-backed allowlist.
psql -X -v ON_ERROR_STOP=1 <<'SQL'
\set ON_ERROR_STOP on
\getenv runtime_role APPTS_RUNTIME_ROLE_CHECK

SELECT format('GRANT CONNECT ON DATABASE %I TO %I', current_database(), :'runtime_role')
\gexec

GRANT USAGE ON SCHEMA appts TO :"runtime_role";
GRANT USAGE ON ALL SEQUENCES IN SCHEMA appts TO :"runtime_role";

-- Append-only tables (SELECT + INSERT; trigger blocks UPDATE/DELETE)
GRANT SELECT, INSERT ON TABLE
  appts.admission_assessment, appts.admission_predicate_result,
  appts.intake_decision, appts.ticket_formation_record,
  appts.incident_record, appts.relationship_record,
  appts.post_closure_correction, appts.successor_ticket_link,
  appts.handover_proposal, appts.handover_response,
  appts.responsibility_change, appts.delegation_grant,
  appts.escalation_obligation_core, appts.sod_decision,
  appts.evidence_object, appts.evidence_qualification,
  appts.evidence_correction, appts.claim_record,
  appts.interpretation_record, appts.claim_evidence_link,
  appts.contradiction_set, appts.contradiction_member,
  appts.evidence_set_version, appts.evidence_set_member,
  appts.verification_request, appts.verifier_eligibility_decision,
  appts.verification_result, appts.gate_evaluation,
  appts.gate_predicate_result, appts.progression_class,
  appts.terminal_disposition_assessment, appts.closure_readiness_assessment,
  appts.source_ref, appts.source_version_ref,
  appts.policy_binding_ref, appts.configuration_snapshot,
  appts.missing_binding_result, appts.integrity_envelope,
  appts.lineage_edge, appts.idempotency_ledger,
  appts.inbox_entry, appts.commit_marker,
  appts.audit_event, appts.access_audit,
  appts.export_manifest_item, appts.release_identity,
  appts.compatibility_declaration,
  appts.runtime_context, appts.runtime_state_transition,
  appts.lifecycle_effect_request, appts.lifecycle_effect_result,
  appts.action_set_member, appts.next_control,
  appts.runtime_escalation, appts.acknowledgment,
  appts.runtime_handover_context, appts.subordinate_projection,
  appts.dependency_context, appts.residual_obligation,
  appts.authorization_transition, appts.package_binding_runtime,
  appts.hook_invocation, appts.hook_result, appts.stub_result,
  appts.authoritative_source_ref, appts.adapter_profile_ref,
  appts.qualified_external_record, appts.interaction_journal,
  appts.pending_capture, appts.sync_batch,
  appts.sync_result, appts.reconciliation_case,
  appts.action_intent, appts.communication_obligation,
  appts.communication_attempt, appts.communication_result,
  appts.export_job,
  appts.diagnostic_error_event, appts.diagnostic_event_subject,
  appts.diagnostic_bundle_member, appts.diagnostic_dependency_evidence,
  appts.diagnostic_mapping_entry, appts.diagnostic_notification,
  appts.diagnostic_notification_attempt, appts.diagnostic_notification_result,
  appts.diagnostic_notification_dead_letter,
  appts.diagnostic_notification_acknowledgment,
  appts.diagnostic_aggregation_member, appts.diagnostic_storm_control_decision,
  appts.diagnostic_notification_failure_link, appts.diagnostic_event_correction,
  appts.provisional_capture_payload_resource,
  appts.pending_capture_idempotency_binding
TO :"runtime_role";

-- Mutable tables (SELECT + INSERT + UPDATE; no DELETE)
GRANT SELECT, INSERT, UPDATE ON TABLE
  appts.ticket_identity, appts.pre_ticket_case,
  appts.authority_envelope, appts.authority_action,
  appts.responsible_assignment, appts.progression_envelope,
  appts.outbox_entry, appts.export_manifest,
  appts.runtime_ticket, appts.operational_obligation,
  appts.waiting_interval, appts.runtime_blocker,
  appts.authority_projection, appts.gate_projection,
  appts.action_set_snapshot,
  appts.diagnostic_mapping_registry_version,
  appts.diagnostic_aggregation_group,
  appts.secure_diagnostic_bundle
TO :"runtime_role";
SQL

grant_verify=$(psql -X -Atqc "
WITH chk AS (
  SELECT
    CASE WHEN has_database_privilege('$APPTS_RUNTIME_ROLE', current_database(), 'CONNECT')
         THEN NULL ELSE 'MISSING CONNECT on database' END AS v01,
    CASE WHEN NOT has_database_privilege('$APPTS_RUNTIME_ROLE', current_database(), 'TEMPORARY')
         THEN NULL ELSE 'UNEXPECTED TEMPORARY on database' END AS v02,
    CASE WHEN has_schema_privilege('$APPTS_RUNTIME_ROLE', 'appts', 'USAGE')
         THEN NULL ELSE 'MISSING USAGE on schema appts' END AS v03,
    CASE WHEN NOT has_schema_privilege('$APPTS_RUNTIME_ROLE', 'appts', 'CREATE')
         THEN NULL ELSE 'UNEXPECTED CREATE on schema appts' END AS v04,
    CASE WHEN NOT has_schema_privilege('$APPTS_RUNTIME_ROLE', 'appts_sys', 'USAGE')
         THEN NULL ELSE 'UNEXPECTED USAGE on schema appts_sys' END AS v05,
    CASE WHEN has_table_privilege('$APPTS_RUNTIME_ROLE', 'appts.sync_result', 'SELECT')
         THEN NULL ELSE 'MISSING SELECT on appts.sync_result' END AS v06,
    CASE WHEN has_table_privilege('$APPTS_RUNTIME_ROLE', 'appts.sync_result', 'INSERT')
         THEN NULL ELSE 'MISSING INSERT on appts.sync_result' END AS v07,
    CASE WHEN NOT has_table_privilege('$APPTS_RUNTIME_ROLE', 'appts.sync_result', 'UPDATE')
         THEN NULL ELSE 'UNEXPECTED UPDATE on appts.sync_result' END AS v08,
    CASE WHEN has_table_privilege('$APPTS_RUNTIME_ROLE', 'appts.runtime_ticket', 'UPDATE')
         THEN NULL ELSE 'MISSING UPDATE on appts.runtime_ticket' END AS v09,
    CASE WHEN has_table_privilege('$APPTS_RUNTIME_ROLE', 'appts.provisional_capture_payload_resource', 'INSERT')
         THEN NULL ELSE 'MISSING INSERT on appts.provisional_capture_payload_resource' END AS v10,
    CASE WHEN has_table_privilege('$APPTS_RUNTIME_ROLE', 'appts.pending_capture_idempotency_binding', 'INSERT')
         THEN NULL ELSE 'MISSING INSERT on appts.pending_capture_idempotency_binding' END AS v11,
    CASE WHEN NOT EXISTS (
           SELECT 1 FROM information_schema.role_table_grants
            WHERE grantee = '$APPTS_RUNTIME_ROLE' AND table_schema = 'appts_sys'
         ) THEN NULL ELSE 'UNEXPECTED privileges on appts_sys' END AS v12,
    CASE WHEN NOT EXISTS (
           SELECT 1 FROM information_schema.role_table_grants
            WHERE grantee = '$APPTS_RUNTIME_ROLE' AND table_schema = 'appts'
              AND privilege_type IN ('DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER')
         ) THEN NULL ELSE 'UNEXPECTED DELETE/TRUNCATE/REFERENCES/TRIGGER on appts' END AS v13
)
SELECT CASE WHEN v01 IS NULL AND v02 IS NULL AND v03 IS NULL AND v04 IS NULL
              AND v05 IS NULL AND v06 IS NULL AND v07 IS NULL AND v08 IS NULL
              AND v09 IS NULL AND v10 IS NULL AND v11 IS NULL AND v12 IS NULL
              AND v13 IS NULL
       THEN 'PASS'
       ELSE concat_ws(' | ', v01,v02,v03,v04,v05,v06,v07,v08,v09,v10,v11,v12,v13)
       END
  FROM chk
")
[ "$grant_verify" = PASS ] || die "post-grant verification failed: $grant_verify"

printf '%s\n' "PASS: runtime role privilege grants verified (V001–V004 allowlist, least-privilege)."
unset APPTS_RUNTIME_ROLE_CHECK PGPASSWORD
