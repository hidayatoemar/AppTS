# DEP-SPEC-001 — Spesifikasi Konstruksi Deployment RESTORE_SERVICE

**Document ID:** DEP-SPEC-001  
**Title:** RESTORE_SERVICE Deployment Construction Specification  
**Version:** v0.1_WD (Working Draft)  
**Date:** 14 Agustus 2026  
**Author:** Hasan Muhammad — Builder Team  
**Status:** DRAFT — dokumen kerja (bukan otoritas). Menunggu review dan penerimaan MCR.  
**Authority Reference:** `00_MCR_RESPONSE__MCR-to-BUILDER-001_DEP001_Specification_Assignment_v1.0_CONTROLLED.md` (MCR-to-BUILDER-001, 14 Agustus 2026)  
**Accepted Frozen Baseline:** `e39f959fc6839c16c7c6cc75bd15079b4ed57a39` (CF06 final baseline, FROZEN / INDEPENDENTLY VERIFIED)

---

## 0. Ringkasan Eksekutif

Dokumen ini adalah spesifikasi konstruksi deployment untuk `APP-RESTORE-SERVICE-DEP-001` — **SPECIFICATION-ONLY**. Tidak ada mutasi source, implementasi, deployment, produksi, data/secrets/provider nyata, registry release, UAT, maupun republish BP-001 yang diotorisasi oleh dokumen ini.

Spesifikasi menjembatani: baseline source/build yang diterima → paket runtime/deployment berorientasi Linux yang dapat dijalankan → artefak yang dapat dikonsumsi Installer — **tanpa mengubah** makna produk/kebijakan, semantik lifecycle/state, Role/TWT, model otoritas, makna data, kontrak antarmuka, maupun maksud operasional yang diterima.

Fakta kunci dari source snapshot (semua terverifikasi, lihat Lampiran A):

- Source menawarkan **build web** (Vite) dan artefak `dist`; **deskriptor route API** (`/api/v1/ui`) dan dependensi Fastify; **empat fungsi worker single-pass**; **migrasi V001–V003** dengan guard UTF8/UTC dan verifier Flyway 13; **PostgreSQL 17** sebagai keluarga mayor yang diterima.
- Source **tidak** menawarkan: HTTP listener/start script API, scheduler/CLI worker, konfigurasi runtime, environment loader, source logging, maupun aset Docker/compose runtime di dalam snapshot.

Seluruh mekanisme yang belum ada di source diperlakukan sebagai **PROPOSED ENGINEERING MECHANIC** atau **OPEN / REQUIRES DECISION** — bukan sebagai defect source.

---

## 1. Otoritas, Ruang Lingkup, dan Non-Tujuan

### 1.1 Otoritas

- `MCR-to-BUILDER-001` (v1.0 CONTROLLED) mengotorisasi pembuatan/penggunaan identitas paket kerja terpisah `APP-RESTORE-SERVICE-DEP-001` untuk **SPECIFICATION AND DEPLOYMENT-CONSTRUCTION PREPARATION ONLY** (MCR-to-BUILDER-001 §4).
- BP-001 kanonik tetap **COMPLETE / ACCEPTED / CLOSED**; tidak boleh diregenerasi, diganti, atau direpublish dalam penugasan ini (MCR-to-BUILDER-001 §2).
- Baseline beku yang diterima: `e39f959fc6839c16c7c6cc75bd15079b4ed57a39` — **SOURCE-BOUND / ACCEPTED DESIGN-BOUND**.

### 1.2 Ruang Lingkup

Spesifikasi ini mencakup sembilan bagian yang diminta MCR (§7 MCR-to-BUILDER-001):

1. Peta proses/runtime (Bagian 2)
2. Target Linux (Bagian 3)
3. Konfigurasi runtime dan batas secrets (Bagian 4)
4. Provisioning dan migrasi PostgreSQL (Bagian 5)
5. Paparan Web/API (Bagian 6)
6. Eksekusi worker (Bagian 7)
7. Operabilitas (Bagian 8)
8. Rencana verifikasi staging/loopback Linux (Bagian 9)
9. Batas serah terima Installer (Bagian 10)

### 1.3 Non-Tujuan

Berikut **tidak** diotorisasi oleh penugasan ini dan **tidak** menjadi tujuan dokumen ini (MCR-to-BUILDER-001 §4):

