# Permohonan Keputusan MCR — Pembuatan Deployment Package Terpisah

Status: DRAFT — dokumen kerja (bukan otoritas)
Tujuan: Permohonan keputusan MCR untuk mengotorisasi ruang kerja/paket deployment terpisah `APP-RESTORE-SERVICE-DEP-001`.
Tanggal: 14 Agustus 2026

---

## 1. Ringkasan

Verifikasi teknis terhadap `APP-RESTORE-SERVICE-BP-001` telah selesai dilaksanakan. Kedelapan gate teknis wajib lulus melalui tooling verifikasi Docker yang ada (`Dockerfile.build`, `docker-compose.build.yml`, `verify.ps1`). Verifikasi database bersifat opsional dan **tidak dijalankan** pada sesi ini.

BP-001 **tetap beku (frozen)**; `SOURCE_SNAPSHOT/RESTORE_SERVICE/` **tidak diubah** — tetap terikat baseline `e39f959fc6839c16c7c6cc75bd15079b4ed57a39`.

Dokumen ini memohon MCR untuk memutuskan apakah akan mengotorisasi paket/ruang kerja deployment terpisah `APP-RESTORE-SERVICE-DEP-001`. Otorisasi tersebut **belum diberikan** dan **tidak diklaim** oleh dokumen ini.

## 2. Status BP-001

- Snapshot source: FROZEN. Tidak ada mutasi pada `SOURCE_SNAPSHOT/RESTORE_SERVICE/`.
- Hasil teknis: `technical verification gates: PASS` (8 gate wajib).
- Publikasi formal BP: `PENDING` — belum ada ZIP final beserta SHA-256 final dan regenerasi manifest final (lihat `RETURN/POST_VERIFICATION_FINDINGS.md`).
- Tidak ada perubahan makna produk/kebijakan, skema data/migrasi, makna kontrak/antarmuka, semantik lifecycle/state, peran/otoritas, maupun topologi runtime.

## 3. Hasil Verifikasi Teknis

| Gate | Status |
|---|---|
| `verify:toolchain` | PASS |
| `verify:boundaries` | PASS |
| `typecheck` | PASS |
| `build` | PASS |
| `test:contracts` | PASS |
| `test:integration` | PASS |
| `test:dg04` | PASS |
| `test:adverse` | PASS |
| Disposable DB verification | OPSIONAL — tidak dijalankan |

## 4. Permohonan Keputusan MCR

MCR dimohon untuk **memutuskan**:

> Apakah pembuatan **Deployment Package / ruang kerja terpisah** dengan identifikasi `APP-RESTORE-SERVICE-DEP-001` diotorisasi?

Permohonan ini tidak menyatakan bahwa paket tersebut telah diotorisasi. Jika disetujui, MCR selanjutnya dimohon untuk **menyetujui Deployment Specification** yang menjabarkan hal-hal berikut:

1. **Topologi proses** — pemetaan proses runtime: API, web statis, dan workers (outbox, reconciliation, obligation, diagnostic-notification).
2. **Konfigurasi dan rahasia** — sumber konfigurasi aplikasi dan kebijakan pengelolaan secrets.
3. **Kebijakan provisioning & migrasi PostgreSQL** — cara instance disediakan dan kebijakan penerapan migrasi (V001–V003).
4. **Hosting & paparan jaringan API/web** — cara layanan API dan web statis di-hosting dan diekspos.
5. **Operasional & observability** — logging, monitoring, dan prosedur operasional.
6. **Penerimaan staging server lokal** — kriteria penerimaan instalasi staging di server lokal (loopback).

Dokumen ini **tidak** menentukan pilihan desain implementasi: tidak ada port, registry, kredensial, nama layanan, atau penyedia yang dipreskripsikan. Seluruhnya menjadi materi Deployment Specification untuk disetujui MCR.

## 5. Yang TIDAK Diotorisasi di Bawah BP-001

Berikut **tidak diotorisasi** oleh BP-001 dan memerlukan otorisasi terpisah:

- **Server deployment** — pemasangan/penjalanan layanan pada server apa pun.
- **Registry publishing** — publikasi image/artefak ke registry mana pun.
- **Aktivasi data/secrets/provider nyata** — penggunaan data produksi, kredensial nyata, atau provider eksternal.
- **Perubahan topologi runtime** — mengubah arsitektur/topologi runtime dari yang terikat di snapshot.

### Landasan otoritas (bukti internal, bukan tautan)

- `EXECUTOR_CONTRACT.md:9-15` — daftar hal yang tidak boleh diubah tanpa otoritas, termasuk *runtime architecture/topology* (baris 14) dan *production, external-provider, real-data, credential, or secret boundaries* (baris 15).
- `AUTHORITY/MCR-to-BP-A001_RELEASE.txt:125` — Builder hanya boleh melakukan koreksi teknis minimum; wajib STOP/escalate bila solusi menuntut perubahan pada batas yang dilindungi (termasuk topologi runtime dan batas produksi/data/secrets/provider).
- `AUTHORITY/MCR-to-BP-A001_RELEASE.txt:195` — *Production/deployment/release activation/provider/real-data/secrets: NOT AUTHORIZED.*

## 6. Jalur Bertahap yang Diusulkan

1. **Keputusan MCR** atas pembuatan `APP-RESTORE-SERVICE-DEP-001` (permohonan ini).
2. **Persetujuan Deployment Specification** oleh MCR (ruang lingkup sebagaimana Bagian 4).
3. **Implementasi di ruang kerja baru** `APP-RESTORE-SERVICE-DEP-001` — terpisah dari BP-001; snapshot BP-001 tetap beku.
4. **Instalasi loopback/staging Linux** — verifikasi instalasi di server lokal (loopback) sesuai spec yang disetujui.
5. **Keputusan aktivasi produksi terpisah** — aktivasi produksi hanya bila diotorisasi eksplisit melalui keputusan/keputusan-keputusan lanjutan yang terpisah dari BP-001.

## 7. Catatan Integritas

Dokumen ini adalah **working decision record**. Dokumen ini beserta `RETURN/POST_VERIFICATION_FINDINGS.md` hanya akan dimasukkan ke dalam manifest yang diregenerasi **jika ZIP final BP menyertakannya**. Sampai saat itu, keberadaan dokumen-dokumen ini mengubah isi working copy relatif terhadap manifest yang ada, sehingga publikasi formal BP tetap berstatus PENDING.

---

— Builder: Hasan Muhammad — 14 Agustus 2026
