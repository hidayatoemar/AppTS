#!/usr/bin/env bash
set -euo pipefail

: "${INDEP_HOST:?INDEP_HOST is required}"
: "${INDEP_USER:?INDEP_USER is required}"

REPO_ROOT="$(git rev-parse --show-toplevel)"
DEP_ROOT="$REPO_ROOT/DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001"
ANSIBLE_ROOT="$REPO_ROOT/INDEPENDENT_DEPLOYMENT/ansible"
EVIDENCE_DIR="$REPO_ROOT/INDEPENDENT_DEPLOYMENT/evidence/tls-day2-${GITHUB_RUN_ID:-manual}"
mkdir -p "$EVIDENCE_DIR"

BASE_SHA="b5551eddbbcd82675997c740b5471bb3cc74241b"
APPLIED_SOURCE_SHA="c69d8f88f30b4b00e985d9ea6ee9ef746b2f67a4"
PORT=18080
KEY="$HOME/.ssh/independent_deploy_key"
REMOTE_HOST="${INDEP_USER}@${INDEP_HOST}"
SSH_BASE=(ssh -i "$KEY" -o BatchMode=yes)
COMPOSE_DIR="/opt/appts-independent-restore-service/deploy/compose"
COMPOSE_FILE="$COMPOSE_DIR/compose.yaml"
COMPOSE_ENV="$COMPOSE_DIR/.env"
INSTALL_ROOT="/opt/appts-independent-restore-service"
DAY2_SEED="$INSTALL_ROOT/deploy/db/seed-tls-day2-arc001.sql"
DAY2_SEED_SHA="8dac03944dd018559ae44a03edb7e8264630dcda8bf12a7a52a5af06585b8799"

cat > "$EVIDENCE_DIR/admitted-overlay.expected" <<'LIST'
DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001/apps/api/src/dep-bootstrap.ts
DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001/apps/api/src/projections/trial-projection-port.ts
DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001/apps/api/src/trial/tls-day2-arc001-flow.ts
DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001/apps/api/tsconfig.json
DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001/apps/web/src/app.tsx
DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001/apps/web/src/router.ts
DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001/apps/web/src/views/ClosureReadinessView.tsx
DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001/apps/web/src/views/EvidenceVerificationView.tsx
DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001/apps/web/src/views/GuidedActionView.tsx
DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001/apps/web/src/views/TicketConsoleView.tsx
DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001/apps/web/src/views/TrainerConsoleView.tsx
DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001/deploy/db/seed-tls-day2-arc001.sql
DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001/packages/core-d03/package.json
DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001/tests/dep001/tls-day2-arc001-boundary.test.mjs
DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001/tests/dep001/tls-day2-producer-runtime-proof.py
DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001/tests/integration/ui-routes.integration.test.ts
LIST
sort "$EVIDENCE_DIR/admitted-overlay.expected" -o "$EVIDENCE_DIR/admitted-overlay.expected"
git diff --name-only "$BASE_SHA" "$APPLIED_SOURCE_SHA" | sort > "$EVIDENCE_DIR/admitted-overlay.observed"
diff -u "$EVIDENCE_DIR/admitted-overlay.expected" "$EVIDENCE_DIR/admitted-overlay.observed"

echo "applied_source_parent=$(git rev-parse ${APPLIED_SOURCE_SHA}^)" | tee "$EVIDENCE_DIR/source-lineage.txt"
echo "applied_source_commit=$APPLIED_SOURCE_SHA" | tee -a "$EVIDENCE_DIR/source-lineage.txt"
test "$(git rev-parse ${APPLIED_SOURCE_SHA}^)" = "$BASE_SHA"

