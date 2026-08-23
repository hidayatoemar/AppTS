#!/usr/bin/env bash
set -euo pipefail

: "${INDEP_HOST:?INDEP_HOST is required}"
: "${INDEP_USER:?INDEP_USER is required}"

REPO_ROOT="$(git rev-parse --show-toplevel)"
EVIDENCE_DIR="$REPO_ROOT/INDEPENDENT_DEPLOYMENT/evidence/tls-day2-resume-${GITHUB_RUN_ID:-manual}"
mkdir -p "$EVIDENCE_DIR"
PORT=18081
KEY="$HOME/.ssh/independent_deploy_key"
REMOTE_HOST="${INDEP_USER}@${INDEP_HOST}"
SSH_BASE=(ssh -i "$KEY" -o BatchMode=yes)
COMPOSE_DIR="/opt/appts-independent-restore-service/deploy/compose"
COMPOSE_FILE="$COMPOSE_DIR/compose.yaml"
COMPOSE_ENV="$COMPOSE_DIR/.env"
INSTALL_ROOT="/opt/appts-independent-restore-service"
DAY2_SEED="$INSTALL_ROOT/deploy/db/seed-tls-day2-arc001.sql"

"${SSH_BASE[@]}" -o ExitOnForwardFailure=yes -N -L "${PORT}:127.0.0.1:8080" "$REMOTE_HOST" &
TUNNEL_PID=$!
trap 'kill "$TUNNEL_PID" 2>/dev/null || true' EXIT
for _ in $(seq 1 60); do
  curl -fsS "http://127.0.0.1:${PORT}/readyz" >/dev/null 2>&1 && break
  sleep 1
done
curl -fsS "http://127.0.0.1:${PORT}/healthz" | tee "$EVIDENCE_DIR/healthz.json"
curl -fsS "http://127.0.0.1:${PORT}/readyz" | tee "$EVIDENCE_DIR/readyz.json"

"${SSH_BASE[@]}" "$REMOTE_HOST" \
  "sudo docker compose -f '$COMPOSE_FILE' --env-file '$COMPOSE_ENV' exec -T api node --input-type=module -e 'import {createPersistencePool} from \"@appts-restore-service/persistence\"; const p=createPersistencePool({connectionString:process.env.DATABASE_URL}); const r=await p.query(\"select current_user as u,current_database() as d\"); console.log(r.rows[0].u+\"|\"+r.rows[0].d); await p.end();'" \
  | tee "$EVIDENCE_DIR/runtime-db-identity.txt"
grep -Fxq 'appts_runtime|appts_dep001_independent' "$EVIDENCE_DIR/runtime-db-identity.txt"

# Re-prove Day-2 seed cannot execute as the runtime identity. No seed mutation is performed here.
set +e
RUNTIME_SEED_OUTPUT="$("${SSH_BASE[@]}" "$REMOTE_HOST" "set -o pipefail; cat '$DAY2_SEED' | sudo docker compose -f '$COMPOSE_FILE' --env-file '$COMPOSE_ENV' exec -T api node --input-type=module -e 'import {createPersistencePool} from \"@appts-restore-service/persistence\"; let sql=\"\"; for await (const c of process.stdin) sql+=c; const p=createPersistencePool({connectionString:process.env.DATABASE_URL}); try { await p.query(sql); console.error(\"UNEXPECTED_SEED_ACCEPT\"); process.exitCode=9; } catch(e) { console.log(String(e?.message??e)); } finally { await p.end(); }'" 2>&1)"
RUNTIME_SEED_RC=$?
set -e
printf '%s\n' "$RUNTIME_SEED_OUTPUT" | tee "$EVIDENCE_DIR/runtime-seed-rejection.txt"
grep -Fq 'TLS-DAY2 STOP: ARC001 static Trial binding seed must not run as appts_runtime' "$EVIDENCE_DIR/runtime-seed-rejection.txt"
if grep -Fq 'UNEXPECTED_SEED_ACCEPT' "$EVIDENCE_DIR/runtime-seed-rejection.txt"; then exit 9; fi
printf 'runtime_seed_command_rc=%s\n' "$RUNTIME_SEED_RC" | tee -a "$EVIDENCE_DIR/runtime-seed-rejection.txt"

