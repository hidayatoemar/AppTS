# Independent Deployment Experiment — Deviation Ledger

Status: EXPERIMENTAL EVIDENCE ONLY

## D-001 — Missing contracts source in Docker build context

- Baseline condition: Dockerfile.dep copies `packages/contracts/package.json` but does not copy the `packages/contracts` source tree into the build stage before API TypeScript build.
- Failure: TS5083 cannot read `/workspace/packages/contracts/tsconfig.json`; TS2307 cannot find module `@appts-restore-service/contracts`; TS6053 reports `/workspace/packages/contracts` not found.
- Causal diagnosis: build-context omission; required referenced TypeScript workspace source is absent inside Docker build stage.
- Minimum change: `COPY packages/contracts packages/contracts`
- Classification: Docker/build context — purely mechanical deployment wiring.
- Product change: NO.
- Formal state change: NO.
- Correction commit: `d4fb63792076fe038a68de04fa7bbf02b9c4cbf6` — EXPERIMENTAL DEPLOYMENT CORRECTION / NOT PRODUCT CHANGE.
- Exact gate rerun trigger: `8ddb6b26b9163cede24cba4bf775c672c2999237`.
- Rerun result: PASS. Original TS5083 / TS2307 / TS6053 failure did not recur. `docker compose ... up -d --build` completed; `/healthz` returned `{"status":"ok"}`; `/readyz` returned `{"status":"ready"}`; API and PostgreSQL containers were Up and healthy.
- First next divergence in this deploy gate: NONE OBSERVED.

## D-002 — Runtime DB bootstrap/migration binding omitted

- Baseline condition: independent runtime Compose initializes PostgreSQL with `APPTS_POSTGRES_USER=appts_runtime`, and no accepted role-bootstrap/migration mechanism is executed before runtime health is declared.
- Observed failure / gate mismatch: Stage 2 inspection showed PostgreSQL 17.11 reachable, but `appts_runtime` was `superuser=true|createdb=true|createrole=true`; non-system table count was `0`; no application schema/migration state was present.
- Causal diagnosis: deployment environment binding conflated PostgreSQL bootstrap/admin identity with runtime identity and omitted the existing DEP-001 `bootstrap-roles.sh` + `migrate.sh` execution path.
- Accepted-source basis: DEP-001 `bootstrap-roles.sh` requires distinct migration/runtime roles and constrains both to NOSUPERUSER/NOCREATEDB/NOCREATEROLE; DEP-001 `migrate.sh` applies the frozen V001–V004 sequence as the migration role.
- Minimum correction: rebind disposable PostgreSQL initialization to `appts_admin`, preserve `appts_runtime` as runtime identity, generate separate experimental admin/migration credentials on the isolated target, and invoke only existing DEP-001 `Dockerfile.tools`, `bootstrap-roles.sh`, and `migrate.sh` mechanics before API activation.
- Disposable-state action: the preserved D-002 baseline had zero non-system tables and no trial/business data; only that isolated empty Docker volume was recreated.
- Classification: environment binding + container/DB bootstrap mechanics — purely mechanical deployment wiring.
- Product change: NO.
- Schema semantic change: NO; only existing frozen migrations were run.
- Runtime grant change: NO at this stage.
- Formal state change: NO.
- Correction commits: `d10602d7e83b570544256b68a3ede7a811f296ae` (env binding) and `3f8e1d385bb5edbace866f94f48b7638ad5e899e` (accepted DB activation mechanics).
- Rerun trigger: `564f0dbc2b9b953f988d9335f357f2e8c1fa639f` / GitHub Actions run `32390555893`.
- Rerun result: PARTIAL PROGRESS. Role bootstrap and V001–V004 migration completed. Read-only follow-up run `32391155237` confirmed `runtime_flags=false|false|false`, `migration_flags=false|false|false`, `appts_table_count=119`, `primary_key_count=119`, and `runtime_connect=false`.
- First next divergence: existing verifier execution failed after migration. Verifier 001 first causal message was `CF01 requires UTC session time zone; found Etc/UTC`; verifier 002 independently reported `expected 91 append-only guards; found 93`; verifier 003 passed.

## D-003 — Verifier session timezone binding omitted

