# BUILDER-to-MCR-003 — RESTORE_SERVICE DEP-001 IMPLEMENTATION AND LINUX STAGING VERIFICATION CONTINUATION RETURN — STOP

**Comm ID:** BUILDER-to-MCR-003
**Version:** v1.0_CONTROLLED
**Date:** 14 Agustus 2026 WIB
**From:** RESTORE_SERVICE Builder Team (Hasan Muhammad)
**To:** MCR (Project Director / Architect)
**Primary Response To:** `MCR-to-BUILDER-003_RESTORE_SERVICE_DEP001_Runtime_Transport_Disposition_and_Implementation_Continuation_v1.0_CONTROLLED.md`
**Message Type:** STOP RETURN / DISPOSITION REQUEST (PENDING-CAPTURE PERSISTENCE SURFACE)
**Status:** `STOP — PENDING-CAPTURE PERSISTENCE CANNOT BE CONSTRUCTED WITHIN FROZEN V001–V003 SEMANTICS`

---

## 1. Status

Builder mengembalikan laporan kelanjutan implementasi DEP-001 dengan status:

> **STOP — PENDING-CAPTURE PERSISTENCE CANNOT BE CONSTRUCTED WITHIN FROZEN V001–V003 SEMANTICS**

STOP ini adalah **STOP otoritas (authority STOP)** yang dimandatkan oleh MCR-003 §5 (`…Builder shall STOP and report the exact gap…`) dan §6 (STOP tetap diperlukan bila resolusi menuntut perubahan makna data atau semantik skema/migrasi), **bukan** karena defect source. Kesenjangan yang dilaporkan adalah **kesenjangan permukaan persisten** (persistence-surface gap) antara input capture yang diterima source dan kolom wajib tabel beku V001–V003 — bukan pelanggaran source terhadap makna yang diterima.

Tidak ada klaim PASS. Tidak ada tahap V0–V8 yang dieksekusi pada sesi ini (lihat Bagian 8). Seluruh pekerjaan yang tercatat (Bagian 4) adalah **bukti konstruksi parsial (L1)**, bukan bukti V0–V8.

## 2. Rantai Otoritas (Authority Chain)

- **BP-001 kanonik tetap COMPLETE / ACCEPTED / CLOSED dan FROZEN** pada baseline `e39f959fc6839c16c7c6cc75bd15079b4ed57a39`. Canonical Build Pack ZIP dan `SOURCE_SNAPSHOT/RESTORE_SERVICE/` **tidak dimodifikasi dan tidak direpublish** oleh penugasan ini (MCR-002 §1, §7; MCR-003 §1, §9).
- **MCR-003 mengaktifkan kembali DEP-001** ("DEP-001 IMPLEMENTATION RE-ACTIVATED") **hanya dengan syarat** seluruh ketentuan §5 (repository translation scope) dan §6 (continuation authority) dipatuhi. MCR-003 §5 secara eksplisit memerintahkan STOP bila runtime yang diterima **tidak dapat diimplementasikan secara benar dalam V001–V003 tanpa perubahan skema/semantik**, dan §6 §6c mempertahankan STOP untuk *data meaning atau migration/schema semantic change*.
- **STOP ini adalah STOP yang sah menurut rantai tersebut**: permukaan capture yang diterima (input web-offline dan dispatcher API) tidak membawa identitas/metadata domain yang diwajibkan kolom NOT NULL tabel beku; menerjemahkan antarmuka capture ke SQL dalam semantik V001–V003 **tidak dapat dilakukan secara setia** tanpa salah satu dari: (a) menciptakan identitas/ metadata yang tidak bersumber dari input yang diterima, atau (b) memperluas skema/kontrak — keduanya melintasi larangan MCR-003 §5 dan §9.
- Status bukan defect source: BP-001 dan baseline beku tetap utuh; kesenjangan berada pada **permukaan konstruksi runtime** yang memang belum didefinisikan source (konsisten dengan temuan GAP-002/GAP-003 dan fakta `packages/persistence` hanya menyediakan primitif pool/transaction, bukan repository SQL).

