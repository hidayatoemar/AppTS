#!/bin/sh
set -eu

expected_label='STAGING SIMULATION / NON-PRODUCTION'
if [ "${APPTS_STAGING_LABEL:-}" != "$expected_label" ]; then
  printf '%s\n' 'DEP startup rejected: APPTS_STAGING_LABEL is not the approved staging label' >&2
  exit 78
fi

exec node /app/apps/api/dist/dep-bootstrap.js
