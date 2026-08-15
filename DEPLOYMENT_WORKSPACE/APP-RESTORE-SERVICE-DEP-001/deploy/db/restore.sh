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
: "${APPTS_BACKUP_FILE:?APPTS_BACKUP_FILE is required.}"
: "${APPTS_RESTORE_CONFIRM:?APPTS_RESTORE_CONFIRM is required.}"
: "${APPTS_STAGING_LABEL:?APPTS_STAGING_LABEL is required.}"
: "${APPTS_DISPOSABLE_DATABASE:?APPTS_DISPOSABLE_DATABASE is required.}"

require_database_network
require_staging_database
require_identifier APPTS_ADMIN_DB "$APPTS_ADMIN_DB"
require_identifier APPTS_ADMIN_USER "$APPTS_ADMIN_USER"
require_identifier APPTS_MIGRATION_ROLE "$APPTS_MIGRATION_ROLE"
require_value APPTS_ADMIN_PASSWORD "$APPTS_ADMIN_PASSWORD"
require_value APPTS_MIGRATION_PASSWORD "$APPTS_MIGRATION_PASSWORD"
require_safe_path APPTS_BACKUP_FILE "$APPTS_BACKUP_FILE"
[ -f "$APPTS_BACKUP_FILE" ] || die "APPTS_BACKUP_FILE does not exist."
[ "$APPTS_ADMIN_DB" != "$APPTS_DB_NAME" ] || die "APPTS_ADMIN_DB and APPTS_DB_NAME must differ."
[ "$APPTS_RESTORE_CONFIRM" = 'RESTORE-BASED ROLLBACK' ] || die "APPTS_RESTORE_CONFIRM must be RESTORE-BASED ROLLBACK."
require_psql
require_pg_restore
require_postgresql17_client "$(psql --version)"
require_postgresql17_client "$(pg_restore --version)"

umask 077
export PGUSER="$APPTS_ADMIN_USER"
export PGPASSWORD="$APPTS_ADMIN_PASSWORD"
export APPTS_RESTORE_MIGRATION_ROLE="$APPTS_MIGRATION_ROLE"
psql -X -v ON_ERROR_STOP=1 --dbname="$APPTS_ADMIN_DB" <<'SQL'
\set ON_ERROR_STOP on
\getenv database_name APPTS_DB_NAME
\getenv migration_role APPTS_RESTORE_MIGRATION_ROLE

SELECT format('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = %L AND pid <> pg_backend_pid()', :'database_name')
 WHERE EXISTS (SELECT 1 FROM pg_database WHERE datname = :'database_name')
\gexec
SELECT format('DROP DATABASE %I', :'database_name')
 WHERE EXISTS (SELECT 1 FROM pg_database WHERE datname = :'database_name')
\gexec
SELECT format('CREATE DATABASE %I OWNER %I ENCODING ''UTF8'' TEMPLATE template0', :'database_name', :'migration_role')
\gexec
SQL
unset PGPASSWORD

export PGUSER="$APPTS_MIGRATION_ROLE"
export PGPASSWORD="$APPTS_MIGRATION_PASSWORD"
printf '%s\n' "RESTORE-BASED ROLLBACK: restoring the disposable staging database from the supplied checkpoint."
pg_restore --exit-on-error --no-owner --no-privileges --dbname="$APPTS_DB_NAME" "$APPTS_BACKUP_FILE"
unset PGPASSWORD

printf '%s\n' "PASS: disposable staging database restored; re-run grant-runtime.sh before runtime use."
