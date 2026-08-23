#!/usr/bin/env python3
import datetime, json, os, subprocess, urllib.error, urllib.parse, urllib.request, uuid

ROOT=os.environ.get('DT_DAY2_ROOT','http://127.0.0.1:18080')
BASE=ROOT+'/api/v1/ui'
E=os.environ['DT_DAY2_EVIDENCE']
CHROME=os.environ['CHROME']
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

def snap(name,path,needles):
    dom=os.path.join(E,name+'.html'); png=os.path.join(E,name+'.png'); url=ROOT+path
    with open(dom,'wb') as out:
        subprocess.run([CHROME,'--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--virtual-time-budget=7000','--dump-dom',url],stdout=out,check=True)
    subprocess.run([CHROME,'--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--virtual-time-budget=7000','--window-size=1440,1400',f'--screenshot={png}',url],stdout=subprocess.DEVNULL,check=True)
    html=open(dom,encoding='utf-8',errors='replace').read()
    for needle in needles:
        assert needle in html, (name,needle)
    return {'name':name,'url':url,'needles':needles}

# Fresh governed Day-1 path to ACTIVE for browser-specific Day-2 observation.
positive={'messageId':str(uuid.uuid4()),'idempotencyKey':str(uuid.uuid4()),'correlationId':str(uuid.uuid4()),'trialContext':'TLS-DAY1-GOLDEN'}
formed=post(D1,positive)
assert formed['disposition']=='CREATED' and formed['decision']=='ACCEPTED_FOR_FORMATION' and formed['state']=='ACCEPTED' and formed['aggregateVersion']==0, formed
ticket=formed['ticketId']; before=get('/tickets/'+ticket); d=before['data']
act={'action_intent_id':str(uuid.uuid4()),'ticket_id':ticket,'actor_ref':A_HOLDER,'role_assignment_ref':A_ASSIGN,'requested_action_class':'ACTIVATE','presented_source_version_ref':before['source_version_set_ref'],'expected_aggregate_version':0,'intent_time':ts()}
out=post(ACTION,act); assert out['result']=='EFFECT_APPLIED' and out['state']=='ACTIVE' and out['aggregateVersion']==1, out
active=get('/tickets/'+ticket); assert active['data']['day2_trainer_available'] is True, active

snaps=[]
q=urllib.parse.quote(ticket,safe='')
snaps.append(snap('01-active-ticket',f'/tickets/{q}',['Lifecycle state:</strong> ACTIVE','Open Day-2 Trainer Console','Evidence and Verification']))
snaps.append(snap('02-trainer-before',f'/trainer/tls-day2?ticket={q}',['Simulation control plane — not AppTS business authority.','cannot create Tickets, verify evidence, advance lifecycle state, or close a Ticket','SERVICE_RESTORATION_INDICATION = AVAILABLE','INT-RUN-TD-01']))

scenario='TLS-D2-BROWSER-'+uuid.uuid4().hex[:12]
trig=post(TRAIN,{'ticketId':ticket,'scenarioRunRef':scenario})
assert trig['result']=='ACK' and trig['durable'] is True and trig['state']=='ACTIVE' and trig['contract']=='INT-RUN-TD-01', trig
after_trig=get('/tickets/'+ticket); assert after_trig['data']['available_actions']==[REQ], after_trig
snaps.append(snap('03-provisional-evidence',f'/tickets/{q}/evidence',['PROVISIONAL_PENDING_INDEPENDENT_VERIFICATION','SIM-NMS-RS-TLS-D2-01','SIM-RS-QER-PROFILE-V1',scenario,'NOT_REQUESTED','External indication is evidence only']))
snaps.append(snap('04-request-action',f'/tickets/{q}/action/{urllib.parse.quote(REQ,safe="")}',['Current Role:</strong> TRIAL-RS-RESPONSIBLE-ROLE-01','Bound Holder:</strong> TRIAL-HOLDER-OPS-A','Availability:</strong> AVAILABLE']))
snaps.append(snap('05-closure-withheld',f'/tickets/{q}/closure',['Lifecycle state:</strong> ACTIVE','NO_CLOSE_ACTION_AUTHORIZED','no CLOSE action']))

