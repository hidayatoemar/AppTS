import datetime, http.cookiejar, json, os, urllib.error, urllib.request, uuid

ROOT=os.environ.get('CODEX058_ROOT','http://127.0.0.1:8080')
UI=ROOT+'/api/v1/ui'; AUTH=ROOT+'/api/v1/auth'
E=os.environ.get('CODEX058_EVIDENCE','/tmp/codex058-evidence'); os.makedirs(E,exist_ok=True)
SECRETS={
 'trial.ops.a':os.environ['CODEX058_OPS_SECRET'],
 'trial.verify.b':os.environ['CODEX058_VERIFY_SECRET'],
 'trial.disp.c':os.environ['CODEX058_DISP_SECRET'],
 'trial.close.d':os.environ['CODEX058_CLOSE_SECRET'],
 'trial.trainer.1':os.environ['CODEX058_TRAINER_SECRET'],
}
ROLES={
 'trial.ops.a':('TRIAL-RS-RESPONSIBLE-ROLE-01','TRIAL-HOLDER-OPS-A'),
 'trial.verify.b':('TRIAL-RS-VERIFICATION-ROLE-01','TRIAL-HOLDER-VERIFY-B'),
 'trial.disp.c':('TRIAL-RS-TERMINAL-DISPOSITION-ROLE-01','TRIAL-HOLDER-DISP-C'),
 'trial.close.d':('TRIAL-RS-CLOSURE-AUTHORITY-ROLE-01','TRIAL-HOLDER-CLOSE-D'),
 'trial.trainer.1':('TRIAL-TRAINER-CONTROL-01','TRIAL-TRAINER-CONTROL-01'),
}
A_HOLDER='51010000-0000-4000-8000-00000000000a'; A_ASSIGN='51010000-0000-4000-8000-00000000000b'
B_HOLDER='52010000-0000-4000-8000-000000000012'; B_ASSIGN='52010000-0000-4000-8000-000000000013'
C_HOLDER='52010000-0000-4000-8000-000000000022'; C_ASSIGN='52010000-0000-4000-8000-000000000023'
D_HOLDER='52010000-0000-4000-8000-000000000032'; D_ASSIGN='52010000-0000-4000-8000-000000000033'
REQ='RS_TRIAL_REQUEST_RESTORATION_VERIFICATION'; VERIFY='RS_TRIAL_VERIFY_RESTORATION_EVIDENCE'; TERM='RS_TRIAL_SUBMIT_TERMINAL_DISPOSITION_CLAIM'; CLOSE='RS_TRIAL_REQUEST_TICKET_CLOSURE'
TRAIN='APPTS.TLS.DAY2.TRAINER.TRIGGER / 1.0.0'; RESEED='APPTS.TLS.DAY3.TRAINER.RESEED_RUN / 1.0.0'; ACTION='INT-RUN-TD-05'

def ts(): return datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z')
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,req,fp,code,msg,headers,newurl): return None

def raw_request(url,method='GET',body=None,opener=None):
    data=None if body is None else json.dumps(body).encode()
    req=urllib.request.Request(url,data=data,headers={'content-type':'application/json'} if body is not None else {},method=method)
    try:
        open_fn=opener.open if opener is not None else urllib.request.urlopen
        with open_fn(req,timeout=30) as r:
            raw=r.read().decode(); return r.status,json.loads(raw) if raw and raw.lstrip().startswith(('{','[')) else raw,dict(r.headers)
    except urllib.error.HTTPError as e:
        raw=e.read().decode(errors='replace')
        try: parsed=json.loads(raw)
        except Exception: parsed=raw
        return e.code,parsed,dict(e.headers)

class Client:
    def __init__(self):
        self.jar=http.cookiejar.CookieJar(); self.opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))
    def request(self,url,method='GET',body=None,expect=200):
        status,value,_=raw_request(url,method,body,self.opener); assert status==expect,(status,value,url); return value
    def login(self,alias,credential=None):
        value=self.request(AUTH+'/login','POST',{'alias':alias,'credential':credential or SECRETS[alias]}); role,holder=ROLES[alias]
        assert value['authenticated'] is True and value['alias']==alias and value['role_ref']==role and value['holder_ref']==holder,value
        assert value['trainer_only'] is (alias=='trial.trainer.1'),value; return value
    def session(self,expect=200): return self.request(AUTH+'/session',expect=expect)
    def logout(self): return self.request(AUTH+'/logout','POST',{})
    def get(self,path,expect=200): return self.request(UI+path,expect=expect)
    def intent(self,contract,payload,expect=200): return self.request(UI+'/intents','POST',{'intent_contract_ref':contract,'subject_ref':payload.get('ticket_id','TLS-D3-RS-SCN-01'),'correlation_id':str(uuid.uuid4()),'payload':payload},expect=expect)
    def end_shift(self): return self.request(AUTH+'/end-shift-check')