cat > "$EVIDENCE_DIR/overlay-sha256.expected" <<'SUMS'
2117e318e06aa02d9e9a31f445ca222bbd5843a0e7413f75ff25745c5df503ac  DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001/apps/api/src/dep-bootstrap.ts
827f07e4e9d39a16c41681be925fdee3b355e3de05a7f34e0624cdc620ffdda8  DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001/apps/api/src/projections/trial-projection-port.ts
91ed3840a08e975eb20a87b39a2d86bda3220d68f418c5e75cbc04414b779768  DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001/apps/api/src/trial/tls-day2-arc001-flow.ts
227338f979936ad83c79e7997776e6845e0b27fa383e11c028429af1f31efcb6  DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001/apps/api/tsconfig.json
84311d2a75f8d78615e0717a9ce3df7f0eeb8d16beaca7eb7927b077ca311ceb  DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001/apps/web/src/app.tsx
226cf1d9204a61dac6b9768b1ffc5d6f6c8896b27d22af2cd25ce2cfa85c8587  DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001/apps/web/src/router.ts
a5309df07e1810109b3a4ecd599d2fbb0b85590684134d34b779ffda600b8e67  DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001/apps/web/src/views/ClosureReadinessView.tsx
e41359b67e0c7e94c7209cd83875c07ce75a2a6742838912b2d30706fd4b3f5c  DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001/apps/web/src/views/EvidenceVerificationView.tsx
763ae3cc7cf80d51e7aa9dda9cba0de888255527e8df2329a067ae1a84c4a660  DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001/apps/web/src/views/GuidedActionView.tsx
8ea289d275f1c498e8b49cd5dbb998b85dddee4507293949e3871cc49c265a5b  DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001/apps/web/src/views/TicketConsoleView.tsx
4b9018a4b75f01cb3a81edca9483e4d02ac399ac32cc123f3e7b87263d57fe42  DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001/apps/web/src/views/TrainerConsoleView.tsx
8dac03944dd018559ae44a03edb7e8264630dcda8bf12a7a52a5af06585b8799  DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001/deploy/db/seed-tls-day2-arc001.sql
1f033d77084a2266dcdc4224aeb82d8d8972a211df5f1042cfbfa3a87bffba0a  DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001/packages/core-d03/package.json
223bdcad3e527f3ee5127b70efc4657655ae7b4d4b395f639037b829806dd545  DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001/tests/dep001/tls-day2-arc001-boundary.test.mjs
af73b07c9397403f8711e132d6b98b84d2d53907fef9e78e5ab227a1ecae4427  DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001/tests/dep001/tls-day2-producer-runtime-proof.py
3f2e3fe48c7a89f18069eb492103d4aac9132ebd2ad649c6f0fcde3a8723f5c7  DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001/tests/integration/ui-routes.integration.test.ts
SUMS
(cd "$REPO_ROOT" && sha256sum -c "$EVIDENCE_DIR/overlay-sha256.expected") | tee "$EVIDENCE_DIR/overlay-sha256-check.txt"

cat > "$EVIDENCE_DIR/protected-sha256.expected" <<'SUMS'
fa6a57a4bb50fdd63884d86ce43fe2b18137c3c0b0554b2b990d57d2771c6106  DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001/apps/api/src/trial/pre-ticket-trial-owner-flow.ts
a7e1f5a716cfb29de543b29aa5af3f8ddf03e334320be2d3ac8ea9e116ac68bc  DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001/apps/api/src/trial/tls-day1-golden-flow.ts
ddbfffc8ecddcabf8cec73ce737a977d1e91253efee42e51c9e57e44efecda82  DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001/deploy/db/seed-tls-day1-golden.sql
41b48d45bb88c7e510a88235840b8601658d08e5347e9f7660419f7efc321f0f  DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001/deploy/db/grant-runtime.sh
617cc290d0871545e0baf06fcbf38f6c575470025238c93c986a3b87496bfd13  DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001/db/migrations/V001__cf01_core_schema.sql
4eac8f28f4de99b2e0ebd46d52985481c671e0967e6ac082cd8f5e57764f34c9  DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001/db/migrations/V002__cf01_runtime_and_exchange_schema.sql
2bab5a2cb86d80ef2bd45821ee7e117c7eba1591ed7f0c90a719f226dddaa7cd  DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001/db/migrations/V003__dg04_diagnostic_persistence.sql
1603c9f89aa0358456b850eca9c094255a8c2ea6688265b76b8859e1ee7e5a55  DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001/db/migrations/V004__d05_pending_capture_v2.sql
60f1e9e7e0ba9993c9340af9344790440298f9e2fe861ed50f50c14f2cc7170c  DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001/package-lock.json
SUMS
(cd "$REPO_ROOT" && sha256sum -c "$EVIDENCE_DIR/protected-sha256.expected") | tee "$EVIDENCE_DIR/protected-sha256-check.txt"

