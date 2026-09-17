# AppTS RESTORE_SERVICE construction kernel

Fresh implementation baseline compiled from the current verified AppTS Construction Compiler contract.

Current construction window: B0-B6 complete (skeleton, contract kernel, deterministic simulator, core evaluators, first clean RS-A-022 vertical slice, adverse/break cases, responsibility/handover/dependency/field contracts).

B5 deliberately exercises fail-closed behavior before expanding capabilities. The suite covers ambiguous/no Acting Context, stale/integrity failures, dependencies, Gate/Enable blocking, replay conflicts, NO_EFFECT vs FAILED, sibling-scope isolation, bounded-machine pre-authorization, and stale Situation Responsibility.

B6 preserves responsibility continuity and plural operational truth: handover initiation/acceptance does not transfer responsibility; only a governed confirmed-effective handover may transfer applicable responsibility; timeout/failure creates an intervention obligation; ACK/follow-up alone cannot release a dependency; Field COMPLETED does not establish restoration, Service Verification, or Purpose responsibility transfer.

Next construction window: B7 verification / closure separation.

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
- Bounded machine execution requires explicit pre-authorization.
- Consequential action fails closed when Situation Responsibility is not current.
- Escalation/assistance/Field participation does not transfer Purpose responsibility.
- Industry-informed, not industry-copied.
