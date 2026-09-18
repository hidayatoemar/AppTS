# AppTS infrastructure reference — candidate current

This file records the currently selected fresh staging target for AppTS. It is **infrastructure context only**, not Product/design authority.

Project Director update on 2026-09-18: Trial #2 used two older cloud servers. The preferred path is now a fresh staging setup rather than reusing either Trial #2 host.

## Candidate-current staging target

- Provider: Biznet Gio Nusantara — NEO Lite
- Public IPv4: `103.127.99.11`
- Domain: `staging.ts.cifo.id`
- SSH port: TCP 22
- SSH username: `appts-mcr`
- Reported OS: AlmaLinux 8
- Firewall/security-group status: fresh / not yet configured
- Server posture: fresh empty VM; no AppTS runtime assumed installed.

## Required pre-provision verification

Before any package install, service restart, firewall change, DNS change, TLS issuance, or AppTS deployment:

1. Verify exact AlmaLinux minor version and kernel from the host.
2. Prefer reprovisioning to AlmaLinux 9.x for a new deployment unless the Project Director explicitly accepts AlmaLinux 8.
3. Verify SSH reachability from an authorized control host using public-key authentication.
4. Verify the DNS A record for `staging.ts.cifo.id` points to `103.127.99.11`.
5. Configure ingress deliberately:
   - TCP 22 restricted to authorized admin/Cifo source networks where practical.
   - TCP 80/443 public only when the web boundary is ready.
6. Verify outbound HTTPS access for package/runtime installation.
7. Run the repository read-only probe `infra/staging/probe-host.sh` before selecting the final deployment adapter.

## Current external reachability observation

A read-only check from the current construction environment on 2026-09-18:
- `staging.ts.cifo.id` did not resolve from this environment.
- TCP 22/80/443 to `103.127.99.11` did not connect from this environment.

This is **not** evidence that the VM is down. The server is reported fresh and its firewall/security-group/DNS are not yet configured, and the construction environment may not have equivalent network reachability.

## Trial #2 relation

Prior Trial #2 infrastructure values, including `103.150.226.110`, are historical deployment context only and are not the selected staging target.

## Security

No passwords, private keys, vault values, tokens, or other credentials are retained here.
