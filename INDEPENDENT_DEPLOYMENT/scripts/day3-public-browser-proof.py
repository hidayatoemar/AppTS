import json, os, pathlib, time, urllib.parse
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC

ROOT=os.environ.get('DAY3_PUBLIC_ROOT','https://dev.appts.cifo.id').rstrip('/')
E=pathlib.Path(os.environ.get('DAY3_PUBLIC_EVIDENCE','/tmp/day3-public-browser'))
E.mkdir(parents=True,exist_ok=True)
CREDS=json.loads(pathlib.Path(os.environ['TRIAL_CREDENTIAL_FILE']).read_text())
PHASE=os.environ.get('DAY3_PUBLIC_PHASE','main')

opts=webdriver.ChromeOptions()
opts.add_argument('--headless=new')
opts.add_argument('--no-sandbox')
opts.add_argument('--disable-gpu')
opts.add_argument('--disable-dev-shm-usage')
opts.add_argument('--window-size=1440,1200')
opts.set_capability('goog:loggingPrefs', {'performance':'ALL'})
driver=webdriver.Chrome(options=opts)
wait=WebDriverWait(driver,30)

def body(): return driver.find_element(By.TAG_NAME,'body').text

def wait_text(value,timeout=30):
    WebDriverWait(driver,timeout).until(lambda d:value in d.find_element(By.TAG_NAME,'body').text)

def snap(name): driver.save_screenshot(str(E/f'{name}.png'))

def goto(path):
    driver.get(ROOT+path)
    wait.until(lambda d:d.execute_script('return document.readyState')=='complete')

def login(alias):
    goto('/login')
    wait_text('AppTS Trial Login')
    Select(driver.find_element(By.CSS_SELECTOR,'select')).select_by_value(alias)
    password=driver.find_element(By.CSS_SELECTOR,'input[type="password"]')
    password.clear(); password.send_keys(CREDS[alias])
    driver.find_element(By.XPATH,"//button[contains(.,'Login / Start Shift')]").click()
    wait.until(lambda d:'/login' not in d.current_url)
    wait_text(alias)

def logout_and_prove(name):
    goto('/end-shift')
    wait_text('End Shift Check')
    wait_text('This check is read-only')
    snap(name+'-end-shift')
    driver.find_element(By.XPATH,"//button[contains(.,'Logout / End Session')]").click()
    wait.until(lambda d:'/login' in d.current_url)
    wait_text('AppTS Trial Login')
    goto('/work')
    wait.until(lambda d:'/login' in d.current_url)
    wait_text('AppTS Trial Login')

def ticket_path(ticket): return '/tickets/'+urllib.parse.quote(ticket,safe='')

def action_path(ticket,action): return ticket_path(ticket)+'/action/'+urllib.parse.quote(action,safe='')

def perform_guided(alias,ticket,action,expected,name):
    login(alias)
    goto(ticket_path(ticket))
    wait_text('Ticket Operational Console')
    link=wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR,f'a[data-action-class="{action}"]')))
    link.click(); wait_text('Guided Action'); wait_text('Availability: AVAILABLE')
    driver.find_element(By.XPATH,"//button[contains(.,'Confirm governed action')]").click()
    wait.until(lambda d:'Authoritative result:' in d.find_element(By.TAG_NAME,'body').text)
    wait_text('Authoritative result: '+expected)
    snap(name)
    return body()

def browser_fetch(script,*args):
    return driver.execute_async_script(script,*args)

