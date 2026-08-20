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
- Observed failure / gate mismatch: Stage 2 inspection shows PostgreSQL 17.11 reachable, but `appts_runtime` is `superuser=true|createdb=true|createrole=true`; non-system table count is `0`; no application schema/migration state is present.
- Causal diagnosis: deployment environment binding conflates PostgreSQL bootstrap/admin identity with runtime identity and omits the existing DEP-001 `bootstrap-roles.sh` + `migrate.sh` execution path.
- Accepted-source basis: DEP-001 `bootstrap-roles.sh` requires distinct migration/runtime roles and constrains both to NOSUPERUSER/NOCREATEDB/NOCREATEROLE; DEP-001 `migrate.sh` applies the frozen V001–V004 sequence as the migration role.
- Minimum correction planned: rebind disposable PostgreSQL initialization to an admin identity, preserve `appts_runtime` as the runtime identity, and invoke the existing DEP-001 db-tools / `bootstrap-roles.sh` / `migrate.sh` mechanics before API activation. No new SQL, schema, migration, role semantics, or runtime grants will be invented.
- Disposable-state action: current independent DB contains zero non-system tables and no trial/business data; the isolated Docker volume may be recreated solely to apply the corrected bootstrap path.
- Classification: environment binding + container/DB bootstrap mechanics — purely mechanical deployment wiring.
- Product change: NO.
- Schema semantic change: NO; only existing frozen migrations may run.
- Runtime grant change: NO; `grant-runtime.sh` remains prohibited/pending unless separately authorized.
- Formal state change: NO.
- Correction commit: PENDING.
- Rerun result: PENDING.
- First next divergence: PENDING.

No Hasan/Adit troubleshooting commit is imported or cherry-picked. Corrections are independently derived from reproduced evidence.
