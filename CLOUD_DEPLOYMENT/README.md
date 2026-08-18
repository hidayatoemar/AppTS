# CLOUD_DEPLOYMENT — Ansible deployment for appts-restore-service (DEP-001 staging)

Deploy the **appts-restore-service DEP-001** ticketing system to your own cloud
VPS:

> **Cloud VPS (AlmaLinux 9) → Docker → docker compose (api + postgres)**

Everything here is **STAGING SIMULATION / NON-PRODUCTION**. The DEP-001 entrypoint
enforces the exact staging label and the compose publishes the API on loopback
(127.0.0.1:8080) only. This is consistent with the project governance in
EXECUTOR_CONTRACT.md and AUTHORITY/: no production, real data, or external exposure.

    CONTROL NODE                          VPS (AlmaLinux 9)
    ------------                          -----------------
    ansible-core    ---- SSH ------->     - Docker Engine + compose plugin
    this directory                       - /opt/appts-restore-service
    (your workstation)                   - compose: api + postgres
         at:
    CLOUD_DEPLOYMENT/ansible
         via: ansible-playbook ...

---

## 1. Cloud VPS prerequisites (do this once on the VPS)

The default target is `103.150.226.110`, SSH user `aditya`. One-time setup on
the VPS:

1. **Fresh AlmaLinux 9** (or compatible RHEL 9 family) with outbound internet —
   Docker builds pull node:24, postgres:17 and npm packages during the image build.
2. **`aditya` is a sudo-capable user** (the playbooks escalate via sudo to root).
   Confirm `ssh aditya@<vps-ip>` works from the control node, and that
   `sudo -v` succeeds without a password prompt (NOPASSWD sudo or a cached tty
   credential) — otherwise Ansible's become prompts interactively.
3. **rsync** on the target is installed by the docker role; no Node.js or
   PostgreSQL is needed by hand — everything runs inside Docker.

---

## 2. Control node prerequisites

Any Linux/macOS box. Python 3.9+ recommended:

    python3 -m venv .venv
    . .venv/bin/activate
    pip install --upgrade pip
    pip install ansible-core
    # or install the pinned collection set:
    ansible-galaxy collection install -r ansible/requirements.yml

Also required on the control node: **rsync** (used by the synchronize module) and **ssh**.

> community.docker.docker_compose_v2 drives the target's docker compose plugin
> over SSH, so no Docker is needed on the control node itself.

---

## 3. Configure

### 3.1 Inventory — cloud VPS host

`ansible/inventory/staging/hosts.yml` ships with the VPS already wired as the
staging target:

    all:
      children:
        appts:
          hosts:
            appts-vps:
              ansible_host: 103.150.226.110      # cloud VPS public IP
              ansible_user: aditya               # sudo-capable SSH user
              ansible_become: true               # escalate to root via sudo
              ansible_ssh_private_key_file: ~/.ssh/id_ed25519
              ansible_ssh_pass: "{{ vault_ansible_ssh_pass }}"   # fallback (see 3.2)

Adjust the IP, SSH user, key path, or `ansible_become` only if your environment
differs. Deployment configuration (install dir, ports, DB, public domain) lives
in `group_vars/all/main.yml`:

### 3.2 Secrets — ansible-vault (required)

Non-secret variables live in `group_vars/all/main.yml`. All passwords resolve to
vault vars defined in `group_vars/all/secrets.yml` — a **plaintext file that is
gitignored** until you encrypt it:

    cd CLOUD_DEPLOYMENT/ansible
    ansible-vault encrypt inventory/staging/group_vars/all/secrets.yml

This encrypts the secrets in place:

- `vault_ansible_ssh_pass` — SSH password for the `aditya` user (key is tried first)
- `vault_appts_postgres_password`
- `vault_appts_admin_password`
- `vault_appts_migration_password`
- `vault_appts_runtime_password`

Then run every playbook with `--ask-vault-pass` (or `--vault-password-file`).
If you rotate a value, edit the file, re-encrypt, and re-run `deploy.yml` /
`migrate.yml`.

