#!/bin/sh
set -eu

die() {
  printf '%s\n' "STOP: $*" >&2
  exit 2
}

require_value() {
  name=$1
  value=$2
  [ -n "$value" ] || die "$name is required."
  case "$value" in
    *[![:print:]]*) die "$name contains non-printable characters." ;;
  esac
}

require_identifier() {
  name=$1
  value=$2
  require_value "$name" "$value"
  case "$value" in
    [a-z_][a-z0-9_] | [a-z_][a-z0-9_][a-z0-9_]*) ;;
    *) die "$name must be a lowercase PostgreSQL identifier (letters, digits, underscore; 1–63 characters)." ;;
  esac
  [ "${#value}" -le 63 ] || die "$name is longer than 63 characters."
}

require_port() {
  require_value PGPORT "$PGPORT"
  case "$PGPORT" in *[!0-9]*) die "PGPORT must be numeric." ;; esac
  [ "$PGPORT" -ge 1 ] && [ "$PGPORT" -le 65535 ] || die "PGPORT is outside 1..65535."
}

require_database_network() {
  require_value APPTS_DB_NETWORK_MODE "$APPTS_DB_NETWORK_MODE"
  require_value PGHOST "$PGHOST"
  case "$PGHOST" in
    localhost|127.0.0.1|::1)
      [ "$APPTS_DB_NETWORK_MODE" = LOOPBACK ] || die "LOOPBACK mode requires a loopback PGHOST."
      ;;
    postgres)
      [ "$APPTS_DB_NETWORK_MODE" = INTERNAL_COMPOSE ] || die "PGHOST=postgres requires INTERNAL_COMPOSE mode."
      ;;
    *) die "PGHOST must be loopback for LOOPBACK mode or the fixed internal Compose hostname postgres for INTERNAL_COMPOSE mode." ;;
  esac
  case "$APPTS_DB_NETWORK_MODE" in
    LOOPBACK|INTERNAL_COMPOSE) ;;
    *) die "APPTS_DB_NETWORK_MODE must be LOOPBACK or INTERNAL_COMPOSE." ;;
  esac
  require_port
}

require_staging_database() {
  require_value APPTS_STAGING_LABEL "$APPTS_STAGING_LABEL"
  [ "$APPTS_STAGING_LABEL" = 'STAGING SIMULATION / NON-PRODUCTION' ] || die "APPTS_STAGING_LABEL must identify staging only."
  require_value APPTS_DISPOSABLE_DATABASE "$APPTS_DISPOSABLE_DATABASE"
  [ "$APPTS_DISPOSABLE_DATABASE" = true ] || die "APPTS_DISPOSABLE_DATABASE=true is required."
  require_identifier APPTS_DB_NAME "$APPTS_DB_NAME"
  case "$APPTS_DB_NAME" in
    appts_dep001_*) ;;
    *) die "APPTS_DB_NAME must use the disposable appts_dep001_ prefix." ;;
  esac
}

require_psql() {
  command -v psql >/dev/null 2>&1 || die "psql is required on the staging command surface."
}

require_pg_dump() {
  command -v pg_dump >/dev/null 2>&1 || die "pg_dump is required on the staging command surface."
}

require_pg_restore() {
  command -v pg_restore >/dev/null 2>&1 || die "pg_restore is required on the staging command surface."
}

require_postgresql17_client() {
  version=$1
  case "$version" in
    *'PostgreSQL) 17.'*|*'PostgreSQL 17.'*) ;;
    *) die "PostgreSQL 17 client tooling is required." ;;
  esac
}

require_safe_path() {
  name=$1
  value=$2
  require_value "$name" "$value"
  case "$value" in
    -*|*..*|*' '*|*'\t'*) die "$name contains an unsafe path." ;;
  esac
}
