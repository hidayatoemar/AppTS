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
- Dedicated SSH key identity: `appts-staging-ai` (ED25519)
- SSH login: verified successful by AppDev
- Passwordless sudo for `appts-mcr`: verified successful by AppDev
- Outbound internet/DNS from VM: verified active
- Security Group:
  - TCP 22 ACCEPT
  - all other inbound DROP
  - TCP 80/443 not yet open
- OS listening posture at handover: only SSH TCP 22 reported listening
- Application stack: not installed
- Server posture: fresh empty VM

## DNS status

As of 2026-09-18, `staging.ts.cifo.id` still resolves to the historical Trial #2 address `103.150.226.110`.

Do **not** cut over DNS yet. The A record shall move to `103.127.99.11` only after the new staging application boundary is healthy and the web/TLS path is ready.

## Remaining bootstrap prerequisites

Before AI-controlled provisioning begins:

1. Store the dedicated SSH private key in GitHub Environment `staging` as an encrypted secret. The key must not be sent through chat.
2. Record/pin the new VM SSH host key fingerprint/public host key before first automated SSH connection.
3. Run repository read-only probe `infra/staging/probe-host.sh`.
4. Only after probe review select and execute the minimal deployment adapter.
5. Open TCP 80/443 only when the reverse-proxy/TLS boundary is ready.
6. Biznet lifecycle API credential is optional for initial SSH-based provisioning and may be added later for disposable-VM lifecycle automation.

## Trial #2 relation

Prior Trial #2 infrastructure values, including `103.150.226.110`, are historical deployment context only and are not the selected staging target.

## Authority boundary

`103.127.99.11` is a disposable AppTS AI-controlled staging target.

Within this target, bounded staging automation may install/configure packages, create AppTS runtime files, manage AppTS services, restart those services, deploy/redeploy verified AppTS builds, collect diagnostics, and reset disposable application state as needed.

This authority does not extend to production systems, customer data, other Cifo infrastructure, DNS cutover, provider-account-wide changes, or unrelated workloads unless separately authorized.

## Security

No passwords, private keys, vault values, tokens, or other credentials are retained in this repository file.
