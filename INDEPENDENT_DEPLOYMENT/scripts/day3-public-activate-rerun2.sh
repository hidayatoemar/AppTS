#!/usr/bin/env bash
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
SRC="$ROOT/INDEPENDENT_DEPLOYMENT/scripts/day3-public-activate.sh"
TMP="$(mktemp)"
cleanup(){ rm -f "$TMP"; }
trap cleanup EXIT
python3 - "$SRC" "$TMP" <<'PY'
import sys
from pathlib import Path
src=Path(sys.argv[1]).read_text()
src=src.replace(
    'sudo test "$(stat -c %a /etc/appts-independent/trial-credentials.json)" = 600',
    'sudo test "$(sudo stat -c %a /etc/appts-independent/trial-credentials.json)" = 600',
    1,
)
marker='# Render only accepted auth/session deployment wiring and recreate API without DB reset/migration.\n'
end_marker="echo 'credential_rotation_and_nonpublic_auth_guard=PASS' | tee \"$E/01-auth-preedge.txt\""
start=src.index(marker)
end=src.index(end_marker,start)
replacement=r'''# Render only accepted auth/session deployment wiring and recreate API without DB reset/migration.
# Canonical renderer is executed as root from stdin, avoiding shell-quote mutation of JSON.
"${SSH[@]}" 'sudo python3 -' < "$ROOT/INDEPENDENT_DEPLOYMENT/scripts/day3-render-auth-env.py"
"${SSH[@]}" 'set -euo pipefail
  cd /opt/appts-independent-restore-service/deploy/compose
  sudo docker compose -f compose.yaml --env-file .env config >/dev/null
  sudo docker compose -f compose.yaml --env-file .env up -d --no-deps --force-recreate api >/dev/null
  ready=false
  for i in $(seq 1 30); do
    if curl -fsS http://127.0.0.1:8080/readyz >/dev/null 2>&1; then ready=true; break; fi
    sleep 1
  done
  test "$ready" = true
  test "$(curl -fsS http://127.0.0.1:8080/healthz)" = "{\"status\":\"ok\"}"
  test "$(curl -fsS http://127.0.0.1:8080/readyz)" = "{\"status\":\"ready\"}"
  test "$(curl -sS -o /dev/null -w "%{http_code}" http://127.0.0.1:8080/api/v1/ui/work-queue)" = 401
'

'''
src=src[:start]+replacement+src[end:]
Path(sys.argv[2]).write_text(src)
PY
bash -n "$TMP"
grep -Fq 'day3-render-auth-env.py' "$TMP"
grep -Fq 'sudo stat -c %a /etc/appts-independent/trial-credentials.json' "$TMP"
bash "$TMP"