(
  cd "$DEP_ROOT"
  npm ci
  npm run verify:boundaries
  npm run typecheck
  npm run build
  node --test tests/dep001/tls-day2-arc001-boundary.test.mjs
) 2>&1 | tee "$EVIDENCE_DIR/current-head-build-test.txt"

(
  cd "$ANSIBLE_ROOT"
  ansible-playbook playbooks/resync.yml
  ansible-playbook playbooks/start.yml
  ansible-playbook playbooks/privilege-verify.yml
) 2>&1 | tee "$EVIDENCE_DIR/current-server-apply-security.txt"

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

python3 - "$EVIDENCE_DIR/overlay-sha256.expected" "$EVIDENCE_DIR/protected-sha256.expected" > "$EVIDENCE_DIR/remote-sha-command.txt" <<'PY'
import sys
for fn in sys.argv[1:]:
    for line in open(fn,encoding='utf-8'):
        if not line.strip(): continue
        digest,path=line.rstrip().split('  ',1)
        marker='DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001/'
        assert path.startswith(marker)
        rel=path[len(marker):]
        print(f"{digest}  /opt/appts-independent-restore-service/{rel}")
PY
cat "$EVIDENCE_DIR/remote-sha-command.txt" | "${SSH_BASE[@]}" "$REMOTE_HOST" 'sha256sum -c -' | tee "$EVIDENCE_DIR/remote-source-sha256-check.txt"

REMOTE_SEED_SHA="$("${SSH_BASE[@]}" "$REMOTE_HOST" "sha256sum '$DAY2_SEED' | awk '{print \$1}'")"
printf 'seed_sha256=%s\n' "$REMOTE_SEED_SHA" | tee "$EVIDENCE_DIR/day2-seed.txt"
test "$REMOTE_SEED_SHA" = "$DAY2_SEED_SHA"

set +e
RUNTIME_SEED_OUTPUT="$("${SSH_BASE[@]}" "$REMOTE_HOST" "set -o pipefail; cat '$DAY2_SEED' | sudo docker compose -f '$COMPOSE_FILE' --env-file '$COMPOSE_ENV' exec -T api node --input-type=module -e 'import {createPersistencePool} from \"@appts-restore-service/persistence\"; let sql=\"\"; for await (const c of process.stdin) sql+=c; const p=createPersistencePool({connectionString:process.env.DATABASE_URL}); try { await p.query(sql); console.error(\"UNEXPECTED_SEED_ACCEPT\"); process.exitCode=9; } catch(e) { console.log(String(e?.message??e)); } finally { await p.end(); }'" 2>&1)"
RUNTIME_SEED_RC=$?
set -e
printf '%s\n' "$RUNTIME_SEED_OUTPUT" | tee -a "$EVIDENCE_DIR/day2-seed.txt"
grep -Fq 'TLS-DAY2 STOP: ARC001 static Trial binding seed must not run as appts_runtime' "$EVIDENCE_DIR/day2-seed.txt"
if grep -Fq 'UNEXPECTED_SEED_ACCEPT' "$EVIDENCE_DIR/day2-seed.txt"; then exit 9; fi
printf 'runtime_seed_command_rc=%s\n' "$RUNTIME_SEED_RC" | tee -a "$EVIDENCE_DIR/day2-seed.txt"

