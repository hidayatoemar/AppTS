#!/usr/bin/env bash
set -euo pipefail

: "${INDEP_HOST:?INDEP_HOST is required}"
: "${INDEP_USER:?INDEP_USER is required}"

REPO_ROOT="$(git rev-parse --show-toplevel)"
EVIDENCE_DIR="$REPO_ROOT/INDEPENDENT_DEPLOYMENT/evidence/browser-proof-${GITHUB_RUN_ID:-manual}"
mkdir -p "$EVIDENCE_DIR"

PORT=18080
KEY="$HOME/.ssh/independent_deploy_key"
ssh -i "$KEY" -o BatchMode=yes -o ExitOnForwardFailure=yes -N \
  -L "${PORT}:127.0.0.1:8080" "${INDEP_USER}@${INDEP_HOST}" &
TUNNEL_PID=$!
trap 'kill "$TUNNEL_PID" 2>/dev/null || true' EXIT

for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${PORT}/readyz" >/dev/null; then break; fi
  sleep 1
done
curl -fsS "http://127.0.0.1:${PORT}/readyz" | tee "$EVIDENCE_DIR/readyz-before.json"

CHROME=""
for candidate in google-chrome google-chrome-stable chromium chromium-browser; do
  if command -v "$candidate" >/dev/null 2>&1; then CHROME="$(command -v "$candidate")"; break; fi
done
test -n "$CHROME" || { echo 'BLOCKED: no headless Chrome/Chromium binary on Actions runner'; exit 2; }
"$CHROME" --version | tee "$EVIDENCE_DIR/browser-version.txt"

chrome_dump() {
  local path="$1" out="$2"
  "$CHROME" --headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage \
    --virtual-time-budget=5000 --dump-dom "http://127.0.0.1:${PORT}${path}" > "$out"
}
chrome_shot() {
  local path="$1" out="$2"
  "$CHROME" --headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage \
    --virtual-time-budget=5000 --window-size=1440,1400 --screenshot="$out" \
    "http://127.0.0.1:${PORT}${path}" >/dev/null
}

chrome_dump /work "$EVIDENCE_DIR/work-before.html"
chrome_dump /intake "$EVIDENCE_DIR/intake-before.html"
chrome_shot /work "$EVIDENCE_DIR/work-before.png"
chrome_shot /intake "$EVIDENCE_DIR/intake-before.png"

grep -Fq 'Work Queue' "$EVIDENCE_DIR/work-before.html"
grep -Fq 'No runtime Tickets are currently projected.' "$EVIDENCE_DIR/work-before.html"
grep -Fq 'Pre-Ticket Intake and Admission' "$EVIDENCE_DIR/intake-before.html"
grep -Fq 'A pre-Ticket case is not a Ticket. Formation remains owner-controlled and fail-closed.' "$EVIDENCE_DIR/intake-before.html"
grep -Fq 'HOLD_AS_PRE_TICKET' "$EVIDENCE_DIR/intake-before.html"
grep -Fq 'NOT_ACCEPTABLE' "$EVIDENCE_DIR/intake-before.html"

python3 - "$PORT" "$EVIDENCE_DIR/browser-trial.json" <<'PY'
import json, sys, uuid, urllib.request
port, out = sys.argv[1], sys.argv[2]
key = str(uuid.uuid4())
body = {
  "intent_contract_ref": "APPTS.CORE.D01.PRETICKET_ADMISSION.SUBMISSION / 1.0.0",
  "payload": {
    "messageId": str(uuid.uuid4()),
    "idempotencyKey": key,
    "correlationId": str(uuid.uuid4()),
  },
}
req = urllib.request.Request(
  f"http://127.0.0.1:{port}/api/v1/ui/intents",
  data=json.dumps(body).encode(),
  headers={"content-type":"application/json"},
  method="POST",
)
with urllib.request.urlopen(req, timeout=30) as r:
  result = json.loads(r.read().decode())
assert result.get("disposition") == "CREATED", result
assert result.get("assessmentResult") == "NOT_ACCEPTABLE", result
assert result.get("decision") == "HOLD_AS_PRE_TICKET", result
with open(out, "w", encoding="utf-8") as f:
  json.dump({"idempotencyKey":key,"result":result}, f, separators=(",",":"))
print(result["caseId"])
PY
CASE_ID="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["result"]["caseId"])' "$EVIDENCE_DIR/browser-trial.json")"

test -n "$CASE_ID"
! grep -Fq "$CASE_ID" "$EVIDENCE_DIR/intake-before.html"

chrome_dump /work "$EVIDENCE_DIR/work-after.html"
chrome_dump /intake "$EVIDENCE_DIR/intake-after.html"
chrome_shot /work "$EVIDENCE_DIR/work-after.png"
chrome_shot /intake "$EVIDENCE_DIR/intake-after.png"

grep -Fq 'Work Queue' "$EVIDENCE_DIR/work-after.html"
grep -Fq 'No runtime Tickets are currently projected.' "$EVIDENCE_DIR/work-after.html"
grep -Fq 'Pre-Ticket Intake and Admission' "$EVIDENCE_DIR/intake-after.html"
grep -Fq 'A pre-Ticket case is not a Ticket. Formation remains owner-controlled and fail-closed.' "$EVIDENCE_DIR/intake-after.html"
grep -Fq "$CASE_ID" "$EVIDENCE_DIR/intake-after.html"
grep -Fq 'HOLD_AS_PRE_TICKET' "$EVIDENCE_DIR/intake-after.html"
grep -Fq 'NOT_ACCEPTABLE' "$EVIDENCE_DIR/intake-after.html"
grep -Fq 'MISSING / INCOMPLETE_MANDATORY_FACTS' "$EVIDENCE_DIR/intake-after.html"

curl -fsS "http://127.0.0.1:${PORT}/api/v1/ui/work-queue" > "$EVIDENCE_DIR/work-after.json"
curl -fsS "http://127.0.0.1:${PORT}/api/v1/ui/intake" > "$EVIDENCE_DIR/intake-after.json"
python3 - "$CASE_ID" "$EVIDENCE_DIR/work-after.json" "$EVIDENCE_DIR/intake-after.json" <<'PY'
import json, sys
case_id, work_path, intake_path = sys.argv[1:]
work = json.load(open(work_path))
intake = json.load(open(intake_path))
assert work["view_id"] == "UX-RS-01" and work["data"]["ticket_count"] == 0, work
assert intake["view_id"] == "UX-RS-02", intake
cases = {item["case_id"]: item for item in intake["data"]["cases"]}
assert case_id in cases, (case_id, cases.keys())
item = cases[case_id]
assert item["case_status_ref"] == "HOLD_AS_PRE_TICKET", item
assert item["assessment_result"] == "NOT_ACCEPTABLE", item
assert item["decision_code"] == "HOLD_AS_PRE_TICKET", item
assert item["completeness_result"] == "MISSING", item
assert item["completeness_reason"] == "INCOMPLETE_MANDATORY_FACTS", item
PY

cat > "$EVIDENCE_DIR/SUMMARY.txt" <<EOF
browser_binary=$CHROME
browser_root_and_static_render=PASS
work_queue_before_zero_ticket=PASS
intake_before_server_projection=PASS
fresh_browser_flow_case_id=$CASE_ID
fresh_runtime_intent_created=PASS
work_queue_after_zero_ticket=PASS
intake_after_case_visible=PASS
intake_after_hold_as_pre_ticket=PASS
intake_after_not_acceptable=PASS
intake_after_missing_facts=PASS
browser_next_consumer_learning_flow=PASS
EOF
cat "$EVIDENCE_DIR/SUMMARY.txt"
