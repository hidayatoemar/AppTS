#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPOSITORY_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)
# shellcheck disable=SC1091
. "$SCRIPT_DIR/lib.sh"

: "${PGHOST:?PGHOST is required.}"
: "${PGPORT:?PGPORT is required.}"
: "${PGDATABASE:?PGDATABASE is required.}"
: "${PGUSER:?PGUSER is required.}"
: "${PGPASSWORD:?PGPASSWORD is required.}"
: "${APPTS_DB_NAME:?APPTS_DB_NAME is required.}"
: "${APPTS_MIGRATION_ROLE:?APPTS_MIGRATION_ROLE is required.}"
: "${APPTS_STAGING_LABEL:?APPTS_STAGING_LABEL is required.}"
: "${APPTS_DISPOSABLE_DATABASE:?APPTS_DISPOSABLE_DATABASE is required.}"

require_database_network
require_staging_database
require_identifier APPTS_MIGRATION_ROLE "$APPTS_MIGRATION_ROLE"
require_value PGPASSWORD "$PGPASSWORD"
[ "$PGDATABASE" = "$APPTS_DB_NAME" ] || die "PGDATABASE must equal APPTS_DB_NAME."
[ "$PGUSER" = "$APPTS_MIGRATION_ROLE" ] || die "migrations must run as APPTS_MIGRATION_ROLE."
command -v node >/dev/null 2>&1 || die "node is required to verify the frozen schema before migration."
node "$REPOSITORY_ROOT/tools/verify-schema-frozen.mjs" --root "$REPOSITORY_ROOT"
require_psql
require_postgresql17_client "$(psql --version)"

server_version=$(psql -X -Atqc "SHOW server_version_num")
case "$server_version" in
  17*) ;;
  *) die "the connected staging server must be PostgreSQL 17.x." ;;
esac

# This guard prevents accidental re-application against a non-disposable or already-built database.
schema_absent=$(psql -X -Atqc "SELECT CASE WHEN to_regnamespace('appts') IS NULL AND to_regnamespace('appts_sys') IS NULL THEN 'true' ELSE 'false' END")
[ "$schema_absent" = true ] || die "appts/appts_sys already exist; use a fresh disposable staging database."

for migration in \
  "$REPOSITORY_ROOT/db/migrations/V001__cf01_core_schema.sql" \
  "$REPOSITORY_ROOT/db/migrations/V002__cf01_runtime_and_exchange_schema.sql" \
  "$REPOSITORY_ROOT/db/migrations/V003__dg04_diagnostic_persistence.sql" \
  "$REPOSITORY_ROOT/db/migrations/V004__d05_pending_capture_v2.sql"
do
  [ -f "$migration" ] || die "missing migration: $migration"
  psql -X -v ON_ERROR_STOP=1 --file="$migration"
done

printf '%s\n' "PASS: V001–V004 applied in order by the distinct migration role; runtime grants remain pending."
