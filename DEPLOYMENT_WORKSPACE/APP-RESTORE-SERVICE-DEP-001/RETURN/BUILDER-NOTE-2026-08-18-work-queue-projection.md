# BUILDER-NOTE — Work-Queue Projection (UX-RS-01)

**Date:** 2026-08-18
**Location:** DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001/
**Type:** Dokumen kerja builder (bukan otoritas).

## Perubahan

1. `apps/api/src/routes/work-queue.ts` (baru) — endpoint `GET /api/v1/ui/work-queue`,
   envelope `UiViewEnvelope` kosong: `view_id=UX-RS-01`, `currentness_ref=CURRENT`,
   `data.items=[]`. `source_version_set_ref` bernilai deployment-defined
   `appts-restore-service-dep001/work-queue/v1` (tidak berasal dari authority).
2. `apps/api/src/dep-bootstrap.ts` — registrasi route di `registerDeploymentRoutes`
   sebelum catch-all. Tanpa impor paket bisnis; path `/api/*` lain tetap 404/405.
3. `apps/web/src/views/WorkQueueView.tsx` — implementasi view: fetch projection,
   validasi view_id, render currentness banner, daftar item toleran, empty state,
   alert kegagalan. Placeholder "Current server projection required." dihapus.
4. `tests/dep001/api-bootstrap.test.ts` — test endpoint work-queue.
5. `package.json` (engines) — koreksi konsistensi toolchain: `node` dari
   `24.18.0` → `24.19.0` agar selaras `.node-version` dan `verify:toolchain`
   (inkonsistensi pre-existing, bukan bagian task).

## Status verifikasi

- verify:toolchain, verify:boundaries, typecheck, build, test:integration (46/46),
  tests/dep001 (27/27): PASS.

## Catatan

- Tidak ada kontrak work-queue resmi yang diterima; bentuk `data.items` adalah
  keputusan konstruksi deployment (dirender toleran oleh view).
- Perilaku staging setelah redeploy: `/work` menampilkan empty state, endpoint
  mengembalikan envelope kosong valid.
- Belum di-commit (menunggu instruksi user).