def action(ticket,action_class,projection,actor=None,assignment=None,expected=None,source=None,intent_id=None):
    payload={'action_intent_id':intent_id or str(uuid.uuid4()),'ticket_id':ticket,'requested_action_class':action_class,'presented_source_version_ref':source or projection['source_version_set_ref'],'expected_aggregate_version':projection['data']['aggregate_version'] if expected is None else expected,'intent_time':ts()}
    if actor is not None: payload['actor_ref']=actor
    if assignment is not None: payload['role_assignment_ref']=assignment
    return payload

def contains_ticket(queue,ticket): return any(x.get('ticket_id')==ticket for x in queue['data'].get('tickets',[]))

def restart_phase():
    closed=open(E+'/closed-ticket-id.txt').read().strip(); open_ticket=open(E+'/open-ticket-id.txt').read().strip()
    d=Client(); d.login('trial.close.d'); closed_view=d.get('/tickets/'+closed); assert closed_view['data']['current_state_code']=='CLOSED' and closed_view['data']['aggregate_version']==3,closed_view
    closed_detail=d.get('/tickets/'+closed+'/concerns/closed'); assert closed_detail['data']['irreversible'] is True and closed_detail['data']['reopen_action_available'] is False,closed_detail
    a=Client(); a.login('trial.ops.a'); queue=a.get('/work-queue'); assert contains_ticket(queue,open_ticket),queue
    json.dump({'closed':closed_view,'closedDetail':closed_detail,'openQueue':queue},open(E+'/restart-readback.json','w'))
    print('D3_RESTART_READBACK=PASS'); return

if os.environ.get('CODEX058_PHASE')=='restart': restart_phase(); raise SystemExit(0)

# D3-01 unauthenticated governed/API surfaces fail closed and SPA routes redirect to Login.
status,body,_=raw_request(UI+'/work-queue'); assert status==401,(status,body)
no_redirect=urllib.request.build_opener(NoRedirect())
status,_,headers=raw_request(ROOT+'/work',opener=no_redirect); assert status in (302,303,307,308) and headers.get('Location')=='/login',(status,headers)

# D3-02 invalid credentials denied; D3-03 exact alias mappings resolve through server binding check.
bad=Client(); status,_,_=raw_request(AUTH+'/login','POST',{'alias':'trial.ops.a','credential':str(uuid.uuid4())},bad.opener); assert status==401,status
sessions={}
for alias in ROLES:
    c=Client(); sessions[alias]=c; c.login(alias)

# D3-05 session isolation: logout B does not affect A; each cookie remains alias-bound.
a=sessions['trial.ops.a']; b=sessions['trial.verify.b']; assert a.session()['alias']=='trial.ops.a' and b.session()['alias']=='trial.verify.b'
b.logout(); status,_,_=raw_request(AUTH+'/session',opener=b.opener); assert status==401,status; assert a.session()['alias']=='trial.ops.a'

# D3-06 trainer has control-plane auth but no generic Product read/action authority.
trainer=sessions['trial.trainer.1']; assert trainer.get('/trainer/targets')['data']['product_authority'] is False
status,_,_=raw_request(UI+'/work-queue',opener=trainer.opener); assert status==403,status
status,_,_=raw_request(UI+'/intents','POST',{'intent_contract_ref':ACTION,'payload':{'requested_action_class':'ACTIVATE'}},trainer.opener); assert status==403,status

# D3-16 fresh governed run: trainer issues simulator input; D-01 governs formation; no prior truth is reset.
run1='TLS-D3-RUN-'+str(uuid.uuid4()); fresh=trainer.intent(RESEED,{'scenarioRunRef':run1}); assert fresh['result']=='ACK' and fresh['control']=='FRESH_GOVERNED_RUN' and fresh['state']=='ACCEPTED',fresh
ticket=fresh['ticketId']; assert isinstance(ticket,str) and ticket,ticket
trainer_target=trainer.get('/trainer/tickets/'+ticket); assert trainer_target['data']['target']['current_state_code']=='ACCEPTED' and trainer_target['data']['target']['trigger_available'] is False,trainer_target
status,_,_=raw_request(UI+'/tickets/'+ticket,opener=trainer.opener); assert status==403,status

