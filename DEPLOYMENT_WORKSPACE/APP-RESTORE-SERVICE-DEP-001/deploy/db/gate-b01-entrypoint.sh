#!/bin/sh
set -eu

# Create the disposable database if it does not already exist.
# b01-db-verify.mjs drops and recreates both appts schemas on every run,
# so the database itself is safe to reuse across repeated gate invocations.
psql -d postgres -c "CREATE DATABASE \"$PGDATABASE\" OWNER \"$PGUSER\"" 2>/dev/null || true

exec node tools/b01-db-verify.mjs test
