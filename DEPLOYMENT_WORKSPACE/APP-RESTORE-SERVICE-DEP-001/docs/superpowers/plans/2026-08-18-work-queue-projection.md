# Work-Queue Projection (UX-RS-01) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Halaman `/work` menampilkan projection work-queue nyata dari endpoint baru `GET /api/v1/ui/work-queue` (empty projection, tanpa placeholder).

**Architecture:** Endpoint server ditambahkan di bootstrap deployment (`dep-bootstrap.ts`) via modul route baru tanpa impor paket bisnis (tetap lolos test larangan impor). `WorkQueueView` diubah mengikuti pola `ClosedTicketView` (fetch → validasi view_id → render dengan currentness banner, empty state, dan alert gagal).

**Tech Stack:** Fastify 5.10.0, React 19 (Vite 8), TypeScript 6.0.3, Node 24.19.0, Node native test runner (`node:test` + `--experimental-strip-types`).

## Global Constraints

- Versi toolchain wajib: Node `24.19.0`, npm `11.17.0` (`verify:toolchain` menolak versi lain; `npm ci` wajib pakai lockfile).
- Hanya edit di `DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001/`. `SOURCE_SNAPSHOT/` TIDAK boleh disentuh.
- `dep-bootstrap.ts` tidak boleh mengimpor `pg`, `@appts-restore-service/persistence`, `diagnostics`, `interaction-d06`, atau path berisi `pending-capture`/`worker` (dijaga `tests/dep001/api-bootstrap.test.ts`).
- Endpoint `/api/v1/ui/pending-captures`, `/api/v1/ui/diagnostics`, `/api/v1/ui/intents`, `/api/v1/worker/reconcile` harus tetap 404/405 (dijaga test eksisting).
- Tidak ada data palsu; endpoint mengembalikan daftar kosong (`data.items = []`).
- Semua perintah dijalankan dari `DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001/`.
- Jangan commit apa pun ke git (menunggu instruksi user).

---

### Task 1: Persiapan toolchain + dependensi

**Files:**
- (tidak ada perubahan file; hanya environment)

- [ ] **Step 1: Aktifkan Node 24.19.0 via nvm**

Run:
```bash
source ~/.nvm/nvm.sh && nvm install 24.19.0 && nvm use 24.19.0
```
Expected: `Now using node v24.19.0`. (Setiap shell berikutnya di sesi ini: `source ~/.nvm/nvm.sh && nvm use 24.19.0`.)

- [ ] **Step 2: Instal dependensi dengan lockfile**

Run:
```bash
npm ci --ignore-scripts --no-audit --no-fund
```
Expected: selesai tanpa error, `node_modules/` terisi.

- [ ] **Step 3: Validasi toolchain**

Run: `npm run verify:toolchain`
Expected: PASS (tidak ada output kegagalan).

- [ ] **Step 4: Bangun proyek agar `apps/web/dist` tersedia**

Run: `npm run build`
Expected: `tsc` + Vite selesai tanpa error; `apps/web/dist/index.html` dan `apps/web/dist/service-worker.js` ada.

- [ ] **Step 5: Sanity test bootstrap eksisting**

Run: `node --experimental-strip-types --test tests/dep001/api-bootstrap.test.ts`
Expected: semua test PASS (5 test hijau).

---

### Task 2: Endpoint server `GET /api/v1/ui/work-queue` (TDD)

**Files:**
- Modify: `tests/dep001/api-bootstrap.test.ts` (tambah 1 test)
- Create: `apps/api/src/routes/work-queue.ts`
- Modify: `apps/api/src/dep-bootstrap.ts`

**Interfaces:**
- Consumes: tidak ada (bukan dari task lain).
- Produces:
  - `registerWorkQueueRoute(app: FastifyInstance): void` di `apps/api/src/routes/work-queue.ts`
  - `WORK_QUEUE_SOURCE_VERSION_SET_REF = "appts-restore-service-dep001/work-queue/v1"` (konstanta `as const`)
  - Response JSON: `{ view_id: "UX-RS-01", source_version_set_ref, generated_at, currentness_ref: "CURRENT", data: { items: [] } }` dengan header `Cache-Control: no-store`.

- [ ] **Step 1: Tulis test yang gagal**

Tambahkan test berikut di akhir `tests/dep001/api-bootstrap.test.ts` (setelah test "never serves the SPA..." baris 71, sebelum test "fails closed" — urutan bebas; pastikan disisipkan dengan indentasi yang konsisten):