## 3. Ruang Lingkup Non-Tujuan (ditegaskan kembali)

- Tidak ada aktivasi produksi/deployment/release, UAT, data operasional nyata, secrets/kredensial produksi, aktivasi provider eksternal, atau paparan publik/LAN (MCR-002 §7; MCR-003 §9).
- Tidak ada mutasi `SOURCE_SNAPSHOT/RESTORE_SERVICE/`, `db/migrations/*`, `package-lock.json`, `Dockerfile*`, `docker-compose*`, atau manifest/paket BP-001.
- Selain workspace DEP terpisah dan delta L1 yang dirinci pada Bagian 4, satu-satunya artefak baru di root Build Pack pada sesi ini adalah **dokumen return ini** di `RETURN/` (write-only). Tidak ada mutasi pada source snapshot kanonik atau artefak BP-001 yang dilindungi.

## 4. Pekerjaan Aktual / Delta (Actual Work / Delta)

### 4.1 Workspace terpisah

- Workspace `DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001/` dibuat terpisah dari Build Pack kanonik, diturunkan dari baseline beku.
- **Inventaris hash awal 178 file** dilakukan terhadap source beku: seluruh file yang disalin mencocokkan source frozen snapshot — **`diffCount=0`** — sebelum pekerjaan L1 dimulai. Ini adalah bukti lineage baseline, **bukan** bukti V0 (artifact identity formal) atau bukti Linux PASS.

### 4.2 Lingkungan Docker Linux amd64

- Tersedia lingkungan Docker Linux **amd64** untuk eksekusi bukti di dalam container Linux (Node `24.19.0` / npm `11.17.0` sesuai `package.json:6-10`). Ketersediaan lingkungan ini adalah prasyarat, **bukan** bukti eksekusi Linux staging aktual.

### 4.3 Layer 1 (L1) — hanya konfigurasi/observability + tes di workspace DEP

- `packages/config/` — source runtime konfigurasi baru: `src/errors.ts`, `src/validation.ts`, `src/api-config.ts`, `src/worker-config.ts`, `src/index.ts`; `package.json` diberi `main`/`types`/`exports` agar dapat dikonsumsi workspace; **tanpa** nilai/secrets, **tanpa** permukaan waktu otoritatif yang dapat dikonfigurasi (lih. tes `config.test.ts:162`).
- `packages/observability/` — source logger (pino) baru: `src/index.ts` dengan redaksi secrets (field bernama, URL kredensial, header) dan serialisasi error; `package.json` diberi `main`/`types`/`exports`.
- `tests/dep001/config.test.ts` (10 tes) dan `tests/dep001/observability.test.ts` (8 tes) — **total 18 tes L1**.
- **Tidak ada** kode L2 (repository translation SQL, bootstrap API/web/worker, adapter transport, unit systemd, konfigurasi eksternal, artefak versioned, staging DB, skema) yang dibuat pada sesi ini.

### 4.4 Bukti Docker Node 24.19/npm 11.17 saat ini (parsial, bukan V0–V8 PASS)

- `verify:toolchain` — **PASS** di Docker Linux amd64 (Node 24.19.0 / npm 11.17.0).
- `typecheck:projects` (emisi `packages/*/dist`) — **PASS**.
- `verify:boundaries` — **PASS**.
- **18 tes L1** (`tests/dep001/config.test.ts` + `tests/dep001/observability.test.ts`) — **PASS** di Docker Linux amd64.

**Pernyataan eksplisit:** bukti di atas adalah **bukti konstruksi parsial L1** (configuration & observability layer + tes), bukan V0–V8 PASS, bukan Linux PASS, bukan keberhasilan deployment, dan bukan kesiapan produksi. Tahap V0–V8 belum dieksekusi (Bagian 8).

## 5. Tidak Ada Implementasi L2 Setelah Hold G2

Setelah penemuan hard stop G2 (Bagian 6), **tidak ada** pekerjaan berikut yang dilakukan:

