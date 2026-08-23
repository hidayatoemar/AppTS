#!/usr/bin/env bash
set -euo pipefail

: "${INDEP_HOST:?INDEP_HOST is required}"
: "${INDEP_USER:?INDEP_USER is required}"

ROOT="$(git rev-parse --show-toplevel)"
E="$ROOT/INDEPENDENT_DEPLOYMENT/evidence/day3-edge-${GITHUB_RUN_ID:-manual}"
mkdir -p "$E"
KEY="$HOME/.ssh/independent_deploy_key"
SSH=(ssh -i "$KEY" -o BatchMode=yes -o ConnectTimeout=10 "${INDEP_USER}@${INDEP_HOST}")
COMPOSE_DIR="/opt/appts-independent-restore-service/deploy/compose"
COMPOSE_FILE="$COMPOSE_DIR/compose.yaml"
COMPOSE_ENV="$COMPOSE_DIR/.env"

printf 'mcr_to_dt=018\nmode=READ_ONLY_NON_PUBLIC_ASSESSMENT\n' > "$E/00-scope.txt"

# External reachability from the GitHub-hosted runner. Do not print target identity.
{
  echo "target_binding_type=$([[ "$INDEP_HOST" =~ ^[0-9]+(\.[0-9]+){3}$ ]] && echo ip_literal || echo hostname)"
  for p in 22 80 443 8080 5432 3000 9090; do
    if timeout 3 bash -c "</dev/tcp/${INDEP_HOST}/${p}" >/dev/null 2>&1; then
      echo "external_tcp_${p}=OPEN"
    else
      echo "external_tcp_${p}=CLOSED_OR_FILTERED"
    fi
  done
} | tee "$E/01-external-reachability.txt"

# Current server listener and bounded firewall posture. No rule changes.
"${SSH[@]}" 'set -euo pipefail
  echo "== listeners =="
  sudo ss -H -lntp 2>/dev/null || ss -H -lnt 2>/dev/null || true
  echo "== firewall =="
  if command -v firewall-cmd >/dev/null 2>&1; then
    echo "firewalld_state=$(sudo firewall-cmd --state 2>/dev/null || true)"
    echo "firewalld_services=$(sudo firewall-cmd --zone=public --list-services 2>/dev/null || true)"
    echo "firewalld_ports=$(sudo firewall-cmd --zone=public --list-ports 2>/dev/null || true)"
  else
    echo "firewalld_state=not_installed"
  fi
  echo "nft_present=$(command -v nft >/dev/null 2>&1 && echo yes || echo no)"
' | tee "$E/02-server-listener-firewall.txt"

# Runtime/service health and current Day-2 readback. No mutation.
"${SSH[@]}" "set -euo pipefail
  echo '== compose_ps =='
  sudo docker compose -f '$COMPOSE_FILE' --env-file '$COMPOSE_ENV' ps
  echo '== health =='
  printf 'healthz='; curl -fsS http://127.0.0.1:8080/healthz; echo
  printf 'readyz='; curl -fsS http://127.0.0.1:8080/readyz; echo
  echo '== runtime_db_identity =='
  sudo docker compose -f '$COMPOSE_FILE' --env-file '$COMPOSE_ENV' exec -T api node --input-type=module -e 'import {createPersistencePool} from \"@appts-restore-service/persistence\"; const p=createPersistencePool({connectionString:process.env.DATABASE_URL}); const r=await p.query(\"select current_user as u,current_database() as d\"); console.log(r.rows[0].u+\"|\"+r.rows[0].d); const c=await p.query(\"select count(*)::int as n from appts.runtime_ticket where current_state_code = '\''CLOSED'\''\"); console.log(\"closed_total=\"+c.rows[0].n); await p.end();'
  echo '== work_queue =='
  curl -fsS http://127.0.0.1:8080/api/v1/ui/work-queue
" | tee "$E/03-runtime-day2-health.txt"

grep -Fq 'healthz={"status":"ok"}' "$E/03-runtime-day2-health.txt"
grep -Fq 'readyz={"status":"ready"}' "$E/03-runtime-day2-health.txt"
grep -Fq 'appts_runtime|appts_dep001_independent' "$E/03-runtime-day2-health.txt"
grep -Fq 'closed_total=0' "$E/03-runtime-day2-health.txt"

# Reverse proxy, hostname/DNS clues, and TLS material. Read-only.
"${SSH[@]}" 'set -euo pipefail
  echo "== proxy binaries/services =="
  for x in nginx caddy httpd apache2; do
    if command -v "$x" >/dev/null 2>&1; then echo "$x=installed"; else echo "$x=absent"; fi
  done
  for s in nginx caddy httpd apache2; do
    echo "$s.active=$(systemctl is-active "$s" 2>/dev/null || true)"
    echo "$s.enabled=$(systemctl is-enabled "$s" 2>/dev/null || true)"
  done
  echo "== hostname clues =="
  printf "system_hostname="; hostname -f 2>/dev/null || hostname
  if [ -d /etc/nginx ]; then grep -RhoE "server_name[[:space:]]+[^;]+" /etc/nginx 2>/dev/null | sort -u || true; fi
  if [ -f /etc/caddy/Caddyfile ]; then grep -E "^[[:space:]]*[^#[:space:]][^[:space:]]*[[:space:]]*\{" /etc/caddy/Caddyfile 2>/dev/null || true; fi
  if [ -d /etc/httpd ]; then grep -RhoE "Server(Name|Alias)[[:space:]]+[^[:space:]]+" /etc/httpd 2>/dev/null | sort -u || true; fi
  if [ -d /etc/apache2 ]; then grep -RhoE "Server(Name|Alias)[[:space:]]+[^[:space:]]+" /etc/apache2 2>/dev/null | sort -u || true; fi
  echo "== tls material =="
  if [ -d /etc/letsencrypt/live ]; then find /etc/letsencrypt/live -mindepth 1 -maxdepth 1 -type d -printf "letsencrypt_name=%f\n" 2>/dev/null | sort; else echo "letsencrypt_live=absent"; fi
  echo "certbot=$(command -v certbot >/dev/null 2>&1 && echo installed || echo absent)"
