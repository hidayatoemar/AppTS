#!/usr/bin/env bash
set -euo pipefail

: "${INDEP_HOST:?INDEP_HOST is required}"
: "${INDEP_USER:?INDEP_USER is required}"
HOSTNAME=dev.appts.cifo.id
ROOT="$(git rev-parse --show-toplevel)"
DEP="$ROOT/DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001"
E="$ROOT/INDEPENDENT_DEPLOYMENT/evidence/day3-public-${GITHUB_RUN_ID:-manual}"
mkdir -p "$E"
KEY="$HOME/.ssh/independent_deploy_key"
SSH=(ssh -i "$KEY" -o BatchMode=yes -o ConnectTimeout=10 "${INDEP_USER}@${INDEP_HOST}")
TRIAL_CREDENTIAL_FILE="${TRIAL_CREDENTIAL_FILE:-/tmp/appts-day3-trial-credentials.json}"
HASH_FILE=/tmp/appts-day3-trial-hashes.json
cleanup(){ rm -f "$TRIAL_CREDENTIAL_FILE" "$HASH_FILE" /tmp/appts-day3-Caddyfile; }
trap cleanup EXIT

# Authority/gate chain must be explicit before the first public mutation.
grep -Fxq 'authentication_gate: PASS' "$ROOT/INDEPENDENT_DEPLOYMENT/evidence/LAST_DAY3_AUTH_FINALIZER_RUN.md"
grep -Fxq 'dns_gate: PASS' "$ROOT/INDEPENDENT_DEPLOYMENT/evidence/LAST_DAY3_DNS_RUN.md"
grep -Fxq 'first_blocker: NONE' "$ROOT/INDEPENDENT_DEPLOYMENT/evidence/LAST_DAY3_DNS_RUN.md"

printf '%s\n' \
  'mcr_to_dt=020' \
  "hostname=$HOSTNAME" \
  'auth_gate=PASS' \
  'dns_gate=PASS' \
  'mode=CONTROLLED_PUBLIC_HTTPS_AND_EXTERNAL_BROWSER' \
  > "$E/00-scope.txt"

# Create/reuse root-only controlled Trial credential material on the DT server.
# No plaintext value is printed, committed, or uploaded as evidence.
"${SSH[@]}" 'set -euo pipefail
  sudo install -d -m 0700 /etc/appts-independent
  if [ ! -s /etc/appts-independent/trial-credentials.json ]; then
    sudo python3 - <<'"'"'PY'"'"'
import json,secrets
aliases=["trial.ops.a","trial.verify.b","trial.disp.c","trial.close.d","trial.trainer.1"]
with open("/etc/appts-independent/trial-credentials.json","w") as f:
    json.dump({a:secrets.token_hex(24) for a in aliases},f,separators=(",",":"))
PY
    sudo chmod 0600 /etc/appts-independent/trial-credentials.json
    sudo chown root:root /etc/appts-independent/trial-credentials.json
  fi
  sudo test "$(stat -c %a /etc/appts-independent/trial-credentials.json)" = 600
'
"${SSH[@]}" 'sudo cat /etc/appts-independent/trial-credentials.json' > "$TRIAL_CREDENTIAL_FILE"
chmod 600 "$TRIAL_CREDENTIAL_FILE"
python3 - "$TRIAL_CREDENTIAL_FILE" <<'PY'
import json,sys
x=json.load(open(sys.argv[1])); expected={"trial.ops.a","trial.verify.b","trial.disp.c","trial.close.d","trial.trainer.1"}
assert set(x)==expected and all(isinstance(v,str) and len(v)>=32 for v in x.values())
PY

# Build the admitted source locally and use its exact hash function to rotate the server registry.
(
  cd "$DEP"
  npm ci
  npm run build:projects
)
TRIAL_CREDENTIAL_FILE="$TRIAL_CREDENTIAL_FILE" node --input-type=module > "$HASH_FILE" <<'NODE'
import fs from 'node:fs';
import { hashTlsDay3Credential } from './DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001/apps/api/dist/trial/tls-day3-auth.js';
const values=JSON.parse(fs.readFileSync(process.env.TRIAL_CREDENTIAL_FILE,'utf8'));
process.stdout.write(JSON.stringify(Object.fromEntries(Object.entries(values).map(([alias,secret])=>[alias,hashTlsDay3Credential(secret)]))));
NODE
chmod 600 "$HASH_FILE"
"${SSH[@]}" 'sudo tee /etc/appts-independent/trial-credential-hashes.json >/dev/null && sudo chmod 0600 /etc/appts-independent/trial-credential-hashes.json && sudo chown root:root /etc/appts-independent/trial-credential-hashes.json' < "$HASH_FILE"

