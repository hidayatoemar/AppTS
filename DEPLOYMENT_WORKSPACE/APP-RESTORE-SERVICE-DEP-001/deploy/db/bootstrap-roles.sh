#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
# shellcheck disable=SC1091
. "$SCRIPT_DIR/lib.sh"

: "${PGHOST:?PGHOST is required.}"
: "${PGPORT:?PGPORT is required.}"
: "${APPTS_ADMIN_DB:?APPTS_ADMIN_DB is required.}"
: "${APPTS_ADMIN_USER:?APPTS_ADMIN_USER is required.}"
: "${APPTS_ADMIN_PASSWORD:?APPTS_ADMIN_PASSWORD is required.}"
: "${APPTS_DB_NAME:?APPTS_DB_NAME is required.}"
: "${APPTS_MIGRATION_ROLE:?APPTS_MIGRATION_ROLE is required.}"
: "${APPTS_MIGRATION_PASSWORD:?APPTS_MIGRATION_PASSWORD is required.}"
: "${APPTS_RUNTIME_ROLE:?APPTS_RUNTIME_ROLE is required.}"
: "${APPTS_RUNTIME_PASSWORD:?APPTS_RUNTIME_PASSWORD is required.}"
: "${APPTS_STAGING_LABEL:?APPTS_STAGING_LABEL is required.}"
: "${APPTS_DISPOSABLE_DATABASE:?APPTS_DISPOSABLE_DATABASE is required.}"

require_database_network
require_staging_database
require_identifier APPTS_ADMIN_DB "$APPTS_ADMIN_DB"
require_identifier APPTS_ADMIN_USER "$APPTS_ADMIN_USER"
require_identifier APPTS_MIGRATION_ROLE "$APPTS_MIGRATION_ROLE"
require_identifier APPTS_RUNTIME_ROLE "$APPTS_RUNTIME_ROLE"
require_value APPTS_ADMIN_PASSWORD "$APPTS_ADMIN_PASSWORD"
require_value APPTS_MIGRATION_PASSWORD "$APPTS_MIGRATION_PASSWORD"
require_value APPTS_RUNTIME_PASSWORD "$APPTS_RUNTIME_PASSWORD"
[ "$APPTS_ADMIN_DB" != "$APPTS_DB_NAME" ] || die "APPTS_ADMIN_DB and APPTS_DB_NAME must differ."
[ "$APPTS_MIGRATION_ROLE" != "$APPTS_RUNTIME_ROLE" ] || die "migration and runtime roles must differ."
require_psql
require_postgresql17_client "$(psql --version)"

umask 077
export PGUSER="$APPTS_ADMIN_USER"
export PGPASSWORD="$APPTS_ADMIN_PASSWORD"
existing_owner=$(psql -X -Atqc "SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname = '$APPTS_DB_NAME'" --dbname="$APPTS_ADMIN_DB")
[ -z "$existing_owner" ] || [ "$existing_owner" = "$APPTS_MIGRATION_ROLE" ] || die "existing staging database has an unexpected owner."
psql -X -v ON_ERROR_STOP=1 --dbname="$APPTS_ADMIN_DB" <<'SQL'
\set ON_ERROR_STOP on
\getenv migration_role APPTS_MIGRATION_ROLE
\getenv migration_password APPTS_MIGRATION_PASSWORD
\getenv runtime_role APPTS_RUNTIME_ROLE
\getenv runtime_password APPTS_RUNTIME_PASSWORD
\getenv database_name APPTS_DB_NAME

SELECT format('CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS PASSWORD %L', :'migration_role', :'migration_password')
 WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'migration_role')
\gexec
SELECT format('ALTER ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS PASSWORD %L', :'migration_role', :'migration_password')
\gexec

SELECT format('CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS PASSWORD %L', :'runtime_role', :'runtime_password')
 WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'runtime_role')
\gexec
SELECT format('ALTER ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS PASSWORD %L', :'runtime_role', :'runtime_password')
\gexec

SELECT format('REVOKE %I FROM %I', parent.rolname, member.rolname)
  FROM pg_auth_members memberships
  JOIN pg_roles parent ON parent.oid = memberships.roleid
  JOIN pg_roles member ON member.oid = memberships.member
 WHERE member.rolname = :'runtime_role'
\gexec

SELECT format('CREATE DATABASE %I OWNER %I ENCODING ''UTF8'' TEMPLATE template0', :'database_name', :'migration_role')
 WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'database_name')
\gexec
SQL

# Database and schema privilege cleanup is scoped to the disposable DEP database.
psql -X -v ON_ERROR_STOP=1 --dbname="$APPTS_ADMIN_DB" <<'SQL'
\set ON_ERROR_STOP on
\getenv runtime_role APPTS_RUNTIME_ROLE
\getenv database_name APPTS_DB_NAME

SELECT format('REVOKE CONNECT, TEMPORARY ON DATABASE %I FROM PUBLIC', :'database_name')
\gexec
SELECT format('REVOKE ALL PRIVILEGES ON DATABASE %I FROM %I', :'database_name', :'runtime_role')
\gexec
SQL

export PGUSER="$APPTS_MIGRATION_ROLE"
export PGPASSWORD="$APPTS_MIGRATION_PASSWORD"
psql -X -v ON_ERROR_STOP=1 --dbname="$APPTS_DB_NAME" <<'SQL'
\set ON_ERROR_STOP on
\getenv runtime_role APPTS_RUNTIME_ROLE

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

unset PGUSER PGPASSWORD
printf '%s\n' "PASS: staging roles prepared; database ownership is limited to the migration role."