# Confirm the previously admitted Day-2 deployment bindings are present without re-seeding.
"${SSH_BASE[@]}" "$REMOTE_HOST" \
  "sudo docker compose -f '$COMPOSE_FILE' --env-file '$COMPOSE_ENV' exec -T postgres psql -X -U appts_admin -d appts_dep001_independent -Atqc \"SELECT 'day2_source='||count(*) FROM appts.source_ref WHERE source_ref_id='52010000-0000-4000-8000-000000000001'; SELECT 'day2_assignments='||count(*) FROM appts.assignment_snapshot WHERE assignment_snapshot_id IN ('52010000-0000-4000-8000-000000000014','52010000-0000-4000-8000-000000000024','52010000-0000-4000-8000-000000000034');\"" \
  | tee "$EVIDENCE_DIR/day2-binding-readback.txt"
grep -Fxq 'day2_source=1' "$EVIDENCE_DIR/day2-binding-readback.txt"
grep -Fxq 'day2_assignments=3' "$EVIDENCE_DIR/day2-binding-readback.txt"

# Day-1 negative regression: a pre-ticket case record may be CREATED, but decision must remain HOLD and Ticket count must not change.
python3 - "$PORT" "$EVIDENCE_DIR/day1-negative-regression.json" <<'PY'
import json,sys,urllib.request,uuid
port,out=sys.argv[1:]
base=f'http://127.0.0.1:{port}/api/v1/ui'
def get(path):
    with urllib.request.urlopen(base+path,timeout=30) as r:return json.loads(r.read().decode())
def post(body):
    req=urllib.request.Request(base+'/intents',data=json.dumps(body).encode(),headers={'content-type':'application/json'},method='POST')
    with urllib.request.urlopen(req,timeout=30) as r:return json.loads(r.read().decode())
before=get('/work-queue')['data']['ticket_count']
payload={'messageId':str(uuid.uuid4()),'idempotencyKey':str(uuid.uuid4()),'correlationId':str(uuid.uuid4())}
r=post({'intent_contract_ref':'APPTS.CORE.D01.PRETICKET_ADMISSION.SUBMISSION / 1.0.0','payload':payload})
after=get('/work-queue')['data']['ticket_count']
assert r.get('decision')=='HOLD_AS_PRE_TICKET',r
assert r.get('assessmentResult')=='NOT_ACCEPTABLE',r
assert before==after,(before,after,r)
assert not r.get('ticketId'),r
json.dump({'beforeTicketCount':before,'response':r,'afterTicketCount':after},open(out,'w'),separators=(',',':'))
print('day1_negative_regression=PASS')
PY

# Independent runtime progression proof using the admitted producer proof as a behavioral oracle against the DT server.
PRODUCER_E="$EVIDENCE_DIR/producer-runtime"
mkdir -p "$PRODUCER_E"
CODEX055_BASE="http://127.0.0.1:${PORT}/api/v1/ui" CODEX055_EVIDENCE="$PRODUCER_E" \
  python3 "$REPO_ROOT/DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001/tests/dep001/tls-day2-producer-runtime-proof.py" \
  | tee "$EVIDENCE_DIR/producer-runtime-ticket.stdout"
PRIMARY_TICKET="$(cat "$PRODUCER_E/ticket-id.txt")"
RERUN_TICKET="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["ticketId"])' "$PRODUCER_E/rerun.json")"
printf 'primary_ticket=%s\nrerun_ticket=%s\n' "$PRIMARY_TICKET" "$RERUN_TICKET" | tee "$EVIDENCE_DIR/runtime-ticket-ids.txt"

# Browser-surface proof with a separate governed Ticket.
CHROME=""
for candidate in google-chrome google-chrome-stable chromium chromium-browser; do
  if command -v "$candidate" >/dev/null 2>&1; then CHROME="$(command -v "$candidate")"; break; fi
done
test -n "$CHROME" || { echo 'STOP: no headless Chrome/Chromium binary on Actions runner'; exit 2; }
"$CHROME" --version | tee "$EVIDENCE_DIR/browser-version.txt"
BROWSER_E="$EVIDENCE_DIR/browser"
mkdir -p "$BROWSER_E"
DT_DAY2_ROOT="http://127.0.0.1:${PORT}" DT_DAY2_EVIDENCE="$BROWSER_E" CHROME="$CHROME" \
  python3 "$REPO_ROOT/INDEPENDENT_DEPLOYMENT/scripts/tls-day2-browser-proof.py" \
  | tee "$EVIDENCE_DIR/browser-ticket.stdout"
BROWSER_TICKET="$(cat "$BROWSER_E/browser-ticket-id.txt")"
printf 'browser_ticket=%s\n' "$BROWSER_TICKET" | tee "$EVIDENCE_DIR/browser-ticket-id.txt"

