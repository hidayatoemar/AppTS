# BUILDER-to-MCR-007
## RESTORE_SERVICE DEP001 — Implementation and Actual Linux Staging Verification
## Final Return — STOP — v1.0 — CONTROLLED

**Responding to:** MCR-to-BUILDER-008  
**Builder session date:** 2026-08-15  
**Scope:** APP-RESTORE-SERVICE-DEP-001 (`DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001/`)  
**BP-001 canonical:** FROZEN — not modified  

---

## Gate Summary

| Gate | Description | Result |
|------|-------------|--------|
| A-1 | `deploy/db/grant-runtime.sh` — V001–V004 runtime privilege grants | **PASS** |
| A-2 | `deploy/db/schema-freeze-baseline.json` — V004 registration | **PASS** |
| B | CF06-B01 disposable migration gate (`test:migrations`) | **HELD — Linux required** |
| C | Linux x64 non-container staging + systemd supervision evidence | **HELD — Linux required** |

---

## Classification: STOP

Gates B and C cannot be executed from the current Windows build environment.

- Gate B: `b01-db-verify.mjs` enforces `allowedHosts = ["localhost", "127.0.0.1", "::1"]` for the Flyway JDBC URL. This requires the test runner to share the host loopback, which depends on `network_mode: host` (Linux/WSL2 only). Windows Docker Desktop does not support `network_mode: host`; container-internal loopback does not reach mapped host ports.
- Gate C: Requires a Linux x64 staging machine with systemd.

All gate artifacts have been created and are ready for execution on Linux or WSL2. See execution steps in each gate section below.

This return will be superseded by `BUILDER-to-MCR-007-PASS` once Gate B and Gate C evidence is captured.

---

## Gate A-1 — PASS: `deploy/db/grant-runtime.sh` Updated

### Change

Replaced the intentional STOP at line 105 (`die "runtime application privilege construction is intentionally STOPPED..."`) with the V001–V004 source-backed runtime privilege grant block and post-grant least-privilege verification.

### Grant scope (MCR-to-BUILDER-008 §2.A allowlist)

| Object | Privilege granted to runtime role |
|--------|----------------------------------|
| Database | `CONNECT` only (no TEMPORARY, no CREATE) |
| Schema `appts` | `USAGE` only (no CREATE) |
| Schema `appts_sys` | none |
| Sequences in `appts` | `USAGE` (required for INSERT on identity columns) |
| **Append-only tables** (SELECT + INSERT; UPDATE blocked by `reject_canonical_mutation()` trigger) | |
| V001 (47 tables) | `admission_assessment`, `admission_predicate_result`, `intake_decision`, `ticket_formation_record`, `incident_record`, `relationship_record`, `post_closure_correction`, `successor_ticket_link`, `handover_proposal`, `handover_response`, `responsibility_change`, `delegation_grant`, `escalation_obligation_core`, `sod_decision`, `evidence_object`, `evidence_qualification`, `evidence_correction`, `claim_record`, `interpretation_record`, `claim_evidence_link`, `contradiction_set`, `contradiction_member`, `evidence_set_version`, `evidence_set_member`, `verification_request`, `verifier_eligibility_decision`, `verification_result`, `gate_evaluation`, `gate_predicate_result`, `progression_class`, `terminal_disposition_assessment`, `closure_readiness_assessment`, `source_ref`, `source_version_ref`, `policy_binding_ref`, `configuration_snapshot`, `missing_binding_result`, `integrity_envelope`, `lineage_edge`, `idempotency_ledger`, `inbox_entry`, `commit_marker`, `audit_event`, `access_audit`, `export_manifest_item`, `release_identity`, `compatibility_declaration` |
| V002 (29 tables) | `runtime_context`, `runtime_state_transition`, `lifecycle_effect_request`, `lifecycle_effect_result`, `action_set_member`, `next_control`, `runtime_escalation`, `acknowledgment`, `runtime_handover_context`, `subordinate_projection`, `dependency_context`, `residual_obligation`, `authorization_transition`, `package_binding_runtime`, `hook_invocation`, `hook_result`, `stub_result`, `authoritative_source_ref`, `adapter_profile_ref`, `qualified_external_record`, `interaction_journal`, `pending_capture`, `sync_batch`, `sync_result`, `reconciliation_case`, `action_intent`, `communication_obligation`, `communication_attempt`, `communication_result`, `export_job` |
| V003 (14 tables) | `diagnostic_error_event`, `diagnostic_event_subject`, `diagnostic_bundle_member`, `diagnostic_dependency_evidence`, `diagnostic_mapping_entry`, `diagnostic_notification`, `diagnostic_notification_attempt`, `diagnostic_notification_result`, `diagnostic_notification_dead_letter`, `diagnostic_notification_acknowledgment`, `diagnostic_aggregation_member`, `diagnostic_storm_control_decision`, `diagnostic_notification_failure_link`, `diagnostic_event_correction` |
| V004 (2 new tables) | `provisional_capture_payload_resource` (T118), `pending_capture_idempotency_binding` (T119) |
| **Mutable tables** (SELECT + INSERT + UPDATE; no DELETE) | |
| V001 (8 tables) | `ticket_identity`, `pre_ticket_case`, `authority_envelope`, `authority_action`, `responsible_assignment`, `progression_envelope`, `outbox_entry`, `export_manifest` |
| V002 (7 tables) | `runtime_ticket`, `operational_obligation`, `waiting_interval`, `runtime_blocker`, `authority_projection`, `gate_projection`, `action_set_snapshot` |
| V003 (3 tables) | `diagnostic_mapping_registry_version`, `diagnostic_aggregation_group`, `secure_diagnostic_bundle` |

