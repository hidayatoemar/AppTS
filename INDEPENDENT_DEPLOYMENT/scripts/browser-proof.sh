#!/usr/bin/env bash
set -euo pipefail

: "${INDEP_HOST:?INDEP_HOST is required}"
: "${INDEP_USER:?INDEP_USER is required}"

REPO_ROOT="$(git rev-parse --show-toplevel)"
EVIDENCE_DIR="$REPO_ROOT/INDEPENDENT_DEPLOYMENT/evidence/tls-day1-browser-proof-${GITHUB_RUN_ID:-manual}"
mkdir -p "$EVIDENCE_DIR"

# MCR-to-DT-014: prove the controlled seed cannot run as the actual runtime
# identity, then apply it only through the deployment/migration identity.
ansible-playbook playbooks/tls-day1-seed.yml | tee "$EVIDENCE_DIR/seed-gate.txt"

PORT=18080
KEY="$HOME/.ssh/independent_deploy_key"
SSH_BASE=(ssh -i "$KEY" -o BatchMode=yes)
"${SSH_BASE[@]}" -o ExitOnForwardFailure=yes -N \
  -L "${PORT}:127.0.0.1:8080" "${INDEP_USER}@${INDEP_HOST}" &
TUNNEL_PID=$!
trap 'kill "$TUNNEL_PID" 2>/dev/null || true' EXIT

wait_ready() {
  for _ in $(seq 1 60); do
    if curl -fsS "http://127.0.0.1:${PORT}/readyz" >/dev/null 2>&1; then return 0; fi
    sleep 1
  done
  return 1
}
wait_ready
curl -fsS "http://127.0.0.1:${PORT}/healthz" | tee "$EVIDENCE_DIR/healthz.json"
curl -fsS "http://127.0.0.1:${PORT}/readyz" | tee "$EVIDENCE_DIR/readyz.json"

CHROME=""
for candidate in google-chrome google-chrome-stable chromium chromium-browser; do
  if command -v "$candidate" >/dev/null 2>&1; then CHROME="$(command -v "$candidate")"; break; fi
done
test -n "$CHROME" || { echo 'STOP: no headless Chrome/Chromium binary on Actions runner'; exit 2; }
"$CHROME" --version | tee "$EVIDENCE_DIR/browser-version.txt"

chrome_dump() {
  local path="$1" out="$2"
  "$CHROME" --headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage \
    --virtual-time-budget=6000 --dump-dom "http://127.0.0.1:${PORT}${path}" > "$out"
}
chrome_shot() {
  local path="$1" out="$2"
  "$CHROME" --headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage \
    --virtual-time-budget=6000 --window-size=1440,1400 --screenshot="$out" \
    "http://127.0.0.1:${PORT}${path}" >/dev/null
}

# Browser baseline before the positive Day-1 flow.
chrome_dump /work "$EVIDENCE_DIR/work-before.html"
chrome_dump /intake "$EVIDENCE_DIR/intake-before.html"
chrome_shot /work "$EVIDENCE_DIR/work-before.png"
chrome_shot /intake "$EVIDENCE_DIR/intake-before.png"
grep -Fq 'Role-Scoped Work Queue' "$EVIDENCE_DIR/work-before.html"
grep -Fq 'No runtime Tickets are currently projected.' "$EVIDENCE_DIR/work-before.html"
grep -Fq 'Pre-Ticket Intake and Admission' "$EVIDENCE_DIR/intake-before.html"

# Exercise a fresh negative TD-PRE-001 and then the fresh positive TLS Day-1
# formation path through the deployed HTTP intent boundary.
python3 - "$PORT" "$EVIDENCE_DIR/day1-create.json" <<'PY'
import json, sys, uuid, urllib.request
port, out = sys.argv[1], sys.argv[2]
base=f"http://127.0.0.1:{port}/api/v1/ui"

def read(path):
    with urllib.request.urlopen(base+path, timeout=30) as r:
        return json.loads(r.read().decode())