# A sees only server-derived Role-scoped work. D3-04 client authority tamper is rejected.
queue=a.get('/work-queue'); assert queue['data']['session_alias']=='trial.ops.a' and contains_ticket(queue,ticket),queue
accepted=a.get('/tickets/'+ticket); assert accepted['data']['available_actions']==['ACTIVATE'],accepted
forged=action(ticket,'ACTIVATE',accepted,B_HOLDER,B_ASSIGN); status,body,_=raw_request(UI+'/intents','POST',{'intent_contract_ref':ACTION,'payload':forged},a.opener); assert status==403 and body.get('error')=='TLS_DAY3_CLIENT_ACTOR_TAMPER_DENIED',(status,body)
activate=action(ticket,'ACTIVATE',accepted); activated=a.intent(ACTION,activate); assert activated['result']=='EFFECT_APPLIED' and activated['state']=='ACTIVE' and activated['aggregateVersion']==1,activated
active=a.get('/tickets/'+ticket); assert active['data']['current_state_code']=='ACTIVE' and active['data']['aggregate_version']==1,active

# D3-08 closure cannot be invoked before predicates/state even by valid closure-role session.
d=sessions['trial.close.d']; premature=action(ticket,CLOSE,active); status,_,_=raw_request(UI+'/intents','POST',{'intent_contract_ref':ACTION,'payload':premature},d.opener); assert status==403,status
assert a.get('/tickets/'+ticket)['data']['current_state_code']=='ACTIVE'

# D3-07 accepted Day-2 journey through role/session boundaries.
trigger=trainer.intent(TRAIN,{'ticketId':ticket,'scenarioRunRef':run1+'-RESTORE'}); assert trigger['result']=='ACK' and trigger['state']=='ACTIVE' and trigger['contract']=='INT-RUN-TD-01',trigger
after_trigger=a.get('/tickets/'+ticket); assert after_trigger['data']['available_actions']==[REQ],after_trigger
req=a.intent(ACTION,action(ticket,REQ,after_trigger)); assert req['result']=='ACK' and req['state']=='ACTIVE',req
requested=a.get('/tickets/'+ticket); assert requested['data']['available_actions']==[],requested
wrong=a.intent(ACTION,action(ticket,VERIFY,requested)); assert wrong['result']=='NACK' and wrong['terminalClaimAvailable'] is False,wrong

# B authenticates independently and receives only B's currently authorized verification action.
b=Client(); b.login('trial.verify.b'); bview=b.get('/tickets/'+ticket); assert bview['data']['available_actions']==[VERIFY],bview
verified=b.intent(ACTION,action(ticket,VERIFY,bview)); assert verified['result']=='ACK' and verified['verificationResult']=='VERIFIED' and verified['terminalClaimAvailable'] is True,verified
bevidence=a.get('/tickets/'+ticket+'/concerns/evidence'); assert bevidence['data']['truth_posture']=='INDEPENDENTLY_VERIFIED' and bevidence['data']['verifier_ref']==B_HOLDER,bevidence

# C receives terminal-disposition authority only after valid independent verification.
c=Client(); c.login('trial.disp.c'); cview=c.get('/tickets/'+ticket); assert cview['data']['available_actions']==[TERM],cview
terminal_payload=action(ticket,TERM,cview); terminal=c.intent(ACTION,terminal_payload); assert terminal['result']=='EFFECT_APPLIED' and terminal['state']=='TERMINAL_PROCESSING' and terminal['aggregateVersion']==2,terminal
terminal_replay=c.intent(ACTION,terminal_payload); assert terminal_replay['replay'] is True and terminal_replay['aggregateVersion']==2,terminal_replay

# D3-09 closure action appears only to D after D-03 readiness/Gate materialization.
d=Client(); d.login('trial.close.d'); dview=d.get('/tickets/'+ticket); assert dview['data']['current_state_code']=='TERMINAL_PROCESSING' and dview['data']['available_actions']==[CLOSE] and dview['data']['close_action_available'] is True,dview
closure=d.get('/tickets/'+ticket+'/concerns/closure'); cd=closure['data']; assert cd['closure_readiness_result']=='READY' and cd['close_action_available'] is True and cd['closure_action_class']==CLOSE and cd['reopen_action_available'] is False,cd
assert all(p['result_code']=='SATISFIED' for p in cd['closure_predicates']),cd

