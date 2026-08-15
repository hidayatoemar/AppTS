# BUILDER-to-MCR-006 — RESTORE_SERVICE DEP-001 PENDING CAPTURE IMPLEMENTATION AND LINUX STAGING VERIFICATION RETURN

**Comm ID:** BUILDER-to-MCR-006
**Version:** v1.0_CONTROLLED
**Date:** 15 Agustus 2026 WIB
**From:** RESTORE_SERVICE Builder Team (Hasan Muhammad)
**To:** MCR (Project Director / Architect)
**Primary Response To:** MCR-to-BUILDER-006 (otorisasi implementasi jalur pending capture: contract, adapters-d05, persistence SQL repo, API route, test suite)
**Message Type:** IMPLEMENTATION RETURN / LINUX STAGING EVIDENCE
**Status:** `PASS — semua gate non-DB lulus di Docker Linux amd64 / grant-runtime dan test:migrations tetap HELD`

---

## 1. Ringkasan Eksekusi

Builder menyelesaikan seluruh konstruksi yang diotorisasi MCR-to-BUILDER-006 untuk jalur pending capture (`APPTS.RUNTIME.D05.PENDING_CAPTURE_SYNC / 1.0.0`). Semua 8 gate non-DB (`verify:toolchain`, `verify:boundaries`, `typecheck`, `build`, `test:contracts`, `test:integration`, `test:dg04`, `test:adverse`, `test:unit`, `test:nfr`) lulus di Docker Linux amd64 (`node:24.19.0-bookworm-slim`). Gate `test:migrations` tidak dijalankan — memerlukan `APPTS_B01_DISPOSABLE_DB=true` dan instance PostgreSQL 17.x hidup (gate terpisah di luar lingkup sesi ini).

---

## 2. Environment Eksekusi

- **OS / shell:** Windows 11 Pro 10.0.26200 / PowerShell 7 (host); Debian bookworm-slim (container eksekusi)
- **Node/npm:** Node v24.19.0 / npm 11.17.0 — dijalankan di dalam Docker container `node:24.19.0-bookworm-slim`. Host tidak dimodifikasi.
- **TypeScript:** 6.0.3
- **Docker Compose file:** `docker-compose.dep.yml` (root BP-001); service `verify-dep`; named volume `node_modules_dep` terpisah dari BP-001.
- **Database:** Tidak dijalankan — gate `test:migrations` memerlukan disposable PostgreSQL 17.x; dikarantina sebagai gate terpisah.

---

## 3. Pekerjaan yang Dilaksanakan

### 3.1 File Baru (Implementasi MCR-006)

| File | Deskripsi |
|---|---|
| `packages/contracts/src/pending-capture-sync.ts` | Kontrak `APPTS.RUNTIME.D05.PENDING_CAPTURE_SYNC / 1.0.0`; 3 message type: `SUBMISSION`, `PENDING_ACCEPTANCE`, `OUTCOME`; validator untuk setiap message; capture kind ref (`DRAFT_EVIDENCE`, `CONSENT_RECORD`, `EXTERNAL_DOCUMENT`, `STRUCTURED_FORM`); outcome codes (`PENDING_ACCEPTED`, `IDENTICAL_REPLAY_REUSED`, `CONFLICTING_REPLAY_HELD`, `CAPTURE_ID_CONFLICT`, `OUT_OF_ORDER_HELD`, `OFFLINE_FINAL_EFFECT_PROHIBITED`, `RECONCILIATION_REQUIRED`, `SOURCE_UNAVAILABLE`, `QUALIFIED`, `PROMOTED`, `CORRECTED`, `REJECTED`). |
| `packages/adapters-d05/src/pending-capture.ts` | `validatePendingBatch()`: batas 250 item (PENDING_CAPTURE_LIMIT_EXCEEDED), deteksi duplikat local_sequence (DUPLICATE_LOCAL_SEQUENCE); type `PendingCapture` dengan `finalEffectClaimed: false` sebagai invariant struktural. |
| `packages/persistence/src/exchange/pending-capture.ts` | SQL repository: `insertFirstDurableAcceptance()` (INSERT ke T118 + T119 + idempotency binding); `markSyncResultOutcome()` (UPDATE outcome pada T119); semua operasi via `TransactionContext` (`ctx.query()`), bukan `PoolClient` langsung. |
| `apps/api/src/routes/ui-pending-captures.ts` | Route `POST /api/v1/ui/pending-captures`; validasi `validatePendingCaptureSyncSubmission()`; dispatch ke intent dispatcher; respon via `ContractEnvelope`. |
| `tests/contract/cf02-d05-pending-capture-sync.contract.test.ts` | 34 contract test: V-PC-001 s/d V-PC-016 mencakup validasi envelope, payload branch, outcome codes, identity version, semantic version. |
| `tests/integration/d05-pending-capture.integration.test.ts` | 22 integration test: PC-V01 s/d PC-V20 mencakup schema identity, payload branch, idempotency, batch validation, actor ref, outcome paths. |
| `tests/adverse/pending-capture-adverse.test.ts` | 17 adverse test: conflicting replay held, capture ID conflict, offline final effect prohibition, out-of-order held, RECONCILIATION_REQUIRED (dengan/tanpa reconciliation_case_ref), SOURCE_UNAVAILABLE, DURABLE_REFERENCE adverse, batch boundary (250 OK / 251 fail), duplicate local_sequence, concurrent race, offline bounded storage. |
| `docker-compose.dep.yml` (root BP-001) | Docker Compose untuk CI DEP-001; memakai `Dockerfile.build` yang sama; named volume `node_modules_dep` terpisah. |