- Tidak ada **repository translation interface→SQL** (RuntimeEffectStore, OutboxRepository, ReconciliationRepository, DiagnosticNotificationRepository, PendingCapture/pending-capture surface, dst.) yang ditulis;
- Tidak ada **API/web bootstrap**, static SPA fallback, health/readiness, atau packaging Service Worker yang dibuat;
- Tidak ada **worker runner/supervisi** (systemd atau padanannya), poll loop, atau adapter transport staging yang dibuat;
- Tidak ada **artefak deployment versioned**, manifest/hash paket DEP-001, atau konfigurasi eksternal/secrets staging;
- Tidak ada **staging database** diprovisi dan **tidak ada** migrasi dijalankan;
- Tidak ada **V0–V8** yang dieksekusi;
- Tidak ada **skema/migrasi/objek database baru** dan tidak ada **perubahan semantik** apa pun.

## 6. Bukti Hard Stop (G2) — Permukaan Persistensi Pending-Capture Tidak Dapat Dibangun dalam Semantik V001–V003

### 6.1 Permukaan capture yang diterima source (input)

- **API dispatcher:** `UiIntentDispatcher { dispatch(contractRef, payload); capture(payload: unknown): Promise<unknown>; }` (`apps/api/src/routes/ui-intents.ts:2`) — `capture` menerima `payload: unknown` yang **tidak bertipe**; tidak ada identitas source-system, subject, actor/captured-by, source label, disclosure, provenance, retention, maupun identitas konten/skema bertipe yang dibawa atau divalidasi oleh antarmuka.
- **Web offline envelope:** `PendingCaptureEnvelope { captureId; kind: "OBSERVATION" | "DRAFT_EVIDENCE"; payload: Readonly<Record<string, unknown>>; localSequence; createdAt; sensitiveFinalEffect: false; }` (`apps/web/src/offline/pending-capture.ts:1`) — envelope membawa `captureId`, `kind`, `payload` tak bertipe, `localSequence`, `createdAt`, `sensitiveFinalEffect`. **Tidak membawa**: source-system, subject, captured-by, source label, disclosure label, provenance, retention obligation, maupun identitas konten/skema bertipe.
- `savePendingCapture` (`apps/web/src/offline/pending-capture.ts:3`) hanya menjamin `sensitiveFinalEffect === false`, batas 250 item, dan pembekuan envelope — tidak menambahkan identitas domain di atas.

### 6.2 Kolom wajib tabel beku (persistence target)

- **`appts.pending_capture`** (`db/migrations/V002__cf01_runtime_and_exchange_schema.sql:503-514`) mewajibkan **NOT NULL**: `source_system_ref_id uuid` (baris 505), `subject_ref uuid` (506), `captured_by_ref uuid` (507), `capture_time timestamptz(3)` (508), `source_label_ref text` (509), `provisional_payload_ref uuid` (510), `sync_status_ref text` (511).
- **`appts.source_observation`** (`db/migrations/V001__cf01_core_schema.sql:80-116`) mewajibkan **NOT NULL**: `committed_at` (91), `disclosure_label_ref uuid` (94), `source_content_ref_kind text` (102), `subject_ref uuid` (107), `provenance_ref uuid` (110) — ditambah constraint cabang konten (`source_content_ref_kind` = URI/TEXT/JSON dengan field dan skema-version yang bersesuaian, baris 114-115).
- **`appts.evidence_object`** (`db/migrations/V001__cf01_core_schema.sql:800-840`) mewajibkan **NOT NULL**: `committed_at` (811), `disclosure_label_ref uuid` (815), `subject_type text` (821), `subject_id uuid` (822), `evidence_type_ref text` (823), `source_context_ref jsonb` (824), `source_context_ref_schema_version text` (825), `content_ref_kind text` (827), `retention_obligation_ref uuid` (835) — ditambah constraint cabang konten/skema (837-839).

### 6.3 Kesenjangan (gap) eksak

