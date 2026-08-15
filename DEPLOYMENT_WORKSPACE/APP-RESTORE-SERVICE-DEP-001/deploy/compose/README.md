# DEP-001 partial Compose artifact

**Evidence label:** `MCR-004/G6: DEP-001 / STAGING SIMULATION / NON-PRODUCTION / COMPOSE STATIC-ONLY / PASS_PARTIAL_HELD`

This is a non-production, static-only staging simulation artifact. It is not a
final V0–V8 release and makes no claim of database migration, role grant,
business API, worker, integration, UAT, or production readiness.

## Scope and hold

The Compose file contains only `api` and `postgres` on exactly two user-defined
bridge networks. `dep-ingress` is non-internal and API-only; `dep-db-internal`
is internal and shared only by API and PostgreSQL. Only the API is published,
and only on loopback at `127.0.0.1:8080`. The API entrypoint requires the exact
staging label before starting the bounded static bootstrap. The PostgreSQL
healthcheck uses `pg_isready` only; it proves that the server accepts connections
and does not prove schema, migration, grant, or application readiness.

Pending capture/business API work, DB bootstrap/migration/grant work, worker
activation, and all final release/UAT evidence remain held under
`PASS_PARTIAL_HELD`. No Compose command invokes those held operations.

## G6 crash-once harness (test-only)

`compose.g6-crash-once.test.yaml` is a separate test-only override. It requires
the explicit `g6-crash-test` profile and changes only the API entrypoint plus
the crash-once test sentinel. The normal `compose.yaml`, `.env.template`, and
`entrypoint.sh` do not reference that sentinel and remain the normal staging
path.

On its first launch, the wrapper starts the normal entrypoint as a child,
waits boundedly for container-local `/healthz`, atomically creates a marker only
under container-local `/tmp`, terminates the known child, waits for it, and
exits nonzero. Docker restart then sees the marker and delegates directly to
the normal entrypoint. No host or named marker volume is used. This harness
requires teardown and provides no runtime PASS evidence; it remains
`PASS_PARTIAL_HELD`.

```sh
docker compose -f deploy/compose/compose.yaml -f deploy/compose/compose.g6-crash-once.test.yaml --profile g6-crash-test up -d
docker compose -f deploy/compose/compose.yaml -f deploy/compose/compose.g6-crash-once.test.yaml --profile g6-crash-test ps
docker compose -f deploy/compose/compose.yaml -f deploy/compose/compose.g6-crash-once.test.yaml --profile g6-crash-test down --remove-orphans
```

## Safe local inspection and run

Supply the names in `.env.template` through an external environment or an
uncommitted local env file. Never paste credentials into this repository or
print the resolved Compose configuration.

```sh
docker compose -f deploy/compose/compose.yaml config --quiet
docker compose -f deploy/compose/compose.yaml build --pull
docker compose -f deploy/compose/compose.yaml up -d
docker compose -f deploy/compose/compose.yaml ps
curl --fail http://127.0.0.1:8080/healthz
docker compose -f deploy/compose/compose.yaml down
```

These commands are for an isolated local/staging simulation only. Do not bind
the API to a public or LAN address.