- Mutasi snapshot source beku;
- Implementasi topologi runtime baru yang tidak didukung desain yang diterima;
- Deployment ke Production;
- Penggunaan data operasional nyata;
- Penggunaan/pengungkapan secrets atau kredensial Production;
- Aktivasi provider eksternal atau endpoint integrasi;
- Publikasi registry sebagai Production release;
- UAT atau aktivasi Production.

### 1.4 Label Klasifikasi

Seluruh elemen dalam dokumen ini diberi salah satu dari empat label eksak:

- **SOURCE-BOUND / ACCEPTED DESIGN-BOUND** — fakta yang terikat pada source/desain yang diterima;
- **PROPOSED ENGINEERING MECHANIC** — mekanisme yang diusulkan Builder, menunggu penerimaan MCR;
- **OPEN / REQUIRES DECISION** — memerlukan keputusan MCR/otoritas berikutnya;
- **NOT VERIFIED** — belum ada bukti verifikasi.

---

## 2. Peta Proses/Runtime (MCR §7.1)

### 2.1 Tabel Peta Runtime

| Komponen | Status | Keterangan |
|---|---|---|
| **Web/static** (SPA React 19, Vite 8) | Build: **SOURCE-BOUND / ACCEPTED DESIGN-BOUND**; Hosting: **PROPOSED ENGINEERING MECHANIC** | `apps/web/vite.config.ts:5-13` mendefinisikan build (`root`, `base: "/"`, `outDir: "dist"`); artefak `apps/web/dist/index.html` ada di snapshot. Mekanisme hosting produksi belum ada. |
| **API process** | Deskriptor + dependensi: **SOURCE-BOUND / ACCEPTED DESIGN-BOUND**; Bootstrap/listener: **PROPOSED ENGINEERING MECHANIC** | `apps/api/src/main.ts:2-3` mendefinisikan `UI_API_PREFIX="/api/v1/ui"` dan `describeUiApi`; `apps/api/src/composition.ts:2-3` mendefinisikan `ApiComposition`/`composeApi`; `apps/api/package.json:10-13` mendeklarasikan `fastify 5.10.0` dan `@fastify/static 10.1.2`. Tidak ada `listen`/`createServer`/`serve` maupun start script di `apps/api`. |
| **Worker — outbox** | Fungsi: **SOURCE-BOUND / ACCEPTED DESIGN-BOUND**; Scheduler/runner: **PROPOSED ENGINEERING MECHANIC** | `apps/worker/src/outbox-worker.ts:2` — `runOutboxWorker(repository)` single-pass (loadReady → publish → record). |
| **Worker — reconciliation** | Fungsi: **SOURCE-BOUND / ACCEPTED DESIGN-BOUND**; Scheduler/runner: **PROPOSED ENGINEERING MECHANIC** | `apps/worker/src/reconciliation-worker.ts:2` — `runReconciliationWorker(repository)` single-pass (loadUncertain → resolveAuthoritatively → reconcile → save). |
| **Worker — obligation** | Fungsi: **SOURCE-BOUND / ACCEPTED DESIGN-BOUND**; Sumber waktu otoritatif: **OPEN / REQUIRES DECISION** | `apps/worker/src/runtime-obligation-worker.ts:2` — `runRuntimeObligationWorker(repository, authoritativeTime)` menerima `authoritativeTime` sebagai parameter; source tidak mendefinisikan sumber waktu otoritatif. |
| **Worker — diagnostic-notification** | Fungsi: **SOURCE-BOUND / ACCEPTED DESIGN-BOUND**; Scheduler/runner: **PROPOSED ENGINEERING MECHANIC** | `apps/worker/src/diagnostic-notification-worker.ts:2` — `runDiagnosticNotificationWorker(repository)` single-pass (loadQueued → deliver → persistResult/trapDeliveryFailure). |
| **PostgreSQL** | Keluarga + migrasi: **SOURCE-BOUND / ACCEPTED DESIGN-BOUND**; Provisioning: **PROPOSED ENGINEERING MECHANIC** | Migrasi `db/migrations/V001__cf01_core_schema.sql`, `V002__cf01_runtime_and_exchange_schema.sql`, `V003__dg04_diagnostic_persistence.sql`; guard UTF8/UTC; verifier Flyway 13 dan psql PostgreSQL 17 (`tools/b01-db-verify.mjs:88-91,119-121`). |
| **Konfigurasi runtime** | **PROPOSED ENGINEERING MECHANIC** | `packages/config/` hanya berisi `package.json` dan `tsconfig.json` — tidak ada source konfigurasi runtime. Tidak ada pembacaan `process.env` di `apps/` maupun `packages/`. |
| **Observability/logging** | **PROPOSED ENGINEERING MECHANIC** | `packages/observability/` hanya berisi `package.json` (dependensi `pino 10.3.1`) dan `tsconfig.json` — tidak ada source logger. |
| **Service Worker** | Registrasi dev: **SOURCE-BOUND / ACCEPTED DESIGN-BOUND**; Packaging produksi: **OPEN / REQUIRES DECISION** | `apps/web/src/main.tsx:2` mendaftarkan Service Worker pada jalur pengembangan `/src/offline/service-worker.ts`; `apps/web/vite.config.ts:5-13` tidak memiliki konfigurasi/plugin Service Worker produksi. |

