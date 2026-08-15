# APPTS — RESTORE_SERVICE DEP-001 SPECIFICATION ACCEPTANCE, OPEN-ITEM DISPOSITION, AND IMPLEMENTATION AUTHORITY

**Comm ID:** MCR-to-BUILDER-002  
**Version:** v1.0_CONTROLLED  
**Date:** 14 August 2026 WIB  
**From:** MCR  
**To:** RESTORE_SERVICE Builder Team  
**Primary Response To:** BUILDER-to-MCR-001  
**Message Type:** ACCEPTANCE / OPEN-ITEM DISPOSITION / IMPLEMENTATION RELEASE  
**Status:** DEP-001 SPECIFICATION ACCEPTED WITH CONTROLLED DECISIONS / IMPLEMENTATION AUTHORIZED / LINUX STAGING VERIFICATION REQUIRED / PRODUCTION NOT AUTHORIZED

## 1. DISPOSITION

MCR accepts `BUILDER-to-MCR-001` as READY for specification review and accepts `DEP-SPEC-001 v0.1_WD` and `DEP-GAP-001 v0.1_WD` as the controlled implementation basis for `APP-RESTORE-SERVICE-DEP-001`, subject to the decisions and boundaries in this artifact.

No source defect is established by the return. BP-001 remains COMPLETE / ACCEPTED / CLOSED and frozen at baseline `e39f959fc6839c16c7c6cc75bd15079b4ed57a39`. The canonical Build Pack ZIP and its source snapshot must not be modified or republished by this assignment.

## 2. OPEN-ITEM DECISIONS

### 2.1 GAP-003 — Service Worker production packaging

**APPROVED FOR MINIMUM DEPLOYMENT-CONSTRUCTION CORRECTION INSIDE DEP-001 ONLY.** Builder may implement the minimum technically necessary packaging/registration correction required for the Service Worker to function from the built web artifact. It must not alter offline/product meaning, user workflow, API contract, lifecycle/state semantics, Role/authority, or accepted UX behavior. The frozen BP-001 source snapshot remains unchanged; exact delta and verification evidence are required.

### 2.2 GAP-005 — Authoritative time

For DEP-001 staging/runtime construction, **PostgreSQL server time is the authoritative time source** for obligation evaluation. Use database-derived time from the same PostgreSQL authority used by RESTORE_SERVICE persistence, with UTC session semantics preserved. Browser time, worker host local timezone, and external public NTP/provider APIs are not Product authority. Host clock synchronization is infrastructure hygiene, not semantic authority.

### 2.3 GAP-010 — Migration role versus application role / grants

**APPROVED SEPARATION.** Use a distinct migration role with DDL/migration authority and a least-privilege runtime application role. Post-migration grants must be explicit, reproducible, and limited to accepted runtime operations. Runtime processes may not retain migration/owner privileges. Builder owns exact grant construction and must prove it in staging. No Production credential or secret is authorized.

### 2.4 GAP-011 — Backup / rollback

**APPROVED WITH RESTORE-BASED ROLLBACK.** Disposable staging may be clean-recreated. Any non-disposable staging DB requires a verifiable pre-migration backup/checkpoint. Rollback defaults to restoring that checkpoint unless an accepted migration provides and verifies a safe reverse path. Do not invent destructive down-migrations. Include backup/restore evidence where applicable.

### 2.5 GAP-014 — Network / TLS / reverse proxy boundary

**LOOPBACK-ONLY FOR DEP-001 STAGING.** Application exposure binds to loopback only and preserves one same-origin Web/API behavior. No external reverse proxy, public TLS endpoint, DNS publication, Internet exposure, or external provider is authorized. Future LAN/UAT/external exposure requires separate authority.

### 2.6 GAP-006 — Non-production secrets injection boundary

