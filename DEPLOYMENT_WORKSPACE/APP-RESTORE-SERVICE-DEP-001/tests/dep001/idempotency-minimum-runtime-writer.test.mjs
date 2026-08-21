import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const source=await readFile(new URL("../../apps/api/src/trial/pre-ticket-trial-owner-flow.ts",import.meta.url),"utf8");
const grants=await readFile(new URL("../../deploy/db/grant-runtime.sh",import.meta.url),"utf8");
test("idempotency serialization no longer requires ledger UPDATE privilege",()=>{assert.match(source,/pg_advisory_xact_lock\(\$1::bigint\)/);assert.match(source,/READ COMMITTED/);assert.doesNotMatch(source,/idempotency_ledger[^\n]*FOR UPDATE/);});
test("MCR049 writer completion is INSERT-only for exactly the two authorized tables",()=>{assert.match(grants,/GRANT INSERT ON TABLE\s+appts\.intake_cue, appts\.source_observation\s+TO :"runtime_role";/s);assert.equal((grants.match(/appts\.intake_cue/g)??[]).length,1);assert.equal((grants.match(/appts\.source_observation/g)??[]).length,1);assert.doesNotMatch(grants,/SECURITY DEFINER/i);});
