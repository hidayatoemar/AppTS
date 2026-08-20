# Independent RESTORE_SERVICE Non-Production Deployment

This directory is deployment-only mechanical glue for the independent comparison branch. It intentionally leaves the frozen Build Pack and `DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001` unchanged.

## Execution model

GitHub Actions manual dispatch
→ ephemeral SSH/inventory binding from GitHub secrets
→ Ansible
→ separate non-production Linux server
→ existing DEP-001 Docker Compose stack
→ health/status evidence uploaded as a GitHub Actions artifact.

The application remains loopback-bound on `127.0.0.1:8080` because that is what the supplied DEP-001 Compose file defines. The harness does not add reverse proxy, public ingress, DNS, TLS, production data, or runtime semantic wiring.

## Required GitHub secrets

Configure these only for the independent server:

- `INDEP_HOST`: host/IP of the separate non-production server.
- `INDEP_USER`: SSH user.
- `INDEP_SSH_PRIVATE_KEY`: private key accepted by that user.
- `INDEP_POSTGRES_PASSWORD`: disposable experiment database password.

The target user must have passwordless sudo. The target must already have Docker Engine and Docker Compose v2. This harness verifies those prerequisites and stops if they are absent; it does not choose or provision a cloud provider or OS.

## Run

From GitHub Actions, select `Independent RESTORE_SERVICE non-production deployment` on branch `experiment/independent-restore-deploy`.

Choose `deploy`, `status`, or `teardown`, and type the exact confirmation token `INDEPENDENT_NONPROD`.

`deploy` copies the existing DEP-001 workspace to `/opt/appts-independent-restore-service`, renders only the required disposable `.env`, validates Compose, builds/starts the stack, and verifies `/healthz` and `/readyz` from inside the target host.

`status` is read-only application evidence.

`teardown` runs `docker compose down -v` and leaves the copied source tree in place for inspection.

## Evidence

Each workflow run uploads a text artifact containing branch, commit, selected action, Ansible output, container status, and health results. This evidence is technical comparison material only and does not alter formal AppTS project state.
