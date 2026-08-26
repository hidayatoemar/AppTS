import os,json
from pathlib import Path
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import Select,WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options

base=os.environ['DT022_BASE_URL'];ticket=os.environ['DT022_TICKET_ID'];qer=os.environ['DT022_QER_ID'];secret=os.environ['DT022_OPS_SECRET'];evidence=Path(os.environ['DT022_EVIDENCE_DIR'])
options=Options();options.add_argument('--headless=new');options.add_argument('--no-sandbox');options.add_argument('--disable-dev-shm-usage');options.add_argument('--window-size=1440,1200')
driver=webdriver.Chrome(options=options);wait=WebDriverWait(driver,15)
def capture(name):
    html=driver.page_source
    (evidence/f'{name}.html').write_text(html)
    driver.save_screenshot(str(evidence/f'{name}.png'))
    return html
def must(text,html):
    assert text in html,(text,driver.current_url)
try:
    driver.get(base+'/work')
    wait.until(EC.presence_of_element_located((By.CSS_SELECTOR,'input[type=password]')))
    html=capture('browser-01-login-from-protected-route');must('AppTS Trial Login',html);must('trial.ops.a',html)
    Select(driver.find_element(By.TAG_NAME,'select')).select_by_value('trial.ops.a')
    driver.find_element(By.CSS_SELECTOR,'input[type=password]').send_keys(secret)
    driver.find_element(By.CSS_SELECTOR,'button[type=submit]').click()
    wait.until(lambda d:'/work' in d.current_url and 'Role-Scoped Work Queue' in d.page_source)
    html=capture('browser-02-work-queue')
    for s in ['Role-Scoped Work Queue','TRIAL-RS-RESPONSIBLE-ROLE-01','TRIAL-HOLDER-OPS-A',ticket,'Operational attention:','1 waiting','1 blocker','1 escalation','next governed control is available']:must(s,html)
    driver.get(base+f'/tickets/{ticket}')
    wait.until(lambda d:'Ticket Operational Console' in d.page_source)
    html=capture('browser-03-ticket-console')
    for s in ['Ticket Operational Console',ticket,'ACCEPTED','Operational attention:','1 waiting','1 blocker','1 escalation','a governed next control is available','Responsibility and Handover','Waiting, Blockers and Dependencies']:must(s,html)
    driver.get(base+f'/tickets/{ticket}/responsibility')
    wait.until(lambda d:'Responsibility and Handover' in d.page_source)
    html=capture('browser-04-responsibility')
    for s in ['Responsibility and Handover','One current Responsible Role is in force','Supporting work, dependency handling, and escalation do not by themselves transfer Ticket responsibility.']:must(s,html)
    driver.get(base+f'/tickets/{ticket}/conditions')
    wait.until(lambda d:'Waiting / Blocker / Dependency' in d.page_source)
    html=capture('browser-05-conditions')
    for s in ['Waiting / Blocker / Dependency','Open waiting:','Open blockers:','Represented dependencies:','Waiting and blockers are operational conditions; they are not Ticket lifecycle states.','Next governed control','Escalation','Closure remains withheld',qer]:must(s,html)
    (evidence/'browser-summary.json').write_text(json.dumps({'login_boundary':'PASS','work_queue':'PASS','ticket_console':'PASS','responsibility_handover':'PASS','conditions_localization':'PASS','next_control_visibility':'PASS','provenance_qer_visible':'PASS','role_holder_server_binding':'PASS','ticket_id':ticket,'qer_id':qer},indent=2))
finally:
    driver.quit()
