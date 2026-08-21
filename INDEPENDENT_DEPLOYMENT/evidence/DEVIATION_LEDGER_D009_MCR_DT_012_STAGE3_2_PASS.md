# D-009 — MCR-to-DT-012 admitted CODEX049 transfer, Stage 3.2 runtime/browser/recovery completion

Status: EXPERIMENTAL EVIDENCE ADDENDUM / NON-PRODUCT
Authority: MCR-to-DT-012_RESTORE_SERVICE_CODEX061_PASS_Acceptance_CODEX049_Transfer_Admission_Stage3_2_Resume_and_Browser_User_Learning_Flow_Completion_v1.0_CONTROLLED
Disposition: PASS

## 1. Admitted transfer and source identity

- Accepted application base: `7a813276bf5e4d5e73a48cc6276141f3b9b4d0c5`.
- Immutable transfer: `CODEX049_DT_TRANSFER_v1.0_CONTROLLED.zip`.
- Drive File ID: `1ITEOnJkPDIDn9ZlGPVEB_EktxYYDJW4w`.
- Size: `14,478` bytes.
- Transfer SHA-256: `1a8b6a65cdc565f1d02976841def8cec81024839f635a26a364d6f7b950b5aa3`.
- Admitted overlay SHA-256 identities:
  - `apps/api/src/trial/pre-ticket-trial-owner-flow.ts` = `fa6a57a4bb50fdd63884d86ce43fe2b18137c3c0b0554b2b990d57d2771c6106`.
  - `deploy/db/grant-runtime.sh` = `41b48d45bb88c7e510a88235840b8601658d08e5347e9f7660419f7efc321f0f`.
  - `tests/dep001/idempotency-minimum-runtime-writer.test.mjs` = `cba0366d557510b456e725198a38297dad30f5f1d2421e3f381ed032887ee32f`.
- Deterministic transfer harness verified transfer ZIP hash, package `SHA256SUMS`, exact post-copy overlay hashes, and constrained application source delta to the admitted paths only.
- Accepted-base to closing-head comparison shows the only application-workspace source delta is the three admitted CODEX049 paths above. `package-lock.json` and frozen V001–V004 migration files are absent from the diff and therefore remain unchanged from the accepted base.
- Closing branch evidence head after final deployed-identity observer: `8ab8cc2c6d5b175f485fe3f6287ade25157e2032`; commits after application proof are DT request/harness/evidence-only unless explicitly listed above.

## 2. Bounded DT harness corrections

The following corrections were performed only inside DT deployment/test harness surfaces and did not alter Product/API/UI/schema/business/lifecycle/Role/authority/policy semantics:

- status observer DATABASE_URL parsing changed to deterministic `u.pathname.slice(1)` after a regex-serialization failure;
- HTTP proof Jinja field access changed from `.keys` to bracket notation to avoid collision with the dictionary method;
- persistence observer added explicit UUID/text casts matching the frozen schema (`idempotency_key uuid`, `durable_result_ref text`);
- browser proof used headless Chrome through the existing SSH local-forward access path and later added restart/recovery verification;
- final status observer added read-only hashes of the three deployed overlay files plus Compose image identity output.

No Product source correction outside the admitted overlay was performed.

## 3. Current-head build/test/architecture verification

GitHub Actions run: `32537787080`.
Artifact ID: `9466001726`.
Artifact SHA-256: `0df9a7c5141a3e5e9b4dc9a150ac4ef7d6de1defff6730387a0fd8b69fd6eae7`.
Controlled toolchain: Node `24.19.0`, npm `11.17.0`.

Results:
- architecture boundary = PASS;
- full typecheck/build = PASS;
- contracts/integration/DG04/adverse/unit/NFR = PASS;
- DEP TypeScript suite = PASS;
- CODEX049 focused writer/idempotency test = PASS;
- `code_verify_rc=0`.

## 4. Actual runtime identity and least-privilege contract

Final deployed-identity/status run: `32538254558`.
Trigger commit: `f3ef97d0bf78c8b90c026591dda78b1d0fbed824`.
Artifact ID: `9466147207`.
Artifact SHA-256: `8cf592f13b40b56dcdab7c93d2b9ca88a83fec0cd6496fb18ae6e196d3b19a78`.

Runtime identity:
- install root: `/opt/appts-independent-restore-service`;
- API access: loopback `127.0.0.1:8080`;
- database: `appts_dep001_independent`;
- API `DATABASE_URL` user: `appts_runtime`;
- observed PostgreSQL current user: `appts_runtime`;
- API Compose image ID: `180700c15061`;
- PostgreSQL Compose image ID: `07edf880f0cf`;
- PostgreSQL pinned image: `postgres:17.11-bookworm@sha256:07edf880f0cf3f742c990d23faf92cb19e84923a8bce30f7d8e1a8ab63cae7b3`.

Direct deployed-host overlay hashes matched the MCR-admitted values exactly for all three files.

Final effective `appts_runtime` privilege evidence:
- role flags: `false|false|false|false|false|false|true`;
- role membership count: `0`;
- DB CONNECT=true; TEMPORARY=false;
- schema `appts`: USAGE=true, CREATE=false;
- schema `appts_sys`: USAGE=false;
- `intake_cue`: INSERT=true; SELECT/UPDATE/DELETE/TRUNCATE=false;
- `source_observation`: INSERT=true; SELECT/UPDATE/DELETE/TRUNCATE=false;
- `idempotency_ledger`: SELECT=true; INSERT=true; UPDATE/DELETE=false.