# Render only accepted auth/session deployment wiring and recreate API without DB reset/migration.
"${SSH[@]}" 'set -euo pipefail
  sudo python3 - <<'"'"'PY'"'"'
from pathlib import Path
p=Path("/opt/appts-independent-restore-service/deploy/compose/.env")
h=Path("/etc/appts-independent/trial-credential-hashes.json").read_text().strip()
lines=p.read_text().splitlines()
vals={"APPTS_TLS_TRIAL_CREDENTIAL_HASHES_JSON":"'"+h+"'","APPTS_TLS_SESSION_COOKIE_SECURE":"true"}
out=[]; seen=set()
for line in lines:
    key=line.split("=",1)[0] if "=" in line else ""
    if key in vals:
        out.append(key+"="+vals[key]); seen.add(key)
    else: out.append(line)
for key,val in vals.items():
    if key not in seen: out.append(key+"="+val)
p.write_text("\n".join(out)+"\n")
PY
  cd /opt/appts-independent-restore-service/deploy/compose
  sudo docker compose -f compose.yaml --env-file .env config >/dev/null
  sudo docker compose -f compose.yaml --env-file .env up -d --no-deps --force-recreate api >/dev/null
  for i in $(seq 1 30); do curl -fsS http://127.0.0.1:8080/readyz >/dev/null && break || sleep 1; done
  test "$(curl -fsS http://127.0.0.1:8080/healthz)" = '"'"'{"status":"ok"}'"'"'
  test "$(curl -fsS http://127.0.0.1:8080/readyz)" = '"'"'{"status":"ready"}'"'"'
  test "$(curl -sS -o /dev/null -w "%{http_code}" http://127.0.0.1:8080/api/v1/ui/work-queue)" = 401
'

echo 'credential_rotation_and_nonpublic_auth_guard=PASS' | tee "$E/01-auth-preedge.txt"

