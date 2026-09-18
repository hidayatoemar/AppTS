# AppTS infrastructure reference — candidate current

This file records the currently selected fresh staging target for AppTS. It is **infrastructure context only**, not Product/design authority.

Project Director update on 2026-09-18: Trial #2 used two older cloud servers. The preferred path is now a fresh staging setup rather than reusing either Trial #2 host.

## Candidate-current staging target

- Provider: Biznet Gio Nusantara — NEO Lite
- Public IPv4: `103.127.99.11`
- Domain: `staging.ts.cifo.id`
- SSH port: TCP 22
- SSH username: `appts-mcr`
- OS: AlmaLinux 9.5 (Teal Serval) x86_64
- Kernel observed by automated probe: `5.14.0-503.16.1.el9_5.x86_64`
- SELinux: Enforcing
- Dedicated SSH key identity: `appts-staging-ai` (ED25519)
- SSH login: verified successful by AppDev and GitHub Actions
- Passwordless sudo for `appts-mcr`: verified successful by AppDev
- Outbound internet/DNS from VM: verified active
- Security Group at handover:
  - TCP 22 ACCEPT
  - all other inbound DROP
  - TCP 80/443 not yet open
- OS listening posture at automated probe: only SSH TCP 22
- Application stack: not installed
- Server posture: fresh empty VM
- Root filesystem observed: ~59 GiB total, ~58 GiB available
- Memory observed: ~3.6 GiB total, ~3.2 GiB available
- Swap: none

## Pinned SSH host identity

The staging automation pins the server ED25519 host identity before SSH execution.

- Public host key:
  `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAILpRJVkwh143CmmrMkQvgfNyRIbV964SsAYLZ3BlaGdh`
- SHA256 fingerprint:
  `SHA256:M0o8nYzf97+hK627/zeemfmiXF02eBjg7Ej5DUYITmw`
- Reported host comment:
  `root@appts-mcr.neo.internal`

Automated workflow verification recomputes the fingerprint from the pinned public host key and requires an exact match before connecting.

## Automated read-only probe

GitHub Actions workflow `staging-readonly-probe` successfully connected to `appts-mcr@103.127.99.11` using:
- GitHub Environment `staging`
- encrypted `APPTS_STAGING_SSH_PRIVATE_KEY`
- `StrictHostKeyChecking=yes`
- the pinned ED25519 host identity above.

Run `35330508043`, job `105553528418`: PASS.

Observed runtime state:
- Node.js: not installed
- npm: not installed
- Caddy/nginx/httpd: not installed
- Docker/podman: not installed
- `/opt/appts-restore-service`: absent
- local port 8080: no application response
- no mutation was performed by the probe.

## DNS status

At AppDev handover earlier on 2026-09-18, `staging.ts.cifo.id` was reported as resolving to historical Trial #2 address `103.150.226.110`.

During the later automated probe from the new staging VM at 2026-09-18T09:37:42Z, the same name resolved to `103.127.99.11`.

Treat the later observation as evidence that DNS propagation/cutover may already be occurring or complete from some resolvers. Do not make further DNS changes until the public resolution state is deliberately verified from multiple viewpoints.

HTTP/HTTPS remain unreachable at this stage because TCP 80/443 are not open and no web boundary is installed.

## Remaining bootstrap / deployment work

1. Select and provision the minimal Node.js runtime needed for the verified AppTS kernel.
2. Build and stage the verified code baseline without inventing a product HTTP/API contract.
3. Keep TCP 80/443 closed until a governed executable web boundary actually exists.
4. Add reverse-proxy/TLS only when that boundary is defined and verified.
5. Biznet lifecycle API credential remains optional for later disposable-VM lifecycle automation.

## Trial #2 relation

Prior Trial #2 infrastructure values, including `103.150.226.110`, are historical deployment context only and are not the selected staging target.

## Authority boundary

`103.127.99.11` is a disposable AppTS AI-controlled staging target.

Within this target, bounded staging automation may install/configure packages, create AppTS runtime files, manage AppTS services, restart those services, deploy/redeploy verified AppTS builds, collect diagnostics, and reset disposable application state as needed.

This authority does not extend to production systems, customer data, other Cifo infrastructure, provider-account-wide changes, or unrelated workloads unless separately authorized. DNS changes remain deliberate infrastructure actions and are not to be performed implicitly.

## Security

No passwords, private keys, vault values, tokens, or other credentials are retained in this repository file.
