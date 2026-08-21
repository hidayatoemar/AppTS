# MCR-to-DT-009 — HTTP Trial STOP Evidence

Status: EVIDENCE ONLY / NON-PRODUCT

## Accepted continuation completed before blocker

- CODEX046 canonical transfer independently verified before application: package SHA-256 `6e395f5a6e963c137af638fe792aea0673750c66d7941b8d5a3f41b7e4bbe3e7`; 15/15 overlay file identities matched `FILES.sha256`.
- Exact 15-file overlay was applied atomically to the isolated DT lineage at commit `7a813276bf5e4d5e73a48cc6276141f3b9b4d0c5`.
- Independent code verification passed before cloud resync.
- Cloud source resync/rebuild preserved the corrected isolated database; no DB reset, migration reinterpretation, schema mutation, Production/UAT, real data, or unrelated environment mutation occurred.
- Runtime-grant action run `32512271759` completed successfully using the existing accepted `deploy/db/grant-runtime.sh` mechanism.

## HTTP Trial first causal blocker

GitHub Actions run: `32512401406`
Trigger commit: `4ea86210d3a3a03d491a36885a399e95b4ea7db4`
Evidence artifact: `9457524888`
Artifact SHA-256: `a40092a97949ac346fcf929d78b915f92a6f5c614f592b7ca04b0939e54bec48`

Before the mutating interaction:

- `GET /api/v1/ui/work-queue` returned HTTP 200 and the harness accepted `view_id=UX-RS-01`, `ticket_count=0`.
- `GET /api/v1/ui/intake` returned HTTP 200 and the harness accepted the preserved governed TD-PRE-001 state: `case_status_ref=HOLD_AS_PRE_TICKET`, `assessment_result=NOT_ACCEPTABLE`, `completeness_result=MISSING`.

First mutating HTTP action:

- `POST /api/v1/ui/intents` returned HTTP 500.
- Exact server error: `permission denied for table idempotency_ledger`.

## Deterministic source/security compatibility finding

The admitted CODEX046 owner flow in `apps/api/src/trial/pre-ticket-trial-owner-flow.ts` executes:

`SELECT payload_hash,durable_result_ref::text AS durable_result_ref FROM appts.idempotency_ledger WHERE owner_domain_ref=$1 AND idempotency_key=$2 FOR UPDATE`

The existing accepted runtime privilege mechanism in `deploy/db/grant-runtime.sh` classifies `appts.idempotency_ledger` as append-only and grants only:

`SELECT, INSERT`

No `UPDATE` privilege is granted to `appts_runtime` for this append-only table. PostgreSQL row-locking `SELECT ... FOR UPDATE` requires UPDATE privilege in addition to SELECT privilege. Therefore the admitted owner-flow locking operation and the accepted least-privilege runtime allowlist are not consumable together under the current runtime identity.

## DT classification

`ACCEPTED OWNER-FLOW / ACCEPTED RUNTIME PRIVILEGE ALLOWLIST INCOMPATIBILITY — AUTHORITY REQUIRED`

No DT correction is authorized because either candidate resolution crosses an explicit MCR-to-DT-009 boundary:

1. granting UPDATE (or otherwise broadening privileges) on `appts.idempotency_ledger` would alter the accepted security/least-privilege boundary; or
2. changing the admitted owner-flow locking strategy would modify Product/application source beyond the admitted CODEX046 overlay.

DT did not perform either action.

## Boundary confirmation

- no manual GRANT or runtime privilege broadening;
- no Product/application source change beyond admitted CODEX046 overlay;
- no schema/migration semantic change;
- no direct canonical Ticket/business-state manufacture;
- no real operational/customer data;
- no Production/UAT activation;
- frozen Build Pack unchanged;
- Hasan/Adit staging and unrelated environments unchanged.

Result: `STOP` at Stage 3.2 HTTP governed-intent execution / browser learning-flow completion boundary.