# Wrong role still cannot close after readiness.
a_after=a.get('/tickets/'+ticket); wrong_role=action(ticket,CLOSE,a_after); status,_,_=raw_request(UI+'/intents','POST',{'intent_contract_ref':ACTION,'payload':wrong_role},a.opener); assert status==403,status

# D3-10 stale aggregate and stale context fail with no closure effect.
stale_agg=action(ticket,CLOSE,dview,expected=1); status,_,_=raw_request(UI+'/intents','POST',{'intent_contract_ref':ACTION,'payload':stale_agg},d.opener); assert status==403,status
still=d.get('/tickets/'+ticket); assert still['data']['current_state_code']=='TERMINAL_PROCESSING' and still['data']['aggregate_version']==2,still
stale_context=dview['source_version_set_ref'].rsplit(':',1)[0]+':999'
stale_ctx=action(ticket,CLOSE,dview,expected=2,source=stale_context); status,body,_=raw_request(UI+'/intents','POST',{'intent_contract_ref':ACTION,'payload':stale_ctx},d.opener); assert status==403 and body.get('error')=='TLS_DAY3_STALE_CONTEXT',(status,body)
assert d.get('/tickets/'+ticket)['data']['current_state_code']=='TERMINAL_PROCESSING'

# D3-11 exactly one governed TP->CLOSED; D3-12 identical replay adds no second transition.
close_id=str(uuid.uuid4()); close_payload=action(ticket,CLOSE,dview,intent_id=close_id); closed=d.intent(ACTION,close_payload); assert closed['result']=='EFFECT_APPLIED' and closed['state']=='CLOSED' and closed['aggregateVersion']==3 and closed['reopenAvailable'] is False,closed
close_replay=d.intent(ACTION,close_payload); assert close_replay['result']=='EFFECT_APPLIED' and close_replay['replay'] is True and close_replay['state']=='CLOSED' and close_replay['aggregateVersion']==3,close_replay
closed_ticket=d.get('/tickets/'+ticket); assert closed_ticket['data']['current_state_code']=='CLOSED' and closed_ticket['data']['available_actions']==[] and closed_ticket['data']['reopen_action_available'] is False,closed_ticket
closed_concern=d.get('/tickets/'+ticket+'/concerns/closure'); assert closed_concern['data']['closure_posture']=='CLOSED_IRREVERSIBLE' and closed_concern['data']['close_action_available'] is False,closed_concern
closed_detail=d.get('/tickets/'+ticket+'/concerns/closed'); assert closed_detail['data']['irreversible'] is True and closed_detail['data']['reopen_action_available'] is False,closed_detail

# D3-14 End Shift is read-only. Create a second governed run, leave it open, prove logout does not finish it.
run2='TLS-D3-RUN-'+str(uuid.uuid4()); fresh2=trainer.intent(RESEED,{'scenarioRunRef':run2}); assert fresh2['result']=='ACK' and fresh2['state']=='ACCEPTED',fresh2
open_ticket=fresh2['ticketId']; end=a.end_shift(); assert end['mutation_performed'] is False and end['posture']=='SERVER_DERIVED_READ_ONLY_END_SHIFT_CHECK' and any(x['ticket_id']==open_ticket for x in end['open_tickets']),end
before_logout=a.get('/tickets/'+open_ticket); assert before_logout['data']['current_state_code']=='ACCEPTED',before_logout
a.logout(); status,_,_=raw_request(UI+'/work-queue',opener=a.opener); assert status==401,status
# D3-15 login state returns; incomplete work remains.
a=Client(); a.login('trial.ops.a'); assert contains_ticket(a.get('/work-queue'),open_ticket); assert a.get('/tickets/'+open_ticket)['data']['current_state_code']=='ACCEPTED'

json.dump({'ticket':ticket,'fresh':fresh,'activated':activated,'trigger':trigger,'wrongVerifier':wrong,'verified':verified,'terminal':terminal,'closureReady':closure,'closed':closed,'closedReplay':close_replay,'freshRun2':fresh2,'endShift':end},open(E+'/day3-golden.json','w'))
open(E+'/closed-ticket-id.txt','w').write(ticket); open(E+'/open-ticket-id.txt','w').write(open_ticket)
print('D3_01_TO_D3_12=PASS'); print('D3_14_TO_D3_18_PRE_RESTART=PASS')
