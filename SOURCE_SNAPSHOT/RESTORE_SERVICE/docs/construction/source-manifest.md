# RESTORE_SERVICE CF06-B00 Construction Source Manifest

Release ID: `CODEX-EXEC-002`  
Batch: `CF06-B00`  
Repository identity: `APP-RESTORE-SERVICE-REPO-001`  
Working-tree identity: `WT-RS-CF06-B00-001`  
Classification of this file: controlled construction provenance; no Product, migration, deployment, or production authority.

## Execution authority and exact active sources

| Role | Controlled artifact | File ID | Exact revision used |
| --- | --- | --- | --- |
| Execution release | `CODEX-EXEC-002_RESTORE_SERVICE_CF06_B00_Execution_Release_v1.0_CONTROLLED` | `1rAm14tIZEVuy-WMtqfKBnsQauBiNw-HmozF7ii4yyy8` | `2` |
| Final Codex Pack | `CODEX-PACK-002_RESTORE_SERVICE_Final_Codex_Pack_v1.0_CONTROLLED` | `16dhQO0CpDYTmTSTI_1o9_8VoSLLgtSkLa6jisBCskLg` | `2` |
| Primary construction package | `AppTS_RESTORE_SERVICE_CF06_Codex_Construction_Package_v0.1.1_WD` | `1HolXD_c6I3C8q_npSu7b4nb7EAQyb1lnmTUx1NfKQ-M` | `2` |
| Independent constructibility gate | `AppTS_RESTORE_SERVICE_CF07_No_Inference_Constructibility_Gate_v0.1.1_WD` | `1rSHvRMfdVf9ICjjr0LUBkwvQPaiu-ogeZTMeI4QuDjw` | `2` |
| Repository/stack binding | `AppTS_RESTORE_SERVICE_CF04_Repository_Stack_Build_and_Environment_Binding_v0.1.1_WD` | `1J8uEUQePJ8huxGy5Qn4UUOd6b_iyC8ugDfGjtevVxfc` | `2` |
| Verification harness | `AppTS_RESTORE_SERVICE_CF05_Executable_Verification_Harness_v0.1_WD` | `1DqI5_cv2881OzBqhuyGaQisLqtHl5_2x8d4LQsLsabU` | `2` |

All six identities above were read directly from Google Drive. Each named source resolved to revision `2` before construction began. Any later identity or revision mismatch invalidates this snapshot and requires `STOP / BLOCKED_SOURCE`; no substitute source is permitted.

## CF-06 precedence

1. `P0` — MCR control and current-workspace doctrine.
2. `P1` — accepted current CF-01 through CF-05 and DG-04 for their bounded controlled meaning.
3. `P2` — admitted PRD and Core/Runtime TD/DED for meaning not superseded by P1.
4. `P3` — admitted M4 and RPR predecessor/candidate context only where consistent with P0–P2.

No lower-precedence source may override a higher-precedence source.

## Control and doctrine sources

| ID | Artifact / bounded role | File ID |
| --- | --- | --- |
| `S-CTL-01` | MCR-SPLINE-002 room-spline and async communication control; authority and fail-closed invariants | `1SNV4RPMOKybhVmd3haP15bErLAD00iW4aiNKK9lcIF4` |
| `S-CTL-02` | Mission/Product Boundary Charter; Product mission, boundary, and evolution control | `1csV2ASZjMcxfdFhRArcAlnncV8s-QczWR__dmLTjahw` |
| `S-CTL-03` | Product Design Intent and Decision Principles; cross-Purpose design intent | `1RJMgKrgKYPSdNzVwA3Vgi55m3Vrsp42zdEK6fwTVpJQ` |
| `S-CTL-04` | Current Design Gap Closure Task List v0.3; current DG/CF ownership and state | `1Dhq6CMy7tIDnoVpU4GQ8m1O1MZExFo3ZKjCafbu0Vcs` |
| `S-CTL-05` | Source Admission Register; source admission and precedence | `1KI5mdzT52EgURyaXpB-mVBnNwiFhGWlm2h7t0Qj3zV4` |
| `S-CTL-06` | Codex Constructibility Gap Register; current constructibility state | `1l5WfdrVrlsPV_dPzJRxJDbxW70KGtq1hH3ndPRCp7o0` |

## Accepted or admitted Product and technical design sources