### 2.2 Narasi Relasi

- **Web/static dan API** direncanakan berbagi **satu origin** (same-origin) karena klien web melakukan fetch dengan prefix relatif (`/api/v1/ui${path}`, `apps/web/src/api.ts:5`) — ini adalah bukti sumber, bukan asumsi; `apps/api/src/main.ts:2` hanya mendeskripsikan prefix API sisi server (`UI_API_PREFIX="/api/v1/ui"`). **PROPOSED ENGINEERING MECHANIC**: satu proses yang melayani API dan artefak statis SPA pada satu origin loopback.
- **Empat worker** adalah proses terpisah yang berjalan secara durable (satu wrapper proses per worker), masing-masing memanggil fungsi single-pass yang diterima dari source secara periodik.
- **PostgreSQL** adalah penyimpanan bersama: API, web (melalui API), dan keempat worker berinteraksi dengannya melalui `packages/persistence` (satu-satunya package yang mengimpor `pg`; `packages/persistence/src/index.ts:1`, `src/transaction.ts:20`).
- **Konfigurasi dan observability** adalah lapisan yang belum ada di source dan direncanakan sebagai mekanisme baru (PROPOSED) yang tidak mengubah makna produk.
- **Service Worker** terikat pada web; packaging produksinya masih **OPEN / REQUIRES DECISION**.

---

## 3. Target Linux (MCR §7.2)

### 3.1 Lingkungan Target yang Diusulkan

- **PROPOSED ENGINEERING MECHANIC**: satu host staging loopback **Debian 12 x64**. Preferensi Linux adalah pilihan engineering; **tidak sama dengan Linux PASS** — Linux PASS hanya dapat diklaim setelah verifikasi staging aktual (saat ini **NOT VERIFIED**).
- **SOURCE-BOUND / ACCEPTED DESIGN-BOUND**: binding runtime Node.js `24.19.0` dan npm `11.17.0` (root `package.json:6-10`, `tools/verify-toolchain.mjs:14,22-24`; TypeScript `6.0.3`).
- **PROPOSED ENGINEERING MECHANIC**: instalasi toolchain Node/npm pada host staging dilakukan oleh Installer sesuai paket yang disiapkan Builder; tidak ada asumsi jalur instalasi spesifik di spec ini.

### 3.2 Prasyarat Paket/Build/Runtime

- **SOURCE-BOUND / ACCEPTED DESIGN-BOUND**: build memerlukan `npm ci --ignore-scripts --no-audit --no-fund` dengan lockfile; gate `verify:toolchain`, `verify:boundaries`, `typecheck`, `build` terikat pada snapshot.
- **PROPOSED ENGINEERING MECHANIC**: artefak runtime dibangun dari baseline beku dan ditempatkan pada direktori artefak **versioned, read-only**; dependensi runtime dikunci eksak.

### 3.3 Filesystem dan Permission

- **PROPOSED ENGINEERING MECHANIC**:
  - Direktori artefak: versioned, **read-only** untuk akun layanan (mis. `…/artifacts/<versi>/`).
  - Direktori konfigurasi: terpisah dari artefak, **root-readable** (lihat Bagian 4).
  - Direktori state dan log: terpisah, **writable** oleh akun layanan.
  - Akun layanan **unprivileged** (bukan root) untuk seluruh proses runtime.

### 3.4 Supervisi Proses dan Lifecycle

- **PROPOSED ENGINEERING MECHANIC**: **systemd** sebagai supervisi proses (start/stop/restart, kebijakan restart saat crash, shutdown graceful). Ini adalah **usulan mekanisme**, bukan fakta yang diterima — tidak ada unit `*.service` di source snapshot.
- **PROPOSED ENGINEERING MECHANIC**: satu unit untuk proses API/static dan satu unit per worker (total lima unit proses runtime), masing-masing dengan akun layanan unprivileged.

---

## 4. Konfigurasi Runtime dan Batas Secrets (MCR §7.3)

