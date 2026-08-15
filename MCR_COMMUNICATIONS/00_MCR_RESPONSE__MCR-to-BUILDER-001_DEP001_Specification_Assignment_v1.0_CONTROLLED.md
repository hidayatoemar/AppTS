# APPTS — MCR FORMAL COMMUNICATION

**Document ID:** MCR-to-BUILDER-001  
**Title:** RESTORE_SERVICE Post-Verification Acknowledgement and DEP-001 Specification Assignment  
**Version:** v1.0 CONTROLLED  
**Date:** 14 August 2026 WIB  
**Authority:** Project Director / Architect → MCR → Builder Team  
**Recipients:** Hasan / Adit — Builder Team  
**Response To:** POST_VERIFICATION_FINDINGS.md and MCR_DECISION_REQUEST_POST_VERIFICATION.md  
**Status:** ACTIVE / DEP-001 SPECIFICATION-ONLY / NO SOURCE MUTATION / NO DEPLOYMENT ACTIVATION

## 1. Acknowledgement

MCR acknowledges receipt and review of the two Builder working records in the new Builder working folder:

- `POST_VERIFICATION_FINDINGS.md`
- `MCR_DECISION_REQUEST_POST_VERIFICATION.md`

The records are useful engineering input. They remain working evidence and do not by themselves change project authority or accepted state.

MCR appreciates the fail-closed treatment used by Builder: verified items were separated from not-verified and absent/missing items, and the frozen source snapshot was not mutated.

## 2. BP-001 State Clarification

The canonical `APP-RESTORE-SERVICE-BP-001` remains **COMPLETE / ACCEPTED / CLOSED** under existing MCR acceptance.

Builder's current working copy may contain additional Docker verification tooling and RETURN documents. This does not reopen or invalidate the accepted canonical BP-001 ZIP, hash, or manifest.

Do not regenerate, replace, or republish the canonical BP-001 as part of this assignment unless a later explicit MCR instruction says so.

## 3. Disposition of Post-Verification Findings

For current control purposes, MCR classifies the following as deployment-readiness / runtime-construction findings requiring bounded follow-up, not automatically as defects in the accepted Product meaning:

- runnable HTTP/API process not yet established by the current source evidence reviewed by Builder;
- worker scheduling/process-runner mechanics not yet established;
- runtime configuration loading/binding not yet established;
- operational PostgreSQL provisioning/migration execution not yet verified in this Builder session;
- production-style web hosting / Service Worker deployment mechanics not yet verified;
- Linux runtime/deployment mechanics require actual Linux evidence.

Builder shall preserve the distinction:

`SOURCE DEFECT / DESIGN CONFLICT` is not the same as `DEPLOYMENT CONSTRUCTION ELEMENT MISSING` and is not the same as `NOT YET VERIFIED`.

If evidence is insufficient, record the item as **OPEN / NOT VERIFIED** rather than inferring a defect.

## 4. MCR Decision on DEP-001

MCR authorizes creation/use of a separate working package identity:

`APP-RESTORE-SERVICE-DEP-001`

for **SPECIFICATION AND DEPLOYMENT-CONSTRUCTION PREPARATION ONLY**.

This authorization does **not** yet authorize:

- mutation of the accepted frozen source snapshot;
- implementation of a new runtime topology not supported by accepted design;
- deployment to Production;
- use of real operational data;
- use/disclosure of Production secrets or credentials;
- activation of external providers or integration endpoints;
- registry publication as a Production release;
- UAT or Production activation.

## 5. Primary Objective

Produce a deployment-construction specification that bridges:

accepted source/build baseline → runnable Linux-oriented runtime/deployment package → Installer-consumable artifact

without changing Product meaning, lifecycle/state semantics, Role/TWT, authority model, data meaning, interface contract, or accepted operational intent.

## 6. Required Outputs

Builder shall produce at minimum:

1. **DEP-SPEC-001** — RESTORE_SERVICE Deployment Construction Specification v0.1_WD
2. **DEP-GAP-001** — Deployment Gap / Evidence / Decision Register v0.1_WD
3. **Formal return** — `BUILDER-to-MCR-001_RESTORE_SERVICE_DEP001_Specification_Return_<READY|STOP>`

The specification should be self-contained enough that MCR can review it without navigating many cross-references. Source references may be retained in a traceability appendix, but the main engineering narrative should state the relevant requirement/meaning directly.

## 7. Required DEP-SPEC-001 Content

Cover at least:

1. Process/runtime map: web/static runtime; API/application process; durable worker processes; PostgreSQL; and their relation. Label each as **SOURCE-BOUND / ACCEPTED DESIGN-BOUND**, **PROPOSED ENGINEERING MECHANIC**, **OPEN / REQUIRES DECISION**, or **NOT VERIFIED**.
2. Linux target: proposed supported Linux x64 environment; Node.js runtime binding; package/build/runtime prerequisites; filesystem/permission considerations; service/process lifecycle expectations. Linux preference does not equal Linux PASS.
3. Runtime configuration and secrets boundary: required configuration; proposed source; environment-specific inputs; secrets/external values; fail-closed missing-configuration behavior. Do not place real secrets in the specification.
4. PostgreSQL provisioning and migration mechanics: instance prerequisites; accepted PostgreSQL major-family compatibility; migration sequence; privilege separation; backup/checkpoint expectations; verification evidence.
5. Web/API exposure: proposed hosting mechanics; proposed listener/reverse-proxy/service boundary; health/readiness; no Production hostname/TLS/provider assumption unless explicitly **PROPOSED / OPEN**.
6. Worker execution: how accepted durable worker functions run/schedule; start/stop/restart; crash/retry/durable-obligation expectations; evidence against silent loss or duplicate semantic effect.
7. Operability: start/stop/restart; logs; health/readiness; monitoring hooks; failure visibility; rollback/cleanup; artifact/config identity.
8. Staging / loopback Linux verification plan: clean environment; install/deploy; DB migration test; processes; health; smoke; worker evidence; restart/recovery; stop/cleanup; captured evidence.
9. Installer handoff boundary: what DEP-001 Builder constructs/freezes versus what Installer Team installs/configures/operates.

## 8. Engineering Freedom / No-Ping-Pong Rule

Within this specification assignment, Builder may inspect accepted source/build baseline and admitted manuals; use non-destructive local Docker tooling; propose concrete Linux deployment mechanics, service/process wrappers, configuration, DB provisioning, logging/monitoring hooks, and packaging structure; and select reasonable HOW options when Product/design meaning does not prescribe them. State such choices briefly and mark them **PROPOSED** until MCR accepts the specification.

STOP / ESCALATE only when accepted meaning is ambiguous/contradictory; a solution would change lifecycle/state/Role/TWT/authority/data/interface meaning; a dependency/topology materially changes accepted architecture; source mutation is needed before specification acceptance; Production/data/secrets/provider authority would be crossed; or evidence proves the accepted requirement cannot be met within boundary.

## 9. Working Folder and Return

The Builder-created folder may remain the working surface for this handshake cycle. Use its `RETURN` folder for the Builder formal return and supporting working evidence. Chat/WA may be used for notification and short clarification. Formal project state changes only through artifacts.

## 10. Current MCR Expectation

Do not implement DEP-001 source/runtime changes yet. First return the specification package **READY** or **STOP**. If READY is accepted, the next authority may activate bounded DEP-001 implementation and Linux runtime verification without reopening BP-001.

**Artifact = Authority. Chat = Notification Only.**
