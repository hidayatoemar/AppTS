#!/usr/bin/env bash
set -euo pipefail

: "${INDEP_HOST:?INDEP_HOST is required}"
: "${INDEP_USER:?INDEP_USER is required}"

REPO_ROOT="$(git rev-parse --show-toplevel)"
EVIDENCE_DIR="$REPO_ROOT/INDEPENDENT_DEPLOYMENT/evidence/tls-day2-finalizer-${GITHUB_RUN_ID:-manual}"
mkdir -p "$EVIDENCE_DIR"
PORT=18082
KEY="$HOME/.ssh/independent_deploy_key"
REMOTE_HOST="${INDEP_USER}@${INDEP_HOST}"
SSH_BASE=(ssh -i "$KEY" -o BatchMode=yes)
COMPOSE_DIR="/opt/appts-independent-restore-service/deploy/compose"
COMPOSE_FILE="$COMPOSE_DIR/compose.yaml"
COMPOSE_ENV="$COMPOSE_DIR/.env"
PRIMARY='19075401-4429-4617-af05-dd3beea85aca'
RERUN='9d45f53e-9b1e-40c8-bd4a-aa5d93fe5560'
BROWSER='179d1174-9345-4fd8-be15-4dd0b4d2f1cd'

"${SSH_BASE[@]}" -o ExitOnForwardFailure=yes -N -L "${PORT}:127.0.0.1:8080" "$REMOTE_HOST" &
TUNNEL_PID=$!
trap 'kill "$TUNNEL_PID" 2>/dev/null || true' EXIT
for _ in $(seq 1 60); do
  curl -fsS "http://127.0.0.1:${PORT}/readyz" >/dev/null 2>&1 && break
  sleep 1
done
curl -fsS "http://127.0.0.1:${PORT}/healthz" | tee "$EVIDENCE_DIR/healthz.json"
curl -fsS "http://127.0.0.1:${PORT}/readyz" | tee "$EVIDENCE_DIR/readyz.json"

# Read-only API readback for the already-created proof tickets.
python3 - "$PORT" "$PRIMARY" "$RERUN" "$BROWSER" "$EVIDENCE_DIR/api-readback.json" <<'PY'
import json,sys,urllib.request
port,primary,rerun,browser,out=sys.argv[1:]
base=f'http://127.0.0.1:{port}/api/v1/ui'
def get(path):
  with urllib.request.urlopen(base+path,timeout=30) as r:return json.loads(r.read().decode())
p=get('/tickets/'+primary); pc=get('/tickets/'+primary+'/concerns/closure'); pe=get('/tickets/'+primary+'/concerns/evidence')
r=get('/tickets/'+rerun); re=get('/tickets/'+rerun+'/concerns/evidence')
b=get('/tickets/'+browser); bc=get('/tickets/'+browser+'/concerns/closure'); be=get('/tickets/'+browser+'/concerns/evidence')
assert p['data']['current_state_code']=='TERMINAL_PROCESSING' and p['data']['aggregate_version']==2,p
assert p['data']['available_actions']==[] and p['data']['close_action_available'] is False,p
assert pc['data']['closure_posture']=='TERMINAL_PROCESSING_NOT_CLOSED' and pc['data']['day2_boundary']=='NO_CLOSE_ACTION_AUTHORIZED',pc
assert pe['data']['verification_status']=='VERIFIED' and pe['data']['truth_posture']=='INDEPENDENTLY_VERIFIED',pe
assert r['data']['current_state_code']=='ACTIVE' and r['data']['aggregate_version']==1,r
assert re['data']['scenario_run_ref']=='TLS-D2-RUN-002' and re['data']['verification_status']=='NOT_REQUESTED',re
assert b['data']['current_state_code']=='TERMINAL_PROCESSING' and b['data']['aggregate_version']==2,b
assert bc['data']['closure_posture']=='TERMINAL_PROCESSING_NOT_CLOSED' and bc['data']['day2_boundary']=='NO_CLOSE_ACTION_AUTHORIZED',bc
assert be['data']['verification_status']=='VERIFIED' and be['data']['truth_posture']=='INDEPENDENTLY_VERIFIED',be
json.dump({'primary':{'ticket':p,'closure':pc,'evidence':pe},'rerun':{'ticket':r,'evidence':re},'browser':{'ticket':b,'closure':bc,'evidence':be}},open(out,'w'),separators=(',',':'))
print('api_readback=PASS')
PY

