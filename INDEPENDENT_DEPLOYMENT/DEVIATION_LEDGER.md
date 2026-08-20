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
- Runtime grant change: NO; `grant-runtime.sh` was not run.
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
- First next divergence: verifier 001 now reaches schema-count validation and reports `expected 117 CF01/DG04 tables; found 119`; verifier 002 reports `expected 91 append-only guards; found 93`; verifier 003 PASS.

## D-004 — Accepted migration output vs verifier expectation divergence

- Baseline condition: existing DEP-001 role bootstrap and frozen V001–V004 migration mechanism completed against the isolated disposable PostgreSQL 17.11 database with accepted `PGTZ=UTC` verifier binding.
- Observed state: `appts_runtime` and `appts_migration` are both `NOSUPERUSER/NOCREATEDB/NOCREATEROLE`; schema contains `119` `appts` base tables and `119` primary keys; runtime CONNECT remains false because runtime grants remain pending by accepted DEP-001 design.
- Initial failure: verifier 001 returned `expected 117 CF01/DG04 tables; found 119`; verifier 002 returned `expected 91 append-only guards; found 93`; verifier 003 passed.
- Causal evidence: frozen V004 explicitly adds T118 `provisional_capture_payload_resource` and T119 `pending_capture_idempotency_binding`, and creates the corresponding append-only guards.
- MCR disposition: `MCR-to-DT-002` accepts this as deterministic verifier expectation drift and authorizes exactly verifier 001 table-count `117→119` plus verifier 002 append-only guard-count `91→93` on the isolated DT branch only.
- Exact authorized diff: verifier 001 `IF table_total <> 117` → `IF table_total <> 119` and its table-count error text `117` → `119`; verifier 002 `IF append_only_trigger_total <> 91` → `<> 93` and its error text `91` → `93`. No other verifier expectation was changed. In particular, verifier 001 `primary_key_total <> 117` remained unchanged.
- Correction commit: `61ba29adec25d51e727c0b0bf8461c960c1079e2` — `BOUNDED DT VERIFIER ALIGNMENT / NOT PRODUCT CHANGE`.
- First rerun trigger: `61b3e08807f5b36749a2bf2789afdfa7c443b5f8`, Actions run `32392425427`.
- First rerun validity: INVALID FOR ALIGNED VERIFIER RESULT because the observer executed the stale pre-alignment verifier copy under `/opt/appts-independent-restore-service`; this was a test-harness artifact-binding issue, not a DB/verifier semantic result.
- Minimum observer correction: transfer current verifier files from the checked-out DT revision to an ephemeral target path before read-only execution; remove the ephemeral files after execution. No DB/application state is changed.
- Observer correction commit: `c15508b515862e663dbdb36964206e6c11bb8ff4` — mechanical current-revision verifier binding.
- Valid rerun trigger: `328e5b186d6892e67f84c396f9fe0bb0ac6350ca`; Actions run `32392656208`; artifact ID `9415468316`; artifact SHA256 `e5c68a3c133ddb1c3a1f35d4282c0b5405104bdf9b2dc5706ab65ce0a00a57d5`.
- Valid rerun observed DB state: `runtime_flags=false|false|false`, `migration_flags=false|false|false`, `appts_table_count=119`, `primary_key_count=119`, `runtime_connect=false`.
- Valid rerun result: verifier 002 PASS; verifier 003 PASS; verifier 001 BLOCKED on the next unchanged expectation: `expected one primary key per CF01/DG04 table; found 119`.
- First next divergence: verifier 001 primary-key fixed-count expectation remains 117 while deterministic migration output has 119 primary keys.
- Authority classification: BLOCKED. `MCR-to-DT-002` did not authorize changing the verifier 001 primary-key expectation; it explicitly prohibited verifier relaxation beyond the exact 119-table / 93-guard alignment.
- Runtime grant: NOT REACHED; `grant-runtime.sh` not run because Stage 2 did not PASS.
- Stage 3 TD-SIM governed-load-path determination: NOT REACHED because Stage 2 remains BLOCKED.
- Minimum Operationally Useful RESTORE_SERVICE: NOT ESTABLISHED / BLOCKED.
- Product/API/UI/schema/business/lifecycle/Role/policy/trial-data semantic change: NONE.

No Hasan/Adit troubleshooting commit is imported or cherry-picked. Corrections are independently derived from reproduced evidence and bounded MCR authority.
