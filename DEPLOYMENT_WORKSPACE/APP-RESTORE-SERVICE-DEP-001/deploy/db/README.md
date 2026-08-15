# DEP-001 G7 DB staging tools

**STAGING SIMULATION / NON-PRODUCTION** only. This is a DB-only, `linux/amd64`
Compose lane for controlled parent execution. It is not runtime deployment,
production evidence, or an Installer handoff.

## Fixed boundaries

- `compose.g7.yaml` contains exactly `postgres` and `db-tools`, one
  `internal: true` network, no host ports, and no API/worker service.
- The only database entrypoint is the internal Compose hostname `postgres` with
  `APPTS_DB_NETWORK_MODE=INTERNAL_COMPOSE`. No public or host-published database
  address is configured.
- `postgres` uses
  `postgres:17.11-bookworm@sha256:07edf880f0cf3f742c990d23faf92cb19e84923a8bce30f7d8e1a8ab63cae7b3`.
  `db-tools` uses `Dockerfile.tools`, which copies only the pinned Node 24.19
  binary and the DEP migration/verification/tool content into `/workspace`.
  It has no npm and no credentials/build arguments.
- The Compose build supplies named contexts for the DEP paths because the
  existing repository `.dockerignore` excludes `deploy/db` and `db`; no
  `.dockerignore` change is part of G7.
- `db-tools` only stays alive for `docker compose exec`; it does not
  automatically migrate, verify, grant, back up, or restore.
- `grant-runtime.sh` is intentionally **not** executed. Runtime SQL operations
  remain source-undetermined and the accepted per-repository allowlist is not
  present. No runtime application-table grant is authorized by this lane.

## Controlled parent command sequence

Run from the DEP workspace root. First create a local, untracked filled env
file from `.env.g7.template`; replace every placeholder with authorized
staging values and do not commit or print the filled file.

```sh
cp deploy/db/.env.g7.template deploy/db/.env.g7
```

Use this command prefix for every subsequent command:

```sh
G7='docker compose --env-file deploy/db/.env.g7 -f deploy/db/compose.g7.yaml'
```

1. Check Compose interpolation only; this is not execution evidence:

   ```sh
   $G7 config
   ```

2. Start the isolated DB and idle tools container. No migration or grant is
   auto-run:

   ```sh
   $G7 up -d --build
   ```

3. Capture tool and server version evidence from inside the tools container:

   ```sh
   $G7 exec -T db-tools node --version
   $G7 exec -T db-tools psql --version
   $G7 exec -T db-tools pg_dump --version
   $G7 exec -T db-tools pg_restore --version
   $G7 exec -T db-tools sh -c 'PGPASSWORD="$APPTS_ADMIN_PASSWORD" psql -h "$PGHOST" -p "$PGPORT" -U "$APPTS_ADMIN_USER" -d "$APPTS_ADMIN_DB" -Atqc "SELECT version(); SHOW server_version_num;"'
   ```

4. Bootstrap the separate admin/migration/runtime roles and disposable DEP
   database:

   ```sh
   $G7 exec -T db-tools sh /workspace/deploy/db/bootstrap-roles.sh
   ```

5. Run the frozen V001–V003 migrations. `migrate.sh` verifies the checked-in
   schema SHA-256 inventory before invoking any migration command:

   ```sh
   $G7 exec -T db-tools sh /workspace/deploy/db/migrate.sh
   ```

6. Run the three read-only verifier SQL files:

   ```sh
   $G7 exec -T db-tools psql -X -v ON_ERROR_STOP=1 --file=/workspace/db/verify/001_cf01_constraints.sql
   $G7 exec -T db-tools psql -X -v ON_ERROR_STOP=1 --file=/workspace/db/verify/002_cf01_history_inbox_outbox.sql
   $G7 exec -T db-tools psql -X -v ON_ERROR_STOP=1 --file=/workspace/db/verify/003_dg04_diagnostics.sql
   ```

7. **Do not run `grant-runtime.sh`.** Its expected behavior in this partial
   state is quarantine verification followed by `STOP`; it must not construct
   application-table privileges.

8. Create the custom-format checkpoint:

   ```sh
   $G7 exec -T db-tools sh /workspace/deploy/db/backup.sh
   ```

9. Exercise restore-based rollback against the disposable database. This
   drops/recreates only the configured `appts_dep001_*` database and restores
   the checkpoint as the migration role:

   ```sh
   $G7 exec -T db-tools sh /workspace/deploy/db/restore.sh
   ```

10. Rerun all three verifier SQL files from step 6 after restore. Do not run
    migrations again and do not run `grant-runtime.sh`.

11. Remove the isolated staging lane and its disposable data:

   ```sh
   $G7 down --remove-orphans -v
   ```

## Required result label and evidence boundary

The parent result for this lane is **`PASS_PARTIAL_HELD`** only when the
authorized evidence records the controlled sequence, tool/server versions,
V001–V003 verification, checkpoint, restore, and post-restore verification.
The result must remain held because pending-capture clarification and the
source-backed runtime privilege allowlist are unresolved.

Do not claim final PASS, Production PASS, runtime-grant approval, application
readiness, deployment, or Installer handoff from this lane. No actual Docker,
PostgreSQL, migration, backup, restore, or runtime evidence is asserted by
this repository artifact.
