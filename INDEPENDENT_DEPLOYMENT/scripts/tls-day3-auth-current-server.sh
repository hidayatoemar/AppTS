#!/usr/bin/env bash
set -euo pipefail

: "${INDEP_HOST:?INDEP_HOST is required}"
: "${INDEP_USER:?INDEP_USER is required}"
: "${INDEP_POSTGRES_PASSWORD:?INDEP_POSTGRES_PASSWORD is required}"

ROOT="$(git rev-parse --show-toplevel)"
DEP="$ROOT/DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001"
E="$ROOT/INDEPENDENT_DEPLOYMENT/evidence/day3-auth-${GITHUB_RUN_ID:-manual}"
mkdir -p "$E/runtime-proof"
KEY="$HOME/.ssh/independent_deploy_key"
SSH=(ssh -i "$KEY" -o BatchMode=yes -o ConnectTimeout=10 "${INDEP_USER}@${INDEP_HOST}")
COMPOSE_DIR="/opt/appts-independent-restore-service/deploy/compose"
COMPOSE_FILE="$COMPOSE_DIR/compose.yaml"
COMPOSE_ENV="$COMPOSE_DIR/.env"

printf '%s\n' \
  'mcr_to_dt=020' \
  'mode=NON_PUBLIC_AUTH_SESSION_GATE' \
  'public_activation=NOT_PERFORMED' \
  > "$E/00-scope.txt"

cd "$DEP"

# Exact admitted CODEX058 overlay identity from the controlled transfer manifest.
cat > "$E/expected-overlay.sha256" <<'EOF'
308e48b84db609da8c9a94682011abc35ddb14276d22a309698125118c62b59e  apps/api/src/dep-bootstrap.ts
70147e1bae3b93dfb0a76ffaf25b88d44cbcd666ff2ec43b296ef8b5557a5390  apps/api/src/projections/trial-projection-port.ts
af421e1ac63e00cf5a8bca657d06ec49d33dd9971f6f5d7c7ae1220aa72d4d30  apps/api/src/routes/trial-auth-http.ts
4b75c9140a01b050c3e237244251e9c3199b8351aea9cd1751e6df0e0ca83404  apps/api/src/routes/trial-end-shift-http.ts
fda9da90d4ab546258dd28cce1b81fc68f5effdab2a9ea9f86b90e763a8f0a96  apps/api/src/routes/trial-trainer-http.ts
297adb454c025341e80e0f2d6ceebd1817798091f908ca3bacf69eccc8d09087  apps/api/src/routes/ui-http.ts
91bbae67712cdc5c72bbe269096a91a876a85df78ef377f545275ae42fe5ae8a  apps/api/src/routes/ui-read.ts
e479dc063151e7c9d88ab74e749c2dc67f399505a66ea684ed67994fed6ff5f4  apps/api/src/trial/tls-day3-arc002-flow.ts
7effc844215c4247a6e1d8173df01a497dc8aed74ceb2e18a4d4d86459cb7ed0  apps/api/src/trial/tls-day3-auth.ts
bc79fbc126811afd05a3be6b45481957a10b082c8238b14b2ff524b28eefcaf9  apps/api/src/trial/tls-day3-trainer-reseed.ts
925cd2bbcb66b83a5c7534306e6ccfaefdbd1545c42af534399914fe9791ad01  apps/web/src/app.tsx
9d46804e3ed582fe46c76d7e2a16269c3c47a7ac7d5ffa39d2333ad823a12604  apps/web/src/auth.ts
5cfc90399ffdcb31c70ea43437ccd8a11722ed27f623deea9fa0e8ec27e51134  apps/web/src/router.ts
cf03e6e6385194ecf40d5c0e266556d9a615468cc13604f55e9876d34b3b615e  apps/web/src/views/ClosureReadinessView.tsx
7177174da4aff4df0821f40e7f2eaa65dbfd11076726cca20abd1eedeb592271  apps/web/src/views/EndShiftView.tsx
1345e87836c03b7c2748606411dcfb38b766bfef52808e3f4c2b8b6afdd735b8  apps/web/src/views/LoginView.tsx
b12fbd014f9e40dabbffd3fe28a3788e09e9f2f92409ee732e8c0709c66ae2c8  apps/web/src/views/TicketConsoleView.tsx
aaa6b8681ce6c2482f2d160f67f82ac45c6f69ac9fac569402075f044fc46524  apps/web/src/views/TrainerConsoleView.tsx
27ad4cca523c557d8b5cc25a0126845fa249bf076a619579e7e83d0d0859628d  apps/web/src/views/WorkQueueView.tsx
ee8d0d9c4c4c38587a04714e305985c254651c88ebe2b9a26aec64fe7462e190  tests/dep001/tls-day3-runtime-proof.py
EOF
sha256sum -c "$E/expected-overlay.sha256" | tee "$E/01-overlay-sha256.txt"
test "$(wc -l < "$E/expected-overlay.sha256" | tr -d ' ')" = 20