"${SSH_BASE[@]}" "$REMOTE_HOST" \
  "sudo docker compose -f '$COMPOSE_FILE' --env-file '$COMPOSE_ENV' exec -T postgres psql -X -U appts_admin -d appts_dep001_independent -Atqc \"SELECT 'tickets='||count(*) FROM appts.ticket_identity; SELECT 'runtime='||count(*) FROM appts.runtime_ticket; SELECT 'day2_source='||count(*) FROM appts.source_ref WHERE source_ref_id='52010000-0000-4000-8000-000000000001'; SELECT 'day2_assignments='||count(*) FROM appts.assignment_snapshot WHERE assignment_snapshot_id IN ('52010000-0000-4000-8000-000000000014','52010000-0000-4000-8000-000000000024','52010000-0000-4000-8000-000000000034');\"" \
  | tee "$EVIDENCE_DIR/seed-before.txt"

"${SSH_BASE[@]}" "$REMOTE_HOST" \
  "sudo docker compose -f '$COMPOSE_FILE' --env-file '$COMPOSE_ENV' exec -T postgres psql -X -v ON_ERROR_STOP=1 -U appts_admin -d appts_dep001_independent < '$DAY2_SEED'" \
  | tee -a "$EVIDENCE_DIR/day2-seed.txt"
"${SSH_BASE[@]}" "$REMOTE_HOST" \
  "sudo docker compose -f '$COMPOSE_FILE' --env-file '$COMPOSE_ENV' exec -T postgres psql -X -v ON_ERROR_STOP=1 -U appts_admin -d appts_dep001_independent < '$DAY2_SEED'" \
  | tee -a "$EVIDENCE_DIR/day2-seed.txt"

"${SSH_BASE[@]}" "$REMOTE_HOST" \
  "sudo docker compose -f '$COMPOSE_FILE' --env-file '$COMPOSE_ENV' exec -T postgres psql -X -U appts_admin -d appts_dep001_independent -Atqc \"SELECT 'tickets='||count(*) FROM appts.ticket_identity; SELECT 'runtime='||count(*) FROM appts.runtime_ticket; SELECT 'day2_source='||count(*) FROM appts.source_ref WHERE source_ref_id='52010000-0000-4000-8000-000000000001'; SELECT 'day2_assignments='||count(*) FROM appts.assignment_snapshot WHERE assignment_snapshot_id IN ('52010000-0000-4000-8000-000000000014','52010000-0000-4000-8000-000000000024','52010000-0000-4000-8000-000000000034');\"" \
  | tee "$EVIDENCE_DIR/seed-after.txt"
python3 - "$EVIDENCE_DIR/seed-before.txt" "$EVIDENCE_DIR/seed-after.txt" <<'PY'
import sys
before=dict(x.strip().split('=',1) for x in open(sys.argv[1]) if '=' in x)
after=dict(x.strip().split('=',1) for x in open(sys.argv[2]) if '=' in x)
assert before['tickets']==after['tickets'],(before,after)
assert before['runtime']==after['runtime'],(before,after)
assert after['day2_source']=='1',after
assert after['day2_assignments']=='3',after
print('seed_no_ticket_or_runtime_manufacture=PASS')
print('seed_reseed_idempotence=PASS')
PY

python3 - "$PORT" "$EVIDENCE_DIR/day1-negative.json" <<'PY'
import json,sys,urllib.request,uuid
port,out=sys.argv[1:]
base=f'http://127.0.0.1:{port}/api/v1/ui'
def get(path):
  with urllib.request.urlopen(base+path,timeout=30) as r:return json.loads(r.read().decode())
def post(body):
  q=urllib.request.Request(base+'/intents',data=json.dumps(body).encode(),headers={'content-type':'application/json'},method='POST')
  with urllib.request.urlopen(q,timeout=30) as r:return json.loads(r.read().decode())
before=get('/work-queue')['data']['ticket_count']
payload={'messageId':str(uuid.uuid4()),'idempotencyKey':str(uuid.uuid4()),'correlationId':str(uuid.uuid4())}
r=post({'intent_contract_ref':'APPTS.CORE.D01.PRETICKET_ADMISSION.SUBMISSION / 1.0.0','payload':payload})
after=get('/work-queue')['data']['ticket_count']
assert r.get('decision')=='HOLD_AS_PRE_TICKET',r
assert r.get('assessment')=='NOT_ACCEPTABLE',r
assert before==after,(before,after,r)
assert not r.get('ticketId'),r
json.dump({'beforeTicketCount':before,'response':r,'afterTicketCount':after},open(out,'w'),separators=(',',':'))
print('day1_negative_regression=PASS')
PY

