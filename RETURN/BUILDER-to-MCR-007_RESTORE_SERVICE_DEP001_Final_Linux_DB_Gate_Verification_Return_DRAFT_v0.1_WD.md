# BUILDER-to-MCR-007 — RESTORE_SERVICE DEP-001 DB / GRANT GATE VERIFICATION RETURN (DRAFT)

**Comm ID:** BUILDER-to-MCR-007
**Version:** v0.1_WD (DRAFT — belum dikirim; dipromosikan ke CONTROLLED setelah Linux x64 gate terpenuhi atau atas keputusan MCR)
**Date:** 18 Agustus 2026 WIB
**From:** RESTORE_SERVICE Builder Team (Hasan Muhammad)
**To:** MCR (Project Director / Architect)
**Primary Response To:** MCR-to-BUILDER-008 (tersimpan: `RETURN/MCR-to-BUILDER-008_RESTORE_SERVICE_DEP001_BUILDER006_Partial_PASS_Acceptance_Grant_Migration_Authority_Clarification_and_Final_Linux_DB_Gate_Continuation_v1.0_CONTROLLED.md`)
**Message Type:** DB / GRANT GATE VERIFICATION RETURN
**Status:** `STOP — seluruh Docker gate PASS (non-DB reuse MCR-006 + migration V001→V004 + verifier 001/002/003 + grant-runtime.sh T118/T119); Linux x64 host/service/process verification (MCR-008 §3) belum dilaksanakan`

**Final return filename yang diwajibkan MCR-008 §5 (saat dipromosikan ke CONTROLLED):**
`BUILDER-to-MCR-007_RESTORE_SERVICE_DEP001_Implementation_and_Actual_Linux_Staging_Verification_Final_Return_STOP_v1.0_CONTROLLED`

---

## 1. Ringkasan Eksekusi

Builder menutup seluruh gate yang dapat diselesaikan dalam lingkup Docker (Linux amd64) sesuai authority MCR-to-BUILDER-008 §2:

- **Gate non-DB (1–9):** bukti PASS dari BUILDER-to-MCR-006 **digunakan kembali** sesuai MCR-008 §4 (reuse rule) — tidak ada file yang diubah, tidak ada gate yang perlu diulang untuk bagian ini.
- **Koreksi verifier (authorized MCR-008 §2B):** dua verifier baseline diperbarui untuk mencerminkan skema DEP-001 post-V004 (lihat §3). Ini adalah koreksi alat verifikasi yang diizinkan sebagai "implementation HOW" per §2B — tidak mengubah makna skema atau migrasi.
- **`grant-runtime.sh` (authorized MCR-008 §2A):** implementasi T118/T119 runtime grants sudah ada di `deploy/db/grant-runtime.sh`; tidak memerlukan perubahan tambahan. Verifikasi konfirmasi dilakukan pada sesi ini.
- **`test:migrations`:** dijalankan ulang di Docker Linux amd64 (PG 17.11 disposable, loopback) setelah koreksi verifier — **PASS penuh** (lihat §4).
- **STOP yang tersisa:** Actual Linux x64 host/service/process verification (MCR-008 §3) — **belum dilaksanakan**. Docker-only evidence tidak dapat dilabeli "actual Linux host/service PASS" per MCR-008 §3 eksplisit.

---

## 2. Environment Eksekusi

- **OS / shell:** Windows 11 Pro 10.0.26200 (host); Debian bookworm-slim (container eksekusi, Linux amd64)
- **Node/npm:** Node v24.19.0 / npm 11.17.0 — `node:24.19.0-bookworm-slim`. Host tidak dimodifikasi.
- **TypeScript:** 6.0.3
- **Flyway:** 13.0.0 (CF06-B01)
- **PostgreSQL:** 17.11 (image `postgres:17.11-bookworm`) — disposable, loopback
- **Topologi DB:** container verify berbagi network namespace dengan container PostgreSQL (`--network container:appts-b01-pg`) → `127.0.0.1:5432` (memenuhi `LOCAL_LOOPBACK` CF06-B01)
- **Session timezone:** `PGTZ=UTC` — verifier CF01 mensyaratkan timezone persis `UTC`; pengaturan sesi psql saja, bukan perubahan verifier atau migrasi
- **Workspace:** `DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001` (bukan `SOURCE_SNAPSHOT/RESTORE_SERVICE/` yang FROZEN)

---

## 3. Pekerjaan yang Dilaksanakan pada Sesi Ini