### 4.1 Kebutuhan Konfigurasi

- **SOURCE-BOUND / ACCEPTED DESIGN-BOUND**: source tidak membaca `process.env` di `apps/` maupun `packages/`; `packages/config` tidak memiliki source runtime. Konfigurasi runtime **belum ada** — ini fakta sumber, bukan defect.
- **PROPOSED ENGINEERING MECHANIC**: model konfigurasi berupa **file konfigurasi eksternal yang dapat dibaca root** plus **injeksi environment** pada saat proses dijalankan oleh supervisor. Nilai variabel aktual **tidak dicantumkan** dalam spec ini.
- Kategori konfigurasi yang direncanakan (tanpa nilai): koneksi PostgreSQL (host loopback, nama database, peran, sandi — nilai hanya di lingkungan staging), jalur artefak/state/log, pengaturan worker (interval polling dan batas batch — nilai numerik ditetapkan pada tahap implementasi, tidak dipreskripsikan di spec ini), dan identitas instance.

### 4.2 Perilaku Fail-Closed

- **PROPOSED ENGINEERING MECHANIC**: jika konfigurasi hilang, tidak terbaca, atau tidak valid, proses **menolak untuk start** (fail closed) dan mencatat kegagalan ke log; tidak ada default diam-diam yang mengubah makna operasional.

### 4.3 Batas Secrets

- **PROPOSED ENGINEERING MECHANIC**: secrets (sandi database, token, kredensial) tidak pernah ditempatkan di spec ini maupun di artefak; mekanisme injeksi (file/env) adalah usulan; seluruh nilai secrets hanya hidup di lingkungan staging non-produksi.
- **OPEN / REQUIRES DECISION**: batas injeksi secrets non-produksi (siapa yang menyediakan, bagaimana disimpan, siapa yang mengoperasikan) memerlukan keputusan MCR.

### 4.4 Sumber Waktu Otoritatif (Authoritative Time)

- **OPEN / REQUIRES DECISION**: fungsi obligation worker menerima `authoritativeTime` sebagai parameter (`apps/worker/src/runtime-obligation-worker.ts:2`); source **tidak** mendefinisikan sumber waktu otoritatif. Spec ini **tidak mengasumsikan** clock lokal, timezone, atau NTP host sebagai otoritatif. Keputusan sumber waktu otoritatif (mis. waktu server database, sumber waktu eksternal yang disetujui, atau kebijakan lain) diserahkan kepada MCR.
- Catatan: guard `SET TIME ZONE 'UTC'` dan persyaratan sesi UTC (`db/migrations/V001__cf01_core_schema.sql:3,6`; `db/verify/001_cf01_constraints.sql:17-21`) adalah batas database (SOURCE-BOUND) dan **tidak** menyelesaikan keputusan sumber waktu otoritatif untuk evaluasi obligation.

---

## 5. Provisioning dan Migrasi PostgreSQL (MCR §7.4)

### 5.1 Prasyarat Instance

- **SOURCE-BOUND / ACCEPTED DESIGN-BOUND**: keluarga mayor PostgreSQL **17** (verifier `tools/b01-db-verify.mjs:119-121`; bukti historis disposable PostgreSQL 17.9 pada `docs/construction/cf06-hold-and-nonauthority.md:20`); migrasi V001–V003; guard UTF8 dan UTC (`db/migrations/V001__cf01_core_schema.sql:3,6`; `db/verify/001_cf01_constraints.sql:17-21`); verifier **Flyway CLI 13.0.0** (`tools/b01-db-verify.mjs:88-91`); dua skema aplikasi `appts` dan `appts_sys` di luar `public` (`tools/b01-db-verify.mjs:137-140`).
- **PROPOSED ENGINEERING MECHANIC**: instance PostgreSQL 17 **loopback disposable** untuk verifikasi staging di masa depan (mencerminkan batas loopback-only pada `tools/b01-db-verify.mjs:80-86`).

### 5.2 Urutan Migrasi

- **PROPOSED ENGINEERING MECHANIC**: urutan **Flyway `migrate` → `validate` → `info`** pada database staging disposable yang telah disiapkan (prepared).
- **SOURCE-BOUND / ACCEPTED DESIGN-BOUND**: urutan pengujian verifier (`tools/b01-db-verify.mjs:141-144`) adalah **`clean` → `migrate` → `validate` → `info`**; langkah `clean` adalah dukungan pengujian loopback-only dan **bukan** instruksi operasional.
- **NOT VERIFIED**: migrasi V001–V003 **belum dijalankan** pada host staging DEP-001 mana pun. Bukti B07 (`docs/construction/cf06-release-manifest.md:30,34`) adalah bukti verifikasi disposable historis pada lingkungan loopback terpisah, bukan bukti pada host staging yang diusulkan.

