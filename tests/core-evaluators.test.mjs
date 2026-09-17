import assert from "node:assert/strict";
import test from "node:test";
import { resolveActingContext } from "../dist/src/runtime/acting-context-resolver.js";
import { makeCandidate, makeResponsibility, makeServiceScope } from "../dist/src/simulator/fixture.js";

const scope = makeServiceScope();
const responsibility = makeResponsibility(scope);
const inputBase = { scopeRef: scope, requiredAuthorityRef: "AUTH-RS-A022", responsibility, allowStale: false };

test("TV-RS-022 exactly one lawful context -> EXACT_ONE", () => {
  const result = resolveActingContext({ ...inputBase, candidates: [makeCandidate(scope)] });
  assert.equal(result.kind, "EXACT_ONE");
});

test("TV-RS-023 multiple lawful contexts -> AMBIGUOUS", () => {
  const result = resolveActingContext({
    ...inputBase,
    candidates: [makeCandidate(scope), makeCandidate(scope, { contextRef: "CTX-002", personRef: "PERSON-002" })],
  });
  assert.equal(result.kind, "AMBIGUOUS");
});

test("TV-RS-024 no lawful context -> NONE", () => {
  const result = resolveActingContext({ ...inputBase, candidates: [] });
  assert.equal(result.kind, "NONE");
});

test("TV-RS-021 stale context is independently rejected", () => {
  const stale = makeCandidate(scope, { currentness: { status: "STALE", basisRef: "EV-OLD" } });
  const result = resolveActingContext({ ...inputBase, candidates: [stale] });
  assert.equal(result.kind, "NONE");
  assert.match(result.reason, /non_current/);
});

test("CCV-F02 invalid+current differs from valid+stale", () => {
  const invalidCurrent = makeCandidate(scope, {
    validity: { conditionRef: "COND-VALID", satisfied: false, evidenceRefs: ["EV-INVALID"] },
    currentness: { status: "CURRENT" },
  });
  const validStale = makeCandidate(scope, {
    validity: { conditionRef: "COND-VALID", satisfied: true, evidenceRefs: ["EV-VALID"] },
    currentness: { status: "STALE" },
  });
  const a = resolveActingContext({ ...inputBase, candidates: [invalidCurrent] });
  const b = resolveActingContext({ ...inputBase, candidates: [validStale] });
  assert.equal(a.kind, "NONE");
  assert.equal(b.kind, "NONE");
  assert.match(a.reason, /invalid/);
  assert.match(b.reason, /non_current/);
});