| ID | Artifact / bounded role | File ID |
| --- | --- | --- |
| `S-DES-01` | Solution-Bound PRD v0.6; RESTORE_SERVICE outcome, requirements, boundaries, and NFR intent | `1Fd4kiK7MuItnDN_MYE96CSA6F7j9kTDFHkypkkNoZgM` |
| `S-DES-02` | Integrated Core TD/DED v0.2; D-01/D-02/D-03 ownership and technical records | `11Gqu_VqRhb6iK6bj3iaBPfhxv_i1Y5vUdQNQoErq4WY` |
| `S-DES-03` | Integrated Runtime TD/DED v0.1; D-04/D-05/D-06 runtime architecture and authority boundaries | `1-2-w57CgpUtNs_rYrV8DvQvZeUcLWG4LXYnxfBSGMBI` |
| `S-DES-04` | CE-PRE-01 Persistence Technology Binding; PostgreSQL 17.x family | `13R5zp2cTy3PzV5aTyNkYZuCXFSglMiZ8Le41KV2ZLRc` |

## Accepted current construction-facing sources

| ID | Artifact | File ID | Accepted revision | Role |
| --- | --- | --- | --- | --- |
| `S-CF01` | CF01 Physical Data Schema and Migration Contract v0.2.2 | `1uJmmh9lU4QpqhWwiE3gvR_8TOdF-om8dVNvRlCXzxOQ` | `4` | Physical persistence contract |
| `S-CF02` | CF02 Exact Interface and Contract Schemas v0.1 | `1dh5-7auRKHkDR-tY4mooBw1nxatmjVY-nSHzTSK9_9Q` | `2` | Exact interface/contract schemas |
| `S-CF03` | CF03 Operational UI and Human Interaction Package v0.1 | `1vPAPlxfjfvzS5WlkvHNsb1N7-Ej6RqSGpQl3Axif_2c` | `3` | UI and human-interaction behavior |
| `S-DG04` | DG04 Runtime Construction Amendment v0.1 | `17o-qd7BpoBTL8j3N0R2a3O5joVH_LMySAJA9MDAGjKM` | `2` | Additive diagnostic/notification construction amendment |
| `S-CF04` | CF04 Repository, Stack, Build and Environment Binding v0.1.1 | `1J8uEUQePJ8huxGy5Qn4UUOd6b_iyC8ugDfGjtevVxfc` | `2` | Repository, stack, build, environment, and frontend mechanics |
| `S-CF05` | CF05 Executable Verification Harness v0.1 | `1DqI5_cv2881OzBqhuyGaQisLqtHl5_2x8d4LQsLsabU` | `2` | Executable verification and evidence obligations |

## Subordinate predecessor or candidate context

| ID | Artifact | File ID |
| --- | --- | --- |
| `S-CTX-01` | Core M4 candidate | `1KBKulYlV4W_BzZH8uT-b4UKwBa8gOpMn6OCyuJOmB5Q` |
| `S-CTX-02` | Runtime M4 candidate | `1q5b98ZRmA-Rr0IDlRSH1jb6DkKlnLC5y1GuyvyTeVvc` |
| `S-CTX-03` | Joined M4 / D-07 candidate | `15wruPXZ8fjxzDXg87K70UuUcGl_nlcf3oJPmZvgl_YE` |
| `S-CTX-04` | RPR-O1 Final Recipe / Builder Work Package Candidate | `1DTCLyiNaDexDKW-kQ9eBldJ66aQxaxr-KIITvYQWEyI` |
| `S-CTX-05` | RPR-O2 Recipe Traceability and Codex Task Index | `1cQCI4k6vC9CjDAdrcVmSyALQ-mYVfCHAmRLYegHtwog` |
| `S-CTX-06` | RPR-O3 Recipe Release Manifest Candidate | `1lFmqsmcuG3T1PdXXzNopoUn88p1uftXVPUqqz90zS0Y` |

`S-CTX-*` may inform grouping, lineage, or completeness checks only. They cannot override current control/doctrine, CF-01 through CF-05, or DG-04. Human/person-placement fields create no activation or construction authority.

## B00 exact technical binding