# Read-only durable DB proof. One UNAUTHORIZED + one VERIFIED result is the expected audited verifier sequence.
"${SSH_BASE[@]}" "$REMOTE_HOST" \
  "sudo docker compose -f '$COMPOSE_FILE' --env-file '$COMPOSE_ENV' exec -T postgres psql -X -U appts_admin -d appts_dep001_independent -Atqc \"SELECT 'runtime_identity_check='||(SELECT current_database()); SELECT 'primary_runtime='||current_state_code||'|'||aggregate_version FROM appts.runtime_ticket WHERE ticket_id='${PRIMARY}'::uuid; SELECT 'primary_transitions='||count(*) FROM appts.runtime_state_transition WHERE ticket_id='${PRIMARY}'::uuid; SELECT 'primary_terminal_effect_requests='||count(*) FROM appts.lifecycle_effect_request WHERE ticket_id='${PRIMARY}'::uuid AND requested_effect_class='TERMINAL_DISPOSITION_CLAIM'; SELECT 'primary_terminal_effect_results='||count(*) FROM appts.lifecycle_effect_result er JOIN appts.lifecycle_effect_request eq ON eq.effect_request_id=er.effect_request_id WHERE eq.ticket_id='${PRIMARY}'::uuid AND eq.requested_effect_class='TERMINAL_DISPOSITION_CLAIM'; SELECT 'verification_total='||count(*) FROM appts.verification_result vr JOIN appts.verification_request rq ON rq.verification_request_id=vr.verification_request_id WHERE rq.ticket_id='${PRIMARY}'::uuid; SELECT 'verification_unauthorized='||count(*) FROM appts.verification_result vr JOIN appts.verification_request rq ON rq.verification_request_id=vr.verification_request_id WHERE rq.ticket_id='${PRIMARY}'::uuid AND vr.result_code='UNAUTHORIZED'; SELECT 'verification_verified='||count(*) FROM appts.verification_result vr JOIN appts.verification_request rq ON rq.verification_request_id=vr.verification_request_id WHERE rq.ticket_id='${PRIMARY}'::uuid AND vr.result_code='VERIFIED'; SELECT 'eligibility_ineligible='||count(*) FROM appts.verifier_eligibility_decision WHERE ticket_id='${PRIMARY}'::uuid AND result_code='INELIGIBLE'; SELECT 'eligibility_eligible='||count(*) FROM appts.verifier_eligibility_decision WHERE ticket_id='${PRIMARY}'::uuid AND result_code='ELIGIBLE'; SELECT 'primary_qer='||count(*) FROM appts.qualified_external_record WHERE ticket_id='${PRIMARY}'::uuid; SELECT 'primary_evidence='||count(*) FROM appts.evidence_object WHERE ticket_id='${PRIMARY}'::uuid; SELECT 'primary_verification_requests='||count(*) FROM appts.verification_request WHERE ticket_id='${PRIMARY}'::uuid; SELECT 'rerun_runtime='||current_state_code||'|'||aggregate_version FROM appts.runtime_ticket WHERE ticket_id='${RERUN}'::uuid; SELECT 'browser_runtime='||current_state_code||'|'||aggregate_version FROM appts.runtime_ticket WHERE ticket_id='${BROWSER}'::uuid; SELECT 'closed_total='||count(*) FROM appts.runtime_ticket WHERE current_state_code='CLOSED';\"" \
  | tee "$EVIDENCE_DIR/db-readback.txt"

grep -Fxq 'runtime_identity_check=appts_dep001_independent' "$EVIDENCE_DIR/db-readback.txt"
grep -Fxq 'primary_runtime=TERMINAL_PROCESSING|2' "$EVIDENCE_DIR/db-readback.txt"
grep -Fxq 'primary_transitions=2' "$EVIDENCE_DIR/db-readback.txt"
grep -Fxq 'primary_terminal_effect_requests=1' "$EVIDENCE_DIR/db-readback.txt"
grep -Fxq 'primary_terminal_effect_results=1' "$EVIDENCE_DIR/db-readback.txt"
grep -Fxq 'verification_total=2' "$EVIDENCE_DIR/db-readback.txt"
grep -Fxq 'verification_unauthorized=1' "$EVIDENCE_DIR/db-readback.txt"
grep -Fxq 'verification_verified=1' "$EVIDENCE_DIR/db-readback.txt"
grep -Fxq 'eligibility_ineligible=1' "$EVIDENCE_DIR/db-readback.txt"
grep -Fxq 'eligibility_eligible=1' "$EVIDENCE_DIR/db-readback.txt"
grep -Fxq 'primary_qer=1' "$EVIDENCE_DIR/db-readback.txt"
grep -Fxq 'primary_evidence=1' "$EVIDENCE_DIR/db-readback.txt"
grep -Fxq 'primary_verification_requests=1' "$EVIDENCE_DIR/db-readback.txt"
grep -Fxq 'rerun_runtime=ACTIVE|1' "$EVIDENCE_DIR/db-readback.txt"
grep -Fxq 'browser_runtime=TERMINAL_PROCESSING|2' "$EVIDENCE_DIR/db-readback.txt"
grep -Fxq 'closed_total=0' "$EVIDENCE_DIR/db-readback.txt"

cat > "$EVIDENCE_DIR/SUMMARY.txt" <<EOF
mcr_to_dt=016
mode=READ_ONLY_FINALIZER
api_readback=PASS
primary_ticket=${PRIMARY}
primary_runtime=TERMINAL_PROCESSING_v2
primary_transitions=2
terminal_effect_request=1
terminal_effect_result=1
wrong_verifier=UNAUTHORIZED_DURABLE_FAIL_CLOSED
valid_verifier=VERIFIED_DURABLE
verification_result_total=2_expected_audit_sequence
rerun_ticket=${RERUN}
rerun_runtime=ACTIVE_v1_DISTINCT_SCENARIO
browser_ticket=${BROWSER}
browser_runtime=TERMINAL_PROCESSING_v2
closed_total=0
close_withheld=PASS
day2_gate_finalizer=PASS
EOF
cat "$EVIDENCE_DIR/SUMMARY.txt"