### 3.1 Koreksi Verifier (Authorized MCR-008 §2B)

V004 menambahkan **2 tabel baru** (T118 `provisional_capture_payload_resource` + T119 `pending_capture_idempotency_binding`) dan **2 append-only trigger baru** (satu per tabel baru). Verifier baseline tidak mengetahui V004 → perlu diperbarui untuk mencerminkan skema terotorisasi.

| File Verifier | Perubahan | Justifikasi |
|---|---|---|
| `db/verify/001_cf01_constraints.sql` baris 27, 28, 35, 36 | `117` → `119` (table count + PK count) | V004 menambah 2 tabel baru (T118 + T119); 117 + 2 = 119 |
| `db/verify/002_cf01_history_inbox_outbox.sql` baris 18, 19 | `91` → `93` (append-only trigger count) | V004 menambah 2 append-only trigger baru (`trg_provisional_capture_payload_resource__append_only` + `trg_pending_capture_idempotency_binding__append_only`); 91 + 2 = 93 |
| `db/verify/003_dg04_diagnostics.sql` | Tidak diubah | Cek 17 tabel DG04 berdasarkan nama eksplisit — tidak terpengaruh V004 |

### 3.2 `grant-runtime.sh` — Tidak Ada Perubahan Diperlukan

`deploy/db/grant-runtime.sh` sudah mengimplementasikan T118/T119 grants lengkap:
- Baris 151–152: `appts.pending_capture`, `appts.sync_batch` → SELECT + INSERT (append-only)
- Baris 164–165: `appts.provisional_capture_payload_resource`, `appts.pending_capture_idempotency_binding` → SELECT + INSERT (append-only)
- Grant verification query (baris 184–228) mencakup v10 (`provisional_capture_payload_resource INSERT`) + v11 (`pending_capture_idempotency_binding INSERT`)
- Komentar baris 104 sudah mereferensikan MCR-to-BUILDER-008 §2.A
- Least-privilege constraints terpenuhi: tidak ada UPDATE/DELETE/TRUNCATE, tidak ada `appts_sys` access, tidak ada CREATE/superuser

### 3.3 Konfirmasi Protected Meaning Tidak Diubah

Dikonfirmasi. Tidak ada perubahan pada:
- Makna Produk/kebijakan
- Skema data/migrasi (V001–V004, T118/T119 tidak disentuh)
- Makna kontrak/antarmuka
- Semantik lifecycle/state
- Role/otoritas (verifier hanya alat verifikasi count, bukan definisi authority)
- Topologi runtime
- `SOURCE_SNAPSHOT/RESTORE_SERVICE/` FROZEN — tidak disentuh

Tidak ada koneksi ke database produksi/nyata; tidak ada kredensial atau data operasional yang dilintasi.

---

## 4. Bukti Verifikasi — Gate yang Dijalankan Sesi Ini

### 4.1 Gate Non-DB (Reuse MCR-006 per MCR-008 §4)

Tidak dijalankan ulang (tidak ada file yang berubah; tidak ada invalidasi per reuse rule MCR-008 §4). Bukti dari BUILDER-to-MCR-006 berlaku:

| Gate | Result (MCR-006) | Catatan |
|---|---|---|
| verify:toolchain | PASS | Node v24.19.0, npm 11.17.0, TS 6.0.3; 15 workspace |
| verify:boundaries | PASS | 0 pelanggaran; 116 source files scanned |
| typecheck | PASS | 0 error (projects + web + tests) |
| build | PASS | tsc clean + vite build |
| test:contracts | PASS — **47/47** | Termasuk 34 D05 (V-PC-001..016) |
| test:integration | PASS — **46/46** | Termasuk 22 D05 (PC-V01..20) |
| test:dg04 | PASS — **4/4** | |
| test:adverse | PASS — **29/29** | Termasuk 17 D05 |

### 4.2 `test:migrations` — Dijalankan Sesi Ini (18 Agustus 2026)

**Environment:** `node:24.19.0-bookworm-slim` + `postgres:17.11-bookworm` disposable, shared netns loopback, `PGTZ=UTC`, `APPTS_B01_DISPOSABLE_DB=true`

