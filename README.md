# AppTS RESTORE_SERVICE construction kernel

Fresh implementation baseline compiled from the current verified AppTS Construction Compiler contract.

Current construction window: B0-B4 (skeleton, contract kernel, deterministic simulator, core evaluators, first clean RS-A-022 vertical slice).

This repository intentionally does **not** import Trial #2 domain/workflow semantics. Historical Git history remains available for archaeology only.

## Build and test

```bash
npm run build
npm test
```

Runtime dependencies for the bounded kernel: none.

## Guardrails

- No mega-status.
- Authentication/UI selection does not create authority.
- Command != execution != material effect != verification != closure.
- Replay safety is implementation idempotency, not canonical `DUPLICATE` meaning.
- No canonical `OUTCOME_UNKNOWN` or `RESTART` state.
- Scope siblings remain independent.
- Industry-informed, not industry-copied.
