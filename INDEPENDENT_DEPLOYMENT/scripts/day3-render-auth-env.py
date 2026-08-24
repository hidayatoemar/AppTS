import json
from pathlib import Path

EXPECTED={"trial.ops.a","trial.verify.b","trial.disp.c","trial.close.d","trial.trainer.1"}
HASH_PATH=Path('/etc/appts-independent/trial-credential-hashes.json')
ENV_PATH=Path('/opt/appts-independent-restore-service/deploy/compose/.env')

obj=json.loads(HASH_PATH.read_text())
assert set(obj)==EXPECTED
assert all(isinstance(v,str) and v.startswith('scrypt$') and v.count('$')==2 for v in obj.values())
canon=json.dumps(obj,separators=(',',':'),sort_keys=True)
assert "'" not in canon

vals={
    'APPTS_TLS_TRIAL_CREDENTIAL_HASHES_JSON': "'"+canon+"'",
    'APPTS_TLS_SESSION_COOKIE_SECURE':'true',
}
lines=ENV_PATH.read_text().splitlines()
out=[]; seen=set()
for line in lines:
    key=line.split('=',1)[0] if '=' in line else ''
    if key in vals:
        out.append(key+'='+vals[key]); seen.add(key)
    else:
        out.append(line)
for key,val in vals.items():
    if key not in seen:
        out.append(key+'='+val)
ENV_PATH.write_text('\n'.join(out)+'\n')

# Immediate secret-safe readback validation before Compose is allowed to restart API.
check={}
for line in ENV_PATH.read_text().splitlines():
    if '=' in line:
        k,v=line.split('=',1); check[k]=v
raw=check['APPTS_TLS_TRIAL_CREDENTIAL_HASHES_JSON']
assert raw.startswith("'") and raw.endswith("'")
parsed=json.loads(raw[1:-1])
assert parsed==obj
assert check['APPTS_TLS_SESSION_COOKIE_SECURE']=='true'
print('auth_env_render=PASS')
print('auth_env_alias_count=5')
print('auth_env_secure_cookie=true')
print('secret_values_emitted=NO')
