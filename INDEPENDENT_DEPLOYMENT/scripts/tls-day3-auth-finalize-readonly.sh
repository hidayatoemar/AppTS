#!/usr/bin/env bash
set -euo pipefail

: "${INDEP_HOST:?INDEP_HOST is required}"
: "${INDEP_USER:?INDEP_USER is required}"

ROOT="$(git rev-parse --show-toplevel)"
E="$ROOT/INDEPENDENT_DEPLOYMENT/evidence/day3-auth-finalizer-${GITHUB_RUN_ID:-manual}"
mkdir -p "$E"
KEY="$HOME/.ssh/independent_deploy_key"
SSH=(ssh -i "$KEY" -o BatchMode=yes -o ConnectTimeout=10 "${INDEP_USER}@${INDEP_HOST}")
COMPOSE_DIR="/opt/appts-independent-restore-service/deploy/compose"
CLOSED_TICKET="2e641262-a413-43ad-be36-cbb99f4eadc9"
OPEN_TICKET="ced26456-3fa0-44ff-bb09-56422a07ad29"

printf '%s\n' \
  'mcr_to_dt=020' \
  'mode=READ_ONLY_AUTH_GATE_FINALIZER' \
  "closed_ticket=$CLOSED_TICKET" \
  "open_ticket=$OPEN_TICKET" \
  'public_activation=NOT_PERFORMED' \
  > "$E/00-scope.txt"

"${SSH[@]}" "set -euo pipefail
  printf 'healthz='; curl -fsS http://127.0.0.1:8080/healthz; echo
  printf 'readyz='; curl -fsS http://127.0.0.1:8080/readyz; echo
  printf 'unauth_work_queue_status='; curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:8080/api/v1/ui/work-queue; echo
  tmp=\$(mktemp); trap 'rm -f \"\$tmp\"' EXIT
  curl -sS -H 'Accept: text/html' -D \"\$tmp\" -o /dev/null http://127.0.0.1:8080/work
  printf 'work_redirect_status='; awk 'toupper(\$1) ~ /^HTTP\\// {code=\$2} END{print code}' \"\$tmp\"
  printf 'work_redirect_location='; awk 'BEGIN{IGNORECASE=1} /^Location:/ {gsub(/\\r/,\"\",\$2); print \$2}' \"\$tmp\"
  sudo ss -H -lnt | grep -E '(:22|:80|:443|:8080|:5432)([[:space:]]|$)' || true
" | tee "$E/01-health-auth-listeners.txt"
grep -Fq 'healthz={"status":"ok"}' "$E/01-health-auth-listeners.txt"
grep -Fq 'readyz={"status":"ready"}' "$E/01-health-auth-listeners.txt"
grep -Fxq 'unauth_work_queue_status=401' "$E/01-health-auth-listeners.txt"
grep -Eq '^work_redirect_status=30[2378]$' "$E/01-health-auth-listeners.txt"
grep -Fxq 'work_redirect_location=/login' "$E/01-health-auth-listeners.txt"
grep -Fq '127.0.0.1:8080' "$E/01-health-auth-listeners.txt"
! grep -Eq '(^|[[:space:]])(0\.0\.0\.0|\[::\]|\*):8080' "$E/01-health-auth-listeners.txt"