"${SSH_BASE[@]}" "$REMOTE_HOST" \
  "sudo docker compose -f '$COMPOSE_FILE' --env-file '$COMPOSE_ENV' exec -T postgres psql -X -U appts_admin -d appts_dep001_independent -Atqc \"SELECT count(*) FROM appts.idempotency_ledger WHERE idempotency_key IN ('55010000-0000-4000-8000-000000000002','55020000-0000-4000-8000-000000000002');\"" \
  | tee "$EVIDENCE_DIR/producer-key-precheck.txt"
grep -Fxq '0' "$EVIDENCE_DIR/producer-key-precheck.txt"

mkdir -p "$EVIDENCE_DIR/producer-runtime"
CODEX055_BASE="http://127.0.0.1:${PORT}/api/v1/ui" \
CODEX055_EVIDENCE="$EVIDENCE_DIR/producer-runtime" \
python3 "$DEP_ROOT/tests/dep001/tls-day2-producer-runtime-proof.py" | tee "$EVIDENCE_DIR/producer-runtime-ticket.txt"

CHROME=""
for candidate in google-chrome google-chrome-stable chromium chromium-browser; do
  if command -v "$candidate" >/dev/null 2>&1; then CHROME="$(command -v "$candidate")"; break; fi
done
test -n "$CHROME" || { echo 'STOP: no headless Chrome/Chromium binary on Actions runner'; exit 2; }
"$CHROME" --version | tee "$EVIDENCE_DIR/browser-version.txt"
mkdir -p "$EVIDENCE_DIR/browser-stage"
DT_DAY2_ROOT="http://127.0.0.1:${PORT}" DT_DAY2_EVIDENCE="$EVIDENCE_DIR/browser-stage" CHROME="$CHROME" \
  python3 "$REPO_ROOT/INDEPENDENT_DEPLOYMENT/scripts/tls-day2-browser-proof.py" \
  | tee "$EVIDENCE_DIR/browser-stage-ticket.txt"

PRODUCER_TICKET="$(tr -d '\r\n' < "$EVIDENCE_DIR/producer-runtime/ticket-id.txt")"
BROWSER_TICKET="$(tr -d '\r\n' < "$EVIDENCE_DIR/browser-stage/browser-ticket-id.txt")"
"${SSH_BASE[@]}" "$REMOTE_HOST" \
  "sudo docker compose -f '$COMPOSE_FILE' --env-file '$COMPOSE_ENV' exec -T postgres psql -X -U appts_admin -d appts_dep001_independent -Atqc \"SELECT 'closed_total='||count(*) FROM appts.runtime_ticket WHERE current_state_code='CLOSED'; SELECT 'producer_runtime='||current_state_code||'|'||aggregate_version FROM appts.runtime_ticket WHERE ticket_id='${PRODUCER_TICKET}'::uuid; SELECT 'browser_runtime='||current_state_code||'|'||aggregate_version FROM appts.runtime_ticket WHERE ticket_id='${BROWSER_TICKET}'::uuid; SELECT 'producer_transition_v2='||count(*) FROM appts.runtime_state_transition WHERE ticket_id='${PRODUCER_TICKET}'::uuid AND resulting_aggregate_version=2; SELECT 'browser_transition_v2='||count(*) FROM appts.runtime_state_transition WHERE ticket_id='${BROWSER_TICKET}'::uuid AND resulting_aggregate_version=2; SELECT 'producer_effects='||count(*) FROM appts.lifecycle_effect_result r JOIN appts.lifecycle_effect_request q ON q.effect_request_id=r.effect_request_id WHERE q.ticket_id='${PRODUCER_TICKET}'::uuid; SELECT 'browser_effects='||count(*) FROM appts.lifecycle_effect_result r JOIN appts.lifecycle_effect_request q ON q.effect_request_id=r.effect_request_id WHERE q.ticket_id='${BROWSER_TICKET}'::uuid;\"" \
  | tee "$EVIDENCE_DIR/durable-terminal-readback.txt"