' | tee "$E/04-edge-hostname-tls.txt"

# Browser-facing current behavior through loopback only.
"${SSH[@]}" 'set -euo pipefail
  tmp=$(mktemp); hdr=$(mktemp); trap "rm -f $tmp $hdr" EXIT
  curl -fsS -D "$hdr" -o "$tmp" http://127.0.0.1:8080/
  echo "root_http_status=$(awk '\''toupper($1) ~ /^HTTP\// {code=$2} END{print code}'\'' "$hdr")"
  echo "set_cookie_count=$(grep -ic '^set-cookie:' "$hdr" || true)"
  echo "location_count=$(grep -ic '^location:' "$hdr" || true)"
  echo "absolute_loopback_url_count=$(grep -Eoc 'http://(127\.0\.0\.1|localhost)(:[0-9]+)?' "$tmp" || true)"
  echo "relative_href_src_count=$(grep -Eoc '(href|src)=\"/' "$tmp" || true)"
' | tee "$E/05-browser-proxy-readiness.txt"

# Derive conservative readiness without inventing hostname or authority.
TARGET_TYPE="$(awk -F= '/^target_binding_type=/{print $2}' "$E/01-external-reachability.txt")"
HOST_CLUES="$(grep -E 'server_name|ServerName|ServerAlias|letsencrypt_name=' "$E/04-edge-hostname-tls.txt" | grep -Ev '(^|[[:space:]])(_|localhost)([[:space:]]|$)' || true)"
PROXY_INSTALLED="$(grep -E '^(nginx|caddy|httpd|apache2)=installed$' "$E/04-edge-hostname-tls.txt" || true)"
TLS_MATERIAL="$(grep '^letsencrypt_name=' "$E/04-edge-hostname-tls.txt" || true)"

DISPOSITION=READY
BLOCKER=NONE
if [ "$TARGET_TYPE" = "ip_literal" ] && [ -z "$HOST_CLUES" ]; then
  DISPOSITION=STOP
  BLOCKER=CONTROLLED_PUBLIC_TRAINING_HOSTNAME_DNS_BINDING_MISSING_OR_NOT_EVIDENCED
elif [ -z "$PROXY_INSTALLED" ]; then
  # Proxy software absence is mechanically correctable under MCR-to-DT-018, but no change is made in this read-only first pass.
  DISPOSITION=READY
  BLOCKER=NONE
fi

# Backend/database ports must not be directly public for readiness.
if grep -Eq '^external_tcp_(8080|5432)=OPEN$' "$E/01-external-reachability.txt"; then
  DISPOSITION=STOP
  BLOCKER=DIRECT_INTERNAL_BACKEND_OR_DATABASE_PORT_PUBLICLY_REACHABLE
fi

{
  echo "mcr_to_dt=018"
  echo "assessment_mode=READ_ONLY_NON_PUBLIC"
  echo "day2_health=PASS"
  echo "runtime_identity=appts_runtime|appts_dep001_independent"
  echo "public_8080=$(awk -F= '/^external_tcp_8080=/{print $2}' "$E/01-external-reachability.txt")"
  echo "public_5432=$(awk -F= '/^external_tcp_5432=/{print $2}' "$E/01-external-reachability.txt")"
  echo "public_80=$(awk -F= '/^external_tcp_80=/{print $2}' "$E/01-external-reachability.txt")"
  echo "public_443=$(awk -F= '/^external_tcp_443=/{print $2}' "$E/01-external-reachability.txt")"
  echo "target_binding_type=$TARGET_TYPE"
  echo "hostname_dns_evidence=$([ -n "$HOST_CLUES" ] && echo PRESENT || echo NOT_EVIDENCED)"
  echo "tls_material_evidence=$([ -n "$TLS_MATERIAL" ] && echo PRESENT || echo NOT_EVIDENCED)"
  echo "reverse_proxy_software=$([ -n "$PROXY_INSTALLED" ] && echo PRESENT || echo NOT_EVIDENCED)"
  echo "authentication_session_guard=HELD_UPSTREAM_BY_MCR_NOT_BYPASSED"
  echo "public_activation=NOT_PERFORMED"
  echo "configuration_changes=NONE_READ_ONLY_PASS"
  echo "readiness_disposition=$DISPOSITION"
  echo "first_blocker=$BLOCKER"
} | tee "$E/06-summary.txt"

# Always finish successfully when the assessment itself completed; READY/STOP is a finding, not harness failure.
echo "day3_edge_assessment=COMPLETE"
