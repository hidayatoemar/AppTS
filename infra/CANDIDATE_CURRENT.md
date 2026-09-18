# AppTS infrastructure reference — candidate current

This file records the currently selected fresh staging target for AppTS. It is **infrastructure context only**, not Product/design authority.

Project Director update on 2026-09-18: Trial #2 used two older cloud servers. The preferred path is now a fresh staging setup rather than reusing either Trial #2 host.

## Candidate-current staging target

- Provider: Biznet Gio Nusantara — NEO Lite
- Public IPv4: `103.127.99.11`
- Domain: `staging.ts.cifo.id`
- SSH port: TCP 22
- SSH username: `appts-mcr`
- OS: AlmaLinux 9.8 (Olive Jaguar) x86_64 (upgraded in-place from 9.5 on 2026-09-18)
- Current kernel after governed OS baseline upgrade/reboot: `5.14.0-687.48.1.el9_8.x86_64`
- SELinux: Enforcing
- Dedicated SSH key identity: `appts-staging-ai` (ED25519)
- SSH login: verified successful by AppDev and GitHub Actions
- Passwordless sudo for `appts-mcr`: verified successful by AppDev
- Outbound internet/DNS from VM: verified active
- Security Group at handover:
  - TCP 22 ACCEPT
  - all other inbound DROP
  - TCP 80/443 not yet open
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

Pre-provision state observed:
- Node.js: not installed
- npm: not installed
- Caddy/nginx/httpd: not installed
- Docker/podman: not installed
- `/opt/appts-restore-service`: absent
- local port 8080: no application response
- no mutation was performed by the probe.

## Verified kernel staging deployment

GitHub Actions workflow `staging-provision-kernel` deployed the exact verified RESTORE_SERVICE constructed-code baseline.

- Verified product commit: `01097454cc73b9917b284c876af4c603856ebe6e`
- Workflow run: `35331095659`
- Job: `105555370238`
- Result: PASS
- Pre-deploy verification/build: 90 PASS / 0 FAIL / 0 SKIP
- Node.js installed from AlmaLinux AppStream module stream 22:
  `v22.23.2`
- Installed runtime release:
  `/opt/appts-restore-service/releases/01097454cc73b9917b284c876af4c603856ebe6e`
- Current release symlink:
  `/opt/appts-restore-service/current`
- Kernel import smoke: PASS, 48 exported symbols
- Post-provision commit identity check: PASS
- Post-provision Node major-version check: PASS
- No runtime `node_modules` deployed; bounded kernel runtime dependencies remain zero.
- Listening TCP ports after deployment: only TCP 22.
- No web/API service or product HTTP contract was invented.

The AlmaLinux Node package does not install `npm` on the staging runtime host. This is acceptable for the deployed bounded kernel because compilation and tests occur in the controlled GitHub Actions build stage and the runtime artifact has zero npm dependencies.

## Native staging acceptance

GitHub Actions workflow `staging-native-acceptance` rebuilt the exact verified baseline and executed the full RESTORE_SERVICE executable test surface **on the staging host itself** using the installed Node.js 22 runtime.

- Workflow run: `35331891729`
- Job: `105557879029`
- Result: PASS
- Exact deployed commit identity: PASS
- Host Node major version 22: PASS
- Full executable verification on staging host: 90 PASS / 0 FAIL / 0 SKIP
- No unexpected TCP listener introduced; staging remained SSH-only.

This establishes that the verified kernel is not only buildable in GitHub Actions but executable with the same verified behavior on the target staging OS/runtime.


### Post-upgrade continuity and idempotence

The governed OS baseline workflow upgraded the fresh VM from AlmaLinux 9.5 to AlmaLinux 9.8, installed kernel `5.14.0-687.48.1.el9_8.x86_64`, rebooted, re-established pinned SSH, and verified the deployed kernel continuity.

- OS workflow run: `35332021637`, job `105558286116`: PASS
- Post-reboot OS: AlmaLinux 9.8 (Olive Jaguar)
- Post-reboot kernel: `5.14.0-687.48.1.el9_8.x86_64`
- Node.js: `v22.23.2`
- Kernel import after OS upgrade: PASS, 48 exports
- Listening TCP ports after reboot: only TCP 22

The native staging acceptance was then re-run against the upgraded host (run `35331891729`, attempt 2, job `105565709465`) and again produced **90 PASS / 0 FAIL / 0 SKIP**.

The hardened provisioning path was also re-run after the upgrade (run `35334587950`, job `105566378636`) and returned `release_state=ALREADY_PRESENT`, proving the same verified release can be reconciled idempotently without duplicating the release. The transferred build artifact was SHA-256 verified before use; that run observed `aa56a2eb487e054afef85f47ec1329c2ad5b1bf1a510365b996a2c610ad551d1`.

## DNS status

DNS convergence has now been independently re-checked after the Network team correction.

Read-only re-run of workflow `staging-readonly-probe` (run `35335355166`, attempt 2, job `105677474639`) completed PASS and observed:

- GitHub-hosted runner: `103.127.99.11`
- Google recursive resolver: `103.127.99.11`
- authoritative `ns1.cifo.co.id`: `103.127.99.11`
- authoritative `ns2.cifo.co.id`: `103.127.99.11`
- staging VM local resolver: `103.127.99.11`
- Google DNS-over-HTTPS from staging VM: `103.127.99.11`
- Cloudflare DNS-over-HTTPS from staging VM: `103.127.99.11`

Current classification: **DNS CONVERGED** for `staging.ts.cifo.id`.

The earlier authoritative divergence is retained as operational evidence. The Network team corrected the condition, but the underlying root cause and permanent synchronization/monitoring mechanism have not yet been established in AppTS evidence; therefore **root cause remains UNKNOWN** rather than inferred.

No DNS mutation was performed by AppTS automation.

HTTP/HTTPS remain intentionally unavailable: TCP 80/443 remain closed and no governed executable web boundary exists yet.

## Remaining deployment work

1. Define/verify the first governed executable staging boundary before introducing an HTTP/API service.
2. Add service supervision only when there is an actual long-running AppTS process to supervise.
3. Keep TCP 80/443 closed until that boundary is defined and verified.
4. Add reverse-proxy/TLS only after the executable boundary is ready.
5. Biznet lifecycle API credential remains optional for later disposable-VM lifecycle automation.

## Trial #2 relation

Prior Trial #2 infrastructure values, including `103.150.226.110`, are historical deployment context only and are not the selected staging target.

## Authority boundary

`103.127.99.11` is a disposable AppTS AI-controlled staging target.

Within this target, bounded staging automation may install/configure packages, create AppTS runtime files, manage AppTS services, restart those services, deploy/redeploy verified AppTS builds, collect diagnostics, and reset disposable application state as needed.

This authority does not extend to production systems, customer data, other Cifo infrastructure, provider-account-wide changes, or unrelated workloads unless separately authorized. DNS changes remain deliberate infrastructure actions and are not to be performed implicitly.

## Security

Repository visibility is intentionally **public** by Project Director decision. Source code and non-secret infrastructure metadata are therefore public. The SSH private key remains only in GitHub Environment `staging`; workflows use the pinned host key and exact branch/repository guards before environment-bound execution.

As observed through the GitHub branch API on 2026-09-18, `mcr/staging-integration-prep` is currently not branch-protected. Public visibility alone does not grant write access, but branch/environment protection remains a separate GitHub administration-plane hardening item.

No passwords, private keys, vault values, tokens, or other credentials are retained in this repository file.
