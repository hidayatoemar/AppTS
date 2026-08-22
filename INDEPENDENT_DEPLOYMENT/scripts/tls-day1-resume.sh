#!/usr/bin/env bash
set -euo pipefail

: "${INDEP_HOST:?INDEP_HOST is required}"
: "${INDEP_USER:?INDEP_USER is required}"

REPO_ROOT="$(git rev-parse --show-toplevel)"
EVIDENCE_DIR="$REPO_ROOT/INDEPENDENT_DEPLOYMENT/evidence/tls-day1-resume-${GITHUB_RUN_ID:-manual}"
mkdir -p "$EVIDENCE_DIR"

PORT=18080
KEY="$HOME/.ssh/independent_deploy_key"
SSH_BASE=(ssh -i "$KEY" -o BatchMode=yes)
REMOTE_HOST="${INDEP_USER}@${INDEP_HOST}"
COMPOSE_FILE="/opt/appts-independent-restore-service/deploy/compose/compose.yaml"
COMPOSE_ENV="/opt/appts-independent-restore-service/deploy/compose/.env"
"${SSH_BASE[@]}" -o ExitOnForwardFailure=yes -N \
  -L "${PORT}:127.0.0.1:8080" "$REMOTE_HOST" &
TUNNEL_PID=$!
trap 'kill "$TUNNEL_PID" 2>/dev/null || true' EXIT

for _ in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:${PORT}/readyz" >/dev/null 2>&1; then break; fi
  sleep 1
done
curl -fsS "http://127.0.0.1:${PORT}/healthz" | tee "$EVIDENCE_DIR/healthz.json"
curl -fsS "http://127.0.0.1:${PORT}/readyz" | tee "$EVIDENCE_DIR/readyz.json"

python3 - "$PORT" "$EVIDENCE_DIR/current-before.json" <<'PY'
import json, sys, urllib.request
port, out = sys.argv[1:]
base=f"http://127.0.0.1:{port}/api/v1/ui"
def read(path):
    with urllib.request.urlopen(base+path, timeout=30) as r:
        return json.loads(r.read().decode())
work=read('/work-queue')
assert work['view_id']=='UX-RS-01', work
assert work['data']['ticket_count']==1, work
item=work['data']['tickets'][0]
assert item['current_state_code']=='ACCEPTED' and item['aggregate_version']==0, item
ticket=item['ticket_id']
console=read('/tickets/'+ticket)
d=console['data']
assert console['view_id']=='UX-RS-03', console
assert d['current_state_code']=='ACCEPTED' and d['aggregate_version']==0, d
assert d['available_actions']==['ACTIVATE'], d
assert d['holder_ref'] and d['role_assignment_ref'] and d['action_contract_ref'], d
with open(out,'w',encoding='utf-8') as f:
    json.dump({'ticketId':ticket,'work':work,'console':console},f,separators=(',',':'))
print(ticket)
PY
TICKET_ID="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["ticketId"])' "$EVIDENCE_DIR/current-before.json")"
echo "resume_ticket_id=${TICKET_ID}" | tee "$EVIDENCE_DIR/resume-ticket.txt"

# Read-only interrupted-intent recovery. Timestamp is serialized back to the
# RFC3339 UTC form used by the original browser-proof request; its instant and
# action identity are unchanged.
"${SSH_BASE[@]}" "$REMOTE_HOST" \
  "sudo docker compose -f '$COMPOSE_FILE' --env-file '$COMPOSE_ENV' exec -T postgres psql -X -U appts_admin -d appts_dep001_independent -Atqc \"SELECT concat_ws(chr(31),action_intent_id::text,ticket_id::text,actor_ref::text,role_assignment_ref::text,requested_action_class,presented_source_version_ref::text,expected_aggregate_version::text,to_char(intent_time AT TIME ZONE 'UTC','YYYY-MM-DD\\\"T\\\"HH24:MI:SS.US\\\"Z\\\"')) FROM appts.action_intent WHERE ticket_id='${TICKET_ID}'::uuid ORDER BY intent_time,action_intent_id;\"" \
  | tee "$EVIDENCE_DIR/stored-action-intents.txt"

python3 - "$PORT" "$EVIDENCE_DIR/current-before.json" "$EVIDENCE_DIR/stored-action-intents.txt" "$EVIDENCE_DIR/action-result.json" "$EVIDENCE_DIR/action-http-error.json" <<'PY'
import datetime, json, sys, uuid, urllib.error, urllib.request
port, before_path, stored_path, out, errout = sys.argv[1:]
base=f"http://127.0.0.1:{port}/api/v1/ui"
before=json.load(open(before_path))
console=before['console']; d=console['data']; ticket=before['ticketId']
lines=[x.rstrip('\n') for x in open(stored_path,encoding='utf-8') if x.rstrip('\n')]
assert len(lines)<=1, lines
stored=[]
if lines:
    parts=lines[0].split(chr(31))
    assert len(parts)==8, parts
    stored=[dict(zip(('action_intent_id','ticket_id','actor_ref','role_assignment_ref','requested_action_class','presented_source_version_ref','expected_aggregate_version','intent_time'),parts))]

