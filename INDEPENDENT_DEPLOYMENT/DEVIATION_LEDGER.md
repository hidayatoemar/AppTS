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
- Correction commit: PENDING.
- Rerun result: PENDING.
- First next divergence: PENDING.

No Hasan/Adit troubleshooting commit is imported or cherry-picked. Corrections are independently derived from reproduced evidence.