```ts
test("DEP bootstrap serves the empty work-queue projection at /api/v1/ui/work-queue", async () => {
  await withServer(async (app) => {
    const response = await app.inject({ method: "GET", url: "/api/v1/ui/work-queue" });
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers["cache-control"], "no-store");
    const envelope = response.json();
    assert.equal(envelope.view_id, "UX-RS-01");
    assert.equal(envelope.currentness_ref, "CURRENT");
    assert.equal(typeof envelope.source_version_set_ref, "string");
    assert.equal(typeof envelope.generated_at, "string");
    assert.ok(Array.isArray(envelope.data.items));
    assert.equal(envelope.data.items.length, 0);
    assert.doesNotMatch(response.body, /Restore Service/);
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan GAGAL**

Run: `node --experimental-strip-types --test tests/dep001/api-bootstrap.test.ts`
Expected: test baru FAIL (status 404) — `assert.equal(response.statusCode, 200)` gagal dengan actual 404. Test lain tetap PASS.

- [ ] **Step 3: Implementasi route**

Create `apps/api/src/routes/work-queue.ts`:

```ts
import type { FastifyInstance } from "fastify";

export const WORK_QUEUE_SOURCE_VERSION_SET_REF = "appts-restore-service-dep001/work-queue/v1" as const;

export function registerWorkQueueRoute(app: FastifyInstance): void {
  app.get("/api/v1/ui/work-queue", async (_request, reply) => {
    return reply.header("Cache-Control", "no-store").send({
      view_id: "UX-RS-01",
      source_version_set_ref: WORK_QUEUE_SOURCE_VERSION_SET_REF,
      generated_at: new Date().toISOString(),
      currentness_ref: "CURRENT",
      data: { items: [] },
    });
  });
}
```

- [ ] **Step 4: Daftarkan route di `dep-bootstrap.ts`**

Dua edit di `apps/api/src/dep-bootstrap.ts`:

Edit 1 — tambah import setelah baris 7 (`import { createLogger, ... }`):

```ts
import { registerWorkQueueRoute } from "./routes/work-queue.ts";
```

Edit 2 — di dalam `registerDeploymentRoutes`, tambahkan panggilan tepat SEBELUM komentar `// This is deliberately the only catch-all route.` (baris 81):

```ts
  registerWorkQueueRoute(app);
```

- [ ] **Step 5: Jalankan test, pastikan PASS**

Run: `node --experimental-strip-types --test tests/dep001/api-bootstrap.test.ts`
Expected: 6 test hijau, termasuk test baru work-queue, dan test 404 eksisting (`pending-captures` dll.) tetap PASS.

- [ ] **Step 6: Typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: keduanya sukses tanpa error.

---

### Task 3: `WorkQueueView` frontend

**Files:**
- Modify: `apps/web/src/views/WorkQueueView.tsx` (ganti seluruh isi)

**Interfaces:**
- Consumes: `createUiClient`, `UiViewEnvelope` dari `../api.ts`; `CurrentnessBanner`, `Currentness` dari `../components/CurrentnessBanner.tsx`; `ViewFrame` dari `../components/ViewFrame.tsx`.
- Produces: `WorkQueueView()` tanpa props — konsumen: `apps/web/src/app.tsx` (tidak berubah, sudah mengimpor `WorkQueueView`).

- [ ] **Step 1: Tulis view baru**

Ganti seluruh isi `apps/web/src/views/WorkQueueView.tsx` dengan:

```tsx
import { useEffect, useState } from "react";
import { createUiClient, type UiViewEnvelope } from "../api.ts";
import { CurrentnessBanner, type Currentness } from "../components/CurrentnessBanner.tsx";
import { ViewFrame } from "../components/ViewFrame.tsx";

const currentnessValues = new Set<Currentness>(["CURRENT", "STALE", "CONTRADICTORY", "MIXED_SOURCE", "MISSING_BINDING", "UNCERTAIN"]);

type WorkItem = Readonly<Record<string, unknown>>;

function currentness(value: unknown): Currentness {
  return typeof value === "string" && currentnessValues.has(value as Currentness) ? value as Currentness : "MISSING_BINDING";
}

function items(data: Readonly<Record<string, unknown>>): readonly WorkItem[] {
  const value = data["items"];
  return Array.isArray(value) ? value.filter((candidate): candidate is WorkItem => typeof candidate === "object" && candidate !== null) : [];
}

function text(item: WorkItem, key: string): string | undefined {
  const value = item[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function label(item: WorkItem): string {
  return text(item, "purpose_ref") ?? text(item, "domain_ref") ?? "details pending authoritative projection";
}

export function WorkQueueView() {
  const [projection, setProjection] = useState<UiViewEnvelope>();
  const [failure, setFailure] = useState<string>();

  useEffect(() => {
    const client = createUiClient();
    void client.read("/work-queue").then((result) => {
      if (result.view_id !== "UX-RS-01") throw new Error("WORK_QUEUE_PROJECTION_VIEW_MISMATCH");
      setProjection(result);
    }).catch((error: unknown) => setFailure(error instanceof Error ? error.message : "WORK_QUEUE_PROJECTION_UNAVAILABLE"));
  }, []);

  const data = (projection?.data ?? {}) as Readonly<Record<string, unknown>>;
  const projectionCurrentness = currentness(projection?.currentness_ref);
  const queueItems = items(data);

  return <ViewFrame viewId="UX-RS-01" title="Role-Scoped Work Queue">
    <CurrentnessBanner currentness={projectionCurrentness} />
    <p>This queue is a current server projection and does not create authority.</p>
    {failure ? <p role="alert">{failure}: the work queue is unavailable until authoritative projection is restored.</p> : null}
    {queueItems.length === 0 ? <p>No work item is currently assigned to this role.</p> : <ul>
      {queueItems.map((item, index) => <li key={index}>
        {text(item, "ticket_ref") ?? "Work item"} — {label(item)}
        {text(item, "status_ref") ? ` (${text(item, "status_ref")})` : null}
      </li>)}
    </ul>}
  </ViewFrame>;
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: sukses tanpa error (konstanta `WORK_ITEM_FIELDS` tidak lagi dipakai; helper `label()` digunakan dalam render).

- [ ] **Step 3: Build web**

Run: `npm run build`
Expected: Vite build sukses.

---

### Task 4: Verifikasi penuh + pencatatan RETURN

**Files:**
- Create: `RETURN/BUILDER-NOTE-2026-08-18-work-queue-projection.md`

- [ ] **Step 1: Jalankan seluruh gate**

Run:
```bash
npm run verify:boundaries && npm run typecheck && npm run build && npm run test:integration && node --experimental-strip-types --test tests/dep001/api-bootstrap.test.ts tests/dep001/service-worker-packaging.test.ts tests/dep001/config.test.ts tests/dep001/observability.test.ts
```
Expected: semua PASS. `test:integration` mencakup `ui-routes.integration.test.ts` (pemetaan `/work` → `UX-RS-01` tetap hijau karena route map tidak berubah).

- [ ] **Step 2: Catat perubahan di RETURN**

Create `RETURN/BUILDER-NOTE-2026-08-18-work-queue-projection.md`:

```markdown
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

## Status verifikasi

- verify:boundaries, typecheck, build, test:integration, tests/dep001: PASS.

## Catatan

- Tidak ada kontrak work-queue resmi yang diterima; bentuk `data.items` adalah
  keputusan konstruksi deployment (rendered toleran oleh view).
- Perilaku staging setelah redeploy: `/work` menampilkan empty state, endpoint
  mengembalikan envelope kosong valid.
- Belum di-commit (menunggu instruksi user).
```

- [ ] **Step 3: Ringkas hasil ke user**

Ringkas: file yang berubah, status gate, dan langkah redeploy (`ansible-playbook playbooks/deploy.yml --ask-vault-pass` dari `CLOUD_DEPLOYMENT/ansible`).

---

## Self-Review

- **Spec coverage:** §3.1 → Task 2 (route + registrasi + test); §3.2 → Task 3 (view); §3.3 → Task 2 Step 1; §4 → Task 1 Step 3-5 + Task 4 Step 1; §5 → Task 4 Step 2. Terpenuhi semua.
- **Placeholder scan:** semua step berisi kode/perintah lengkap; tidak ada TBD.
- **Type consistency:** `registerWorkQueueRoute(FastifyInstance): void` dipakai Task 2 Step 4; `WorkQueueView()` tanpa props konsisten dengan `app.tsx`; tipe `UiViewEnvelope`/`Currentness` mengikuti `api.ts`/`CurrentnessBanner.tsx` yang sudah ada.