### 3.2 File Dimodifikasi (Integrasi dan Koreksi Teknis)

| File | Perubahan |
|---|---|
| `packages/contracts/src/index.ts` | Re-export `pending-capture-sync` (penambahan entri ekspor). |
| `packages/adapters-d05/src/index.ts` | Re-export `pending-capture` (penambahan entri ekspor). |
| `packages/persistence/src/index.ts` | Re-export `exchange/pending-capture` (penambahan entri ekspor). |
| `apps/api/src/index.ts` | Registrasi route `ui-pending-captures` ke Fastify instance. |
| `package.json` (DEP-001 root) | Update 3 test script: `test:contracts`, `test:integration`, `test:adverse` — penambahan file test MCR-006. |
| `apps/api/tsconfig.json` | **Koreksi teknis:** tambah `{"path": "../../packages/contracts"}` ke array `references`. Fix: `tsc -b --clean` memproses `apps/api` sebelum `packages/contracts` terbuild; TypeScript in-process resolution cache mencatat contracts sebagai NOT FOUND; domain packages (core-d01 dst.) gagal TS2307 meskipun contracts berhasil dibangun setelahnya. Dengan contracts sebagai declared reference, topological ordering terjamin. |
| `tools/verify-toolchain.mjs` | **Koreksi teknis (pre-existing gap):** tambah `@appts-restore-service/config` dan `@appts-restore-service/observability` ke `expectedDirect` map (keduanya sudah ada di `apps/api/package.json` tapi tidak terdaftar di controlled set — verify:toolchain FAIL). |
| `packages/contracts/src/pending-capture-sync.ts` | **Koreksi teknis:** import `AcceptanceCode` dari `./common/result.ts`; hapus deklarasi duplikat `export type AcceptanceCode` (sudah diekspor dari `common/result.ts` — TS2308 collision). |
| `packages/persistence/src/exchange/pending-capture.ts` | **Koreksi teknis:** 4 helper function: ganti tipe parameter dari `import("pg").PoolClient` ke `TransactionContext`; ganti `client.query(` ke `ctx.query(`; ganti `ctx.client` ke `ctx` di call sites. `TransactionContext` hanya mengekspos `query()` langsung — tidak ada sub-property `.client`. Fix non-null assertion `rows[0]!` (TS2532). |

### 3.3 Konfirmasi Protected Meaning Tidak Diubah

Dikonfirmasi. Tidak ada perubahan pada:
- Makna Produk/kebijakan
- Skema data/migrasi (T118/T119 dan migrasi terkait sudah diotorisasi DS-A011 dan ada dalam migration scripts; Builder tidak membuat/memodifikasi skema SQL)
- Makna kontrak/antarmuka (`APPTS.RUNTIME.D05.PENDING_CAPTURE_SYNC / 1.0.0` sesuai desain chain IC-A008 + DRRT-32 + DS-A011)
- Semantik lifecycle/state (pending capture adalah jalur terpisah dari lifecycle tiket utama)
- Role/otoritas
- Topologi runtime
- `grant-runtime.sh` tidak dimodifikasi — extension grants untuk T118/T119 memerlukan authority MCR (lihat §5)

---

## 4. Bukti Verifikasi Linux amd64

