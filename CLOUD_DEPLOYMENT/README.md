# CLOUD_DEPLOYMENT — Ansible deployment for appts-restore-service (DEP-001 staging)

Deploy the **appts-restore-service DEP-001** ticketing system to your own cloud:

> **Proxmox VE → LXC container (AlmaLinux 9) → nested Docker → docker compose (api + postgres)**

Everything here is **STAGING SIMULATION / NON-PRODUCTION**. The DEP-001 entrypoint
enforces the exact staging label and the compose publishes the API on loopback
(127.0.0.1:8080) only. This is consistent with the project governance in
EXECUTOR_CONTRACT.md and AUTHORITY/: no production, real data, or external exposure.

    CONTROL NODE                          LXC (AlmaLinux 9)
    ------------                          -----------------
    ansible-core    ---- SSH ------->     - Docker Engine (nested)
    this directory                       - docker compose
    (your workstation)                   - /opt/appts-restore-service
         at:                          compose: api + postgres
    CLOUD_DEPLOYMENT/ansible
         via: ansible-playbook ...

---

## 1. Proxmox LXC prerequisites (do this once on the Proxmox host)

1. **Create an AlmaLinux 9 LXC** (container, not a VM):
   - Template: download an AlmaLinux 9 CT template (e.g. almalinux-9-default_*.tar.xz)
     under CT Templates, then create the container from it.
   - Give it a static IP or DHCP reservation; allocate **at least 2 GB RAM** and 8-10 GB disk.