# Frozen baseline / Day-1 / Day-2 protected material must remain untouched from pre-Day3 DT head.
git diff --exit-code e9aeefbc802566dbac0beb3ca7aea68b680da0ec HEAD -- \
  package-lock.json \
  db/migrations/V001__cf01_core_schema.sql \
  db/migrations/V002__cf01_runtime_and_exchange_schema.sql \
  db/migrations/V003__dg04_diagnostic_persistence.sql \
  db/migrations/V004__d05_pending_capture_v2.sql \
  deploy/db/grant-runtime.sh \
  deploy/db/seed-tls-day1-golden.sql \
  deploy/db/seed-tls-day2-arc001.sql \
  apps/api/src/trial/pre-ticket-trial-owner-flow.ts \
  apps/api/src/trial/tls-day1-golden-flow.ts \
  apps/api/src/trial/tls-day2-arc001-flow.ts \
  > "$E/02-protected-diff.txt"
printf 'protected_material=PASS\n' | tee -a "$E/02-protected-diff.txt"

# Exact toolchain and accepted static/build gates.
test "$(node --version)" = 'v24.19.0'
test "$(npm --version)" = '11.17.0'
npm ci
npm run verify:boundaries | tee "$E/03-boundaries.txt"
npm run typecheck | tee "$E/04-typecheck.txt"
npm run build | tee "$E/05-build.txt"
npm run test:contracts | tee "$E/06-contracts.txt"
npm run test:adverse | tee "$E/07-adverse.txt"

# Generate five ephemeral controlled Trial credentials. Plaintext never leaves process memory/evidence.
export CODEX058_OPS_SECRET="$(openssl rand -hex 24)"
export CODEX058_VERIFY_SECRET="$(openssl rand -hex 24)"
export CODEX058_DISP_SECRET="$(openssl rand -hex 24)"
export CODEX058_CLOSE_SECRET="$(openssl rand -hex 24)"
export CODEX058_TRAINER_SECRET="$(openssl rand -hex 24)"
for v in CODEX058_OPS_SECRET CODEX058_VERIFY_SECRET CODEX058_DISP_SECRET CODEX058_CLOSE_SECRET CODEX058_TRAINER_SECRET; do
  printf '::add-mask::%s\n' "${!v}"
done
export APPTS_TLS_TRIAL_CREDENTIAL_HASHES_JSON="$(node --input-type=module <<'NODE'
import { hashTlsDay3Credential } from './apps/api/dist/trial/tls-day3-auth.js';
const values={
 'trial.ops.a':process.env.CODEX058_OPS_SECRET,
 'trial.verify.b':process.env.CODEX058_VERIFY_SECRET,
 'trial.disp.c':process.env.CODEX058_DISP_SECRET,
 'trial.close.d':process.env.CODEX058_CLOSE_SECRET,
 'trial.trainer.1':process.env.CODEX058_TRAINER_SECRET,
};
process.stdout.write(JSON.stringify(Object.fromEntries(Object.entries(values).map(([alias,secret])=>[alias,hashTlsDay3Credential(secret)]))));
NODE
)"
printf '::add-mask::%s\n' "$APPTS_TLS_TRIAL_CREDENTIAL_HASHES_JSON"
export APPTS_TLS_SESSION_COOKIE_SECURE=false
printf '%s\n' \
  'credential_plaintext_persisted=false' \
  'credential_registry_contains_hashes_only=true' \
  'configured_alias_count=5' \
  > "$E/08-credential-boundary.txt"

cd "$ROOT"
# Source-only resync and rebuild; preserve DB container/data and existing V001-V004 state.
ansible-playbook -i INDEPENDENT_DEPLOYMENT/ansible/inventory.ini INDEPENDENT_DEPLOYMENT/ansible/playbooks/resync.yml | tee "$E/09-resync.txt"
ansible-playbook -i INDEPENDENT_DEPLOYMENT/ansible/inventory.ini INDEPENDENT_DEPLOYMENT/ansible/playbooks/start.yml | tee "$E/10-start.txt"