- Single-repository TypeScript modular monolith.
- npm workspaces: `apps/*` and `packages/*`.
- Node.js `24.19.0`; npm `11.17.0`; TypeScript `6.0.3`.
- ESM, `NodeNext`, and `ES2024`.
- Fastify `5.10.0`; `@fastify/static` `10.1.2`; `pg` `8.22.0`; Pino `10.3.1`.
- React and react-dom `19.2.8`; Vite `8.1.0`; `@vitejs/plugin-react` `6.0.4`.
- `@types/node` `24.13.3`; `@types/react` `19.2.17`; `@types/react-dom` `19.2.3`.
- Exact direct versions only; package-lock controlled; no unbound library, provider, or platform layer.
- Only `packages/persistence` may import `pg` for application database access.
- Circular workspace dependencies and cross-package private/internal imports are prohibited.

## B00 authority boundary

Only the exact `CODEX-EXEC-002` B00 target set and the following gates are active: `npm ci`, `npm run verify:toolchain`, and `npm run verify:boundaries`. No Product behavior is implemented. CF06-B01 through CF06-B08, build execution beyond those explicit verification commands, database/Flyway commands, migration, application start, deployment, production access, real-data access, secret access, remote push, merge, release, or publication remain unauthorized or on HOLD.

## Successor provenance — CF06-B00 consolidated compile-blocker correction

This additive section preserves the historical `CODEX-EXEC-002` snapshot above. It records the accepted successor lineage and does not retroactively alter that earlier authority surface.

- Accepted v0.3 correction: `AppTS_RESTORE_SERVICE_CF06_B00_Build_Typecheck_Workspace_Dependency_Reconciliation_Bounded_Correction_v0.3_WD`, File ID `1kMSkP0But8PawoeKGY-OI55SW5voGHBgA1rRsvbtZno`, revision `2`; accepted by `MCR-to-CC-A011`, File ID `1zAtesCKxxTHJqio3iyMSXUtQCJRN-PF_vdWjDvKn42Q`.
- Preserved entry identity: base HEAD `8f527218f9c69547c8c577c7801f9dd279782a96`; base tree `c9acf5dac1ad288c4404d4f4f52fca1db0952c5d`; 30-target aggregate SHA-256 `f02e1f266b1f6d1805f7f6617beb99cafc0124ebb8ea7a35bc25a33b8a9c64bc`; package-lock SHA-256 `665bd0cf5321095add04917a09ec26b20b078d0afecfc4b65b301a1d890aab37`.
- The accepted workspace graph has exactly seven public `@appts-restore-service/contracts` dependency and project-reference edges: core-d01, core-d02, core-d03, runtime-d04, adapters-d05, interaction-d06, and diagnostics.
- Diagnostic/disposition lineage: `CODEX-to-MCR-026` File ID `1TsanfWPpSFT48EN9WoMxCmcLWh5WT7IWv-axUt577u8`; `MCR-CODEX-B00-CORR-D003` File ID `1aCacNlZgyOxvif-_upg42vPwMA5L4nTdmPXiYFo_j30`; `CE-to-MCR-A011` File ID `15WQm0MEPH2alY0ELNCXwKqZ4K56G6FUzALzUgZ7ATZY`; `MCR-to-CE-A012` File ID `111efcyfb4oG881Y31G2m6itu11R4o1T19JMH0wjDSmY`; `CC-to-MCR-A012` File ID `1ZKQfWEzBtF1oUULnSVa9MbLF3JS3CDIOuOskMjIW0nA`; `MCR-to-CC-A013` File ID `15kkq3hLTSyDUe-yJ1lqf0WhmI80CvcpZyhA35L0nHAY`; v0.4 File ID `1rFpnM27eC4Wz7y45fUg_4QM_14pJ66k1xgN_LMfd0YI`; `MCR-CODEX-B00-CORR-D004`; and fresh execution release `CODEX-EXEC-016`.
- CB-01: `rewriteRelativeImportExtensions=true`; source specifiers preserved. CB-02: contracts public package root binds only to dist `main`, `types`, and ordered `exports`. CB-03: persistence devDependency `@types/pg=8.20.0` with mechanical lock reconciliation; runtime `pg=8.22.0` unchanged. CB-04: omit absent `outboxRef` only. CB-05: dependent recheck required before any action-derivation source change.
- Consolidated population: exactly 35 immediate targets. Verification sequence is toolchain, boundaries, CB-05 targeted recheck, positive typecheck/build/tests, disposable negative checks, ownership/graph/provenance verification, generated-output cleanup, and PASS-or-STOP disposition.