2. **Enable nested virtualization for Docker** — CT → Options → Features:
   - [x] **nesting=1** (required so Docker's overlay storage and iptables work)
   - [x] **keyctl=1** (recommended for containers using keyrings)
   - Unprivileged containers work fine with Docker once nesting is enabled.
3. **systemd inside the container**: AlmaLinux 9 CT images boot with systemd as
   PID 1, which Docker needs. Verify the container boots normally before continuing.
4. **SSH access**: set the root password or install your public key
   (ssh-copy-id root@<lxc-ip>), then confirm ssh root@<lxc-ip> works.
5. Make sure the LXC has **outbound internet**: Docker builds pull node:24,
   postgres:17 and npm packages during the image build.

The LXC does **not** need Node.js or PostgreSQL installed by hand — only Docker.
Everything else is produced inside Docker images (Dockerfile.dep runs npm ci +
build, and the compose stack runs the Postgres container).

---

## 2. Control node prerequisites

Any Linux/macOS box. Python 3.9+ recommended:

    python3 -m venv .venv
    . .venv/bin/activate
    pip install --upgrade pip
    pip install ansible-core 'ansible.posix>=1.6.0' 'community.docker>=3.10.0'
    # or install the pinned collection set:
    ansible-galaxy collection install -r ansible/requirements.yml

Also required on the control node: **rsync** (used by the synchronize module) and **ssh**.

> community.docker.docker_compose_v2 drives the target's docker compose plugin
> over SSH, so no Docker is needed on the control node itself.

---

## 3. Configure

### 3.1 Inventory — point at your LXC

Edit ansible/inventory/hosts.yml:

    lxc-appts-01:
      ansible_host: <your-lxc-ip>          # e.g. 10.0.0.20
      ansible_user: root                    # root, or your sudo user
      ansible_become: false                 # set true for a non-root sudo user
      ansible_ssh_private_key_file: ~/.ssh/id_ed25519

### 3.2 Secrets — ansible-vault (recommended)

Edit ansible/inventory/group_vars/all.yml. The built-in defaults (change-me) are
usable only for a throwaway sandbox. For anything real, encrypt the secrets:

    cd CLOUD_DEPLOYMENT/ansible
    ansible-vault encrypt_string 'S3cr3t!strong-password' --name vault_appts_postgres_password
    ansible-vault encrypt_string 'S3cr3t!admin-password'   --name vault_appts_admin_password
    ansible-vault encrypt_string 'S3cr3t!migration-pw'     --name vault_appts_migration_password
    ansible-vault encrypt_string 'S3cr3t!runtime-pw'       --name vault_appts_runtime_password

Paste the four vault blocks at the top of group_vars/all.yml, then run all
playbooks with --ask-vault-pass (or --vault-password-file).

> The compose .env (which contains these values) is rendered on the target with
> mode 0600 and is excluded from the workspace sync.

---

## 4. Deploy

    cd CLOUD_DEPLOYMENT/ansible

    # dry run first (YAML + variable resolution, no changes made)
    ansible-playbook playbooks/deploy.yml --syntax-check

    # install docker, then build and start the stack
    ansible-playbook playbooks/deploy.yml --ask-vault-pass

What it does:

1. **docker role** — installs Docker Engine, containerd, buildx and the compose
   plugin from the official Docker CE repo on AlmaLinux 9; enables docker.service.
2. **appts role** — creates a system user (appts), syncs the DEP-001 workspace to
   /opt/appts-restore-service (excluding node_modules, dist, .git and secrets),
   renders deploy/compose/.env, runs  docker compose up -d --build  (Dockerfile.dep
   builds the API + web images inside Docker), waits for
   http://127.0.0.1:8080/healthz, then prints  docker compose ps.

Expected output ends with a compose ps listing showing both services
Up (healthy) and the API published on 127.0.0.1:8080->8080/tcp.

---

## 5. Access the UI (loopback-only)

The stack binds 127.0.0.1:8080 on the LXC by design. From your workstation, tunnel in:

    ssh -L 8080:127.0.0.1:8080 root@<lxc-ip>
    # now open http://127.0.0.1:8080 in your browser: the Restore Service SPA

Health checks from inside the LXC:

    curl -fsS http://127.0.0.1:8080/healthz     # {"status":"ok"}
    curl -fsS http://127.0.0.1:8080/readyz      # {"status":"ready"}

> Do not change the compose port binding to 0.0.0.0 without explicit sign-off:
> the accepted DEP-001 boundary is loopback-only (GAP-014).

---

## 6. Inspect, update, and operate

    cd CLOUD_DEPLOYMENT/ansible

    # status / health / container list (read-only)
    ansible-playbook playbooks/status.yml --ask-vault-pass

    # redeploy after editing group_vars or the DEP-001 workspace
    ansible-playbook playbooks/deploy.yml --ask-vault-pass

    # compose logs on the box (manual)
    ssh root@<lxc-ip> 'cd /opt/appts-restore-service/deploy/compose && docker compose -f compose.yaml --env-file .env logs -f'

---

## 7. Optional — G7 DB verification lane

The compose app stack ships an empty Postgres (a static-only staging shell). To
exercise the **real migration tooling** against a disposable staging database on
the LXC, run the separate lane (its own isolated postgres + tools containers):

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
        |-- inventory/
        |   |-- hosts.yml             # your LXC host (edit the IP)
        |   |-- group_vars/
        |       |-- all.yml           # deploy variables + vault secrets
        |-- playbooks/
        |   |-- deploy.yml            # docker + appts roles (main entry)
        |   |-- status.yml            # healthz/readyz + compose ps
        |   |-- teardown.yml          # compose down -v (+ optional file removal)
        |   |-- migrate.yml           # optional G7 DB verification lane
        |-- roles/
            |-- docker/  tasks/main.yml       # Docker CE + compose plugin install
            |-- appts/
                |-- tasks/main.yml            # sync, render env, compose up, health wait
                |-- handlers/main.yml         # restart stack on change
                |-- templates/
                    |-- appts-compose.env.j2  # renders deploy/compose/.env
                    |-- appts-g7.env.j2       # renders deploy/db/.env.g7 (migrate lane)

---

## 10. Troubleshooting

| Symptom                                                  | Likely cause / fix                                             |
| -------------------------------------------------------- | -------------------------------------------------------------- |
| docker start fails inside the LXC                        | Enable CT feature nesting and reboot the CT; check docker info Storage Driver (overlay2 or vfs). |
| docker build cannot reach the network                    | The LXC must allow outbound traffic; check the Proxmox firewall for the CT. |
| Playbook fails on the synchronize task                   | rsync missing on the target; the docker role installs it, or run dnf install rsync on the LXC. |
| EBADENGINE / engine-strict during image build            | Only matters inside the Docker build; the build needs network for npm ci. Do not alter the pinned versions. |
| API is up but the UI 404s on business routes             | By design: the DEP-001 bootstrap serves the SPA + health only; business /api/v1/ui/* wiring is HELD project work. |
| SELinux blocking containers                              | container-selinux is pulled by docker-ce; check getenforce and policy if needed. |