def post(body):
    req=urllib.request.Request(base+"/intents", data=json.dumps(body).encode(), headers={"content-type":"application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())

work0=read("/work-queue")
assert work0["view_id"]=="UX-RS-01" and work0["data"]["ticket_count"]==0, work0

neg_key=str(uuid.uuid4())
negative={
  "intent_contract_ref":"APPTS.CORE.D01.PRETICKET_ADMISSION.SUBMISSION / 1.0.0",
  "payload":{"messageId":str(uuid.uuid4()),"idempotencyKey":neg_key,"correlationId":str(uuid.uuid4())},
}
neg=post(negative)
assert neg.get("disposition")=="CREATED", neg
assert neg.get("assessmentResult")=="NOT_ACCEPTABLE", neg
assert neg.get("decision")=="HOLD_AS_PRE_TICKET", neg
work_after_negative=read("/work-queue")
assert work_after_negative["data"]["ticket_count"]==0, work_after_negative

key=str(uuid.uuid4())
positive={
  "intent_contract_ref":"APPTS.CORE.D01.PRETICKET_ADMISSION.SUBMISSION / 1.0.0",
  "payload":{"messageId":str(uuid.uuid4()),"idempotencyKey":key,"correlationId":str(uuid.uuid4()),"trialContext":"TLS-DAY1-GOLDEN"},
}
created=post(positive)
assert created.get("disposition")=="CREATED", created
assert created.get("assessmentResult")=="ACCEPTABLE", created
assert created.get("decision")=="ACCEPTED_FOR_FORMATION", created
assert created.get("state")=="ACCEPTED" and created.get("aggregateVersion")==0, created
ticket=created["ticketId"]
replay=post(positive)
assert replay.get("disposition")=="IDEMPOTENT_REPLAY" and replay.get("ticketId")==ticket, replay
changed=json.loads(json.dumps(positive))
changed["payload"]["messageId"]=str(uuid.uuid4())
changed["payload"]["correlationId"]=str(uuid.uuid4())
conflict=post(changed)
assert conflict.get("disposition")=="CONFLICT_HOLD" and conflict.get("ticketId")==ticket, conflict
work=read("/work-queue")
assert work["view_id"]=="UX-RS-01" and work["data"]["ticket_count"]==1, work
items={x["ticket_id"]:x for x in work["data"]["tickets"]}
assert ticket in items and items[ticket]["current_state_code"]=="ACCEPTED" and items[ticket]["aggregate_version"]==0, items
console=read("/tickets/"+ticket)
assert console["view_id"]=="UX-RS-03", console
d=console["data"]
assert d["current_state_code"]=="ACCEPTED" and d["aggregate_version"]==0, d
assert d["available_actions"]==["ACTIVATE"], d
assert d["action_contract_ref"], d
assert d["holder_ref"] and d["role_assignment_ref"], d
with open(out,"w",encoding="utf-8") as f:
    json.dump({"negative":neg,"negativeKey":neg_key,"positiveRequest":positive,"created":created,"replay":replay,"conflict":conflict,"work":work,"consoleBefore":console},f,separators=(",",":"))
print(ticket)
PY
TICKET_ID="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["created"]["ticketId"])' "$EVIDENCE_DIR/day1-create.json")"
NEG_CASE_ID="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["negative"]["caseId"])' "$EVIDENCE_DIR/day1-create.json")"
test -n "$TICKET_ID"
test -n "$NEG_CASE_ID"

# Browser readback of Work Queue and Ticket Console before ACTIVATE.
chrome_dump /work "$EVIDENCE_DIR/work-accepted.html"
chrome_dump "/tickets/${TICKET_ID}" "$EVIDENCE_DIR/ticket-console-before.html"
chrome_shot /work "$EVIDENCE_DIR/work-accepted.png"
chrome_shot "/tickets/${TICKET_ID}" "$EVIDENCE_DIR/ticket-console-before.png"
grep -Fq "$TICKET_ID" "$EVIDENCE_DIR/work-accepted.html"
grep -Fq 'ACCEPTED' "$EVIDENCE_DIR/work-accepted.html"
grep -Fq 'aggregate version 0' "$EVIDENCE_DIR/work-accepted.html"
grep -Fq 'Ticket Operational Console' "$EVIDENCE_DIR/ticket-console-before.html"
grep -Fq "$TICKET_ID" "$EVIDENCE_DIR/ticket-console-before.html"
grep -Fq 'data-ticket-state="ACCEPTED"' "$EVIDENCE_DIR/ticket-console-before.html"
grep -Fq 'aggregate version 0' "$EVIDENCE_DIR/ticket-console-before.html"
grep -Fq 'ACTIVATE' "$EVIDENCE_DIR/ticket-console-before.html"
grep -Fq '51010000-0000-4000-8000-00000000000a' "$EVIDENCE_DIR/ticket-console-before.html"
grep -Fq '51010000-0000-4000-8000-00000000000b' "$EVIDENCE_DIR/ticket-console-before.html"

# Invoke the action through the exact deployed UI/API intent contract and replay
# the identical action once to prove no second durable transition.
python3 - "$PORT" "$EVIDENCE_DIR/day1-create.json" "$EVIDENCE_DIR/day1-action.json" <<'PY'
import datetime, json, sys, uuid, urllib.request
port, create_path, out = sys.argv[1:]
base=f"http://127.0.0.1:{port}/api/v1/ui"
created_doc=json.load(open(create_path))
ticket=created_doc["created"]["ticketId"]

def read(path):
    with urllib.request.urlopen(base+path, timeout=30) as r: return json.loads(r.read().decode())

def post(body):
    req=urllib.request.Request(base+"/intents",data=json.dumps(body).encode(),headers={"content-type":"application/json"},method="POST")
    with urllib.request.urlopen(req,timeout=30) as r: return json.loads(r.read().decode())

console=read("/tickets/"+ticket)
d=console["data"]
assert d["available_actions"]==["ACTIVATE"], d
intent_time=datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00","Z")
action_id=str(uuid.uuid4())
body={
  "intent_contract_ref":d["action_contract_ref"],
  "subject_ref":ticket,
  "correlation_id":str(uuid.uuid4()),
  "presented_source_version_ref":console["source_version_set_ref"],
  "expected_aggregate_version":d["aggregate_version"],
  "payload":{
    "action_intent_id":action_id,
    "ticket_id":ticket,
    "actor_ref":d["holder_ref"],
    "role_assignment_ref":d["role_assignment_ref"],
    "requested_action_class":"ACTIVATE",
    "presented_source_version_ref":console["source_version_set_ref"],
    "expected_aggregate_version":d["aggregate_version"],
    "intent_time":intent_time,
  },
}
first=post(body)
assert first.get("result")=="EFFECT_APPLIED" and first.get("durable") is True, first
assert first.get("state")=="ACTIVE" and first.get("aggregateVersion")==1, first
replay=post(body)
assert replay.get("result")=="EFFECT_APPLIED" and replay.get("durable") is True, replay
assert replay.get("state")=="ACTIVE" and replay.get("aggregateVersion")==1, replay
refreshed=read("/tickets/"+ticket)
r=refreshed["data"]
assert r["current_state_code"]=="ACTIVE" and r["aggregate_version"]==1, r
assert r["available_actions"]==[], r
assert r["restriction_profile_ref"]=="POST_ACTIVATION_REFRESH_REQUIRED", r
work=read("/work-queue")
items={x["ticket_id"]:x for x in work["data"]["tickets"]}
assert items[ticket]["current_state_code"]=="ACTIVE" and items[ticket]["aggregate_version"]==1, items[ticket]
with open(out,"w",encoding="utf-8") as f:
    json.dump({"actionRequest":body,"first":first,"replay":replay,"consoleAfter":refreshed,"workAfter":work},f,separators=(",",":"))
print(action_id)
PY
ACTION_ID="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["actionRequest"]["payload"]["action_intent_id"])' "$EVIDENCE_DIR/day1-action.json")"

# Browser readback after durable ACTIVATE.
chrome_dump "/tickets/${TICKET_ID}" "$EVIDENCE_DIR/ticket-console-after.html"
chrome_dump /work "$EVIDENCE_DIR/work-active.html"
chrome_shot "/tickets/${TICKET_ID}" "$EVIDENCE_DIR/ticket-console-after.png"
chrome_shot /work "$EVIDENCE_DIR/work-active.png"
grep -Fq "$TICKET_ID" "$EVIDENCE_DIR/ticket-console-after.html"
grep -Fq 'data-ticket-state="ACTIVE"' "$EVIDENCE_DIR/ticket-console-after.html"
grep -Fq 'aggregate version 1' "$EVIDENCE_DIR/ticket-console-after.html"
grep -Fq 'Available actions:</strong> None' "$EVIDENCE_DIR/ticket-console-after.html"
grep -Fq 'POST_ACTIVATION_REFRESH_REQUIRED' "$EVIDENCE_DIR/ticket-console-after.html"
grep -Fq "$TICKET_ID" "$EVIDENCE_DIR/work-active.html"
grep -Fq 'ACTIVE' "$EVIDENCE_DIR/work-active.html"
grep -Fq 'aggregate version 1' "$EVIDENCE_DIR/work-active.html"

# Independent durable current-server readback via deployment identity only.
"${SSH_BASE[@]}" "${INDEP_USER}@${INDEP_HOST}" \
  "sudo sh -lc 'cd /opt/appts-independent-restore-service/deploy/compose && docker compose -f compose.yaml --env-file .env exec -T postgres psql -X -U appts_admin -d appts_dep001_independent -Atqc \"SELECT ''ticket_identity=''||count(*) FROM appts.ticket_identity WHERE ticket_id=''''${TICKET_ID}''''; SELECT ''ticket_formation=''||count(*) FROM appts.ticket_formation_record WHERE ticket_id=''''${TICKET_ID}''''; SELECT ''runtime=''||current_state_code||''|''||aggregate_version FROM appts.runtime_ticket WHERE ticket_id=''''${TICKET_ID}''''; SELECT ''action_intent=''||count(*) FROM appts.action_intent WHERE action_intent_id=''''${ACTION_ID}''''; SELECT ''effect_request=''||count(*) FROM appts.lifecycle_effect_request WHERE command_id=''''${ACTION_ID}''''; SELECT ''effect_result=''||count(*) FROM appts.lifecycle_effect_result r JOIN appts.lifecycle_effect_request q ON q.effect_request_id=r.effect_request_id WHERE q.command_id=''''${ACTION_ID}''''; SELECT ''transition=''||count(*) FROM appts.runtime_state_transition WHERE ticket_id=''''${TICKET_ID}''''; SELECT ''accepted_decision=''||count(*) FROM appts.intake_decision d JOIN appts.ticket_formation_record f ON f.intake_decision_id=d.decision_id WHERE f.ticket_id=''''${TICKET_ID}'''' AND d.decision_code=''ACCEPTED_FOR_FORMATION'';\"'" \
  | tee "$EVIDENCE_DIR/durable-readback.txt"

grep -Fxq 'ticket_identity=1' "$EVIDENCE_DIR/durable-readback.txt"
grep -Fxq 'ticket_formation=1' "$EVIDENCE_DIR/durable-readback.txt"
grep -Fxq 'runtime=ACTIVE|1' "$EVIDENCE_DIR/durable-readback.txt"
grep -Fxq 'action_intent=1' "$EVIDENCE_DIR/durable-readback.txt"
grep -Fxq 'effect_request=1' "$EVIDENCE_DIR/durable-readback.txt"
grep -Fxq 'effect_result=1' "$EVIDENCE_DIR/durable-readback.txt"
grep -Fxq 'transition=1' "$EVIDENCE_DIR/durable-readback.txt"
grep -Fxq 'accepted_decision=1' "$EVIDENCE_DIR/durable-readback.txt"

cat > "$EVIDENCE_DIR/SUMMARY.txt" <<EOF
controlled_seed_runtime_rejection=PASS
controlled_seed_deployment_identity_application=PASS
health_ready=PASS
browser_binary=$CHROME
negative_td_pre_001_case_id=$NEG_CASE_ID
negative_td_pre_001_hold_zero_ticket=PASS
positive_ticket_id=$TICKET_ID
valid_governed_intake=PASS
accepted_for_formation=PASS
durable_ticket_identity=PASS
identical_formation_replay=PASS
changed_content_conflict_hold=PASS
work_queue_browser_accepted_v0=PASS
ticket_console_browser_accepted_v0=PASS
current_holder_role_authority_gate_binding=PASS
activate_presented=PASS
action_intent_id=$ACTION_ID
activate_effect_applied=PASS
active_v1=PASS
identical_action_replay_no_second_transition=PASS
ticket_console_browser_active_v1=PASS
work_queue_browser_active_v1=PASS
durable_vector=1|1|1|1|1|1|1|1
day1_gate=PASS
EOF
cat "$EVIDENCE_DIR/SUMMARY.txt"
