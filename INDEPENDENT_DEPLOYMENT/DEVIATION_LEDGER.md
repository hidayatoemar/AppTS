# Independent Deployment Experiment — Deviation Ledger

Status: EXPERIMENTAL EVIDENCE ONLY

## D-001 — Missing contracts source in Docker build context

- Baseline condition: Dockerfile.dep copies `packages/contracts/package.json` but does not copy the `packages/contracts` source tree into the build stage before API TypeScript build.
- Failure: TS5083 cannot read `/workspace/packages/contracts/tsconfig.json`; TS2307 cannot find module `@appts-restore-service/contracts`; TS6053 reports `/workspace/packages/contracts` not found.
- Causal diagnosis: build-context omission; required referenced TypeScript workspace source is absent inside Docker build stage.
- Minimum change: `COPY packages/contracts packages/contracts`
- Classification: Docker/build context — purely mechanical deployment wiring.
- Product change: NO.
- Formal state change: NO.
- Rerun result: PENDING.

No Hasan/Adit troubleshooting commit is imported or cherry-picked. Corrections are independently derived from reproduced evidence.