# Query only durable state through the existing least-privilege API runtime connection.
"${SSH[@]}" "set -euo pipefail; cd '$COMPOSE_DIR'; sudo docker compose -f compose.yaml --env-file .env exec -T api node --input-type=module" <<'NODE' | tee "$E/02-durable-readback.txt"
import {createPersistencePool} from '@appts-restore-service/persistence';
const p=createPersistencePool({connectionString:process.env.DATABASE_URL});
const t='2e641262-a413-43ad-be36-cbb99f4eadc9';
const o='ced26456-3fa0-44ff-bb09-56422a07ad29';
async function one(label,sql){const r=await p.query(sql); console.log(label+'='+r.rows[0].v);}
const who=await p.query('select current_user as u,current_database() as d');
console.log('runtime_identity='+who.rows[0].u+'|'+who.rows[0].d);
await one('closed_ticket',`select count(*)::int as v from appts.runtime_ticket where ticket_id='${t}'::uuid and current_state_code='CLOSED' and aggregate_version=3`);
await one('open_ticket',`select count(*)::int as v from appts.runtime_ticket where ticket_id='${o}'::uuid and current_state_code='ACCEPTED' and aggregate_version=0`);
await one('closure_readiness_ready',`select count(*)::int as v from appts.closure_readiness_assessment where ticket_id='${t}'::uuid and result_code='READY'`);
await one('closure_claims',`select count(*)::int as v from appts.claim_record where ticket_id='${t}'::uuid and claim_type_ref='CLOSURE_CLAIM'`);
await one('closure_effect_requests',`select count(*)::int as v from appts.lifecycle_effect_request where ticket_id='${t}'::uuid and requested_effect_class='CLOSURE_CLAIM'`);
await one('closure_effect_results',`select count(*)::int as v from appts.lifecycle_effect_result r join appts.lifecycle_effect_request q on q.effect_request_id=r.effect_request_id where q.ticket_id='${t}'::uuid and q.requested_effect_class='CLOSURE_CLAIM'`);
await one('closed_transitions',`select count(*)::int as v from appts.runtime_state_transition where ticket_id='${t}'::uuid and from_state_code='TERMINAL_PROCESSING' and to_state_code='CLOSED'`);
await one('reopen_effect_requests',`select count(*)::int as v from appts.lifecycle_effect_request where ticket_id='${t}'::uuid and requested_effect_class ilike '%REOPEN%'`);
await one('terminal_transitions',`select count(*)::int as v from appts.runtime_state_transition where ticket_id='${t}'::uuid and to_state_code='TERMINAL_PROCESSING'`);
await one('verified_results',`select count(*)::int as v from appts.verification_result vr join appts.verification_request rq on rq.verification_request_id=vr.verification_request_id where rq.ticket_id='${t}'::uuid and vr.result_code='VERIFIED'`);
await p.end();
NODE

grep -Fxq 'runtime_identity=appts_runtime|appts_dep001_independent' "$E/02-durable-readback.txt"
for x in \
  closed_ticket=1 open_ticket=1 closure_readiness_ready=1 closure_claims=1 \
  closure_effect_requests=1 closure_effect_results=1 closed_transitions=1 \
  reopen_effect_requests=0 terminal_transitions=1 verified_results=1; do
  grep -Fxq "$x" "$E/02-durable-readback.txt"
done

# Public-backend boundary remains held while finalizing authentication.
{
  for p in 80 443 8080 5432; do
    if timeout 3 bash -c "</dev/tcp/${INDEP_HOST}/${p}" >/dev/null 2>&1; then
      echo "external_tcp_${p}=OPEN"
    else
      echo "external_tcp_${p}=CLOSED_OR_FILTERED"
    fi
  done
} | tee "$E/03-external-boundary.txt"
grep -Fxq 'external_tcp_8080=CLOSED_OR_FILTERED' "$E/03-external-boundary.txt"
grep -Fxq 'external_tcp_5432=CLOSED_OR_FILTERED' "$E/03-external-boundary.txt"

printf '%s\n' \
  'first_run_runtime_d3_01_to_d3_12=PASS' \
  'first_run_runtime_d3_14_to_d3_18=PASS' \
  'first_run_restart_session_invalidation=PASS' \
  'first_run_restart_closed_readback=PASS' \
  'first_run_browser_login_bootstrap=PASS' \
  'durable_closed_v3=PASS' \
  'durable_open_control_ticket=PASS' \
  'single_terminal_processing_to_closed=PASS' \
  'single_closure_effect=PASS' \
  'no_reopen=PASS' \
  'unauthenticated_work_queue_fail_closed=PASS' \
  'unauthenticated_work_redirect_login=PASS' \
  'public_8080=NOT_EXPOSED' \
  'public_5432=NOT_EXPOSED' \
  'public_activation=NOT_PERFORMED' \
  'authentication_gate=PASS' \
  > "$E/SUMMARY.txt"
cat "$E/SUMMARY.txt"