> The compose .env (which contains these values) is rendered on the target with
> mode 0600 and is excluded from the workspace sync.

---

## 4. Deploy

> First-time setup: confirm `ssh aditya@103.150.226.110` works before deploying.

    cd CLOUD_DEPLOYMENT/ansible

    # dry run first (YAML + variable resolution, no changes made)
    ansible-playbook playbooks/deploy.yml --syntax-check

    # install docker, then build and start the stack
    ansible-playbook playbooks/deploy.yml --ask-vault-pass

What it does:

1. **firewall role** — opens TCP 80/443 in the host firewall (firewalld) so the
   public reverse proxy is reachable.
2. **docker role** — installs Docker Engine, containerd, buildx and the compose
   plugin from the official Docker CE repo on AlmaLinux 9; enables docker.service.
3. **appts role** — creates a system user (appts), syncs the DEP-001 workspace to
   /opt/appts-restore-service (excluding node_modules, dist, .git and secrets),
   renders deploy/compose/.env and deploy/compose/Caddyfile, runs
   docker compose up -d --build  (Dockerfile.dep builds the API + web images
   inside Docker), waits for http://127.0.0.1:8080/healthz, then prints
   docker compose ps.

Expected output ends with a compose ps listing showing all three services
Up (healthy) — api, postgres and caddy — and the API published on
127.0.0.1:8080->8080/tcp plus caddy on 0.0.0.0:80->80/tcp and 0.0.0.0:443->443/tcp.

---

## 5. Access the app

### Public HTTPS (recommended)

Caddy reverse-proxies the app and terminates TLS automatically via Let's Encrypt:

    https://staging.ts.cifo.id          # → api:8080 (SPA + health endpoints)
    https://staging.ts.cifo.id/healthz  # {"status":"ok"}

`staging.ts.cifo.id` must resolve to the VPS public IP (103.150.226.110) and
TCP 80/443 must be open in **both** the host firewall (done by the firewall
role) and the cloud provider's security group (do this once, externally). The
first TLS issuance needs ports 80/443 reachable from the internet.

### Loopback tunnel (direct)

The stack still binds 127.0.0.1:8080 on the VPS by design. From your workstation, tunnel in:

    ssh -L 8080:127.0.0.1:8080 aditya@<vps-ip>
    # now open http://127.0.0.1:8080 in your browser: the Restore Service SPA

Health checks from inside the VPS:

    curl -fsS http://127.0.0.1:8080/healthz     # {"status":"ok"}
    curl -fsS http://127.0.0.1:8080/readyz      # {"status":"ready"}

> The compose port binding for the API stays loopback-only (GAP-014). Public
> exposure is handled exclusively by the Caddy reverse proxy on 80/443.

---

## 6. Inspect, update, and operate

    cd CLOUD_DEPLOYMENT/ansible

    # status / health / container list (read-only)
    ansible-playbook playbooks/status.yml --ask-vault-pass

    # redeploy after editing group_vars or the DEP-001 workspace
    ansible-playbook playbooks/deploy.yml --ask-vault-pass

    # compose logs on the box (manual)
    ssh aditya@<vps-ip> 'cd /opt/appts-restore-service/deploy/compose && docker compose -f compose.yaml --env-file .env logs -f'

---

## 7. Optional — G7 DB verification lane

The compose app stack ships an empty Postgres (a static-only staging shell). To
exercise the **real migration tooling** against a disposable staging database on
the VPS, run the separate lane (its own isolated postgres + tools containers):

    cd CLOUD_DEPLOYMENT/ansible
    ansible-playbook playbooks/migrate.yml --ask-vault-pass

It runs  bootstrap-roles.sh → migrate.sh (V001-V004) → verifiers → backup →
restore → verifiers, exactly as documented in
DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001/deploy/db/README.md.

**Honest scope:**

- grant-runtime.sh is intentionally NOT run: runtime-role grants are a HELD
  project item that needs MCR authority.