### 5.3 Pemisahan Peran dan Grant

- **OPEN / REQUIRES DECISION**: pemisahan **peran migrasi** vs **peran aplikasi**, serta **grant pasca-migrasi** pada skema `appts`/`appts_sys`, memerlukan penerimaan operasional/keamanan dari MCR. Spec ini tidak mempreskripsikan peran, grant, maupun kepemilikan objek.

### 5.4 Backup/Checkpoint

- **PROPOSED ENGINEERING MECHANIC**: **checkpoint backup** sebelum penerapan migrasi pada staging (sebagai titik rollback), dan prosedur rollback/restore yang diverifikasi pada tahap staging.
- **OPEN / REQUIRES DECISION**: kebijakan backup/rollback operasional (frekuensi, retensi, lokasi) memerlukan keputusan MCR.

---

## 6. Paparan Web/API (MCR §7.5)

### 6.1 Same-Origin

- **SOURCE-BOUND / ACCEPTED DESIGN-BOUND**: klien web melakukan fetch dengan prefix relatif (`/api/v1/ui${path}`, `apps/web/src/api.ts:5`) — **same-origin** antara web dan API adalah bukti sumber; `apps/api/src/main.ts:2` hanya mendeskripsikan prefix API sisi server (`UI_API_PREFIX="/api/v1/ui"`).
- **PROPOSED ENGINEERING MECHANIC**: satu origin loopback tunggal; satu proses yang melayani API dan artefak statis SPA.

### 6.2 Mekanisme Hosting yang Diusulkan

- **PROPOSED ENGINEERING MECHANIC** (item implementasi — **belum ada** di source):
  - **Bootstrap proses API** (entry point yang memanggil komposisi yang diterima dan memulai listener);
  - **Adapter route Fastify** yang meregistrasi route deskriptor yang diterima (`describeUiApi`/`composeApi`) ke instance Fastify;
  - **Static SPA fallback** untuk route non-API (mengembalikan `index.html` untuk navigasi SPA);
  - **Health/readiness** (lihat Bagian 8).
- **OPEN / REQUIRES DECISION**: batas **reverse-proxy/TLS/provider non-produksi** (mis. apakah ada proxy di depan origin loopback, terminasi TLS, atau penyedia hosting) — tidak ada asumsi hostname produksi, TLS, atau provider dalam spec ini.

### 6.3 Service Worker Produksi

- **OPEN / REQUIRES DECISION**: packaging Service Worker untuk produksi **belum terpecahkan**. `apps/web/src/main.tsx:2` mendaftarkan jalur pengembangan `/src/offline/service-worker.ts`; `apps/web/vite.config.ts:5-13` tidak memiliki konfigurasi Service Worker produksi. Spec ini **tidak menyatakan** bahwa masalah ini dapat ditangani tanpa mutasi source; keputusan mekanisme packaging (dan apakah memerlukan perubahan build/source) diserahkan kepada MCR.

---

## 7. Eksekusi Worker (MCR §7.6)

### 7.1 Fungsi yang Diterima

- **SOURCE-BOUND / ACCEPTED DESIGN-BOUND**: empat fungsi worker single-pass (Bagian 2.1). `apps/worker/package.json` tidak memiliki `bin`/`main`/`scripts` — tidak ada entri eksekusi.

### 7.2 Mekanisme Eksekusi yang Diusulkan

- **PROPOSED ENGINEERING MECHANIC** (item implementasi masa depan — **belum ada** di source):
  - **Poll loop** yang memanggil fungsi worker secara periodik;
  - **Wrapper proses durable** per worker (satu wrapper per worker, mis. unit systemd);
  - **Interval polling** dan **batas batch** — nilai numerik tidak dipreskripsikan di spec ini;
  - **Koordinasi/anti-duplikasi** antar instance (mis. advisory lock PostgreSQL) — **tidak dinyatakan** bahwa advisory lock sudah menjamin apa pun; ini murni mekanisme yang diusulkan dan harus diverifikasi;
  - **Heartbeat** dan pelaporan status;
  - **Konfigurasi** per worker (Bagian 4).

### 7.3 Harapan Lifecycle dan Durable Obligation

