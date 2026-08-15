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
: "${APPTS_BACKUP_FILE:?APPTS_BACKUP_FILE is required.}"
: "${APPTS_STAGING_LABEL:?APPTS_STAGING_LABEL is required.}"
: "${APPTS_DISPOSABLE_DATABASE:?APPTS_DISPOSABLE_DATABASE is required.}"

require_database_network
require_staging_database
require_identifier PGUSER "$PGUSER"
require_value PGPASSWORD "$PGPASSWORD"
require_safe_path APPTS_BACKUP_FILE "$APPTS_BACKUP_FILE"
[ "$PGDATABASE" = "$APPTS_DB_NAME" ] || die "PGDATABASE must equal APPTS_DB_NAME."
require_pg_dump
require_postgresql17_client "$(pg_dump --version)"

umask 077
backup_directory=$(dirname -- "$APPTS_BACKUP_FILE")
mkdir -p "$backup_directory"
pg_dump --format=custom --no-owner --no-privileges --file="$APPTS_BACKUP_FILE" --dbname="$APPTS_DB_NAME"

printf '%s\n' "PASS: staging checkpoint backup created at $APPTS_BACKUP_FILE (restore-based rollback input)."