# Current server must remain non-public before auth gate is declared PASS.
"${SSH[@]}" "set -euo pipefail
  printf 'healthz='; curl -fsS http://127.0.0.1:8080/healthz; echo
  printf 'readyz='; curl -fsS http://127.0.0.1:8080/readyz; echo
  sudo ss -H -lnt | grep -E '(:22|:80|:443|:8080|:5432)([[:space:]]|$)' || true
  cd '$COMPOSE_DIR'
  sudo docker compose -f compose.yaml --env-file .env ps
" | tee "$E/11-server-health-listeners.txt"
grep -Fq 'healthz={"status":"ok"}' "$E/11-server-health-listeners.txt"
grep -Fq 'readyz={"status":"ready"}' "$E/11-server-health-listeners.txt"
grep -Fq '127.0.0.1:8080' "$E/11-server-health-listeners.txt"
! grep -Eq '(^|[[:space:]])(0\.0\.0\.0|\[::\]|\*):8080' "$E/11-server-health-listeners.txt"

# Establish test-only SSH tunnel. The trainee/public path is not using this; this is pre-public auth verification only.
ssh -i "$KEY" -o BatchMode=yes -o ExitOnForwardFailure=yes -o ConnectTimeout=10 -fN \
  -L 18080:127.0.0.1:8080 "${INDEP_USER}@${INDEP_HOST}"
TUNNEL_PID="$(pgrep -f 'ssh .*18080:127.0.0.1:8080' | head -n1 || true)"
cleanup(){ if [ -n "${TUNNEL_PID:-}" ]; then kill "$TUNNEL_PID" 2>/dev/null || true; fi; }
trap cleanup EXIT
for i in $(seq 1 30); do curl -fsS http://127.0.0.1:18080/readyz >/dev/null && break || sleep 1; done

export CODEX058_ROOT=http://127.0.0.1:18080
export CODEX058_EVIDENCE="$E/runtime-proof"
python3 "$DEP/tests/dep001/tls-day3-runtime-proof.py" | tee "$E/12-runtime-main.txt"

CLOSED_TICKET="$(cat "$E/runtime-proof/closed-ticket-id.txt")"
OPEN_TICKET="$(cat "$E/runtime-proof/open-ticket-id.txt")"
test -n "$CLOSED_TICKET"; test -n "$OPEN_TICKET"; test "$CLOSED_TICKET" != "$OPEN_TICKET"

# Establish an authenticated cookie specifically to prove process restart invalidates server-side session state.
python3 - <<'PY'
import http.cookiejar,json,os,urllib.request
jar=http.cookiejar.MozillaCookieJar(os.environ['CODEX058_EVIDENCE']+'/pre-restart-cookie.txt')
op=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
body=json.dumps({'alias':'trial.ops.a','credential':os.environ['CODEX058_OPS_SECRET']}).encode()
req=urllib.request.Request(os.environ['CODEX058_ROOT']+'/api/v1/auth/login',data=body,headers={'content-type':'application/json'},method='POST')
with op.open(req,timeout=30) as r: assert r.status==200
jar.save(ignore_discard=True,ignore_expires=True)
PY

"${SSH[@]}" "set -euo pipefail; cd '$COMPOSE_DIR'; sudo docker compose -f compose.yaml --env-file .env restart api >/dev/null; for i in \$(seq 1 30); do curl -fsS http://127.0.0.1:8080/readyz >/dev/null && exit 0 || sleep 1; done; exit 1"
for i in $(seq 1 30); do curl -fsS http://127.0.0.1:18080/readyz >/dev/null && break || sleep 1; done

python3 - <<'PY'
import http.cookiejar,os,urllib.error,urllib.request
jar=http.cookiejar.MozillaCookieJar(os.environ['CODEX058_EVIDENCE']+'/pre-restart-cookie.txt'); jar.load(ignore_discard=True,ignore_expires=True)
op=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
try:
    op.open(os.environ['CODEX058_ROOT']+'/api/v1/auth/session',timeout=30)
    raise AssertionError('pre-restart session unexpectedly survived process restart')
except urllib.error.HTTPError as e:
    assert e.code==401,e.code
print('PRE_RESTART_SESSION_INVALIDATED=PASS')
PY

CODEX058_PHASE=restart python3 "$DEP/tests/dep001/tls-day3-runtime-proof.py" | tee "$E/13-runtime-restart.txt"