No role switching, SECURITY DEFINER, superuser use, migration-role substitution, or privilege broadening was used for the runtime proof.

## 5. Fresh HTTP runtime behavior proof

GitHub Actions run: `32536408423`.
Artifact ID: `9465565589`.
Artifact SHA-256: `509178446c1552d5af1a47698247aabe4669207a16b2b52d3e06676594a64e6d`.
All mutating Trial requests used `POST /api/v1/ui/intents` through the running API bound to actual `appts_runtime`.

Sequential fresh-key result:
- first request = `CREATED`;
- assessment = `NOT_ACCEPTABLE`;
- decision = `HOLD_AS_PRE_TICKET`;
- identical same-key replay = `IDEMPOTENT_REPLAY` with the same case;
- conflicting same-key changed content = `CONFLICT_HOLD`.

Identical concurrency:
- 1 `CREATED`;
- 7 `IDEMPOTENT_REPLAY`;
- 0 conflict;
- one durable case identity.

Mixed same-key concurrency after seed:
- 4 `IDEMPOTENT_REPLAY`;
- 4 `CONFLICT_HOLD`;
- 0 additional `CREATED`.

Independent postcondition readback for the three fresh durable outcomes:
- pre_ticket_case = 3;
- HOLD_AS_PRE_TICKET = 3;
- source_observation = 3;
- intake_cue = 3;
- idempotency ledger mapping = 3;
- admission assessment = 3;
- intake decision = 3;
- ticket_identity = 0;
- ticket_formation_record = 0;
- runtime_ticket = 0.

## 6. Browser next-consumer and restart/recovery proof

GitHub Actions run: `32536693248`.
Artifact ID: `9465659829`.
Artifact SHA-256: `65142604ba3c5d958dc20ec5112251f56fdf44c7ba8eb144f0ad1b1b1e997c32`.
Browser: Google Chrome `151.0.7922.137` through SSH local forwarding to the loopback Trial service; no public ingress or security-policy broadening was introduced.

Fresh browser-flow case: `7d9871c9-e4e1-4020-8322-fa7abe92cc11`.

Rendered proof:
- Work Queue displayed zero runtime Tickets before and after the fresh flow;
- Intake rendered the fresh case;
- case state rendered `HOLD_AS_PRE_TICKET`;
- assessment rendered `NOT_ACCEPTABLE`;
- completeness rendered `MISSING / INCOMPLETE_MANDATORY_FACTS`;
- user-next-consumer learning flow therefore shows clearly that the pre-Ticket case is not a Ticket.

Restart/recovery proof:
- Compose `postgres + api` restarted without volume reset;
- `/readyz` returned ready after restart;
- case count remained `14`;
- browser-flow case `7d9871c9-e4e1-4020-8322-fa7abe92cc11` remained present and rendered with the same state;
- Work Queue remained zero Ticket.

## 7. Final health/state observer

Final deployed-identity/status run `32538254558` confirmed:
- `/healthz` = `ok`;
- `/readyz` = `ready`;
- browser root HTTP status = `200`;
- Work Queue view `UX-RS-01` with `ticket_count=0`;
- Intake view `UX-RS-02` with `case_count=14`;
- browser-flow case remains `HOLD_AS_PRE_TICKET / NOT_ACCEPTABLE / MISSING / INCOMPLETE_MANDATORY_FACTS`;
- exact deployed overlay hashes = PASS;
- API/DB runtime identity = `appts_runtime`;
- exact least-privilege assertions = PASS;
- both API and PostgreSQL containers = healthy.

## 8. Preserved boundaries

- Production: NOT USED / NOT AUTHORIZED.
- UAT: NOT USED / NOT AUTHORIZED.
- Real operational data: NOT USED.
- Hasan/Adit staging: NOT MODIFIED / NOT IMPORTED.
- Manual canonical business-state SQL INSERT/UPDATE: NOT USED for Trial behavior proof.
- Direct canonical Ticket manufacture: NOT PERFORMED.
- Schema/migration semantic change: NONE; V001–V004 unchanged.
- Product/API/UI/business/lifecycle/Role/authority/policy semantic change beyond admitted overlay: NONE.
- Security-policy broadening: NONE.
- New runtime role, SECURITY DEFINER, role switching, or extra privilege: NONE.
- Build Pack mutation: NONE; Build Pack remains frozen.

## 9. DT disposition

All bounded MCR-to-DT-012 Stage 3.2 gates required for transfer identity, source application, current-head verification, actual least-privilege runtime behavior, fresh/replay/conflict/concurrency, durable persistence, zero-Ticket boundary, browser next-consumer proof, restart/recovery durability, and deployed source/runtime reproducibility are PASS.

DT disposition: `PASS`.
Next formal communication: `DT-to-MCR-007_RESTORE_SERVICE_CODEX049_Transfer_Application_Stage3_2_Cloud_Deployment_Browser_Access_and_User_Learning_Flow_Completion_Return_PASS_v1.0_CONTROLLED`.
Post-return room state: `WAIT MCR` pending MCR disposition.
