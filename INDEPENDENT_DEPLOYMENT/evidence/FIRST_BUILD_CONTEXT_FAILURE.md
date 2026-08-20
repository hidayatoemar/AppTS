# Independent Deployment Experiment — First Build-Context Failure Evidence

Status: PRESERVED EXPERIMENTAL EVIDENCE ONLY

## Baseline binding
- Repository: hidayatoemar/AppTS
- Independent experiment branch: experiment/independent-restore-deploy
- Common comparison anchor: 40abd7dacfad803429d1663f76976ce15038b8a6
- Failed deploy trigger commit: 5e0d65960a50ed01ef9b731e36966f20670d7073
- Failed GitHub Actions run: 32373990095
- Frozen DEP-001 source in this branch remained semantically unchanged before the failure.

## Exact failed gate
Command executed by deployment harness on the independent non-production target:

    docker compose -f compose.yaml --env-file .env up -d --build

Docker build then failed at Dockerfile.dep build stage:

    RUN npm run build:dep --workspace=apps/api

## Exact observed failure

    error TS5083: Cannot read file '/workspace/packages/contracts/tsconfig.json'.
    src/routes/ui-pending-captures.ts(5,8): error TS2307: Cannot find module '@appts-restore-service/contracts' or its corresponding type declarations.
    tsconfig.json(16,5): error TS6053: File '/workspace/packages/contracts' not found.

Docker reported:

    failed to solve: process "/bin/sh -c npm run build:dep --workspace=apps/api" did not complete successfully: exit code: 2

## Causal diagnosis
Dockerfile.dep copied `packages/contracts/package.json` for dependency installation, but the build stage did not copy the actual `packages/contracts` source tree before TypeScript project build. The API tsconfig/reference therefore resolved a path that did not exist inside the build container.

## Classification
DEPLOYMENT / BUILD-CONTEXT MECHANICAL FAILURE.

This evidence does not change formal AppTS state and does not authorize Product, API, UI, schema, business, verifier, role, policy, seed, loader, or trial-data changes.