def read(path):
    with urllib.request.urlopen(base+path,timeout=30) as r:
        return json.loads(r.read().decode())

def post(body):
    req=urllib.request.Request(base+'/intents',data=json.dumps(body).encode(),headers={'content-type':'application/json'},method='POST')
    try:
        with urllib.request.urlopen(req,timeout=30) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        raw=e.read().decode(errors='replace')
        with open(errout,'w',encoding='utf-8') as f:
            json.dump({'status':e.code,'body':raw},f,separators=(',',':'))
        print(f'HTTP_ERROR_STATUS={e.code}')
        print(f'HTTP_ERROR_BODY={raw}')
        raise

if stored:
    s=stored[0]
    assert s['ticket_id']==ticket, s
    assert s['actor_ref']==d['holder_ref'], (s,d)
    assert s['role_assignment_ref']==d['role_assignment_ref'], (s,d)
    assert s['requested_action_class']=='ACTIVATE', s
    assert int(s['expected_aggregate_version'])==0, s
    payload={
      'action_intent_id':s['action_intent_id'],
      'ticket_id':ticket,
      'actor_ref':s['actor_ref'],
      'role_assignment_ref':s['role_assignment_ref'],
      'requested_action_class':'ACTIVATE',
      'presented_source_version_ref':s['presented_source_version_ref'],
      'expected_aggregate_version':int(s['expected_aggregate_version']),
      'intent_time':s['intent_time'],
    }
    resume_mode='REUSE_STORED_ACTION_INTENT'
else:
    payload={
      'action_intent_id':str(uuid.uuid4()),
      'ticket_id':ticket,
      'actor_ref':d['holder_ref'],
      'role_assignment_ref':d['role_assignment_ref'],
      'requested_action_class':'ACTIVATE',
      'presented_source_version_ref':console['source_version_set_ref'],
      'expected_aggregate_version':0,
      'intent_time':datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00','Z'),
    }
    resume_mode='CREATE_FRESH_ACTION_INTENT'
body={'intent_contract_ref':d['action_contract_ref'],'payload':payload}
first=post(body)
assert first.get('result')=='EFFECT_APPLIED' and first.get('durable') is True, first
assert first.get('state')=='ACTIVE' and first.get('aggregateVersion')==1, first
replay=post(body)
assert replay.get('result')=='EFFECT_APPLIED' and replay.get('durable') is True, replay
assert replay.get('state')=='ACTIVE' and replay.get('aggregateVersion')==1, replay
refreshed=read('/tickets/'+ticket)
r=refreshed['data']
assert r['current_state_code']=='ACTIVE' and r['aggregate_version']==1, r
assert r['available_actions']==[], r
assert r['restriction_profile_ref']=='POST_ACTIVATION_REFRESH_REQUIRED', r
work=read('/work-queue')
items={x['ticket_id']:x for x in work['data']['tickets']}
assert items[ticket]['current_state_code']=='ACTIVE' and items[ticket]['aggregate_version']==1, items[ticket]
with open(out,'w',encoding='utf-8') as f:
    json.dump({'resumeMode':resume_mode,'actionRequest':body,'first':first,'replay':replay,'consoleAfter':refreshed,'workAfter':work},f,separators=(',',':'))
print('RESUME_MODE='+resume_mode)
print('ACTION_ID='+payload['action_intent_id'])
PY
ACTION_ID="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["actionRequest"]["payload"]["action_intent_id"])' "$EVIDENCE_DIR/action-result.json")"

CHROME=""
for candidate in google-chrome google-chrome-stable chromium chromium-browser; do
  if command -v "$candidate" >/dev/null 2>&1; then CHROME="$(command -v "$candidate")"; break; fi
done
test -n "$CHROME" || { echo 'STOP: no headless Chrome/Chromium binary on Actions runner'; exit 2; }
"$CHROME" --version | tee "$EVIDENCE_DIR/browser-version.txt"
"$CHROME" --headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage --virtual-time-budget=6000 --dump-dom "http://127.0.0.1:${PORT}/tickets/${TICKET_ID}" > "$EVIDENCE_DIR/ticket-console-after.html"
"$CHROME" --headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage --virtual-time-budget=6000 --dump-dom "http://127.0.0.1:${PORT}/work" > "$EVIDENCE_DIR/work-active.html"
"$CHROME" --headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage --virtual-time-budget=6000 --window-size=1440,1400 --screenshot="$EVIDENCE_DIR/ticket-console-after.png" "http://127.0.0.1:${PORT}/tickets/${TICKET_ID}" >/dev/null
"$CHROME" --headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage --virtual-time-budget=6000 --window-size=1440,1400 --screenshot="$EVIDENCE_DIR/work-active.png" "http://127.0.0.1:${PORT}/work" >/dev/null