- Baseline condition: independent verifier execution inherited PostgreSQL/container session timezone `Etc/UTC`.
- Failure: exact existing verifier `001_cf01_constraints.sql` stopped before schema-count checks with `CF01 requires UTC session time zone; found Etc/UTC`.
- Causal diagnosis: independent verifier invocation omitted the accepted G7 `PGTZ=UTC` environment binding already present in DEP-001 `compose.g7.yaml`.
- Minimum correction: bind `PGTZ=UTC` to the verifier execution only; do not change PostgreSQL schema, migration SQL, or verifier expectations.
- Classification: environment binding — purely mechanical deployment wiring.
- Product change: NO.
- Verifier expectation change: NO.
- Formal state change: NO.
- Correction commit: `e1f71343ea53f85364ef1b8f36e1c512f0c0dd18` — EXPERIMENTAL verifier PGTZ binding / NOT PRODUCT CHANGE.
- Exact rerun trigger: `98c8c5d30740206ad502b8cc65bfc843974734bf`; GitHub Actions observer run `32391415278`.
- Rerun result: PASS for the mechanical timezone correction. The `Etc/UTC` mismatch did not recur.
- First next divergence: verifier 001 reached schema-count validation and reported `expected 117 CF01/DG04 tables; found 119`; verifier 002 reported `expected 91 append-only guards; found 93`; verifier 003 PASS.

## D-004 — Accepted migration output vs verifier expectation divergence

- Baseline condition: existing DEP-001 role bootstrap and frozen V001–V004 migration mechanism completed against the isolated disposable PostgreSQL 17.11 database with accepted `PGTZ=UTC` verifier binding.
- Observed state: `appts_runtime` and `appts_migration` are both `NOSUPERUSER/NOCREATEDB/NOCREATEROLE`; schema contains `119` `appts` base tables and `119` primary keys; runtime CONNECT initially remained false because runtime grants were not yet applied.
- Initial failure: verifier 001 returned `expected 117 CF01/DG04 tables; found 119`; verifier 002 returned `expected 91 append-only guards; found 93`; verifier 003 passed.
- Causal evidence: frozen V004 explicitly adds T118 `provisional_capture_payload_resource` and T119 `pending_capture_idempotency_binding`, and creates the corresponding append-only guards.
- MCR-to-DT-002 disposition: authorized exactly verifier 001 table-count `117→119` plus verifier 002 append-only guard-count `91→93` on the isolated DT branch only.
- Correction commit: `61ba29adec25d51e727c0b0bf8461c960c1079e2` — `BOUNDED DT VERIFIER ALIGNMENT / NOT PRODUCT CHANGE`.
- Valid rerun trigger: `328e5b186d6892e67f84c396f9fe0bb0ac6350ca`; Actions run `32392656208`; artifact ID `9415468316`; artifact SHA256 `e5c68a3c133ddb1c3a1f35d4282c0b5405104bdf9b2dc5706ab65ce0a00a57d5`.
- Valid rerun result: verifier 002 PASS; verifier 003 PASS; verifier 001 BLOCKED on the next unchanged expectation: `expected one primary key per CF01/DG04 table; found 119`.
- MCR-to-DT-003 disposition: accepted this BLOCKED evidence and authorized exactly verifier 001 primary-key expected count `117→119` on the isolated DT branch.

## D-005 — Bounded primary-key verifier alignment

- Before condition: verifier 001 table expectation already aligned to `119`, but `IF primary_key_total <> 117 THEN` remained while deterministic V001–V004 output contained `119` primary keys.
- Authority: `MCR-to-DT-003_RESTORE_SERVICE_DT002_BLOCKED_Acceptance_Primary_Key_Verifier_Alignment_and_Operational_Activation_Continuation_v1.0_CONTROLLED`.
- Exact minimum change: `IF primary_key_total <> 117 THEN` → `IF primary_key_total <> 119 THEN`; associated error text was unchanged because it contained no numeric expected value.
- Classification: bounded DT verifier expectation alignment against deterministic accepted migration output — NON-PRODUCT / NON-SEMANTIC.
- Correction commit: `06bf7d9e0cc7ec9180676e4fd58f327fc8b5ef32` — `BOUNDED DT PRIMARY-KEY VERIFIER ALIGNMENT / NOT PRODUCT CHANGE`.
- Stage 2 rerun trigger: `f10d25f1fe50091f0bbb55fbd90e55217e9f1322`.
- GitHub Actions run: `32395353799`; artifact ID `9416453474`; artifact SHA256 `15f411cdfa0def3726075e7b0b8455841b16d913d6e14bd8dc1132cbaee433a4`.
- Observed DB state: `runtime_flags=false|false|false`; `migration_flags=false|false|false`; `appts_table_count=119`; `primary_key_count=119`; `runtime_connect=false` before runtime grants.
- Rerun result: PASS. Verifier 001 rc=0; verifier 002 rc=0; verifier 003 rc=0. No additional verifier divergence observed.
- Stage 2 result: PASS.
- Product/API/UI/schema/business/lifecycle/Role/policy/trial-data semantic change: NONE.

