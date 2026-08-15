# DEP-GAP-001 — Register Kesenjangan / Bukti / Keputusan Deployment

**Document ID:** DEP-GAP-001  
**Title:** Deployment Gap / Evidence / Decision Register  
**Version:** v0.1_WD (Working Draft)  
**Date:** 14 Agustus 2026  
**Author:** Hasan Muhammad — Builder Team  
**Status:** DRAFT — dokumen kerja (bukan otoritas). Menunggu review dan penerimaan MCR.  
**Authority Reference:** `00_MCR_RESPONSE__MCR-to-BUILDER-001_DEP001_Specification_Assignment_v1.0_CONTROLLED.md` (MCR-to-BUILDER-001, 14 Agustus 2026)

---

## 1. Tujuan dan Metode

Register ini mencatat kesenjangan deployment-construction untuk `APP-RESTORE-SERVICE-DEP-001` beserta bukti sumber yang mendukung, disposisi/mekanisme yang diusulkan, dan keputusan/verifikasi yang diperlukan. Register ini melengkapi `DEP-SPEC-001` dan tidak berdiri sendiri sebagai otoritas.

Metode: setiap baris didasarkan pada bukti yang dapat ditelusuri (referensi file:baris pada Lampiran A `DEP-SPEC-001` dan catatan `RETURN/POST_VERIFICATION_FINDINGS.md`). Tidak ada hasil observasi tes baru yang diklaim pada sesi ini.

## 2. Prinsip Klasifikasi

MCR-to-BUILDER-001 §3 menegaskan pembedaan tiga jenis:

- **Konstruksi hilang** (deployment construction element missing) — elemen yang diperlukan untuk menjalankan/mengoperasikan runtime belum ada di source;
- **Belum terverifikasi** (not yet verified) — elemen ada atau diusulkan tetapi belum ada bukti verifikasi;
- **Fakta sumber** (source fact) — keadaan yang terikat pada source/desain yang diterima.

**Tidak ada baris yang diklasifikasikan sebagai defect source** kecuali dibuktikan langsung oleh bukti; saat ini **tidak ada** kesenjangan yang terbukti sebagai defect source. Setiap baris diberi salah satu dari empat label eksak: `SOURCE-BOUND / ACCEPTED DESIGN-BOUND`, `PROPOSED ENGINEERING MECHANIC`, `OPEN / REQUIRES DECISION`, atau `NOT VERIFIED`.

## 3. Register