### Post-grant verification checks (13 assertions, fail-closed)

| # | Assertion |
|---|-----------|
| v01 | Runtime has CONNECT on database |
| v02 | Runtime does NOT have TEMPORARY on database |
| v03 | Runtime has USAGE on schema `appts` |
| v04 | Runtime does NOT have CREATE on schema `appts` |
| v05 | Runtime does NOT have USAGE on schema `appts_sys` |
| v06 | Runtime has SELECT on `appts.sync_result` |
| v07 | Runtime has INSERT on `appts.sync_result` |
| v08 | Runtime does NOT have UPDATE on `appts.sync_result` (append-only guard) |
| v09 | Runtime has UPDATE on `appts.runtime_ticket` (mutable) |
| v10 | Runtime has INSERT on `appts.provisional_capture_payload_resource` (T118/V004) |
| v11 | Runtime has INSERT on `appts.pending_capture_idempotency_binding` (T119/V004) |
| v12 | Runtime has no privileges on any `appts_sys` table |
| v13 | Runtime has no DELETE/TRUNCATE/REFERENCES/TRIGGER on any `appts` table |

Script exits non-zero if any assertion fails (`die "post-grant verification failed: $grant_verify"`).

---

## Gate A-2 — PASS: `schema-freeze-baseline.json` Updated

`migrate.sh` calls `verify-schema-frozen.mjs` before applying migrations. The baseline previously contained only V001–V003 and the three verify scripts. V004 was present on disk but absent from the baseline, which would have caused `migrate.sh` to STOP with `ADDED db/migrations/V004__d05_pending_capture_v2.sql`.

Added entry:

```json
{
  "path": "db/migrations/V004__d05_pending_capture_v2.sql",
  "sha256": "1603c9f89aa0358456b850eca9c094255a8c2ea6688265b76b8859e1ee7e5a55"
}
```

SHA256 verified via `Get-FileHash` against the file as written. The baseline now covers 7 files (V001–V004 + 3 verify scripts), sorted by path.

---

## Gate B — HELD: CF06-B01 Disposable Migration Gate

### Artifacts created

| File | Purpose |
|------|---------|
| `deploy/db/Dockerfile.b01-gate` | Gate B image: Node 24.19.0 + psql 17 (apt) + Flyway 13.0.0 (Maven Central) |
| `deploy/db/gate-b01-entrypoint.sh` | Creates disposable DB, then execs `node tools/b01-db-verify.mjs test` |
| `deploy/db/compose.b01.yaml` | Compose for Gate B: `b01-pg` (postgres:17, host network) + `b01-gate` (host network) |
| `deploy/db/.env.b01.template` | Env template with `appts_b01_dep001_gate` database name and port 54321 |

### Gate B execution (Linux x64 or WSL2)

```sh
# From DEP-001 workspace root on Linux / WSL2
cp deploy/db/.env.b01.template deploy/db/.env.b01
# Fill APPTS_B01_ADMIN_PASSWORD with a strong random value
vi deploy/db/.env.b01

docker compose -f deploy/db/compose.b01.yaml --env-file deploy/db/.env.b01 \
  up --build --abort-on-container-exit
```

Expected final output of `b01-gate` service:
```
PASS: CF06-B01 bounded migration verification completed on the authorized disposable database.
```

### V004 verify coverage gap — observation (no STOP authority required)

`b01-db-verify.mjs` hardcodes `verificationFiles` as `[001_cf01_constraints.sql, 002_cf01_history_inbox_outbox.sql, 003_dg04_diagnostics.sql]` (no V004 entry). The `db/verify/` directory contains no `004_d05_pending_capture.sql`. Flyway will apply and validate V004 migration integrity (checksum, migration history), but T118/T119 constraint behaviour (content branch, append-only trigger, uniqueness) will not be asserted via SQL. Gate B will PASS for migration integrity but V004 SQL constraints are untested at the verify layer.

MCR should decide whether to authorize a `004_d05_pending_capture.sql` verify script and corresponding `b01-db-verify.mjs` expansion (outside current builder authority).

---

## Gate C — HELD: Linux x64 Non-Container Staging + systemd