req={'action_intent_id':str(uuid.uuid4()),'ticket_id':ticket,'actor_ref':A_HOLDER,'role_assignment_ref':A_ASSIGN,'requested_action_class':REQ,'presented_source_version_ref':after_trig['source_version_set_ref'],'expected_aggregate_version':1,'intent_time':ts()}
requested=post(ACTION,req); assert requested['result']=='ACK' and requested['state']=='ACTIVE', requested
after_req=get('/tickets/'+ticket); assert after_req['data']['available_actions']==[VERIFY], after_req
snaps.append(snap('06-verify-action',f'/tickets/{q}/action/{urllib.parse.quote(VERIFY,safe="")}',['Current Role:</strong> TRIAL-RS-VERIFICATION-ROLE-01','Bound Holder:</strong> TRIAL-HOLDER-VERIFY-B','Availability:</strong> AVAILABLE']))

wrong={'action_intent_id':str(uuid.uuid4()),'ticket_id':ticket,'actor_ref':A_HOLDER,'role_assignment_ref':A_ASSIGN,'requested_action_class':VERIFY,'presented_source_version_ref':after_req['source_version_set_ref'],'expected_aggregate_version':1,'intent_time':ts()}
rejected=post(ACTION,wrong); assert rejected['result']=='NACK' and rejected['durable'] is True and rejected['terminalClaimAvailable'] is False, rejected
after_wrong=get('/tickets/'+ticket); assert after_wrong['data']['available_actions']==[VERIFY], after_wrong

valid={'action_intent_id':str(uuid.uuid4()),'ticket_id':ticket,'actor_ref':B_HOLDER,'role_assignment_ref':B_ASSIGN,'requested_action_class':VERIFY,'presented_source_version_ref':after_wrong['source_version_set_ref'],'expected_aggregate_version':1,'intent_time':ts()}
verified=post(ACTION,valid); assert verified['result']=='ACK' and verified['verificationResult']=='VERIFIED' and verified['terminalClaimAvailable'] is True, verified
after_verify=get('/tickets/'+ticket); assert after_verify['data']['available_actions']==[TERM], after_verify
snaps.append(snap('07-verified-evidence',f'/tickets/{q}/evidence',['INDEPENDENTLY_VERIFIED','VERIFIED','52010000-0000-4000-8000-000000000012']))
snaps.append(snap('08-terminal-action',f'/tickets/{q}/action/{urllib.parse.quote(TERM,safe="")}',['Current Role:</strong> TRIAL-RS-TERMINAL-DISPOSITION-ROLE-01','Bound Holder:</strong> TRIAL-HOLDER-DISP-C','Availability:</strong> AVAILABLE']))

terminal={'action_intent_id':str(uuid.uuid4()),'ticket_id':ticket,'actor_ref':C_HOLDER,'role_assignment_ref':C_ASSIGN,'requested_action_class':TERM,'presented_source_version_ref':after_verify['source_version_set_ref'],'expected_aggregate_version':1,'intent_time':ts()}
applied=post(ACTION,terminal); assert applied['result']=='EFFECT_APPLIED' and applied['state']=='TERMINAL_PROCESSING' and applied['aggregateVersion']==2 and applied['closeActionAvailable'] is False, applied
replay=post(ACTION,terminal); assert replay['result']=='EFFECT_APPLIED' and replay['replay'] is True and replay['aggregateVersion']==2, replay
final=get('/tickets/'+ticket); assert final['data']['current_state_code']=='TERMINAL_PROCESSING' and final['data']['available_actions']==[] and final['data']['close_action_available'] is False, final
snaps.append(snap('09-terminal-ticket',f'/tickets/{q}',['Lifecycle state:</strong> TERMINAL_PROCESSING','Available actions:</strong> None']))
snaps.append(snap('10-terminal-closure',f'/tickets/{q}/closure',['Lifecycle state:</strong> TERMINAL_PROCESSING','TERMINAL_PROCESSING_NOT_CLOSED','NO_CLOSE_ACTION_AUTHORIZED','no CLOSE action']))
snaps.append(snap('11-trainer-after',f'/trainer/tls-day2?ticket={q}',['Simulation control plane — not AppTS business authority.','Current state:</strong> TERMINAL_PROCESSING','Trigger withheld: target Ticket must be ACTIVE.']))

result={'ticketId':ticket,'scenarioRunRef':scenario,'wrongVerifier':rejected,'validVerifier':verified,'terminal':applied,'replay':replay,'snapshots':snaps}
json.dump(result,open(os.path.join(E,'browser-stage-proof.json'),'w'),separators=(',',':'))
open(os.path.join(E,'browser-ticket-id.txt'),'w').write(ticket)
print(ticket)