## D-006 — Existing accepted runtime-grant mechanism activation

- Prerequisite: Stage 2 PASS under D-005.
- Authority: MCR-to-DT-003 continues runtime-grant authority from MCR-to-DT-002 on the isolated non-production DT database.
- Existing accepted mechanism: `deploy/db/grant-runtime.sh` from DEP-001; invoked unchanged. The script performs privilege quarantine followed by the existing source-backed V001–V004 least-privilege allowlist and its own post-grant verification.
- Harness-only wiring: `INDEPENDENT_DEPLOYMENT/ansible/playbooks/runtime-grant.yml` commit `f5ec150e4e30f751ed559cadf5f90d470b678a25`; workflow action wiring commit `a29c93adc2f5325908259e6c9c8d357d585b71c8`.
- Runtime-grant trigger: `c761f98ee5295b40dad4d7010c6b9d387c02b583`.
- GitHub Actions run: `32395790269`; artifact ID `9416597998`; artifact SHA256 `0410b115cca79befef4264029fb5614c9bdf90371fd8196b00f472c346d7c36e`.
- Pre-grant evidence: `runtime_flags=false|false|false|false|true`; `runtime_connect=false`; `runtime_temp=false`; `runtime_appts_usage=false`; `runtime_appts_create=false`; `runtime_appts_sys_usage=false`; `runtime_table_grants=0`.
- Post-grant evidence: runtime elevated flags remained false; `runtime_connect=true`; `runtime_temp=false`; `runtime_appts_usage=true`; `runtime_appts_create=false`; `runtime_appts_sys_usage=false`; representative allowlist checks PASS (`sync_result` SELECT/INSERT true, UPDATE false; `runtime_ticket` UPDATE true).
- Result: PASS. Existing `grant-runtime.sh` was invoked unchanged; no manual privilege broadening was performed.
- Product/API/UI/schema/business/lifecycle/Role/policy/trial-data semantic change: NONE.

## D-007 — Stage 3 governed TD-SIM-001 load/reset/reseed path absent

- Prerequisite state: Stage 2 PASS and runtime-grant PASS.
- Stage 3.1 canonical pack presence: PASS. The controlled TD-SIM-001 folder contains `README.md`, `data/td-sim-001-fixtures.json`, `manifest/data-dictionary.csv`, `manifest/scenario-manifest.csv`, `docs/load-reset-reseed-instructions.md`, `docs/open-dependency-register.md`, `docs/no-real-data-and-semantics-confirmation.md`, and `manifest/integrity-manifest.json`.
- Stage 3.2 locations searched: current MCR-RUNBOOK-001 controlled instructions; TD-SIM-001 `load-reset-reseed-instructions.md` and open dependency register; current isolated DEP-001 source including package scripts and `db/fixtures`; repository search for TD-SIM loader/seed/reseed binding.
- Existing accepted deployment workspace finding: `package.json` exposes build/typecheck/test/migration commands but no TD-SIM load/seed/reseed command. `db/fixtures` contains only `cf01_positive.sql` and `cf01_negative.sql`, which are database verification fixtures, not TD-SIM-001 loading mechanics. Repository search found no TD-SIM-001 loader/seed/reseed binding.
- Controlled TD-SIM instruction: `No load, reset, or reseed command is authorized or verified by this package`; package classification is `STATIC REFERENCE ONLY`; loadability must not be claimed until a governed loader/reseed path is separately authorized and verified.
- Open dependency register: `Governed data load/reseed path` remains `OPEN / RUNTIME SERVER PROJECTION DEPENDENCY` because no loader or reseed command was verified.
- Exact missing binding: no existing authorized mechanism maps `data/td-sim-001-fixtures.json` into the running non-production AppTS through traceable accepted application/runtime semantics, and no authorized reset/reseed command exists.
- Required result under MCR-RUNBOOK-001 and MCR-to-DT-003: `BLOCKED — NO GOVERNED TRIAL DATA LOAD PATH`.
- New loader/seed/reseed code: NOT CREATED.
- Manual business-state INSERT/UPDATE: NOT PERFORMED.
- New dummy data/schema/API/UI projection: NOT CREATED.
- Stage 4+: NOT REACHED.
- Minimum Operationally Useful RESTORE_SERVICE: NOT ESTABLISHED / BLOCKED.
- Next action: WAIT MCR.

