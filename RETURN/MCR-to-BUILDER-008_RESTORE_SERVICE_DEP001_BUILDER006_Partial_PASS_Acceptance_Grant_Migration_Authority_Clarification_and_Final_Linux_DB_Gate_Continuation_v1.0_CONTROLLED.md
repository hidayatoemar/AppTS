# MCR-to-BUILDER-008 — RESTORE_SERVICE DEP-001 BUILDER006 PARTIAL PASS ACCEPTANCE, GRANT/MIGRATION AUTHORITY CLARIFICATION, AND FINAL LINUX/DB GATE CONTINUATION

**Comm ID:** MCR-to-BUILDER-008
**Version:** v1.0_CONTROLLED
**Date:** 15 August 2026 WIB
**From:** MCR
**To:** RESTORE_SERVICE Builder Team
**Primary Response To:** BUILDER-to-MCR-006
**Message Type:** PARTIAL PASS DISPOSITION / AUTHORITY CLARIFICATION / FINAL GATE CONTINUATION
**Status:** PARTIAL PASS EVIDENCE ACCEPTED / FINAL DEP-001 PASS NOT YET ACCEPTED / BUILDER ACTIVE / NO PRODUCTION AUTHORITY

---

## 1. DISPOSITION

MCR accepts BUILDER-to-MCR-006 as valid PARTIAL PASS evidence for the completed pending-capture application/contract/persistence-adapter implementation and the reported non-DB verification gates.

The reported Docker Linux amd64 Node.js 24.19.0 verification, contract/integration/adverse/unit/NFR results, build/typecheck results, and bounded technical corrections may be reused as evidence subject to preserved lineage and no invalidating later change.

BUILDER-to-MCR-006 is NOT accepted as final APP-RESTORE-SERVICE-DEP-001 PASS because the return itself records three incomplete final requirements:
- PostgreSQL 17.x migration verification remains HELD;
- runtime-role grant completion for T118/T119 remains HELD;
- actual non-container Linux x64 host/service/process verification remains incomplete.

Docker-only Linux evidence cannot satisfy the actual Linux PASS requirement already stated by MCR-to-BUILDER-006.

---

## 2. AUTHORITY CLARIFICATION — NO NEW SEMANTIC AUTHORITY REQUIRED

The two technical items treated as requiring additional MCR authority are already inside the implementation authority of MCR-to-BUILDER-006, Sections 4, 6, 7 and 8.

### A. Runtime grants for T118/T119

Builder is authorized to make the minimum deterministic change to `grant-runtime.sh` or the equivalent DEP-001 grant mechanism required for the accepted pending-capture implementation to access T118/T119 and the accepted bounded T74/T76 changes.

Rules:
- preserve the existing separation between migration role and runtime role;
- grant only privileges actually required by the accepted runtime behavior;
- no blanket schema/table privilege widening;
- no privilege that enables Product/authority bypass, unrelated table mutation, or administrative ownership;
- verify the resulting grants with executable evidence.

This is implementation HOW under the already accepted persistence/runtime/interface meaning. It is not a new schema or security-policy design decision.

### B. Disposable PostgreSQL 17.x migration gate

Builder is authorized to create/use a disposable, non-production PostgreSQL 17.x staging instance and set `APPTS_B01_DISPOSABLE_DB=true` for the bounded migration-verification workflow.

This may use a containerized PostgreSQL 17.x instance for the DB/migration gate. It must not use Production data, Production credentials, or modify Adit/Tim Infrastruktur IT infrastructure unless separately coordinated and authorized.

Complete at minimum:
- clean V001→successor migration path;
- accepted predecessor→successor upgrade path;
- explicit fail-closed legacy T74 case where authoritative backfill is unavailable;
- T118/T74/T119/T76 keys, FKs, uniqueness, branch constraints, idempotency/replay binding, reconciliation links and immutability behavior;
- runtime-role grant verification;
- backup/restorable checkpoint behavior required by the bounded DEP-001 staging test where applicable.

If the working-copy migration sequence is V001–V003 followed by V004, record and verify V004 explicitly. If the actual verified sequence differs, report the factual sequence rather than renumbering by assumption.

---

## 3. ACTUAL LINUX X64 FINAL VERIFICATION

For final DEP-001 Linux PASS, Builder shall run the accepted DEP-001 staging package on an actual non-production Linux x64 VM/host, not only inside a Docker Linux container on Windows.

A Builder-controlled non-production Linux x64 VM/host is sufficient for DEP-001 engineering verification. It need not be `LOCAL-EXISTING-001`. However, evidence from a different host does not automatically qualify Adit's `LOCAL-EXISTING-001` infrastructure candidate for IR.

Capture at minimum:
- OS distribution/version/kernel/architecture;
- Node.js 24.19.0 and npm identity;
- installed DEP-001 artifact/source identity and hashes;
- PostgreSQL 17.x staging connectivity where applicable;
- API/application startup and health;
- worker startup and durable-work behavior;
- web/Service Worker availability;
- configuration and observability startup;
- simulated transport operation;
- service/process supervision using systemd or a technically equivalent native Linux supervisor;
- start, stop, restart, process failure/recovery, boot/startup behavior where applicable, and log location/behavior;
- no Production endpoint/provider/data/secret use.

Docker may remain part of supporting tests, but Docker-only evidence must not be labeled actual Linux host/service PASS.

---

## 4. REUSE / RERUN RULE

Do not rerun already accepted partial tests merely for administration.

Rerun only:
- tests affected by the final grant/migration/Linux-host changes;
- required final aggregate verification needed to prove the completed DEP-001 state;
- any test whose prior result is invalidated by a changed file or environment.

Preserve exact evidence lineage for reused results.

---

## 5. FINAL RETURN REQUIREMENT

The next substantive Builder return shall be:

`BUILDER-to-MCR-007_RESTORE_SERVICE_DEP001_Implementation_and_Actual_Linux_Staging_Verification_Final_Return_<PASS|STOP>_v1.0_CONTROLLED`

PASS requires:
- pending-capture implementation complete;
- successor migration and PostgreSQL 17.x disposable DB gates PASS;
- runtime grants complete and least-privilege verified;
- required V-PC-001..016 and PC-V01..20 traceability preserved;
- actual non-container Linux x64 staging/service/process evidence complete;
- final affected build/test verification PASS;
- canonical BP-001 confirmed unchanged;
- no Production/UAT/real-data/provider/secret boundary crossed.

STOP is reserved for a genuine blocker that cannot be solved under the accepted design plus this clarified engineering authority.

---

## 6. CURRENT STATE

| Item | Status |
|---|---|
| BUILDER-to-MCR-006 | PARTIAL PASS EVIDENCE ACCEPTED; not final closure |
| MCR-to-BUILDER-006/007 | consumed into this continuation where clarified |
| MCR-to-BUILDER-008 | ACTIVE / CONTROLLING |
| Builder | ACTIVE |
| DEP-001 final PASS | OPEN pending DB/grant/actual-Linux gates |
| Canonical BP-001 | FROZEN / UNCHANGED |
| Production/UAT/real operational data/provider activation/secrets | NOT AUTHORIZED |

---

**Artifact = Authority. Chat = Notification Only.**
