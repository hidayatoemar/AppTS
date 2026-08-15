# Executor Contract

## Permitted

The Builder may inspect, build, typecheck, test, and make minimum technically necessary corrections in its own extracted working copy when the accepted meaning and contracts remain preserved.

## Must not change without authority

- Product or policy meaning;
- data meaning, schemas, and migration semantics;
- interface/contract meaning;
- lifecycle/state semantics;
- Role/authority or accepted UX behavior;
- runtime architecture/topology;
- production, external-provider, real-data, credential, or secret boundaries.

## Tool-agnostic environment

A current Node.js/npm toolchain able to honor the included lockfile is required. Use the package scripts and included tools; do not rely on a Codex-specific path or permanent machine configuration. PostgreSQL/Flyway verification, if performed, must be disposable and loopback-only; no production database or credentials are required.

## Builder responsibility

The Builder owns technical execution. This Build Pack owns accepted meaning and acceptance boundaries. Record every change and verification result in the supplied return template.
