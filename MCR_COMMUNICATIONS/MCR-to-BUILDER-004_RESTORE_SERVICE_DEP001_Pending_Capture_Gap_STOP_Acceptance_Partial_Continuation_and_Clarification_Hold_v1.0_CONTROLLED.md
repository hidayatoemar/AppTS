# APPTS — RESTORE_SERVICE DEP-001 PENDING-CAPTURE GAP STOP ACCEPTANCE, PARTIAL CONTINUATION, AND CLARIFICATION HOLD

**Comm ID:** MCR-to-BUILDER-004  
**Version:** v1.0_CONTROLLED  
**Date:** 14 August 2026 WIB  
**From:** MCR  
**To:** RESTORE_SERVICE Builder Team  
**Primary Response To:** BUILDER-to-MCR-003  
**Message Type:** STOP DISPOSITION / PARTIAL CONTINUATION / CROSS-LAYER CLARIFICATION HOLD  
**Status:** STOP ACCEPTED / PENDING-CAPTURE PATH HOLD / UNAFFECTED DEP-001 CONSTRUCTION MAY CONTINUE / FINAL LINUX PASS HELD / PRODUCTION NOT AUTHORIZED

## 1. Disposition

MCR accepts `BUILDER-to-MCR-003` as a valid authority STOP. Builder correctly refused to invent identities, metadata, payload referents, schema objects, or persistence meaning not established by accepted authority.

The STOP is not a Production/deployment failure and does not invalidate the accepted BP-001 baseline. BP-001 remains COMPLETE / ACCEPTED / CLOSED and frozen at baseline `e39f959fc6839c16c7c6cc75bd15079b4ed57a39`.

## 2. MCR review finding

Accepted Runtime technical design requires Offline Pending Capture to carry user/device context, local sequence, source time/offset/confidence, payload hash, and authorization-snapshot reference, with server synchronization validating current authority/context. CF-01 `pending_capture` requires `source_system_ref_id`, `subject_ref`, `captured_by_ref`, `capture_time`, `source_label_ref`, `provisional_payload_ref`, and `sync_status_ref`.

The constructed source surface identified by Builder does not expose enough typed context to establish these persistence meanings faithfully. This is a CROSS-LAYER CONSTRUCTION/BINDING GAP between Runtime intent, constructed capture contract, and persistence contract; MCR will not resolve it by inventing Product/data meaning.

## 3. Pending-capture path hold

Until controlled clarification: do not implement/persist `pending_capture` with fabricated/default identities; use dangling UUIDs; add V004 or modify V001–V003; reinterpret payload/source/subject/actor/disclosure/provenance/retention meaning; scope out accepted offline capture permanently; or claim pending-capture Linux PASS. Existing DEP-001 L1 work may be preserved.

## 4. Partial continuation authority

Builder may continue deterministic work independent of pending-capture persistence: configuration/observability; API/static bootstrap, same-origin loopback hosting, health/readiness, and minimum Service Worker packaging correction; worker runner/supervision; authorized staging-only outbox and diagnostic simulations; PostgreSQL provisioning, separate migration/runtime roles, V001–V003 validation, backup/restore; fully determined SQL translations; service definitions, external staging configuration, logging, recovery, artifact manifest/hash mechanics; and unaffected Linux evidence.

## 5. Final verification state

V0–V8 final DEP-001 PASS is HELD until pending-capture binding is resolved. Partial evidence may be accumulated with exact lineage. No complete V5–V8, Installer handoff, UAT, or Production readiness claim is authorized while this hold remains open.

## 6. Parallel clarification

MCR is issuing AppTS DS a bounded clarification assignment for the faithful mapping between Runtime pending-capture context and CF-01 V001–V003 persistence. Builder must not pre-empt it with a local design decision.

## 7. Return / communication

No routine formal return is required solely for unaffected continuation. Builder may preserve evidence. If another genuine authority blocker is encountered in unaffected work, Builder may issue a new STOP return. MCR will issue a later continuation instruction after clarification.

## 8. Prohibitions

No Production/release/UAT activation, real operational data, Production secrets/credentials, external provider activation, public/LAN exposure outside controlled staging, canonical BP-001 mutation/republication, or schema/data/Product/authority invention.

## 9. State transition

`BUILDER-to-MCR-003 STOP` → STOP ACCEPTED → PENDING-CAPTURE PATH HOLD → UNAFFECTED DEP-001 CONSTRUCTION ACTIVE → DS BOUNDED CLARIFICATION ACTIVE → FINAL DEP-001 PASS HELD PENDING MCR FOLLOW-UP.

**Artifact = Authority. Chat = Notification Only.**