Seluruh gate dijalankan via: `docker compose -f docker-compose.dep.yml run --rm verify-dep sh -c "find . -name '*.tsbuildinfo' -not -path './node_modules/*' -delete && npm run ci:verify"`

| Gate | Perintah | Result | Catatan Bukti |
|---|---|---|---|
| verify:toolchain | `npm run verify:toolchain` | **PASS** | Node v24.19.0, npm 11.17.0, TypeScript 6.0.3, lockfileVersion 3, workspaceCount 15, 22 direct deps terkunci; `postgresFlywayCheck: NOT_APPLICABLE_CF06_B00_NO_DB_OR_MIGRATION_COMMAND_INVOKED` |
| verify:boundaries | `npm run verify:boundaries` | **PASS** | `pg` hanya di `packages/persistence`; `contracts` tidak bergantung workspace lain; tidak ada circular dependency; tidak ada import path privat lintas-package; 116 source files scanned |
| typecheck:projects | `tsc -b tsconfig.json --force` | **PASS** | 0 error; semua 15 workspace terverifikasi TypeScript 6.0.3 |
| typecheck:web | `tsc -p tsconfig.app.json --noEmit && tsc -p tsconfig.vite.json --noEmit` | **PASS** | 0 error |
| typecheck:tests | `tsc -p tsconfig.tests.json --noEmit` | **PASS** | 0 error |
| build:projects | `tsc -b tsconfig.json --clean && tsc -b tsconfig.json` | **PASS** | Clean build sukses setelah fix project reference `apps/api → contracts` |
| build:web | `vite build` | **PASS** | `dist/service-worker.js`, `dist/index.html`, `dist/assets/index-*.css`, `dist/assets/index-*.js` (198.29 kB); built in 934ms |
| test:contracts | `node --experimental-strip-types --test ...` | **PASS** | **47/47** pass; 34 test D05 baru (V-PC-001..V-PC-016) + 13 existing CF02/I01-I04/INT-RUN-TD |
| test:integration | `node --experimental-strip-types --test ...` | **PASS** | **46/46** pass; 22 test D05 baru (PC-V01..PC-V20) + 24 existing D01-D04/UI |
| test:dg04 | `node --experimental-strip-types --test ...` | **PASS** | **4/4** pass |
| test:adverse | `node --experimental-strip-types --test ...` | **PASS** | **29/29** pass; 17 test pending-capture baru + 12 existing adverse |
| test:unit | `node tools/verify-cf05-harness.mjs` | **PASS** | source_count 6, case_count 71, evidence_manifest_hash: `46b7b955848ec4606bba2553a6b48fdae5a57882744bc245c24d7263f39e50fc` |
| test:nfr | `node tools/verify-cf05-harness.mjs` | **PASS** | Identik test:unit |
| test:migrations | `npm run verify:toolchain && node tools/b01-db-verify.mjs test` | **HELD** | `STOP: APPTS_B01_DISPOSABLE_DB=true is required` — gate terpisah; memerlukan PostgreSQL 17.x disposable; tidak dijalankan pada sesi ini |

---

## 5. Item yang Tetap HELD

| Item | Status | Catatan |
|---|---|---|
| `grant-runtime.sh` update untuk T118/T119 | HELD | Runtime role grants untuk tabel pending capture baru memerlukan authority MCR. Builder tidak memiliki authority untuk memperluas SQL grants. |
| `test:migrations` | HELD | Gate terpisah; memerlukan `APPTS_B01_DISPOSABLE_DB=true` + disposable PostgreSQL 17.x |
| Produksi / UAT / data nyata / credential / secret | NOT AUTHORIZED | Tidak dilintasi pada sesi ini |

---

## 6. State

| Item | Status |
|---|---|
| BP-001 kanonik | COMPLETE / ACCEPTED / CLOSED / FROZEN — tidak dimodifikasi |
| MCR-006 implementasi pending capture (non-DB gates) | COMPLETE / PASS |
| `grant-runtime.sh` T118/T119 extension | HELD — menunggu authority MCR |
| `test:migrations` (disposable DB) | HELD — gate terpisah, belum dieksekusi |
| Final DEP-001 full-stack PASS (incl. DB gates) | HELD — menunggu disposable PostgreSQL staging dan grant resolution |
| Produksi / UAT / data nyata / provider / credential / secret | NOT AUTHORIZED |

---

**Artifact = Authority. Chat = Notification Only.**

— Builder: Hasan Muhammad — 15 Agustus 2026