- **PROPOSED ENGINEERING MECHANIC**: start/stop/restart via supervisor; kebijakan restart saat crash; retry dengan backoff; shutdown graceful.
- **SOURCE-BOUND / ACCEPTED DESIGN-BOUND**: effect engine menjamin idempotency via `commandId` + `payloadHash` dan menandai commit tidak pasti sebagai `EFFECT_UNCERTAIN_RECONCILIATION_REQUIRED` (`packages/runtime-d04/src/effect-engine.ts:3-4,14-16,29`), yang kemudian diselesaikan oleh reconciliation worker (`packages/runtime-d04/src/reconciliation.ts:4,9`; `apps/worker/src/reconciliation-worker.ts:2`).
- **NOT VERIFIED**: bukti runtime bahwa mekanisme eksekusi yang diusulkan melestarikan idempotency/reconciliation dan tidak menyebabkan silent loss atau duplicate semantic effect **masih menjadi verifikasi masa depan** pada tahap staging; tidak ada klaim hasil observasi pada sesi ini.

---

## 8. Operabilitas (MCR §7.7)

- **PROPOSED ENGINEERING MECHANIC** (seluruhnya mekanisme yang diusulkan, belum ada di source):
  - **Start/stop/restart**: via supervisor proses (Bagian 3.4).
  - **Logs**: ditulis ke direktori log terpisah; rotasi log ditetapkan pada tahap implementasi.
  - **Observability**: `pino 10.3.1` terdeklarasi sebagai dependensi (`packages/observability/package.json:11`) — **SOURCE-BOUND** untuk deklarasi dependensi; source logger itu sendiri **belum ada** (PROPOSED).
  - **Health/readiness**: endpoint/mekanisme health dan readiness untuk API/static dan worker (mis. liveness, readiness terhadap koneksi database) — item implementasi yang diusulkan.
  - **Monitoring hooks**: titik ekspor metrik/status untuk pemantauan eksternal — item implementasi yang diusulkan.
  - **Failure visibility**: kegagalan proses, kegagalan worker, dan kegagalan migrasi harus terlihat melalui log/status supervisor.
  - **Rollback/cleanup**: artefak versioned read-only memungkinkan rollback dengan mengganti versi artefak; rollback database mengikuti kebijakan backup/checkpoint (Bagian 5.4); prosedur stop/cleanup staging di Bagian 9.
  - **Artifact/config identity**: artefak diidentifikasi berdasarkan versi; konfigurasi diidentifikasi terpisah dari artefak.

---

## 9. Rencana Verifikasi Staging/Loopback Linux (MCR §7.8)

Rencana berikut adalah **tahapan verifikasi masa depan** — **BELUM DIEKSEKUSI** (**NOT VERIFIED**). Tidak ada perintah aktual, angka interval/port, maupun instruksi deploy yang dicantumkan di spec ini; detail operasional ditetapkan pada tahap implementasi yang diotorisasi.

| Tahap | Kegiatan (konseptual) | Status |
|---|---|---|
| V0 | Host bersih Debian 12 x64 loopback, tanpa instalasi layanan | **NOT VERIFIED** — belum dieksekusi |
| V1 | Instalasi toolchain Node `24.19.0` / npm `11.17.0` | **NOT VERIFIED** |
| V2 | Provisioning PostgreSQL 17 loopback disposable | **NOT VERIFIED** |
| V3 | Penerapan migrasi V001–V003 (migrate → validate → info) pada database disposable yang disiapkan + verifikasi guard UTF8/UTC | **NOT VERIFIED** |
| V4 | Instalasi artefak versioned read-only + konfigurasi eksternal | **NOT VERIFIED** |
| V5 | Start proses API/static + empat worker; health/smoke | **NOT VERIFIED** |
| V6 | Bukti worker: outbox, reconciliation, obligation, diagnostic-notification | **NOT VERIFIED** |
| V7 | Restart/recovery (simulasi crash/restart) | **NOT VERIFIED** |
| V8 | Stop/cleanup + pengumpulan bukti (log, status, hasil verifikasi) | **NOT VERIFIED** |

Kriteria penerimaan staging (konseptual): seluruh proses berjalan dengan akun unprivileged; migrasi berhasil dengan guard terpenuhi; health/readiness positif; bukti worker menunjukkan pemrosesan tanpa silent loss/duplikasi semantik; restart/recovery berhasil; cleanup menyisakan host bersih.

---

## 10. Batas Serah Terima Installer (MCR §7.9)