**APPROVED EXTERNALIZED STAGING SECRETS.** No secret may be embedded in source, Build Pack, deployment artifact, manifest, or log. Staging configuration/secrets are externally supplied through host-controlled file/environment mechanics with restrictive permissions. `systemd EnvironmentFile` or equivalent Linux-native mechanism is allowed. Only placeholder/sample keys may be packaged.

## 3. ACCEPTED PROPOSED ENGINEERING MECHANICS

Subject to verification, MCR accepts: same-origin loopback API/static presentation; Debian 12 x64 or equivalent supported Linux x64 staging; Node 24.19.0/npm 11.17.0; unprivileged service account(s); versioned read-only artifact area separated from writable state/log/config; systemd or technically equivalent supervision; durable wrappers for four single-pass workers; explicit health/readiness/logging; PostgreSQL 17-family staging plus V001–V003 migrations; and version/hash/manifest DEP-001 artifact identity.

Builder retains engineering freedom for HOW these mechanics are realized provided accepted meaning and boundaries remain unchanged.

## 4. IMPLEMENTATION AUTHORITY

Builder is authorized to construct `APP-RESTORE-SERVICE-DEP-001` in a separate working area derived from the accepted frozen baseline. Builder may create deployment/bootstrap/runtime wrapper code and scripts; systemd definitions; external configuration templates and secret-injection mechanics without real secrets; API/static bootstrap and worker runners; necessary minimum DEP-001 source correction for executable application/SW packaging; a versioned deployment artifact; disposable/controlled staging PostgreSQL; staging migrations/verification; and deterministic technical fixes within accepted meaning.

STOP and return to MCR if resolving an issue requires changing Product/policy, data/migration semantics, API/interface, lifecycle/state, Role/authority, accepted UX, accepted runtime responsibility boundaries, or Production/real-data/provider/credential authority.

## 5. REQUIRED LINUX STAGING VERIFICATION

Actual clean controlled Linux x64 evidence is required before PASS:

- **V0:** artifact identity, manifest/hash, baseline lineage.
- **V1:** toolchain/dependency reproducibility.
- **V2:** PostgreSQL provisioning and migration execution.
- **V3:** migration validation plus backup/restore or disposable-recreate evidence.
- **V4:** external configuration/secrets fail-closed behavior and permission boundary.
- **V5:** API/static startup, same-origin web/API, health/readiness, and Service Worker packaging.
- **V6:** four worker runners under supervision and approved authoritative-time mechanism.
- **V7:** restart/recovery/logging and least-privilege runtime operation.
- **V8:** clean stop/restart/redeploy/restore evidence for Installer handoff.

Existing Build Pack evidence may be referenced, but Linux deployment PASS must rest on actual Linux execution evidence.

## 6. REQUIRED RETURN

Expected return: `BUILDER-to-MCR-002_RESTORE_SERVICE_DEP001_Implementation_and_Linux_Staging_Verification_Return_<PASS|STOP>_v1.0_CONTROLLED`.

A PASS includes artifact identity/location/size/SHA-256; delta from frozen baseline; manifest/hash ledger; host/toolchain evidence; V0–V8 matrix; migration/role/grant proof; authoritative-time and SW packaging proof; secrets-boundary proof with no secrets; supervision/health/logging/recovery evidence; Installer handoff; BP-001 unchanged confirmation; and remaining blockers if any.

## 7. PROHIBITIONS

No Production deployment/release activation; UAT activation without separate release; real operational data; Production secrets/credentials; external provider activation; public/LAN exposure beyond staging; canonical BP-001 mutation/republication; or semantic redesign of Product, policy, data, contract, lifecycle/state, Role/authority, or accepted UX.

## 8. STATE TRANSITION

`BUILDER-to-MCR-001 READY` → specification review complete → DEP-SPEC-001 / DEP-GAP-001 accepted with MCR decisions → `APP-RESTORE-SERVICE-DEP-001 IMPLEMENTATION ACTIVE` → expected `BUILDER-to-MCR-002 <PASS|STOP>`.

**Artifact = Authority. Chat = Notification Only.**