- The G7 lane provisions its own disposable database, separate from the app
  stack's postgres service. Wiring the running API to a migrated database is
  HELD project work: the DEP-001 bootstrap is static + health only, and the
  business /api/v1/ui/* routes are intentionally not wired in this package.

---

## 8. Teardown

    cd CLOUD_DEPLOYMENT/ansible
    ansible-playbook playbooks/teardown.yml --ask-vault-pass
    #   ^ stops and removes containers/networks/volumes, keeps /opt/appts-restore-service
    ansible-playbook playbooks/teardown.yml -e appts_teardown_remove_files=true
    #   ^ also deletes /opt/appts-restore-service

---

## 9. Layout

    CLOUD_DEPLOYMENT/
    |-- README.md                     # this guide
    |-- ansible/
        |-- ansible.cfg               # inventory, ssh, output settings
        |-- requirements.yml          # community.docker + ansible.posix collections
        |-- .gitignore                # ignores secrets.yml, collections, .env
        |-- inventory/
        |   |-- staging/
        |       |-- hosts.yml         # cloud VPS host (ansible_host, user, become)
        |       |-- group_vars/
        |           |-- all/
        |               |-- main.yml      # deploy variables (non-secret)
        |               |-- secrets.yml   # vault-encrypted secrets (gitignored)
        |-- playbooks/
        |   |-- deploy.yml            # docker + appts roles (main entry)
        |   |-- status.yml            # healthz/readyz + compose ps
        |   |-- teardown.yml          # compose down -v (+ optional file removal)
        |   |-- migrate.yml           # optional G7 DB verification lane
        |-- roles/
            |-- firewall/ tasks/main.yml    # open TCP 80/443 (firewalld)
            |-- docker/  tasks/main.yml     # Docker CE + compose plugin install
            |-- appts/
                |-- tasks/main.yml            # sync, render env + Caddyfile, compose up, health wait
                |-- handlers/main.yml         # restart stack on change
                |-- templates/
                    |-- appts-compose.env.j2  # renders deploy/compose/.env
                    |-- appts-g7.env.j2       # renders deploy/db/.env.g7 (migrate lane)
                    |-- Caddyfile.j2          # renders deploy/compose/Caddyfile (reverse proxy)

---

## 10. Troubleshooting

| Symptom                                                  | Likely cause / fix                                             |
| -------------------------------------------------------- | -------------------------------------------------------------- |
| SSH connection refused / timeout to the VPS              | Confirm the VPS public IP is reachable and sshd is running; check the provider firewall/security group allows your IP on 22. |
| become/sudo prompts for a password during a playbook     | `aditya` needs passwordless sudo (or a cached credential). Configure `aditya ALL=(ALL) NOPASSWD:ALL` in sudoers or run with a tty. |
| Playbook fails: ansible_user / become_user not permitted | The SSH user must be in a sudo-capable group; verify `sudo -v` on the box. |
| docker start fails on the VPS                            | Check `docker info` (storage driver overlay2); confirm the VPS is a full OS, not a restricted container. |
| docker build cannot reach the network                    | The VPS must allow outbound traffic to download.docker.com and registry/docker hub. |
| Playbook fails on the synchronize task                   | rsync missing on the target; the docker role installs it, or run dnf install rsync on the VPS. |
| EBADENGINE / engine-strict during image build            | Only matters inside the Docker build; the build needs network for npm ci. Do not alter the pinned versions. |
| API is up but the UI 404s on business routes             | By design: the DEP-001 bootstrap serves the SPA + health only; business /api/v1/ui/* wiring is HELD project work. |
| SELinux blocking containers                              | container-selinux is pulled by docker-ce; check getenforce and policy if needed. |
| https://staging.ts.cifo.id doesn't load / cert not issued | Confirm the DNS A record points to 103.150.226.110 and TCP 80/443 are open in the cloud security group (host firewall alone is not enough); first cert issuance requires 80 reachable. |
| Caddy "too many redirects" / HTTP instead of HTTPS        | Ensure the domain in the Caddyfile matches the requested URL exactly; Caddy redirects port 80 → 443 automatically. |
| ACME email not set (Let's Encrypt warns)                  | Check `ACME_EMAIL` in deploy/compose/.env (rendered from `appts_caddy_acme_email` in group_vars). |