- **Builder (DEP-001, implementasi terotorisasi masa depan)** — membangun dan membekukan:
  - Artefak runtime versioned (read-only) dari baseline beku;
  - Paket yang dapat dikonsumsi Installer (struktur direktori, identitas artefak/versi);
  - Spesifikasi konfigurasi yang dibutuhkan (tanpa nilai/secrets);
  - Prosedur verifikasi staging (Bagian 9).
- **Installer Team** — menginstal, mengonfigurasi, dan mengoperasikan:
  - Instalasi toolchain, PostgreSQL, artefak, dan konfigurasi pada host staging;
  - Operasi harian (start/stop/restart, log, pemantauan, backup).
- **Batas**: Builder tidak menginstal/mengonfigurasi/mengoperasikan pada host; Installer tidak mengubah artefak yang dibekukan. Seluruh aktivitas ini hanya terjadi setelah otorisasi implementasi DEP-001 oleh MCR — **bukan** pada penugasan spec ini.

---

## 11. Ringkasan Label dan Item Terbuka

- **SOURCE-BOUND / ACCEPTED DESIGN-BOUND**: web build; deskriptor API + dependensi Fastify; empat fungsi worker; migrasi V001–V003 + guard UTF8/UTC; keluarga PG 17; verifier Flyway 13; prefix relatif `/api/v1/ui` (same-origin); idempotency/reconciliation effect engine; deklarasi dependensi pino.
- **PROPOSED ENGINEERING MECHANIC**: host Debian 12 x64 loopback; Node 24.19.0/npm 11.17.0 di host; satu proses API/static same-origin; wrapper systemd per worker; akun layanan unprivileged; direktori artefak versioned read-only + config/state/log terpisah; file konfigurasi eksternal + injeksi env; fail-closed; instance PG 17 loopback disposable; urutan migrate/validate/info pada database disposable yang disiapkan; checkpoint backup; bootstrap API, adapter Fastify, SPA fallback, health/readiness; poll loop, interval, advisory lock, heartbeat; logging/monitoring hooks; prosedur staging V0–V8.
- **OPEN / REQUIRES DECISION**: sumber waktu otoritatif obligation worker; peran migrasi vs aplikasi + grant pasca-migrasi; kebijakan backup/rollback operasional; packaging Service Worker produksi; batas reverse-proxy/TLS/provider non-produksi; batas injeksi secrets non-produksi.
- **NOT VERIFIED**: Linux PASS; migrasi pada host staging; perilaku runtime worker (idempotency/reconciliation, silent loss/duplikasi); seluruh tahap staging V0–V8.

Tidak ada item yang diklasifikasikan sebagai defect source; seluruh kesenjangan adalah konstruksi yang hilang, belum terverifikasi, atau keputusan engineering.

---

## Lampiran A — Referensi Bukti (Traceability)

