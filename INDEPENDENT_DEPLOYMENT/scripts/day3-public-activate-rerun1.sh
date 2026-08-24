#!/usr/bin/env bash
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
SRC="$ROOT/INDEPENDENT_DEPLOYMENT/scripts/day3-public-activate.sh"
TMP="$(mktemp)"
cleanup(){ rm -f "$TMP"; }
trap cleanup EXIT
sed 's|sudo test "$(stat -c %a /etc/appts-independent/trial-credentials.json)" = 600|sudo test "$(sudo stat -c %a /etc/appts-independent/trial-credentials.json)" = 600|' "$SRC" > "$TMP"
if cmp -s "$SRC" "$TMP"; then
  echo 'MECHANICAL_PATCH_NOT_APPLIED' >&2
  exit 1
fi
bash -n "$TMP"
bash "$TMP"