| ID | Area | Klasifikasi (label) | Jenis | Referensi Bukti | Disposisi / Mekanisme Diusulkan | Keputusan / Verifikasi Diperlukan | Pemilik / Otoritas Berikutnya |
|---|---|---|---|---|---|---|---|
| GAP-001 | Runtime bootstrap (entry proses API) | `PROPOSED ENGINEERING MECHANIC` | Konstruksi hilang | `apps/api/src/main.ts:2-3`; `apps/api/src/composition.ts:2-3`; `apps/api/package.json:10-13`; tidak ada `listen`/`createServer`/`serve` di `apps/api/src` | Bootstrap proses API + listener pada implementasi DEP-001 terotorisasi | Keputusan MCR atas DEP-SPEC-001; verifikasi staging V5 | MCR → Builder (implementasi terotorisasi) |
| GAP-002 | Web static hosting / SPA fallback | `PROPOSED ENGINEERING MECHANIC` | Konstruksi hilang | `apps/web/vite.config.ts:5-13`; `apps/web/package.json:10-13`; artefak `apps/web/dist/index.html` | Hosting statis same-origin + fallback SPA untuk route non-API | Verifikasi staging V5 | MCR → Builder |
| GAP-003 | Service Worker produksi | `OPEN / REQUIRES DECISION` | Belum terverifikasi + keputusan | `apps/web/src/main.tsx:2` (registrasi jalur dev `/src/offline/service-worker.ts`); `apps/web/vite.config.ts:5-13` (tanpa konfigurasi SW) | Keputusan mekanisme packaging SW produksi; **tidak diasumsikan** dapat ditangani tanpa mutasi source | Keputusan MCR | MCR |
| GAP-004 | Worker scheduler/runner | `PROPOSED ENGINEERING MECHANIC` | Konstruksi hilang | `apps/worker/src/outbox-worker.ts:2`; `reconciliation-worker.ts:2`; `runtime-obligation-worker.ts:2`; `diagnostic-notification-worker.ts:2`; `apps/worker/package.json` (tanpa bin/main/scripts) | Poll loop + wrapper proses durable per worker (mis. unit systemd); interval/batch ditetapkan saat implementasi | Verifikasi staging V5–V7 | MCR → Builder |
| GAP-005 | Sumber waktu otoritatif (authoritative time) | `OPEN / REQUIRES DECISION` | Keputusan | `apps/worker/src/runtime-obligation-worker.ts:2` — `runRuntimeObligationWorker(repository, authoritativeTime)`; source tidak mendefinisikan sumber waktu | Keputusan sumber waktu otoritatif untuk evaluasi obligation; **tidak mengasumsikan** clock lokal/timezone/NTP otoritatif | Keputusan MCR | MCR |
| GAP-006 | Konfigurasi runtime / secrets | `PROPOSED ENGINEERING MECHANIC` | Konstruksi hilang | `packages/config/` (hanya package.json + tsconfig.json); tidak ada `process.env` di `apps/` maupun `packages/` | File konfigurasi eksternal root-readable + injeksi env; fail-closed saat konfigurasi hilang; tanpa nilai/secrets di spec | Keputusan MCR (batas injeksi secrets non-produksi); verifikasi staging V4 | MCR → Builder |
| GAP-007 | Observability / logging | `PROPOSED ENGINEERING MECHANIC` | Konstruksi hilang | `packages/observability/package.json:11` (dependensi `pino 10.3.1`); tanpa source logger | Source logger + hook monitoring; log ke direktori terpisah | Verifikasi staging V5–V8 | MCR → Builder |
| GAP-008 | Health / readiness | `PROPOSED ENGINEERING MECHANIC` | Konstruksi hilang | Tidak ada endpoint/mekanisme health di source | Mekanisme health/readiness untuk API/static dan worker | Verifikasi staging V5 | MCR → Builder |
| GAP-009 | Provisioning & migrasi PostgreSQL | `PROPOSED ENGINEERING MECHANIC` | Konstruksi hilang + belum terverifikasi | `db/migrations/V001__cf01_core_schema.sql:3,6`; `V002__…:3`; `V003__…:3`; `db/verify/001_cf01_constraints.sql:17-21`; `tools/b01-db-verify.mjs:88-91,119-121,137-144` (verifier source menggunakan urutan clean → migrate → validate → info untuk pengujian loopback) | Instance PG 17 loopback disposable; urutan Flyway migrate → validate → info pada database disposable yang disiapkan; guard UTF8/UTC | Verifikasi staging V2–V3; migrasi belum dijalankan pada host staging mana pun | MCR → Builder |
| GAP-010 | Model privilege / grant | `OPEN / REQUIRES DECISION` | Keputusan | `tools/b01-db-verify.mjs:137-140` (skema `appts` + `appts_sys` di luar `public`) | Pemisahan peran migrasi vs peran aplikasi; grant pasca-migrasi | Keputusan MCR (penerimaan operasional/keamanan) | MCR |
| GAP-011 | Backup / rollback database | `PROPOSED ENGINEERING MECHANIC` | Konstruksi hilang + keputusan | Tidak ada mekanisme backup di source; `tools/b01-db-verify.mjs:141-144` (urutan clean/migrate/validate/info) | Checkpoint backup sebelum migrasi; prosedur rollback/restore terverifikasi di staging | Keputusan MCR (kebijakan backup/rollback); verifikasi staging V3/V8 | MCR → Builder |
| GAP-012 | Bukti Linux lokal | `NOT VERIFIED` | Belum terverifikasi | Tidak ada bukti runtime Linux pada sesi ini; `RETURN/POST_VERIFICATION_FINDINGS.md` (8 gate PASS via tooling Docker; DB opsional tidak dijalankan) | Rencana verifikasi staging V0–V8 (host Debian 12 x64 loopback) | Verifikasi staging masa depan setelah otorisasi implementasi | Builder (setelah otorisasi) |
| GAP-013 | Identitas artefak paket | `PROPOSED ENGINEERING MECHANIC` | Konstruksi hilang | Tidak ada artefak paket DEP-001; baseline beku `e39f959fc6839c16c7c6cc75bd15079b4ed57a39` | Artefak versioned read-only + identitas (versi/hash/manifest) yang dibekukan Builder | Keputusan MCR; verifikasi staging V4 | MCR → Builder |
| GAP-014 | Batas network / TLS / reverse-proxy non-produksi | `OPEN / REQUIRES DECISION` | Keputusan | Tidak ada asumsi hosting di source; prefix relatif `/api/v1/ui` (`apps/api/src/main.ts:2`) → same-origin | Batas reverse-proxy/TLS/provider non-produksi; satu origin loopback (PROPOSED) | Keputusan MCR | MCR |

## 4. Catatan Penutup

- Seluruh kesenjangan di atas adalah **konstruksi yang hilang**, **belum terverifikasi**, atau **keputusan engineering** — **bukan defect source**.
- Item `OPEN / REQUIRES DECISION` (GAP-003, GAP-005, GAP-010, GAP-014, dan sebagian GAP-006/GAP-011) memerlukan keputusan MCR sebelum implementasi DEP-001 dapat dimulai.
- Item `PROPOSED ENGINEERING MECHANIC` menjadi materi implementasi DEP-001 terotorisasi setelah DEP-SPEC-001 diterima MCR.
- Item `NOT VERIFIED` (GAP-012) menjadi materi verifikasi staging masa depan; tidak ada klaim hasil observasi pada sesi ini.

---

— Builder: Hasan Muhammad — 14 Agustus 2026