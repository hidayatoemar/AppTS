import assert from "node:assert/strict";
import test from "node:test";
import { decideRetry, isSemanticSuccess, openInteraction, resolveReplay, resolveSource, transitionInteraction, type InteractionJournal } from "../../packages/adapters-d05/src/index.ts";
import { validateBoundedInteractionRequest } from "../../packages/contracts/src/index.ts";

const journal = (state: InteractionJournal["state"]): InteractionJournal => ({ interactionIdentity: "i", journalId: "j", payloadHash: "h", attemptCount: 1, state, lastTransitionAt: "2026-08-11T00:00:00Z", ...(state === "UNCERTAIN" || state === "RECONCILIATION_PENDING" ? { reconciliationCaseId: "recon" } : {}) });

test("transport acceptance is not semantic success", () => { assert.equal(isSemanticSuccess(journal("TRANSPORT_ACCEPTED")), false); assert.equal(isSemanticSuccess(journal("QUALIFIED_RESULT")), true); });
test("uncertain adapter result requires reconciliation and prohibits blind retry", () => { assert.equal(decideRetry(journal("UNCERTAIN"), false), "RECONCILIATION_REQUIRED"); assert.equal(decideRetry(journal("FAILED"), false), "NO_RETRY"); assert.equal(decideRetry(journal("FAILED"), true), "RETRY_ALLOWED"); });
test("duplicates and source/profile absence fail closed", () => { assert.equal(resolveReplay(journal("FAILED"), "i", "h"), "IDENTICAL_REPLAY"); assert.equal(resolveReplay(journal("FAILED"), "i", "different"), "CONFLICTING_REPLAY"); assert.deepEqual(resolveSource(undefined, undefined), { status: "NO_EFFECT", reason: "SOURCE_UNAVAILABLE" }); });
test("reconciliation state cannot exist without a durable case", () => { assert.throws(() => transitionInteraction(journal("FAILED"), "UNCERTAIN", "2026-08-11T01:00:00Z"), /RECONCILIATION_CASE_REQUIRED/); });
test("INT-RUN-TD-02 bounded request is consumed through the accepted public contract", () => { const request = { interaction_identity: "i", source_system_ref_id: "source", adapter_profile_ref_id: "profile", subject_ref: "subject", request_ref: "request", requested_at: "2026-08-11T00:00:00Z" }; const opened = openInteraction(request, validateBoundedInteractionRequest(request), "journal", "hash"); assert.equal(opened.state, "REQUESTED"); });
