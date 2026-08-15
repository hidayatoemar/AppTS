# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Context: Build Pack, Bukan Layanan Produksi

Repositori ini adalah **Build Pack** (`APP-RESTORE-SERVICE-BP-001`) — paket terverifikasi untuk membangun dan memvalidasi `appts-restore-service`. Kode sumber aktual layanan ada di `SOURCE_SNAPSHOT/RESTORE_SERVICE/`. Tidak ada aktivasi produksi, deploy, atau akses database nyata yang diizinkan.

**Builder hanya boleh:** inspect, build, typecheck, test, dan koreksi teknis minimal.

**Builder tidak boleh mengubah:** makna produk/kebijakan, skema data/migrasi, makna kontrak/antarmuka, semantik lifecycle/state, peran/otoritas, atau topologi arsitektur runtime.

Seluruh pekerjaan teknis dilakukan dari dalam `SOURCE_SNAPSHOT/RESTORE_SERVICE/`.

---

## Perintah Umum

Semua perintah dijalankan dari `SOURCE_SNAPSHOT/RESTORE_SERVICE/`:

```bash
# Instalasi dependensi (wajib pakai lockfile)
npm ci --ignore-scripts --no-audit --no-fund

# Validasi toolchain dan dependensi (jalankan duluan)
npm run verify:toolchain
npm run verify:boundaries

# Type checking
npm run typecheck

# Build seluruh proyek
npm run build

# Test per kategori
npm run test:contracts    # validasi skema kontrak (CF02)
npm run test:integration  # integrasi per domain (D01-D04, UI routes)
npm run test:dg04         # diagnostics
npm run test:adverse      # jalur adverse (race condition, offline, retry)
npm run test:unit         # harness CF05

# Semua gate sekaligus
npm run ci:verify

# Database (hanya loopback, tidak ada produksi)
npm run db:info
npm run db:validate
npm run db:migrate
npm run test:migrations
```

Tes menggunakan Node.js native runner (`node:test`) dengan flag `--experimental-strip-types` — tidak ada Jest/Vitest.

---

## Versi Toolchain yang Diwajibkan

| Tool | Versi |
|------|-------|
| Node.js | `24.19.0` |
| npm | `11.17.0` |
| TypeScript | `6.0.3` |
| PostgreSQL (DB only) | `17.x` |

`verify:toolchain` akan gagal jika versi tidak cocok. Semua dependensi dikunci secara eksak di `package-lock.json`.

---

## Arsitektur Tingkat Tinggi

### Tiga Aplikasi

| Workspace | Peran |
|-----------|-------|
| `apps/api` | HTTP API (Fastify 5). Prefix: `/api/v1/ui`. Routes: read projections, intents (POST), pending-captures (POST), diagnostics. |
| `apps/web` | SPA React 19 (Vite 8). 15 views (`UX-RS-01` s/d `UX-RS-15`). Offline via Service Worker + pending capture (maks 250 item). |
| `apps/worker` | Worker background: outbox, reconciliation, obligation, diagnostic notification. Tidak punya dependensi eksternal. |

### Package Domain (Lapisan Bisnis)

Semua package bisnis bergantung hanya pada `contracts`. `contracts` tidak boleh bergantung pada package lain.

```
contracts       ← pure types + validation, tidak ada dependensi workspace
  ↑
core-d01        ← intake, admission, formation, purpose-binding
core-d02        ← authority resolution, handover, delegasi, SoD
core-d03        ← evidence, verification, gates, closure eligibility
runtime-d04     ← lifecycle effect engine, AOUA, obligations, escalation
adapters-d05    ← source registry, qualified records, pending capture
interaction-d06 ← projection service, action intent, komunikasi
diagnostics     ← diagnostic event, safe error envelope, notifikasi
persistence     ← PostgreSQL (pg). SATU-SATUNYA package yang boleh import `pg`.
observability   ← logging (pino)
config          ← konfigurasi (kosong di snapshot ini)
test-support    ← utilitas test
```

### Lifecycle Ticket

Tiket bergerak satu arah: `ACCEPTED → ACTIVE → TERMINAL_PROCESSING → CLOSED`. Status `CLOSED` bersifat terminal — tidak bisa dibuka kembali.

### Kontrak dan Envelope

Semua pesan antar-domain menggunakan `ContractEnvelope<T>` dari `packages/contracts`, dengan field wajib: `interface_identity`, `semantic_version`, `idempotency_key`, `correlation_id`, `payload_hash`. Enam runtime internal (INT-RUN-TD-01 s/d 06) hanya boleh didefinisikan di `packages/contracts/src/runtime/`.

### Effect Engine (runtime-d04)

`executeLifecycleEffect()` adalah satu-satunya penulis lifecycle state. Memastikan idempotency via `commandId + payloadHash`, menangani version conflict, dan commit yang tidak pasti (`EFFECT_UNCERTAIN_RECONCILIATION_REQUIRED`) — yang kemudian diselesaikan oleh reconciliation worker.

### Database

- Schema: `appts` (data bisnis) + `appts_sys` (tracking migrasi)
- Migrasi: Flyway prefix `V001__`, `V002__`, `V003__`
- Tiap domain memiliki **relasi SQL yang dimilikinya** (deklarasi di `packages/persistence/src/*/index.ts`)
- Hanya `SERIALIZABLE` atau `READ COMMITTED` isolation — via `runTransaction()` di `persistence`

---

## Batas Arsitektur yang Harus Dijaga

Semua batas ini di-enforce oleh `npm run verify:boundaries`:

1. `pg` hanya boleh diimpor oleh `packages/persistence`
2. `packages/contracts` tidak boleh bergantung pada workspace lain
3. Tidak ada circular dependency antar workspace
4. Tidak ada impor path privat lintas-package (mis. `@appts-restore-service/core-d01/src/intake.ts`)
5. Package level tidak boleh bergantung pada app level

---

## Struktur Test

| Folder | Cakupan |
|--------|---------|
| `tests/contract/` | Validasi skema kontrak CF02 (envelope, I01-I04, INT-RUN-TD) |
| `tests/integration/` | Integrasi per domain D01-D04 dan UI routes |
| `tests/dg04/` | Diagnostics (diagnostic event, notifikasi) |
| `tests/adverse/` | Jalur adverse: race condition, offline stale, retry reconciliation |

---

## Alur Verifikasi (Gate PASS/STOP)

**PASS** = semua gate berhasil, tidak ada perubahan batas kontrak, return template lengkap.

**STOP** = diperlukan jika perbaikan akan melampaui batas otoritas (mengubah makna, skema, atau kontrak).

Setiap perubahan yang dibuat harus dicatat di `RETURN/BUILDER_RETURN_TEMPLATE.md`.
