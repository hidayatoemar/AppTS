import datetime, json, os, urllib.error, urllib.request, uuid

BASE=os.environ.get('CODEX055_BASE','http://127.0.0.1:8080/api/v1/ui')
E=os.environ.get('CODEX055_EVIDENCE','/tmp/codex055-evidence')
os.makedirs(E,exist_ok=True)
A_HOLDER='51010000-0000-4000-8000-00000000000a'; A_ASSIGN='51010000-0000-4000-8000-00000000000b'
B_HOLDER='52010000-0000-4000-8000-000000000012'; B_ASSIGN='52010000-0000-4000-8000-000000000013'
C_HOLDER='52010000-0000-4000-8000-000000000022'; C_ASSIGN='52010000-0000-4000-8000-000000000023'
REQ='RS_TRIAL_REQUEST_RESTORATION_VERIFICATION'; VERIFY='RS_TRIAL_VERIFY_RESTORATION_EVIDENCE'; TERM='RS_TRIAL_SUBMIT_TERMINAL_DISPOSITION_CLAIM'
D1='APPTS.CORE.D01.PRETICKET_ADMISSION.SUBMISSION / 1.0.0'; TRAIN='APPTS.TLS.DAY2.TRAINER.TRIGGER / 1.0.0'; ACTION='INT-RUN-TD-05'

def get(path):
    with urllib.request.urlopen(BASE+path,timeout=30) as r: return json.loads(r.read().decode())

def post(contract,payload):
    req=urllib.request.Request(BASE+'/intents',data=json.dumps({'intent_contract_ref':contract,'payload':payload}).encode(),headers={'content-type':'application/json'},method='POST')
    try:
        with urllib.request.urlopen(req,timeout=30) as r: return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        raw=e.read().decode(errors='replace'); raise AssertionError(f'HTTP {e.code}: {raw}')

def ts(): return datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z')

def form_active(base_uuid_prefix):
    positive={'messageId':base_uuid_prefix+'000000000001','idempotencyKey':base_uuid_prefix+'000000000002','correlationId':base_uuid_prefix+'000000000003','trialContext':'TLS-DAY1-GOLDEN'}
    formed=post(D1,positive)
    assert formed['disposition']=='CREATED' and formed['decision']=='ACCEPTED_FOR_FORMATION' and formed['state']=='ACCEPTED' and formed['aggregateVersion']==0, formed
    ticket=formed['ticketId']; before=get('/tickets/'+ticket); d=before['data']
    assert d['current_state_code']=='ACCEPTED' and d['available_actions']==['ACTIVATE'], d
    act={'action_intent_id':str(uuid.uuid4()),'ticket_id':ticket,'actor_ref':A_HOLDER,'role_assignment_ref':A_ASSIGN,'requested_action_class':'ACTIVATE','presented_source_version_ref':before['source_version_set_ref'],'expected_aggregate_version':0,'intent_time':ts()}
    out=post(ACTION,act); assert out['result']=='EFFECT_APPLIED' and out['state']=='ACTIVE' and out['aggregateVersion']==1, out
    active=get('/tickets/'+ticket); ad=active['data']
    assert ad['current_state_code']=='ACTIVE' and ad['aggregate_version']==1 and ad['day2_stage']=='AWAITING_CONTROLLED_DAY2_TRIGGER' and ad['day2_trainer_available'] is True, ad
    return ticket,active

ticket,active=form_active('55010000-0000-4000-8000-')
json.dump(active,open(E+'/active-before-day2.json','w'))
trig=post(TRAIN,{'ticketId':ticket,'scenarioRunRef':'TLS-D2-RUN-001'})
assert trig['result']=='ACK' and trig['durable'] is True and trig['state']=='ACTIVE' and trig['contract']=='INT-RUN-TD-01', trig
after_trig=get('/tickets/'+ticket); td=after_trig['data']
assert td['current_state_code']=='ACTIVE' and td['aggregate_version']==1, td
assert td['available_actions']==[REQ] and TERM not in td['available_actions'], td
evidence=get('/tickets/'+ticket+'/concerns/evidence'); ed=evidence['data']
assert ed['source_identity']=='SIM-NMS-RS-TLS-D2-01' and ed['adapter_profile_identity']=='SIM-RS-QER-PROFILE-V1', ed
assert ed['scenario_run_ref']=='TLS-D2-RUN-001' and ed['event_class']=='SERVICE_RESTORATION_INDICATION' and ed['indicated_condition']=='AVAILABLE', ed
assert ed['truth_posture']=='PROVISIONAL_PENDING_INDEPENDENT_VERIFICATION' and ed['verification_status']=='NOT_REQUESTED', ed
json.dump({'trigger':trig,'ticket':after_trig,'evidence':evidence},open(E+'/provisional.json','w'))