Input capture yang diterima (6.1) **tidak menyediakan** nilai untuk seluruh identitas/metadata domain yang diwajibkan (6.2): source-system identity (`source_system_ref_id`), subject identity (`subject_ref`), actor identity (`captured_by_ref`), source label (`source_label_ref`), disclosure label (`disclosure_label_ref`), provenance (`provenance_ref`), retention obligation (`retention_obligation_ref`), serta identitas konten/skema bertipe (`source_content_ref_kind`/`source_context_ref`/`content_ref_kind` beserta skema-version-nya). Envelope web-offline tidak mendefinisikan darimana identitas-identitas itu berasal; `capture(payload: unknown)` tidak menegosiasikannya.

### 6.4 Mengapa "UUID menggantung" tidak setia secara semantik

- `provisional_payload_ref uuid NOT NULL` (`V002:510`) dapat diisi dengan UUID acak yang **sah secara DDL** (tidak ada FK/constraint yang memaksa keberadaan referent), tetapi **bukan referent payload yang setia secara semantik**: UUID tersebut akan menunjuk ke "sesuatu yang tidak ada" — tidak ada objek/baris yang benar-benar menampung payload capture. Menerjemahkan `pending_capture` dengan cara ini **mengubah makna field yang dipersistenkan** (payload referent menjadi placeholder kosong), yang dilarang MCR-003 §5 ("no reinterpretation of persisted field meaning").
- Demikian pula `subject_ref`, `captured_by_ref`, `source_system_ref_id`, `source_label_ref`, `disclosure_label_ref`, `provenance_ref`, `retention_obligation_ref`: nilai-nilai ini **harus lahir dari input yang diterima atau dari registri domain yang disetujui**; karena permukaan capture tidak membawanya dan source tidak mendefinisikan kebijakan derivasinya, **menciptakannya (inventing)** berarti Builder menetapkan makna operasional/otoritas yang tidak pernah diterima.

### 6.5 Mengapa menciptakan ID/metadata atau menambah V004/objek baru melanggar MCR-003 §5

- **Inventing ID/metadata**: memasok nilai identitas yang tidak bersumber dari input capture = menetapkan tanggung jawab runtime/otoritas yang tidak didefinisikan source; ini melintasi §6 §6d (Role/authority) dan §9 (semantic redesign / new runtime responsibility di luar simulasi yang diotorisasi).
- **V004 / objek baru**: MCR-003 §5 secara eksplisit melarang "no V004 or other new migration; no new column, table, index, constraint, trigger, stored procedure, or schema object". Perluasan skema untuk menampung identitas yang hilang adalah jalur yang **tidak diotorisasi** pada siklus ini; MCR-003 §5 menutup dengan perintah: *"Builder shall not compensate by silently extending the schema"*.

### 6.6 `qualified_external_record` bukan referent capture

- `appts.qualified_external_record` (`V002:447-485`) adalah tabel **sinkronisasi/kualifikasi** untuk record eksternal: membawa `source_system_ref_id` (468), `external_record_identity` (469), `external_record_version_ref` (470), `subject_ref` (471), `qualification_result_ref` (472), `payload_or_reference_ref_kind` (475) — untuk **record eksternal yang ter-kualifikasi dari source system**. Ia **bukan** referent payload pending-capture web-offline: capture web-offline bukan record eksternal yang ter-qualification, dan memetakan `provisional_payload_ref` ke baris `qualified_external_record` akan mengubah makna field (mengganti makna "payload sementara capture" dengan "payload record eksternal terkualifikasi"). Oleh karena itu ia tidak menyelesaikan kesenjangan 6.3.

### 6.7 Kesimpulan hard stop

Terjemahan antarmuka pending-capture ke SQL **tidak dapat dibangun secara benar di dalam semantik beku V001–V003** tanpa perubahan skema atau semantik. Ini adalah kondisi STOP persis sebagaimana MCR-003 §5: *"If the accepted runtime cannot be implemented correctly within V001–V003 without schema or semantic change, Builder shall STOP and report the exact gap."* Kesenjangan yang dilaporkan: **permukaan capture yang diterima tidak membawa identitas/metadata domain yang diwajibkan tabel beku, dan tidak ada jalur derivasi yang diterima untuk mendapatkannya dalam batas.**

## 7. Pilihan Disposisi MCR yang Diminta