grep -Fxq 'producer_runtime=TERMINAL_PROCESSING|2' "$EVIDENCE_DIR/durable-terminal-readback.txt"
grep -Fxq 'browser_runtime=TERMINAL_PROCESSING|2' "$EVIDENCE_DIR/durable-terminal-readback.txt"
grep -Fxq 'producer_transition_v2=1' "$EVIDENCE_DIR/durable-terminal-readback.txt"
grep -Fxq 'browser_transition_v2=1' "$EVIDENCE_DIR/durable-terminal-readback.txt"
grep -Fxq 'closed_total=0' "$EVIDENCE_DIR/durable-terminal-readback.txt"

PRODUCER_RERUN_TICKET="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["ticketId"])' "$EVIDENCE_DIR/producer-runtime/rerun.json")"
"${SSH_BASE[@]}" "$REMOTE_HOST" \
  "sudo docker compose -f '$COMPOSE_FILE' --env-file '$COMPOSE_ENV' exec -T postgres psql -X -U appts_admin -d appts_dep001_independent -Atqc \"SELECT 'scenario_refs='||count(DISTINCT payload_or_reference_ref_json->>'scenario_run_ref') FROM appts.qualified_external_record WHERE payload_or_reference_ref_json->>'scenario_run_ref' IN ('TLS-D2-RUN-001','TLS-D2-RUN-002'); SELECT 'producer_evidence='||count(*) FROM appts.qualified_external_record WHERE ticket_id='${PRODUCER_TICKET}'::uuid; SELECT 'producer_verification='||count(*) FROM appts.verification_result WHERE ticket_id='${PRODUCER_TICKET}'::uuid; SELECT 'rerun_runtime='||current_state_code||'|'||aggregate_version FROM appts.runtime_ticket WHERE ticket_id='${PRODUCER_RERUN_TICKET}'::uuid;\"" \
  | tee "$EVIDENCE_DIR/durable-repeatability-readback.txt"
grep -Fxq 'scenario_refs=2' "$EVIDENCE_DIR/durable-repeatability-readback.txt"
grep -Fxq 'rerun_runtime=ACTIVE|1' "$EVIDENCE_DIR/durable-repeatability-readback.txt"

cat > "$EVIDENCE_DIR/SUMMARY.txt" <<EOF2
mcr_assignment=MCR-to-DT-016
transfer=CODEX055_DT_TRANSFER_v1.0_CONTROLLED.zip
transfer_sha256=d6f23f299b5c3516f23303ae8424bf0ff6812afc5c25025847f1a0c8469f1d39
accepted_base=$BASE_SHA
applied_source_commit=$APPLIED_SOURCE_SHA
admitted_overlay_files=16
protected_source_hashes=PASS
current_head_build_test=PASS
current_server_source_resync=PASS
current_server_health_ready=PASS
runtime_identity=appts_runtime
runtime_privilege_matrix=PASS
day2_seed_runtime_rejection=PASS
day2_seed_deployment_application=PASS
day2_seed_idempotent_reseed=PASS
day2_seed_ticket_manufacture=ZERO
day1_negative_regression=PASS
day1_positive_activate_regression=PASS
day2_producer_runtime_progression=ACTIVE_TO_TERMINAL_PROCESSING_PASS
wrong_verifier_fails_closed=PASS
eligible_verifier=PASS
terminal_claim_withheld_then_available=PASS
terminal_replay_no_duplicate_transition=PASS
browser_stage_consumability=PASS
repeatability_distinct_scenario_run_ref=PASS
closed_total=0
close_action=WITHHELD
day2_gate_recommendation=PASS_CLOSE_DAY2
EOF2
cat "$EVIDENCE_DIR/SUMMARY.txt"
