# Build and Verification Gates

Run from SOURCE_SNAPSHOT/RESTORE_SERVICE.

## Prerequisite

Use an isolated working copy and install dependencies from the included lockfile:

    npm ci --ignore-scripts --no-audit --no-fund

## Required gate surface

    npm run verify:toolchain
    npm run verify:boundaries
    npm run typecheck
    npm run build
    npm run test:contracts
    npm run test:integration
    npm run test:dg04
    npm run test:adverse

When the included environment supports the disposable loopback database verification, also run the included DB verification surface and record its outcome. Do not connect to any real or production database.

## Gate interpretation

PASS requires successful completion of all applicable commands, no semantic/contract boundary breach, and no generated/transient residue presented as source change. A missing dependency, local tool issue, or packaging issue may be repaired in the extracted copy. STOP is required only if repair would cross a protected authority boundary or the baseline cannot be trusted.