Builder **tidak memilih** salah satu opsi di bawah ini; seluruh opsi bersifat non-produksi, loopback-only, dan tanpa provider eksternal. MCR dimohon memberikan disposisi dalam dokumen otoritas terkontrol berikutnya (mis. MCR-to-BUILDER-004):

- **(A) Disposisi binding/kontrak terkontrol** — MCR menetapkan binding/kontrak yang mendefinisikan: identitas source web-offline yang divalidasi (validated web-offline source), identitas subject, identitas actor/captured-by, source label, identitas disclosure, identitas provenance, identitas retention, serta **referent payload** yang setia (objek/baris yang benar-benar menampung payload capture) — beserta kebijakan derivasi/validasi yang disetujui. Setelah disposisi (A), Builder dapat menerjemahkan permukaan capture ke V001–V003 **tanpa** mengubah skema.
- **(B) Cakup eksplisit pending-capture keluar + otorisasi penolakan fail-closed bertipe** — MCR secara eksplisit mengeluarkan (scope out) persistensi pending-capture dari siklus DEP-001 ini dan mengotorisasi perilaku fail-closed bertipe pada runtime (mis. `capture`/pending-capture menolak dengan kode tipe yang terdokumentasi ketika identitas domain tidak tersedia), dengan penandaan eksplisit dan tanpa mengubah skema/semantik.
- **(C) Otorisasi ekstensi kontrak/skema minimum** — MCR mengotorisasi ekstensi kontrak/skema minimum yang ditentukan secara tepat (identitas/metadata mana yang ditambahkan, pada objek mana, dengan semantik apa), sebagai pengecualian eksplisit terhadap MCR-003 §5 untuk siklus ini.

## 8. Matriks Verifikasi V0–V8

Berdasarkan MCR-002 §5 dan MCR-003 §7/§8. **Tidak ada klaim PASS.**

| Tahap | Persyaratan (MCR-002 §5) | Status |
|---|---|---|
| V0 | Artifact identity, manifest/hash, baseline lineage | `NOT EXECUTED — HELD FOR ATOMIC CONSTRUCTION` (hash inventory awal 178 file `diffCount=0` adalah bukti lineage kerja, bukan V0 formal) |
| V1 | Toolchain/dependency reproducibility | `NOT EXECUTED — HELD FOR ATOMIC CONSTRUCTION` (verifikasi toolchain parsial di Docker Linux ada sebagai bukti L1, bukan V1) |
| V2 | PostgreSQL provisioning dan eksekusi migrasi | `NOT EXECUTED — HELD FOR ATOMIC CONSTRUCTION` |
| V3 | Validasi migrasi + bukti backup/restore atau disposable-recreate | `NOT EXECUTED — HELD FOR ATOMIC CONSTRUCTION` |
| V4 | Perilaku fail-closed konfigurasi/secrets eksternal dan batas permission | `NOT EXECUTED — HELD FOR ATOMIC CONSTRUCTION` |
| V5 | Start API/static, same-origin web/API, health/readiness, packaging Service Worker | `NOT EXECUTED — HELD FOR ATOMIC CONSTRUCTION` |
| V6 | Empat worker runner di bawah supervisi + mekanisme authoritative-time yang disetujui | `NOT EXECUTED — DEPEND ON UNRESOLVED CAPTURE SURFACE` |
| V7 | Restart/recovery/logging dan operasi least-privilege | `NOT EXECUTED — DEPEND ON UNRESOLVED CAPTURE SURFACE` |
| V8 | Bukti clean stop/restart/redeploy/restore untuk Installer handoff | `NOT EXECUTED — DEPEND ON UNRESOLVED CAPTURE SURFACE` |

## 9. Komitmen No-Action

Sampai disposisi terkontrol baru (MCR-to-BUILDER-004 atau setara) diterima, Builder berkomitmen:

- **Tidak melanjutkan implementasi DEP-001** — tidak ada kode bootstrap/runner baru, tidak ada repository translation, tidak ada unit systemd, tidak ada konfigurasi/artefak, tidak ada staging database, tidak ada eksekusi V0–V8.
- **Tidak ada workaround skema atau semantik** — tidak ada V004, tidak ada kolom/indeks/constraint/objek baru, tidak ada reinterpretasi makna field, tidak ada penciptaan identitas/metadata yang tidak bersumber dari input yang diterima, dan tidak ada penandaan simulasi yang menyiratkan integrasi nyata.
- **BP-001 kanonik dan baseline beku tetap tidak tersentuh**; `SOURCE_SNAPSHOT/RESTORE_SERVICE/`, migrasi, package-lock, Docker/compose, dan manifest tidak dimodifikasi.
- Di luar workspace DEP dan delta L1 yang didaftarkan pada Bagian 4, satu-satunya artefak baru di root Build Pack dari sesi ini adalah dokumen return ini di `RETURN/`.

## 10. Lampiran Bukti (Evidence Appendix)

### Referensi authority

| Referensi | Isi |
|---|---|
| `MCR-to-BUILDER-002_…v1.0_CONTROLLED.md` §1, §7, §8 | BP-001 tetap CLOSED/frozen; prohibitions (tanpa mutasi BP-001, tanpa produksi/provider/data nyata); state transition IMPLEMENTATION ACTIVE → expected BUILDER-to-MCR-002 |
| `MCR-to-BUILDER-003_…v1.0_CONTROLLED.md` §5 (baris 64-75) | Repository translation terbatas pada V001–V003: tanpa V004/objek baru (baris 68-71); larangan reinterpretasi makna field (baris 71); **perintah STOP dan lapor gap eksak bila runtime tak dapat diimplementasikan tanpa perubahan skema/semantik (baris 75)**; larangan kompensasi dengan perluasan skema diam-diam |
| `MCR-to-BUILDER-003_…v1.0_CONTROLLED.md` §6 (baris 77-94) | Continuation authority; STOP tetap wajib untuk: perubahan makna data/migrasi/skema (baris 88), perubahan kontrak antarmuka (baris 89), Role/authority (baris 91), tanggung jawab runtime baru di luar simulasi staging (baris 92) |
| `MCR-to-BUILDER-003_…v1.0_CONTROLLED.md` §8 (baris 108-121) | Required return: repository translation inventory dan mapping ke objek V001–V003 (baris 119); konfirmasi tanpa ekstensi skema/migrasi (baris 120); matriks V0–V8 dari eksekusi Linux x64 aktual (baris 121) |
| `MCR-to-BUILDER-003_…v1.0_CONTROLLED.md` §9 (baris 123-125) | Prohibitions: tanpa semantic redesign; tanpa klaim simulasi = integrasi/provider nyata |
| `AUTHORITY/MCR-to-BP-A001_RELEASE.txt:191,195` | Baseline `e39f959fc6839c16c7c6cc75bd15079b4ed57a39` FROZEN; produksi/deployment/provider/real-data/secrets NOT AUTHORIZED |
| `EXECUTOR_CONTRACT.md:9-15` | Batas yang tidak boleh diubah tanpa otoritas (termasuk topologi runtime, batas produksi/data/secrets/provider) |

### Referensi source — permukaan capture (input)

| Referensi | Isi |
|---|---|
| `SOURCE_SNAPSHOT/RESTORE_SERVICE/apps/api/src/routes/ui-intents.ts:1` | `UI_INTENT_PATH="/api/v1/ui/intents"`; `UI_PENDING_CAPTURE_PATH="/api/v1/ui/pending-captures"` |
| `SOURCE_SNAPSHOT/RESTORE_SERVICE/apps/api/src/routes/ui-intents.ts:2` | `UiIntentDispatcher` dengan `dispatch(contractRef, payload)` dan `capture(payload: unknown): Promise<unknown>` — tanpa identitas domain pada input |
| `SOURCE_SNAPSHOT/RESTORE_SERVICE/apps/web/src/offline/pending-capture.ts:1` | `PendingCaptureEnvelope` — hanya captureId, kind, payload tak bertipe, localSequence, createdAt, sensitiveFinalEffect; **tanpa** source-system/subject/captured-by/source label/disclosure/provenance/retention/konten-skema bertipe |
| `SOURCE_SNAPSHOT/RESTORE_SERVICE/apps/web/src/offline/pending-capture.ts:3` | `savePendingCapture` — hanya menjamin `sensitiveFinalEffect === false`, batas 250, pembekuan envelope |
| `SOURCE_SNAPSHOT/RESTORE_SERVICE/apps/web/src/offline/pending-capture.ts:4` | `OFFLINE_AUTHORITY_LABEL="OFFLINE / NOT AUTHORITATIVE CURRENT CONTEXT"` |