try:
    if PHASE=='restart':
        ticket=os.environ['DAY3_PUBLIC_TICKET_ID']
        login('trial.close.d')
        goto(ticket_path(ticket)+'/closed')
        wait_text('Closed Ticket / Correction / Successor')
        wait_text('Closed is irreversible')
        wait_text('No post-closure action is available without current authoritative action context.')
        snap('12-restart-closed-readback')
        logout_and_prove('13-restart')
        (E/'restart-summary.json').write_text(json.dumps({'restart_browser_readback':'PASS','ticket_id':ticket},indent=2))
        print('DAY3_PUBLIC_RESTART_BROWSER=PASS')
        raise SystemExit(0)

    # Trainer creates a genuinely fresh governed Ticket through the visible control-plane surface.
    login('trial.trainer.1')
    wait_text('TLS Trainer Console'); wait_text('no Product Role authority')
    target_select=driver.find_element(By.CSS_SELECTOR,'select')
    before={o.get_attribute('value') for o in target_select.find_elements(By.TAG_NAME,'option') if o.get_attribute('value')}
    driver.find_element(By.CSS_SELECTOR,'button[data-trainer-reseed="fresh-governed-run"]').click()
    wait_text('Processing result: ACK')
    def new_ticket(d):
        sel=d.find_element(By.CSS_SELECTOR,'select')
        values={o.get_attribute('value') for o in sel.find_elements(By.TAG_NAME,'option') if o.get_attribute('value')}
        diff=values-before
        return next(iter(diff)) if diff else False
    ticket=wait.until(new_ticket)
    Select(driver.find_element(By.CSS_SELECTOR,'select')).select_by_value(ticket)
    wait_text('Current state: ACCEPTED')
    snap('01-trainer-fresh-governed-run')
    logout_and_prove('01-trainer')

    # A: LOGIN/START SHIFT -> Role Work Queue -> Ticket -> ACTIVATE.
    login('trial.ops.a')
    wait_text('Role-Scoped Work Queue'); wait_text('Server-derived Role: TRIAL-RS-RESPONSIBLE-ROLE-01'); wait_text(ticket)
    snap('02-ops-role-work-queue')
    goto(ticket_path(ticket)); wait_text('Lifecycle state: ACCEPTED — aggregate version 0')
    wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR,'button[data-action-class="ACTIVATE"]'))).click()
    wait_text('Lifecycle state: ACTIVE — aggregate version 1')
    wait_text('Action result: EFFECT_APPLIED')
    snap('03-ops-activated')
    logout_and_prove('03-ops')

    # Trainer issues only the approved simulated restoration indication.
    login('trial.trainer.1')
    goto('/trainer/tls-day2?ticket='+urllib.parse.quote(ticket,safe=''))
    wait_text('Current state: ACTIVE')
    trigger=wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR,'button[data-trainer-trigger="SERVICE_RESTORATION_INDICATION"]')))
    trigger.click(); wait_text('Processing result: ACK')
    snap('04-trainer-restoration-indication')
    logout_and_prove('04-trainer')

    # A requests independent restoration verification.
    req='RS_TRIAL_REQUEST_RESTORATION_VERIFICATION'
    perform_guided('trial.ops.a',ticket,req,'ACK','05-ops-request-verification')
    logout_and_prove('05-ops')

    # B independently verifies; visible evidence must become independently verified.
    verify='RS_TRIAL_VERIFY_RESTORATION_EVIDENCE'
    perform_guided('trial.verify.b',ticket,verify,'ACK','06-verify-governed-action')
    goto(ticket_path(ticket)+'/evidence'); wait_text('Evidence and Verification'); wait_text('Truth posture: INDEPENDENTLY_VERIFIED'); wait_text('Verification result: VERIFIED')
    snap('07-independent-verification-evidence')
    logout_and_prove('07-verify')

    # C submits terminal disposition and materializes TERMINAL_PROCESSING v2.
    term='RS_TRIAL_SUBMIT_TERMINAL_DISPOSITION_CLAIM'
    perform_guided('trial.disp.c',ticket,term,'EFFECT_APPLIED','08-terminal-disposition')
    goto(ticket_path(ticket)); wait_text('Lifecycle state: TERMINAL_PROCESSING — aggregate version 2')
    snap('08-terminal-processing')
    logout_and_prove('08-disposition')

    # D sees machine-derived closure readiness and the bounded close action.
    close='RS_TRIAL_REQUEST_TICKET_CLOSURE'
    login('trial.close.d')
    goto(ticket_path(ticket)+'/closure'); wait_text('Terminal / Closure Readiness'); wait_text('Closure readiness: READY'); wait_text('Lifecycle state: TERMINAL_PROCESSING')
    snap('09-closure-readiness-ready')
    wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR,f'a[data-action-class="{close}"]'))).click()
    wait_text('Guided Action'); wait_text('Availability: AVAILABLE')

    # External-browser stale request must fail closed before the valid close.
    stale_script="""
    const ticket=arguments[0], action=arguments[1], done=arguments[arguments.length-1];
    (async()=>{
      const pr=await fetch('/api/v1/ui/tickets/'+encodeURIComponent(ticket)); const p=await pr.json(); const d=p.data;
      const actor=d.holder_ref||d.current_responsible_holder_ref; const assignment=d.role_assignment_ref||d.action_authority_assignment_ref;
      const body={intent_contract_ref:d.action_contract_ref,subject_ref:ticket,correlation_id:crypto.randomUUID(),presented_source_version_ref:p.source_version_set_ref,expected_aggregate_version:Math.max(0,d.aggregate_version-1),payload:{action_intent_id:crypto.randomUUID(),ticket_id:ticket,actor_ref:actor,role_assignment_ref:assignment,requested_action_class:action,presented_source_version_ref:p.source_version_set_ref,expected_aggregate_version:Math.max(0,d.aggregate_version-1),intent_time:new Date().toISOString()}};
      const r=await fetch('/api/v1/ui/intents',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}); done({status:r.status,text:await r.text()});
    })().catch(e=>done({error:String(e)}));
    """
    stale=browser_fetch(stale_script,ticket,close)
    if stale.get('status')!=403: raise AssertionError(stale)
    (E/'stale-browser-request.json').write_text(json.dumps({'status':stale.get('status')},indent=2))
    goto(ticket_path(ticket)+'/closure'); wait_text('Lifecycle state: TERMINAL_PROCESSING'); wait_text('Closure readiness: READY')
    wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR,f'a[data-action-class="{close}"]'))).click(); wait_text('Guided Action'); wait_text('Availability: AVAILABLE')

    # Capture the exact UI-generated closure intent, then replay it identically after success.
    driver.get_log('performance')
    driver.find_element(By.XPATH,"//button[contains(.,'Confirm governed action')]").click()
    wait_text('Authoritative result: EFFECT_APPLIED')
    closure_post=None
    for entry in driver.get_log('performance'):
        try:
            msg=json.loads(entry['message'])['message']
            if msg.get('method')!='Network.requestWillBeSent': continue
            reqobj=msg['params']['request']; post=reqobj.get('postData','')
            if reqobj.get('method')=='POST' and reqobj.get('url','').endswith('/api/v1/ui/intents') and close in post:
                closure_post=post
        except Exception:
            pass
    if not closure_post: raise AssertionError('closure POST body not captured from browser network log')
    replay_script="""
    const post=arguments[0], done=arguments[arguments.length-1];
    fetch('/api/v1/ui/intents',{method:'POST',headers:{'content-type':'application/json'},body:post}).then(async r=>done({status:r.status,text:await r.text()})).catch(e=>done({error:String(e)}));
    """
    replay=browser_fetch(replay_script,closure_post)
    if replay.get('status')!=200: raise AssertionError(replay)
    replay_body=json.loads(replay['text'])
    if replay_body.get('replay') is not True or replay_body.get('state')!='CLOSED' or replay_body.get('aggregateVersion')!=3: raise AssertionError(replay_body)
    (E/'identical-browser-replay.json').write_text(json.dumps({'status':200,'replay':True,'state':'CLOSED','aggregateVersion':3},indent=2))

    goto(ticket_path(ticket)); wait_text('Lifecycle state: CLOSED — aggregate version 3'); snap('10-closed-v3')
    goto(ticket_path(ticket)+'/closed'); wait_text('Closed is irreversible'); wait_text('No post-closure action is available without current authoritative action context.'); snap('11-closed-irreversible')
    logout_and_prove('11-close')

    (E/'ticket-id.txt').write_text(ticket+'\n')
    (E/'main-summary.json').write_text(json.dumps({'external_browser_golden_journey':'PASS','ticket_id':ticket,'stale_status':403,'identical_replay':True,'closed_version':3,'logout_invalidation':'PASS'},indent=2))
    print('DAY3_PUBLIC_BROWSER_GOLDEN=PASS')
    print('DAY3_PUBLIC_BROWSER_STALE=PASS')
    print('DAY3_PUBLIC_BROWSER_REPLAY=PASS')
    print('DAY3_PUBLIC_BROWSER_LOGOUT=PASS')
finally:
    driver.quit()
