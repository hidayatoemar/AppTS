# CF06 hold and non-authority state

## Current authority

`MCR-CODEX-B07-D020` authorizes only CF06-B08 release-candidate documentation assembly and its PASS-only local commit. It does not grant any authority beyond that bounded documentation result.

## Explicitly not authorized

- production, deployment, release activation, remote Git, or history rewrite;
- real data, real credentials, secrets, provider calls, or external listeners;
- semantic changes to Product, data, interfaces, state/lifecycle, Role/responsibility, authority, policy, UX, runtime meaning, dependencies, or topology;
- mutation of accepted B07 implementation merely to make the manifests agree.

## Hold state

CF06-B00 and CF06-B07 are COMPLETE / ACCEPTED / CLOSED. CF06-B08 is limited to this release-candidate assembly. Any later IV CF07, production, deployment, or operational activation requires a new explicit MCR authority.

## Evidence scope

The disposable PostgreSQL 17.9/Flyway 13.0.0 environment referenced by B07 was loopback-only, used no real data, made no persistent Windows/system configuration change, and was stopped after verification. It is evidence only; it is not a runtime service, deployment, or production authorization.