# Durable readback for the primary terminal-processing Ticket, repeatability Ticket, browser Ticket, and global CLOSED boundary.
"${SSH_BASE[@]}" "$REMOTE_HOST" \
  "sudo docker compose -f '$COMPOSE_FILE' --env-file '$COMPOSE_ENV' exec -T postgres psql -X -U appts_admin -d appts_dep001_independent -Atqc \"SELECT 'primary_runtime='||current_state_code||'|'||aggregate_version FROM appts.runtime_ticket WHERE ticket_id='${PRIMARY_TICKET}'::uuid; SELECT 'primary_transitions='||count(*) FROM appts.runtime_state_transition WHERE ticket_id='${PRIMARY_TICKET}'::uuid; SELECT 'primary_action_intents='||count(*) FROM appts.action_intent WHERE ticket_id='${PRIMARY_TICKET}'::uuid; SELECT 'primary_qer='||count(*) FROM appts.qualified_external_record WHERE ticket_id='${PRIMARY_TICKET}'::uuid; SELECT 'primary_evidence='||count(*) FROM appts.evidence_object WHERE ticket_id='${PRIMARY_TICKET}'::uuid; SELECT 'primary_verification_requests='||count(*) FROM appts.verification_request WHERE ticket_id='${PRIMARY_TICKET}'::uuid; SELECT 'primary_verification_results='||count(*) FROM appts.verification_result vr JOIN appts.verification_request rq ON rq.verification_request_id=vr.verification_request_id WHERE rq.ticket_id='${PRIMARY_TICKET}'::uuid; SELECT 'rerun_runtime='||current_state_code||'|'||aggregate_version FROM appts.runtime_ticket WHERE ticket_id='${RERUN_TICKET}'::uuid; SELECT 'browser_runtime='||current_state_code||'|'||aggregate_version FROM appts.runtime_ticket WHERE ticket_id='${BROWSER_TICKET}'::uuid; SELECT 'closed_total='||count(*) FROM appts.runtime_ticket WHERE current_state_code='CLOSED';\"" \
  | tee "$EVIDENCE_DIR/durable-readback.txt"
grep -Fxq 'primary_runtime=TERMINAL_PROCESSING|2' "$EVIDENCE_DIR/durable-readback.txt"
grep -Fxq 'primary_transitions=2' "$EVIDENCE_DIR/durable-readback.txt"
grep -Fxq 'primary_qer=1' "$EVIDENCE_DIR/durable-readback.txt"
grep -Fxq 'primary_evidence=1' "$EVIDENCE_DIR/durable-readback.txt"
grep -Fxq 'primary_verification_requests=1' "$EVIDENCE_DIR/durable-readback.txt"
grep -Fxq 'primary_verification_results=1' "$EVIDENCE_DIR/durable-readback.txt"
grep -Fxq 'rerun_runtime=ACTIVE|1' "$EVIDENCE_DIR/durable-readback.txt"
grep -Fxq 'browser_runtime=TERMINAL_PROCESSING|2' "$EVIDENCE_DIR/durable-readback.txt"
grep -Fxq 'closed_total=0' "$EVIDENCE_DIR/durable-readback.txt"

# Browser evidence must contain all expected stage captures.
test -s "$BROWSER_E/browser-stage-proof.json"
for n in 01-active-ticket 02-trainer-before 03-provisional-evidence 04-request-action 05-closure-withheld 06-verify-action 07-verified-evidence 08-terminal-action 09-terminal-ticket 10-terminal-closure 11-trainer-after; do
  test -s "$BROWSER_E/${n}.html"
  test -s "$BROWSER_E/${n}.png"
done

cat > "$EVIDENCE_DIR/SUMMARY.txt" <<EOF
mcr_to_dt=016
resume_health_ready=PASS
runtime_identity=appts_runtime
runtime_seed_rejection=PASS
day2_bindings_present=PASS
day1_negative_regression=PASS
day1_positive_and_activate_regression=PASS
day2_provisional_evidence=PASS
wrong_verifier_fail_closed=PASS
independent_verifier=PASS
terminal_claim_predicate_gating=PASS
lifecycle_active_to_terminal_processing=PASS
terminal_replay_no_duplicate_effect=PASS
closed_total=0
close_withheld=PASS
repeatability_distinct_scenario=PASS
browser_user_consumability=PASS
primary_ticket=${PRIMARY_TICKET}
rerun_ticket=${RERUN_TICKET}
browser_ticket=${BROWSER_TICKET}
day2_gate=PASS
EOF
cat "$EVIDENCE_DIR/SUMMARY.txt"