## D-008 — MCR-to-DT-005 resume: target recovered, accepted Trial source delta not materialized in DT branch

- Fresh authority: `MCR-to-DT-005_RESTORE_SERVICE_CODEX056_PASS_Acceptance_Stage3_2_Cloud_Deployment_Test_Continuation_and_User_Learning_Access_v1.0_CONTROLLED`.
- Prior Stage 3.2 HOLD: RELEASED. DT resume authorized on isolated non-production lane; Hasan/Adit staging remains untouched.
- Initial current-target status trigger: `a33cb677462d22576add41b523fc5d718d703bce`; Actions run `32471266506`; result FAILURE because `http://127.0.0.1:8080/healthz` returned connection refused. This was an existing-service stopped state, not a Product/source failure.
- Authorized minimum recovery: added harness-only `start.yml` and workflow action to execute existing installed `docker compose ... up -d` without `--build`, source replacement, DB reset, migration, or seeding. Harness commits: `7c9af8d31555dd33f9f989db55b09e925088f936` and `6205063384f1490d659451dd2ea28f905db8b5a8`.
- Recovery trigger: `29a83e57681b0b99832c700a63ca031a3fd57921`; Actions run `32471412080`; artifact ID `9442670480`; artifact SHA256 `87ffc5927a59887972ee8adacaf020545321645f185037dc8b211aa0580aba9a`.
- Recovery result: PASS. Existing stack started; `healthz={"status":"ok"}` and `readyz={"status":"ready"}`; no rebuild, source replacement, or DB reset occurred.
- Accepted dependency-closure basis: MCR accepted `CODEX-to-MCR-056` under `MCR-to-CODEX-042`. The accepted Trial-gated delta is explicitly limited to `apps/api/src/routes/ui-intents.ts` (accepted SHA-256 `dec733c25b3459546785f0fb6cd3b441a3a544fc004a3f52cb1a0e0ccdc27cb5`), `apps/api/src/routes/trial-disclosure-binding.ts` (`42c5387ba22312987b21b3fe4b0305a66fd7926750c686afac8bf30f93aaa98d`), and `tools/td-pre-001-governed-replay.mjs` (`0fb10a88584737541d0cbe88bc026a1c765fa5aab4e3a64964068ef8a35f0e1d`), with process-local Trial key `APPTS_TRIAL_DISCLOSURE_LABEL_REF`.
- Current DT branch source identity mismatch: `apps/api/src/routes/trial-disclosure-binding.ts` is absent; `tools/td-pre-001-governed-replay.mjs` is not present in the DT repository; current `ui-intents.ts` remains the pre-closure version. Therefore the current running image cannot be claimed to contain the MCR-accepted CODEX056 Trial mechanism.
- Publication/materialization finding: the CODEX056 return states the bounded delta was produced with `no remote Git action`; the accepted files are not materialized into the isolated DT Git branch, and no separate consumable source package/commit or DT-specific source-materialization authority was found.
- Strict-boundary classification: STOP. MCR-to-DT-005 authorizes use of accepted implementation but explicitly does not authorize new source changes except under an existing explicit DT authority; applying or reconstructing the missing source delta inside DT would be a source mutation/materialization decision not explicitly bound by the artifact.
- Browser exposure/workflow exercise: NOT REACHED. A healthy pre-closure runtime is insufficient because source/runtime identity cannot be verified against the accepted Trial path.
- No Product/API/UI/business/lifecycle/Role/authority/policy semantic change performed.
- No manual canonical seeding, new dummy data, schema/migration change, real data, Production/UAT activation, credential broadening, or Hasan/Adit staging modification performed.
- Required next action: WAIT MCR for an explicit accepted source materialization/transfer binding (e.g. admitted commit/package or explicit DT authority to apply the exact accepted CODEX056 delta) before deployment/rebuild and browser workflow continuation.

No Hasan/Adit troubleshooting commit is imported or cherry-picked. Corrections are independently derived from reproduced evidence and bounded MCR authority. No Product semantics were invented.