| Referensi | Isi |
|---|---|
| `00_MCR_RESPONSE__MCR-to-BUILDER-001_DEP001_Specification_Assignment_v1.0_CONTROLLED.md` §2, §4, §7, §8, §10 | Otorisasi DEP-001 spec-only; BP-001 tetap CLOSED; sembilan bagian wajib; kebebasan engineering; return READY/STOP |
| `AUTHORITY/MCR-to-BP-A001_RELEASE.txt:191,195` | Baseline `e39f959fc6839c16c7c6cc75bd15079b4ed57a39` FROZEN; produksi/deployment/provider/real-data/secrets NOT AUTHORIZED |
| `EXECUTOR_CONTRACT.md:9-15` | Batas yang tidak boleh diubah tanpa otoritas (termasuk topologi runtime, batas produksi/data/secrets/provider) |
| `SOURCE_SNAPSHOT/RESTORE_SERVICE/apps/api/src/main.ts:2-3` | `UI_API_PREFIX="/api/v1/ui"`; `describeUiApi` (readOnlyRoutes, mutatingRoutes) |
| `SOURCE_SNAPSHOT/RESTORE_SERVICE/apps/api/src/composition.ts:2-3` | `ApiComposition` (projections/intents/diagnostics ports); `composeApi` |
| `SOURCE_SNAPSHOT/RESTORE_SERVICE/apps/api/package.json:10-13` | Dependensi `fastify 5.10.0`, `@fastify/static 10.1.2`; tanpa scripts/bin |
| `SOURCE_SNAPSHOT/RESTORE_SERVICE/apps/worker/src/outbox-worker.ts:2` | `runOutboxWorker` single-pass |
| `SOURCE_SNAPSHOT/RESTORE_SERVICE/apps/worker/src/reconciliation-worker.ts:2` | `runReconciliationWorker` single-pass |
| `SOURCE_SNAPSHOT/RESTORE_SERVICE/apps/worker/src/runtime-obligation-worker.ts:2` | `runRuntimeObligationWorker(repository, authoritativeTime)` |
| `SOURCE_SNAPSHOT/RESTORE_SERVICE/apps/worker/src/diagnostic-notification-worker.ts:2` | `runDiagnosticNotificationWorker` single-pass |
| `SOURCE_SNAPSHOT/RESTORE_SERVICE/apps/worker/package.json` | Tanpa `bin`/`main`/`scripts` |
| `SOURCE_SNAPSHOT/RESTORE_SERVICE/apps/web/vite.config.ts:5-13` | Konfigurasi build Vite (root, base, outDir, sourcemap) |
| `SOURCE_SNAPSHOT/RESTORE_SERVICE/apps/web/src/api.ts:5` | Klien web melakukan fetch prefix relatif `/api/v1/ui${path}` (bukti same-origin) |
| `SOURCE_SNAPSHOT/RESTORE_SERVICE/apps/web/src/main.tsx:2` | Registrasi Service Worker jalur dev `/src/offline/service-worker.ts` |
| `SOURCE_SNAPSHOT/RESTORE_SERVICE/apps/web/package.json:10-13` | Scripts `build` + `typecheck` saja |
| `SOURCE_SNAPSHOT/RESTORE_SERVICE/packages/config/` | Hanya `package.json` + `tsconfig.json` (tanpa source runtime) |
| `SOURCE_SNAPSHOT/RESTORE_SERVICE/packages/observability/package.json:11` | Dependensi `pino 10.3.1`; tanpa source logger |
| `SOURCE_SNAPSHOT/RESTORE_SERVICE/packages/persistence/src/index.ts:1`, `src/transaction.ts:20` | `pg` hanya di persistence; `runTransaction` |
| `SOURCE_SNAPSHOT/RESTORE_SERVICE/packages/runtime-d04/src/effect-engine.ts:3-4,14-16,29` | `executeLifecycleEffect`; idempotency `commandId`+`payloadHash`; `EFFECT_UNCERTAIN_RECONCILIATION_REQUIRED` |
| `SOURCE_SNAPSHOT/RESTORE_SERVICE/packages/runtime-d04/src/reconciliation.ts:4,9` | Logika reconciliation untuk commit tidak pasti |
| `SOURCE_SNAPSHOT/RESTORE_SERVICE/db/migrations/V001__cf01_core_schema.sql:3,6` | `SET TIME ZONE 'UTC'`; guard UTF8 |
| `SOURCE_SNAPSHOT/RESTORE_SERVICE/db/migrations/V002__cf01_runtime_and_exchange_schema.sql:3`, `V003__dg04_diagnostic_persistence.sql:3` | `SET TIME ZONE 'UTC'` |
| `SOURCE_SNAPSHOT/RESTORE_SERVICE/db/verify/001_cf01_constraints.sql:17-21` | Guard UTF8 + UTC |
| `SOURCE_SNAPSHOT/RESTORE_SERVICE/tools/b01-db-verify.mjs:80-91,110-121,137-144` | Loopback-only; Flyway CLI 13.0.0; psql PG 17; skema `appts`/`appts_sys`; urutan clean/migrate/validate/info |
| `SOURCE_SNAPSHOT/RESTORE_SERVICE/docs/construction/cf06-release-manifest.md:30,34` | Toolchain Node 24.19.0/npm 11.17.0/TS 6.0.3; verifikasi PG/Flyway disposable loopback; B07 PASS |
| `SOURCE_SNAPSHOT/RESTORE_SERVICE/docs/construction/cf06-hold-and-nonauthority.md:20` | Bukti disposable PostgreSQL 17.9/Flyway 13.0.0 loopback-only |
| `SOURCE_SNAPSHOT/RESTORE_SERVICE/package.json:6-10,25-28` | `packageManager` npm@11.17.0; engines; script `db:info`/`db:validate`/`db:migrate`/`test:migrations` |
| `RETURN/POST_VERIFICATION_FINDINGS.md` | Catatan kerja verifikasi teknis (8 gate PASS; DB opsional tidak dijalankan; snapshot tidak dimutasi) |
| `RETURN/MCR_DECISION_REQUEST_POST_VERIFICATION.md` | Permohonan keputusan MCR yang dijawab oleh MCR-to-BUILDER-001 |

---

— Builder: Hasan Muhammad — 14 Agustus 2026