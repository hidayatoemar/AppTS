# AppTS RESTORE_SERVICE construction kernel

Fresh implementation baseline compiled from the current verified AppTS Construction Compiler contract.

Current construction window: B0-B8 complete (skeleton, contract kernel, deterministic simulator, core evaluators, first clean RS-A-022 vertical slice, adverse/break cases, responsibility/handover/dependency/field contracts, verification/closure separation, external/provider reconciliation).

B5 exercises fail-closed behavior before expanding capabilities.

B6 preserves responsibility continuity and plural operational truth: handover initiation/acceptance does not transfer responsibility; only a governed confirmed-effective handover may transfer applicable responsibility; timeout/failure creates an intervention obligation; ACK/follow-up alone cannot release a dependency; Field COMPLETED does not establish restoration, Service Verification, or Purpose responsibility transfer.

B7 keeps Work Completed, material restoration, Service Verification, Customer Verification, Closure Eligibility, and Closure Decision as independent truth dimensions. Residual obligations remain independently live where governed.

B8 preserves the external-effect uncertainty boundary: provider completion is evidence/dependency progress only; insufficient external effect evidence holds automatic retry; reconciliation must match exact request identity and scope with current/integrity-sufficient evidence; a reconciled no-effect conclusion only enables fresh Gate/Enable/lawful-action reevaluation and never authorizes retry by itself. No canonical OUTCOME_UNKNOWN is introduced.

Next construction window: B9 durable LocalJsonlStore and authoritative AppendBatch recovery/replay.

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
- Escalation/assistance/Field/provider participation does not transfer Purpose responsibility.
- Blind external retry after uncertain effect is prohibited.
- Industry-informed, not industry-copied.