### Referensi source — tabel beku (persistence target)

| Referensi | Isi |
|---|---|
| `SOURCE_SNAPSHOT/RESTORE_SERVICE/db/migrations/V002__cf01_runtime_and_exchange_schema.sql:503-514` | `appts.pending_capture` — NOT NULL: `source_system_ref_id` (505), `subject_ref` (506), `captured_by_ref` (507), `capture_time` (508), `source_label_ref` (509), `provisional_payload_ref` (510), `sync_status_ref` (511) |
| `SOURCE_SNAPSHOT/RESTORE_SERVICE/db/migrations/V001__cf01_core_schema.sql:80-116` | `appts.source_observation` — NOT NULL: `committed_at` (91), `disclosure_label_ref` (94), `source_content_ref_kind` (102), `subject_ref` (107), `provenance_ref` (110); constraint cabang konten URI/TEXT/JSON + skema-version (114-115) |
| `SOURCE_SNAPSHOT/RESTORE_SERVICE/db/migrations/V001__cf01_core_schema.sql:800-840` | `appts.evidence_object` — NOT NULL: `committed_at` (811), `disclosure_label_ref` (815), `subject_type` (821), `subject_id` (822), `evidence_type_ref` (823), `source_context_ref` (824), `source_context_ref_schema_version` (825), `content_ref_kind` (827), `retention_obligation_ref` (835); constraint cabang konten/skema (837-839) |
| `SOURCE_SNAPSHOT/RESTORE_SERVICE/db/migrations/V002__cf01_runtime_and_exchange_schema.sql:447-485` | `appts.qualified_external_record` — sinkronisasi/kualifikasi record eksternal (`source_system_ref_id` 468, `external_record_identity` 469, `qualification_result_ref` 472, `payload_or_reference_ref_kind` 475); **bukan** referent pending-capture web-offline |

### Referensi bukti kerja (delta L1)

| Referensi | Isi |
|---|---|
| `DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001/` (workspace terpisah) | Diturunkan dari baseline beku; inventaris hash awal 178 file vs frozen source = `diffCount=0` |
| `DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001/packages/config/src/*.ts` | L1 config: errors/validation/api-config/worker-config/index; tanpa nilai/secrets; tanpa permukaan waktu otoritatif |
| `DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001/packages/observability/src/index.ts` | L1 observability: logger pino dengan redaksi secrets |
| `DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001/tests/dep001/config.test.ts` (10 tes), `tests/dep001/observability.test.ts` (8 tes) | 18 tes L1 — PASS di Docker Linux amd64 |
| `DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001/package.json:6-10` | `packageManager` npm@11.17.0; engines Node 24.19.0/npm 11.17.0 |
| Bukti Docker (sesi) | `verify:toolchain` PASS, `typecheck:projects` PASS, `verify:boundaries` PASS, 18 tes L1 PASS — bukti parsial L1, bukan V0–V8 |
| `RETURN/DEP-SPEC-001_…v0.1_WD.md`, `RETURN/DEP-GAP-001_…v0.1_WD.md` | Basis spesifikasi terkontrol yang diterima MCR-002 §1; GAP-002/GAP-003/GAP-006 relevan pada kesenjangan capture surface |
| `RETURN/BUILDER-to-MCR-002_…v1.0_CONTROLLED.md` | Return STOP sebelumnya (runtime-transport) yang diterima MCR-003 §1 |

---

**Artifact = Authority. Chat = Notification Only.**

— Builder: Hasan Muhammad — 14 Agustus 2026