# Caddy is a deployment HOW only. Whitelist the browser/API surfaces needed by Trial and block internal health/admin/API catch-all exposure.
cat > /tmp/appts-day3-Caddyfile <<'CADDY'
dev.appts.cifo.id {
  handle /healthz { respond 404 }
  handle /readyz { respond 404 }
  handle /metrics* { respond 404 }
  handle /debug* { respond 404 }
  handle /admin* { respond 404 }
  handle /api/v1/auth/* { reverse_proxy 127.0.0.1:8080 }
  handle /api/v1/ui/* { reverse_proxy 127.0.0.1:8080 }
  handle /api/* { respond 404 }
  handle { reverse_proxy 127.0.0.1:8080 }
}
CADDY
"${SSH[@]}" 'sudo tee /etc/appts-independent/Caddyfile >/dev/null && sudo chmod 0644 /etc/appts-independent/Caddyfile && sudo chown root:root /etc/appts-independent/Caddyfile' < /tmp/appts-day3-Caddyfile

"${SSH[@]}" 'set -euo pipefail
  sudo docker pull caddy:2-alpine >/dev/null
  sudo docker rm -f appts-independent-public-edge >/dev/null 2>&1 || true
  sudo docker run -d --name appts-independent-public-edge --restart unless-stopped --network host \
    -v /etc/appts-independent/Caddyfile:/etc/caddy/Caddyfile:ro \
    -v appts-independent-caddy-data:/data \
    -v appts-independent-caddy-config:/config \
    caddy:2-alpine >/dev/null
  if command -v firewall-cmd >/dev/null 2>&1 && sudo firewall-cmd --state >/dev/null 2>&1; then
    sudo firewall-cmd --permanent --add-service=http >/dev/null
    sudo firewall-cmd --permanent --add-service=https >/dev/null
    sudo firewall-cmd --reload >/dev/null
  fi
  sudo docker image inspect caddy:2-alpine --format "{{index .RepoDigests 0}}"
' | tee "$E/02-edge-image.txt"

# Wait for browser-trusted public HTTPS. curl uses the runner trust store; no insecure mode is permitted.
HTTPS_OK=false
for i in $(seq 1 60); do
  if curl -fsS --max-time 8 "https://${HOSTNAME}/login" -o /dev/null 2>/dev/null; then HTTPS_OK=true; break; fi
  sleep 2
done
[[ "$HTTPS_OK" == true ]]

echo | openssl s_client -connect "${HOSTNAME}:443" -servername "$HOSTNAME" 2>/dev/null | openssl x509 -noout -subject -issuer -dates -ext subjectAltName > "$E/03-certificate.txt"
grep -Fq "DNS:${HOSTNAME}" "$E/03-certificate.txt"

{
  http_code=$(curl -sS -o /dev/null -w '%{http_code}' -H 'Accept: text/html' "http://${HOSTNAME}/work")
  http_loc=$(curl -sS -D - -o /dev/null -H 'Accept: text/html' "http://${HOSTNAME}/work" | awk 'BEGIN{IGNORECASE=1} /^location:/ {gsub(/\r/,"",$2);print $2}' | tail -n1)
  echo "http_work_status=$http_code"
  echo "http_work_location=$http_loc"
  echo "https_login_status=$(curl -sS -o /dev/null -w '%{http_code}' "https://${HOSTNAME}/login")"
  echo "https_unauth_work_queue=$(curl -sS -o /dev/null -w '%{http_code}' "https://${HOSTNAME}/api/v1/ui/work-queue")"
  echo "https_healthz=$(curl -sS -o /dev/null -w '%{http_code}' "https://${HOSTNAME}/healthz")"
  echo "https_readyz=$(curl -sS -o /dev/null -w '%{http_code}' "https://${HOSTNAME}/readyz")"
  for p in 80 443 8080 5432; do
    if timeout 3 bash -c "</dev/tcp/${HOSTNAME}/${p}" >/dev/null 2>&1; then echo "external_tcp_${p}=OPEN"; else echo "external_tcp_${p}=CLOSED_OR_FILTERED"; fi
  done
} | tee "$E/04-public-boundary.txt"
grep -Eq '^http_work_status=30[12378]$' "$E/04-public-boundary.txt"
grep -Eq '^http_work_location=https://dev\.appts\.cifo\.id' "$E/04-public-boundary.txt"
grep -Fxq 'https_login_status=200' "$E/04-public-boundary.txt"
grep -Fxq 'https_unauth_work_queue=401' "$E/04-public-boundary.txt"
grep -Fxq 'https_healthz=404' "$E/04-public-boundary.txt"
grep -Fxq 'https_readyz=404' "$E/04-public-boundary.txt"
grep -Fxq 'external_tcp_80=OPEN' "$E/04-public-boundary.txt"
grep -Fxq 'external_tcp_443=OPEN' "$E/04-public-boundary.txt"
grep -Fxq 'external_tcp_8080=CLOSED_OR_FILTERED' "$E/04-public-boundary.txt"
grep -Fxq 'external_tcp_5432=CLOSED_OR_FILTERED' "$E/04-public-boundary.txt"

# Full external browser journey with persistent controlled Trial credentials.
export DAY3_PUBLIC_ROOT="https://${HOSTNAME}"
export DAY3_PUBLIC_EVIDENCE="$E/browser-main"
export TRIAL_CREDENTIAL_FILE
python3 "$ROOT/INDEPENDENT_DEPLOYMENT/scripts/day3-public-browser-proof.py" | tee "$E/05-browser-main.txt"
TICKET="$(tr -d '\r\n' < "$E/browser-main/ticket-id.txt")"
test -n "$TICKET"
echo "browser_ticket_id=$TICKET" | tee "$E/06-ticket-id.txt"

# Durable readback under least-privilege runtime identity; no mutation.
"${SSH[@]}" "set -euo pipefail; cd /opt/appts-independent-restore-service/deploy/compose; sudo docker compose -f compose.yaml --env-file .env exec -T api node --input-type=module" <<NODE | tee "$E/07-durable-readback.txt"
import {createPersistencePool} from '@appts-restore-service/persistence';
const p=createPersistencePool({connectionString:process.env.DATABASE_URL}); const t='${TICKET}';
async function one(label,sql){const r=await p.query(sql);console.log(label+'='+r.rows[0].v)}
const who=await p.query('select current_user as u,current_database() as d'); console.log('runtime_identity='+who.rows[0].u+'|'+who.rows[0].d);
await one('closed_ticket',`select count(*)::int as v from appts.runtime_ticket where ticket_id='${TICKET}'::uuid and current_state_code='CLOSED' and aggregate_version=3`);
await one('closure_readiness_ready',`select count(*)::int as v from appts.closure_readiness_assessment where ticket_id='${TICKET}'::uuid and result_code='READY'`);
await one('closure_claims',`select count(*)::int as v from appts.claim_record where ticket_id='${TICKET}'::uuid and claim_type_ref='CLOSURE_CLAIM'`);
await one('closure_effect_requests',`select count(*)::int as v from appts.lifecycle_effect_request where ticket_id='${TICKET}'::uuid and requested_effect_class='CLOSURE_CLAIM'`);
await one('closure_effect_results',`select count(*)::int as v from appts.lifecycle_effect_result r join appts.lifecycle_effect_request q on q.effect_request_id=r.effect_request_id where q.ticket_id='${TICKET}'::uuid and q.requested_effect_class='CLOSURE_CLAIM'`);
await one('closed_transitions',`select count(*)::int as v from appts.runtime_state_transition where ticket_id='${TICKET}'::uuid and from_state_code='TERMINAL_PROCESSING' and to_state_code='CLOSED'`);
await one('reopen_effect_requests',`select count(*)::int as v from appts.lifecycle_effect_request where ticket_id='${TICKET}'::uuid and requested_effect_class ilike '%REOPEN%'`);
await one('terminal_transitions',`select count(*)::int as v from appts.runtime_state_transition where ticket_id='${TICKET}'::uuid and to_state_code='TERMINAL_PROCESSING'`);
await one('verified_results',`select count(*)::int as v from appts.verification_result vr join appts.verification_request rq on rq.verification_request_id=vr.verification_request_id where rq.ticket_id='${TICKET}'::uuid and vr.result_code='VERIFIED'`);
await p.end();
NODE
grep -Fxq 'runtime_identity=appts_runtime|appts_dep001_independent' "$E/07-durable-readback.txt"
for x in closed_ticket=1 closure_readiness_ready=1 closure_claims=1 closure_effect_requests=1 closure_effect_results=1 closed_transitions=1 reopen_effect_requests=0 terminal_transitions=1 verified_results=1; do grep -Fxq "$x" "$E/07-durable-readback.txt"; done

# Restart API only, then re-read CLOSED through the same external trusted HTTPS browser path.
"${SSH[@]}" 'set -euo pipefail; cd /opt/appts-independent-restore-service/deploy/compose; sudo docker compose -f compose.yaml --env-file .env restart api >/dev/null; for i in $(seq 1 30); do curl -fsS http://127.0.0.1:8080/readyz >/dev/null && exit 0 || sleep 1; done; exit 1'
for i in $(seq 1 30); do curl -fsS --max-time 6 "https://${HOSTNAME}/login" -o /dev/null && break || sleep 1; done
export DAY3_PUBLIC_PHASE=restart
export DAY3_PUBLIC_TICKET_ID="$TICKET"
export DAY3_PUBLIC_EVIDENCE="$E/browser-restart"
python3 "$ROOT/INDEPENDENT_DEPLOYMENT/scripts/day3-public-browser-proof.py" | tee "$E/08-browser-restart.txt"

printf '%s\n' \
  'mcr_to_dt=020' \
  "hostname=$HOSTNAME" \
  'dns_resolution=PASS' \
  'certificate_browser_trust=PASS' \
  'https_hostname_identity=PASS' \
  'public_80_redirect_only=PASS' \
  'public_443_https=PASS' \
  'public_8080=NON_PUBLIC' \
  'public_5432=NON_PUBLIC' \
  'internal_health_ready_public=BLOCKED_404' \
  'unauthenticated_protected_access=PASS_FAIL_CLOSED' \
  'authenticated_browser_golden_journey=PASS' \
  'browser_stale_request=PASS_FAIL_CLOSED' \
  'browser_identical_replay=PASS_NO_DUPLICATE' \
  'closed_v3_durable_exactly_once=PASS' \
  'logout_session_invalidation=PASS' \
  'restart_recovery_closed_readback=PASS' \
  'product_role_lifecycle_schema_security_policy_meaning_changed=NO' \
  'public_activation=ENABLED_VERIFIED' \
  'final_disposition=PASS' \
  > "$E/09-summary.txt"
cat "$E/09-summary.txt"