req_action={'action_intent_id':str(uuid.uuid4()),'ticket_id':ticket,'actor_ref':A_HOLDER,'role_assignment_ref':A_ASSIGN,'requested_action_class':REQ,'presented_source_version_ref':after_trig['source_version_set_ref'],'expected_aggregate_version':1,'intent_time':ts()}
requested=post(ACTION,req_action); assert requested['result']=='ACK' and requested['state']=='ACTIVE', requested
after_req=get('/tickets/'+ticket); rd=after_req['data']; assert rd['available_actions']==[VERIFY] and TERM not in rd['available_actions'], rd

wrong={'action_intent_id':str(uuid.uuid4()),'ticket_id':ticket,'actor_ref':A_HOLDER,'role_assignment_ref':A_ASSIGN,'requested_action_class':VERIFY,'presented_source_version_ref':after_req['source_version_set_ref'],'expected_aggregate_version':1,'intent_time':ts()}
rejected=post(ACTION,wrong); assert rejected['result']=='NACK' and rejected['durable'] is True and rejected['state']=='ACTIVE' and rejected['terminalClaimAvailable'] is False, rejected
after_wrong=get('/tickets/'+ticket); assert after_wrong['data']['available_actions']==[VERIFY] and TERM not in after_wrong['data']['available_actions'], after_wrong

valid={'action_intent_id':str(uuid.uuid4()),'ticket_id':ticket,'actor_ref':B_HOLDER,'role_assignment_ref':B_ASSIGN,'requested_action_class':VERIFY,'presented_source_version_ref':after_wrong['source_version_set_ref'],'expected_aggregate_version':1,'intent_time':ts()}
verified=post(ACTION,valid); assert verified['result']=='ACK' and verified['verificationResult']=='VERIFIED' and verified['terminalClaimAvailable'] is True, verified
after_verify=get('/tickets/'+ticket); vd=after_verify['data']; assert vd['available_actions']==[TERM], vd
ctl=vd['action_controls'][0]; assert ctl['actor_ref']==C_HOLDER and ctl['role_assignment_ref']==C_ASSIGN, ctl
verified_evidence=get('/tickets/'+ticket+'/concerns/evidence'); ved=verified_evidence['data']; assert ved['verification_status']=='VERIFIED' and ved['verifier_ref']==B_HOLDER and ved['truth_posture']=='INDEPENDENTLY_VERIFIED', ved
json.dump({'wrongVerifier':rejected,'validVerifier':verified,'ticket':after_verify,'evidence':verified_evidence},open(E+'/verification.json','w'))

terminal={'action_intent_id':str(uuid.uuid4()),'ticket_id':ticket,'actor_ref':C_HOLDER,'role_assignment_ref':C_ASSIGN,'requested_action_class':TERM,'presented_source_version_ref':after_verify['source_version_set_ref'],'expected_aggregate_version':1,'intent_time':ts()}
applied=post(ACTION,terminal); assert applied['result']=='EFFECT_APPLIED' and applied['durable'] is True and applied['state']=='TERMINAL_PROCESSING' and applied['aggregateVersion']==2 and applied['closeActionAvailable'] is False, applied
replay=post(ACTION,terminal); assert replay['result']=='EFFECT_APPLIED' and replay['replay'] is True and replay['state']=='TERMINAL_PROCESSING' and replay['aggregateVersion']==2, replay
final=get('/tickets/'+ticket); fd=final['data']; assert fd['current_state_code']=='TERMINAL_PROCESSING' and fd['aggregate_version']==2 and fd['available_actions']==[] and fd['close_action_available'] is False, fd
assert 'SET_TERMINAL_PROCESSING' not in fd['available_actions'] and 'CLOSE' not in fd['available_actions'], fd
closure=get('/tickets/'+ticket+'/concerns/closure'); cd=closure['data']; assert cd['current_state_code']=='TERMINAL_PROCESSING' and cd['close_action_available'] is False and cd['closure_posture']=='TERMINAL_PROCESSING_NOT_CLOSED' and cd['day2_boundary']=='NO_CLOSE_ACTION_AUTHORIZED', cd
json.dump({'terminal':applied,'replay':replay,'ticket':final,'closure':closure},open(E+'/terminal.json','w'))
open(E+'/ticket-id.txt','w').write(ticket)

# Controlled rerun uses a fresh governed Ticket and a distinct scenario_run_ref; no canonical state reset or terminal manufacture.
ticket2,_=form_active('55020000-0000-4000-8000-')
trig2=post(TRAIN,{'ticketId':ticket2,'scenarioRunRef':'TLS-D2-RUN-002'})
assert trig2['result']=='ACK' and trig2['state']=='ACTIVE', trig2
e2=get('/tickets/'+ticket2+'/concerns/evidence'); assert e2['data']['scenario_run_ref']=='TLS-D2-RUN-002', e2
t2=get('/tickets/'+ticket2); assert t2['data']['current_state_code']=='ACTIVE' and t2['data']['aggregate_version']==1, t2
json.dump({'ticketId':ticket2,'trigger':trig2,'evidence':e2,'ticket':t2},open(E+'/rerun.json','w'))
print(ticket)