grep -Fq "$TICKET_ID" "$EVIDENCE_DIR/ticket-console-after.html"
grep -Fq 'data-ticket-state="ACTIVE"' "$EVIDENCE_DIR/ticket-console-after.html"
grep -Fq 'aggregate version 1' "$EVIDENCE_DIR/ticket-console-after.html"
grep -Fq 'Available actions:</strong> None' "$EVIDENCE_DIR/ticket-console-after.html"
grep -Fq 'POST_ACTIVATION_REFRESH_REQUIRED' "$EVIDENCE_DIR/ticket-console-after.html"
grep -Fq "$TICKET_ID" "$EVIDENCE_DIR/work-active.html"
grep -Fq 'ACTIVE' "$EVIDENCE_DIR/work-active.html"
grep -Fq 'aggregate version 1' "$EVIDENCE_DIR/work-active.html"

"${SSH_BASE[@]}" "$REMOTE_HOST" \
  "sudo docker compose -f '$COMPOSE_FILE' --env-file '$COMPOSE_ENV' exec -T postgres psql -X -U appts_admin -d appts_dep001_independent -Atqc \"SELECT 'ticket_identity='||count(*) FROM appts.ticket_identity WHERE ticket_id='${TICKET_ID}'::uuid; SELECT 'ticket_formation='||count(*) FROM appts.ticket_formation_record WHERE ticket_id='${TICKET_ID}'::uuid; SELECT 'runtime='||current_state_code||'|'||aggregate_version FROM appts.runtime_ticket WHERE ticket_id='${TICKET_ID}'::uuid; SELECT 'action_intent='||count(*) FROM appts.action_intent WHERE action_intent_id='${ACTION_ID}'::uuid; SELECT 'ticket_action_intents='||count(*) FROM appts.action_intent WHERE ticket_id='${TICKET_ID}'::uuid; SELECT 'effect_request='||count(*) FROM appts.lifecycle_effect_request WHERE command_id='${ACTION_ID}'::uuid; SELECT 'effect_result='||count(*) FROM appts.lifecycle_effect_result r JOIN appts.lifecycle_effect_request q ON q.effect_request_id=r.effect_request_id WHERE q.command_id='${ACTION_ID}'::uuid; SELECT 'transition='||count(*) FROM appts.runtime_state_transition WHERE ticket_id='${TICKET_ID}'::uuid; SELECT 'accepted_decision='||count(*) FROM appts.intake_decision d JOIN appts.ticket_formation_record f ON f.intake_decision_id=d.decision_id WHERE f.ticket_id='${TICKET_ID}'::uuid AND d.decision_code='ACCEPTED_FOR_FORMATION';\"" \
  | tee "$EVIDENCE_DIR/durable-readback.txt"

grep -Fxq 'ticket_identity=1' "$EVIDENCE_DIR/durable-readback.txt"
grep -Fxq 'ticket_formation=1' "$EVIDENCE_DIR/durable-readback.txt"
grep -Fxq 'runtime=ACTIVE|1' "$EVIDENCE_DIR/durable-readback.txt"
grep -Fxq 'action_intent=1' "$EVIDENCE_DIR/durable-readback.txt"
grep -Fxq 'ticket_action_intents=1' "$EVIDENCE_DIR/durable-readback.txt"
grep -Fxq 'effect_request=1' "$EVIDENCE_DIR/durable-readback.txt"
grep -Fxq 'effect_result=1' "$EVIDENCE_DIR/durable-readback.txt"
grep -Fxq 'transition=1' "$EVIDENCE_DIR/durable-readback.txt"
grep -Fxq 'accepted_decision=1' "$EVIDENCE_DIR/durable-readback.txt"

cat > "$EVIDENCE_DIR/SUMMARY.txt" <<EOF
resume_ticket_id=${TICKET_ID}
action_id=${ACTION_ID}
health_ready=PASS
current_before=ACCEPTED_v0_ACTIVATE_PRESENTED
activate_http=EFFECT_APPLIED
action_replay=EFFECT_APPLIED_ACTIVE_v1_NO_SECOND_TRANSITION
browser_ticket_console_after=ACTIVE_v1
browser_work_queue_after=ACTIVE_v1
durable_vector=1|1|1|1|1|1|1|1
EOF
cat "$EVIDENCE_DIR/SUMMARY.txt"