### Artifact created

| File | Purpose |
|------|---------|
| `deploy/systemd/appts-restore-api.service` | systemd unit for `apps/api` — runs `node /opt/appts-restore-service/apps/api/dist/dep-bootstrap.js` under user `appts`, restarts on failure, journals stdout/stderr |

### Gate C execution (Linux x64 staging machine)

```sh
# 1. Install Node.js 24.19.0 on the Linux staging machine
#    (e.g., via NodeSource: https://github.com/nodesource/distributions)

# 2. Create the service user
sudo useradd --system --no-create-home appts

# 3. Extract the DEP-001 built artifacts to /opt/appts-restore-service/
#    Build inside the Docker build image, then copy the dist/ folders and node_modules out.
#    Minimum required paths:
#      /opt/appts-restore-service/apps/api/dist/
#      /opt/appts-restore-service/apps/web/dist/
#      /opt/appts-restore-service/packages/config/dist/
#      /opt/appts-restore-service/packages/observability/dist/
#      /opt/appts-restore-service/node_modules/
sudo chown -R appts:appts /opt/appts-restore-service

# 4. Write the environment file
sudo mkdir -p /etc/appts-restore-service
sudo tee /etc/appts-restore-service/appts-restore-api.env <<'ENV'
APPTS_STAGING_LABEL=STAGING SIMULATION / NON-PRODUCTION
API_LISTEN_PORT=8080
APPTS_RUNTIME_DATABASE_URL=postgresql://<RUNTIME_ROLE>:<PASSWORD>@<HOST>:<PORT>/<DBNAME>
DATABASE_URL=postgresql://<RUNTIME_ROLE>:<PASSWORD>@<HOST>:<PORT>/<DBNAME>
NODE_ENV=production
ENV
sudo chmod 0640 /etc/appts-restore-service/appts-restore-api.env
sudo chown root:appts /etc/appts-restore-service/appts-restore-api.env

# 5. Install and start the systemd unit
sudo cp deploy/systemd/appts-restore-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now appts-restore-api

# 6. Capture evidence
systemctl status appts-restore-api
journalctl -u appts-restore-api --since "5 minutes ago" --no-pager
ps -fp "$(systemctl show -p MainPID --value appts-restore-api)"
curl -fs http://127.0.0.1:8080/healthz && echo "HEALTHZ: OK"
```

Gate C evidence required in follow-up return:
- `systemctl status appts-restore-api` output (Active: active (running))
- `journalctl` output showing clean startup (no fatal errors)
- `ps` line confirming process is the correct Node PID supervised by systemd
- `curl /healthz` response confirming API is reachable

---

## Technical Flags

| # | Flag | Severity | Action |
|---|------|----------|--------|
| F-01 | `verify-schema-frozen.mjs` line 129 message hardcodes "V001–V003" — now inaccurate (V004 is registered) | Cosmetic | No impact on verification logic; MCR may authorize a message update in a future pass |
| F-02 | V004 verify coverage gap in `b01-db-verify.mjs` | Moderate | MCR authorization required to expand gate scope; builder cannot act |
| F-03 | Gates B and C cannot execute from Windows; Linux/WSL2 required for Gate B, Linux staging required for Gate C | Structural | Awaiting MCR direction on staging machine access |

---

## Changes Manifest (This Session)

| File | Action | Description |
|------|--------|-------------|
| `deploy/db/grant-runtime.sh` | Modified | Lines 104–105: replaced intentional STOP with V001–V004 GRANT block + 13-check post-grant verification |
| `deploy/db/schema-freeze-baseline.json` | Modified | Added V004 entry (sha256: `1603c9f89aa0358456b850eca9c094255a8c2ea6688265b76b8859e1ee7e5a55`) |
| `deploy/db/Dockerfile.b01-gate` | Created | Gate B image definition |
| `deploy/db/gate-b01-entrypoint.sh` | Created | Gate B container entrypoint |
| `deploy/db/compose.b01.yaml` | Created | Gate B Docker Compose (Linux/WSL2 only) |
| `deploy/db/.env.b01.template` | Created | Gate B environment template |
| `deploy/systemd/appts-restore-api.service` | Created | Gate C systemd unit |

No product meaning, schema semantics, contract interfaces, lifecycle state semantics, role authority, or runtime topology were changed. All changes are within the builder authority granted by MCR-to-BUILDER-008.

---

## Next Steps for MCR

1. Provide Linux/WSL2 access (or confirm WSL2 is available on builder machine) for Gate B execution
2. Confirm Gate C staging machine and runtime database credentials
3. Decide on F-02: authorize 004_d05_pending_capture.sql verify script + b01-db-verify.mjs expansion, or accept current coverage
4. After Gates B+C evidence is captured: supersede this document with `BUILDER-to-MCR-007-PASS`

---

*Classification: STOP — Gate A complete; Gates B and C held pending Linux execution.*