# Actual browser bootstrap via loopback tunnel: unauthenticated governed route must land on real Login surface.
CHROME=""; for c in google-chrome google-chrome-stable chromium chromium-browser; do command -v "$c" >/dev/null 2>&1 && CHROME="$(command -v "$c")" && break; done
test -n "$CHROME"
"$CHROME" --version | tee "$E/14-browser-version.txt"
"$CHROME" --headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage --virtual-time-budget=5000 \
  --dump-dom http://127.0.0.1:18080/work > "$E/15-login-from-work.html"
grep -Fq 'AppTS Trial Login' "$E/15-login-from-work.html"
grep -Fq 'trial.ops.a' "$E/15-login-from-work.html"
"$CHROME" --headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage --virtual-time-budget=5000 \
  --window-size=1440,1000 --screenshot="$E/16-login-bootstrap.png" http://127.0.0.1:18080/work >/dev/null 2>&1

# Durable readback under least-privilege runtime identity; no database mutation.
"${SSH[@]}" "set -euo pipefail; cd '$COMPOSE_DIR'; sudo docker compose -f compose.yaml --env-file .env exec -T api node --input-type=module -e \"
import {createPersistencePool} from '@appts-restore-service/persistence';
const p=createPersistencePool({connectionString:process.env.DATABASE_URL});
const t='${CLOSED_TICKET}'; const o='${OPEN_TICKET}';
const one=async(label,sql,args=[])=>{const r=await p.query(sql,args); console.log(label+'='+r.rows[0].v)};
const who=await p.query('select current_user as u,current_database() as d'); console.log('runtime_identity='+who.rows[0].u+'|'+who.rows[0].d);
await one('closed_ticket',\"select count(*)::int as v from appts.runtime_ticket where ticket_id=\\$1::uuid and current_state_code='CLOSED' and aggregate_version=3\",[t]);
await one('open_ticket',\"select count(*)::int as v from appts.runtime_ticket where ticket_id=\\$1::uuid and current_state_code='ACCEPTED' and aggregate_version=0\",[o]);
await one('closed_transitions',\"select count(*)::int as v from appts.runtime_state_transition where ticket_id=\\$1::uuid and from_state_code='TERMINAL_PROCESSING' and to_state_code='CLOSED'\",[t]);
await one('closure_effect_requests',\"select count(*)::int as v from appts.lifecycle_effect_request where ticket_id=\\$1::uuid and requested_effect_class='CLOSURE_CLAIM'\",[t]);
await one('reopen_effect_requests',\"select count(*)::int as v from appts.lifecycle_effect_request where ticket_id=\\$1::uuid and requested_effect_class ilike '%REOPEN%'\",[t]);
await p.end();
\"" | tee "$E/17-durable-readback.txt"
grep -Fxq 'runtime_identity=appts_runtime|appts_dep001_independent' "$E/17-durable-readback.txt"
for x in closed_ticket=1 open_ticket=1 closed_transitions=1 closure_effect_requests=1 reopen_effect_requests=0; do grep -Fxq "$x" "$E/17-durable-readback.txt"; done

# Final pre-public boundary probe from the external Actions runner.
{
  for p in 80 443 8080 5432; do
    if timeout 3 bash -c "</dev/tcp/${INDEP_HOST}/${p}" >/dev/null 2>&1; then echo "external_tcp_${p}=OPEN"; else echo "external_tcp_${p}=CLOSED_OR_FILTERED"; fi
  done
} | tee "$E/18-pre-public-external-ports.txt"
grep -Fxq 'external_tcp_8080=CLOSED_OR_FILTERED' "$E/18-pre-public-external-ports.txt"
grep -Fxq 'external_tcp_5432=CLOSED_OR_FILTERED' "$E/18-pre-public-external-ports.txt"

printf '%s\n' \
  'overlay_identity=PASS' \
  'static_build_contract_adverse=PASS' \
  'current_server_resync_db_preserved=PASS' \
  'auth_session_guard=PASS' \
  'five_alias_bindings=PASS' \
  'client_authority_tamper=PASS' \
  'trainer_product_authority_denied=PASS' \
  'day3_golden_closure=PASS' \
  'single_terminal_processing_to_closed=PASS' \
  'replay_no_duplicate=PASS' \
  'no_reopen=PASS' \
  'end_shift_read_only=PASS' \
  'logout_session_invalidation=PASS' \
  'restart_session_invalidation=PASS' \
  'closed_restart_durable=PASS' \
  'browser_login_bootstrap=PASS' \
  'public_8080=NOT_EXPOSED' \
  'public_5432=NOT_EXPOSED' \
  'public_activation=NOT_PERFORMED' \
  'authentication_gate=PASS' \
  > "$E/SUMMARY.txt"
cat "$E/SUMMARY.txt"