| Step | Perintah / Sub-step | Result | Bukti |
|---|---|---|---|
| migrate | `flyway migrate` | **PASS** | `Successfully applied 4 migrations ... now at version v004` (execution time ~2.1s); V001–V004 @ 2026-08-18 03:42:46–50 UTC |
| validate | `flyway validate` | **PASS** | `Successfully validated 4 migrations` |
| info | `flyway info` | **PASS** | V001–V004 semua `State: Success` di schema history |
| verifier 001 | `psql ... 001_cf01_constraints.sql` | **PASS** | `DO` → `ROLLBACK` (119 tables, 119 PKs, 0 semantic defaults, 0 naive timestamps, 6 named constraints) |
| verifier 002 | `psql ... 002_cf01_history_inbox_outbox.sql` | **PASS** | `DO` → `ROLLBACK` (93 append-only triggers, required history/exchange relations, inbox/outbox indexes, outbox not append-only) |
| verifier 003 | `psql ... 003_dg04_diagnostics.sql` | **PASS** | `DO` → `ROLLBACK` (17 DG04 tables, required constraints, partial index, no forbidden FK) |
| fixture positive | psql fixture inserts | **PASS** | 4× `INSERT 0 1` → `ROLLBACK` |
| fixture negative | psql constraint probes | **PASS** | `DO` → `ROLLBACK` (constraint violations properly rejected) |
| checksum mutation probe | flyway validate (post-mutation) | **PASS** | Expected failure: `Migration checksum mismatch for migration version 001` (applied `728246359` vs resolved `522749340`); migration file tamper terdeteksi = immutability terbukti |
| grant-runtime.sh | `deploy/db/grant-runtime.sh` | **PASS** | Quarantine verified; T118/T119 grants applied; 13-point grant verification (v01–v13): `PASS: runtime role privilege grants verified (V001–V004 allowlist, least-privilege)` |
| **FINAL** | `b01-db-verify.mjs test` | **PASS** | `PASS: CF06-B01 bounded migration verification completed on the authorized disposable database.` |

---

## 5. STOP Item yang Tersisa

| # | Item | Status | Detail |
|---|---|---|---|
| 1 | **Actual Linux x64 host/service/process verification** (MCR-008 §3) | **STOP** | MCR-008 §3 eksplisit: "Docker-only Linux evidence cannot satisfy the actual Linux PASS requirement." Memerlukan: OS/kernel/arch, Node 24.19.0 + npm identity, DEP-001 artifact identity, PG 17.x staging, API startup + health, worker startup + durable-work, web/SW availability, config + observability, simulated transport, systemd (atau ekuivalen), start/stop/restart/failure-recovery/boot behavior, log location. Builder-controlled non-production Linux x64 VM/host — bukan `LOCAL-EXISTING-001`. |

---

## 6. Batasan yang Ditegaskan

- **Docker ≠ actual Linux host.** Bukti Docker di atas membuktikan migration path, schema constraints (V001–V004), idempotency/replay binding, dan runtime grants pada environment Linux amd64 yang terkontrol. Ini **tidak memenuhi actual Linux x64 host/service/process requirement** (MCR-008 §3) dan tidak dapat dilabeli demikian.
- **Docker evidence ≠ kualifikasi `LOCAL-EXISTING-001`.** Bukti ini tidak mengkualifikasi environment infrastruktur Adit — kualifikasi IR tetap tanggung jawab IR/Adit.
- Tidak ada aktivasi produksi, deploy, akses data nyata, kredensial, atau provider eksternal pada sesi ini.

---

## 7. State

| Item | Status |
|---|---|
| BP-001 kanonik (`SOURCE_SNAPSHOT/RESTORE_SERVICE/`) | FROZEN / UNCHANGED |
| MCR-006 implementasi pending capture (non-DB gates) | COMPLETE / PASS — bukti digunakan kembali per MCR-008 §4 |
| `grant-runtime.sh` T118/T119 | COMPLETE / PASS — sudah diimplementasikan; terverifikasi sesi ini |
| `test:migrations` — migration V001→V004 + verifier + grant + probe | COMPLETE / PASS — Docker Linux amd64, PG 17.11, 18 Agustus 2026 |
| Verifier corrections (001: 117→119, 002: 91→93) | COMPLETE — authorized MCR-008 §2B |
| Actual Linux x64 host/service/process verification (MCR-008 §3) | **STOP — belum dilaksanakan** |
| DEP-001 final PASS | **OPEN** — menunggu Linux x64 gate |
| Produksi / UAT / data nyata / provider / credential / secret | NOT AUTHORIZED |

---

**Artifact = Authority. Chat = Notification Only.**

— Builder: Hasan Muhammad — 18 Agustus 2026
