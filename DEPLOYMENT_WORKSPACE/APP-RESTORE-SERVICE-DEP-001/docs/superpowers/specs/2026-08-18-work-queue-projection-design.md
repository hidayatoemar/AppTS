# Work-Queue Projection (UX-RS-01) — Design Doc

**Tanggal:** 2026-08-18
**Lokasi kerja:** `DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001/`
**Status:** Disetujui user (owner repo) — implementasi menunggu

---

## 1. Latar Belakang

Halaman `https://staging.ts.cifo.id/work` hanya menampilkan placeholder
`UX-RS-01 — Role-Scoped Work Queue — Current server projection required.`
Penyebab: `WorkQueueView` (`apps/web/src/views/WorkQueueView.tsx`) adalah
placeholder satu baris tanpa `children`, sehingga `ViewFrame`
(`apps/web/src/components/ViewFrame.tsx`) menampilkan fallback tersebut.

Fakta pendukung:

- Dari 15 view, hanya `UX-RS-12` (`ClosedTicketView`) yang terimplementasi
  penuh: fetch projection via `createUiClient().read(...)` lalu render.
- Server staging menjalankan `dep-bootstrap.ts` (static SPA + healthz/readyz
  saja); semua `/api/*` lainnya 404 karena routing bisnis adalah HELD work
  (lihat `CLOUD_DEPLOYMENT/README.md` §7 dan troubleshooting).
- Tidak ada projection "work-queue" di server side mana pun
  (`packages/interaction-d06/src/projection-service.ts` hanya menangani
  konteks per-ticket).
- Tidak ada data source yang tersambung (postgres staging kosong, "static-only").

## 2. Keputusan (disetujui user)

1. **Cakupan:** frontend view + endpoint API (`GET /api/v1/ui/work-queue`).
2. **Sumber data:** empty projection — endpoint mengembalikan envelope valid
   dengan daftar kosong (`data.items = []`), `currentness_ref: "CURRENT"`,
   tanpa database, tanpa data palsu.
3. **Lokasi perubahan:** hanya `DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001/`.
   `SOURCE_SNAPSHOT/RESTORE_SERVICE/` tetap beku (integritas paket BP-001).

## 3. Desain

### 3.1 Server — `apps/api/src/routes/work-queue.ts` (baru)

- `registerWorkQueueRoute(app: FastifyInstance): void` mendaftarkan
  `GET /api/v1/ui/work-queue`.
- Response JSON mengikuti bentuk `UiViewEnvelope` yang didefinisikan di
  `apps/web/src/api.ts`:

  ```json
  {
    "view_id": "UX-RS-01",
    "source_version_set_ref": "appts-restore-service-dep001/work-queue/v1",
    "generated_at": "<ISO 8601 saat request>",
    "currentness_ref": "CURRENT",
    "data": { "items": [] }
  }
  ```

- `source_version_set_ref` adalah nilai deployment-defined (bukan dari
  authority; tidak ada kontrak work-queue yang diterima — didokumentasikan
  sebagai keputusan konstruksi).
- **Tanpa impor paket bisnis** (`pg`, `persistence`, `diagnostics`,
  `interaction-d06`, apa pun yang mengandung `pending-capture`/`worker`)
  sehingga tetap mematuhi `tests/dep001/api-bootstrap.test.ts` (test impor
  terlarang) dan topologi runtime staging.
- Dipanggil dari `dep-bootstrap.ts` di dalam `registerDeploymentRoutes()`
  sebelum catch-all `/*`. Fastify memprioritaskan route spesifik di atas
  wildcard, sehingga SPA fallback untuk `/api/*` lainnya tidak berubah
  (tetap 404/405, sesuai test eksisting).

### 3.2 Frontend — `apps/web/src/views/WorkQueueView.tsx` (ganti)

Mengikuti pola `ClosedTicketView`:

- `useState` untuk `projection` dan `failure`; `useEffect` memanggil
  `createUiClient().read("/work-queue")`.
- Validasi `result.view_id === "UX-RS-01"`, selain itu `failure =
  WORK_QUEUE_PROJECTION_VIEW_MISMATCH`.
- Render:
  - `ViewFrame viewId="UX-RS-01" title="Role-Scoped Work Queue"`
  - `CurrentnessBanner` (dari `currentness_ref`; selain `CURRENT` →
    banner fail-closed, sama seperti view lain)
  - Daftar work item: render toleran — setiap item adalah record; hanya
    field string yang dikenal yang dirender (`ticket_ref`, `purpose_ref`,
    `domain_ref`, `status_ref`), tanpa asumsi bentuk item yang kaku
    (shape item belum punya kontrak resmi).
  - Empty state saat `items` kosong: pesan bahwa tidak ada work item
    untuk peran saat ini.
  - `failure` → `<p role="alert">` (mis. `UI_HTTP_404` di staging).
- Tidak ada penulisan/otoritas baru: view hanya membaca projection.

### 3.3 Test — `tests/dep001/api-bootstrap.test.ts` (tambah kasus)

- `GET /api/v1/ui/work-queue` → `200`, body JSON (bukan HTML SPA),
  `view_id === "UX-RS-01"`, `currentness_ref === "CURRENT"`,
  `Array.isArray(data.items)` dan kosong.
- Kasus 404 eksisting untuk `/api/v1/ui/pending-captures` dsb. tetap lolos.

## 4. Verifikasi

- `npm run typecheck`
- `npm run build` (membangun `apps/web/dist` yang dibutuhkan test bootstrap)
- `node --experimental-strip-types --test tests/dep001/api-bootstrap.test.ts`
- `npm run test:integration` (termasuk `ui-routes.integration.test.ts`)
- `npm run verify:boundaries`

## 5. Pencatatan

- Perubahan dicatat di `RETURN/` deployment workspace (dokumen kerja
  builder, bukan otoritas).
- Perilaku staging setelah redeploy: `/work` menampilkan "tidak ada work
  item" (bukan placeholder); endpoint `/api/v1/ui/work-queue` mengembalikan
  envelope kosong yang valid.
