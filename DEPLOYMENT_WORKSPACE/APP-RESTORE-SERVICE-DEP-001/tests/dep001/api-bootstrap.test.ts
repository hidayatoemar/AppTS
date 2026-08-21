import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import type { ApiComposition } from "../../apps/api/src/composition.ts";
import { createDepBootstrapServer } from "../../apps/api/src/dep-bootstrap.ts";

const workspaceRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const staticRoot = resolve(workspaceRoot, "apps/web/dist");
const validEnv = {
  DATABASE_URL: "postgres://appts:appts@localhost:5432/appts",
  API_LISTEN_PORT: "3000",
} as const;

const testComposition: ApiComposition = Object.freeze({
  projections: Object.freeze({
    async read(viewId: string, subjectRef?: string): Promise<unknown> {
      return {
        view_id: viewId,
        ...(subjectRef === undefined ? {} : { subject_ref: subjectRef }),
        source_version_set_ref: "test:1",
        generated_at: "2026-08-21T00:00:00.000Z",
        currentness_ref: "CURRENT",
        data: { test_projection: true },
      };
    },
  }),
  intents: Object.freeze({
    async dispatch(contractRef: string): Promise<unknown> { return { result: "ACK", contract_ref: contractRef }; },
    async capture(): Promise<unknown> { return { result: "PENDING" }; },
  }),
  diagnostics: Object.freeze({
    async retrieve(): Promise<never> { throw new Error("DIAGNOSTIC_AUTHORITY_BINDING_REQUIRED"); },
  }),
});

async function withServer(run: (base: Awaited<ReturnType<typeof createDepBootstrapServer>>["app"]) => Promise<void>): Promise<void> {
  const server = await createDepBootstrapServer({ env: validEnv, staticRoot, composition: testComposition });
  try {
    await run(server.app);
  } finally {
    await server.close();
  }
}

test("DEP bootstrap exposes local JSON liveness and static-only readiness", async () => {
  await withServer(async (app) => {
    const health = await app.inject({ method: "GET", url: "/healthz" });
    assert.equal(health.statusCode, 200);
    assert.deepEqual(health.json(), { status: "ok" });
    assert.equal(health.headers["cache-control"], "no-store");

    const ready = await app.inject({ method: "GET", url: "/readyz" });
    assert.equal(ready.statusCode, 200);
    assert.deepEqual(ready.json(), { status: "ready" });
    assert.equal(ready.headers["cache-control"], "no-store");
  });
});

test("DEP bootstrap serves the shell, browser fallback, and worker with exact scope header", async () => {
  await withServer(async (app) => {
    const root = await app.inject({ method: "GET", url: "/" });
    assert.equal(root.statusCode, 200);
    assert.match(root.body, /Restore Service/);

    const browserRoute = await app.inject({ method: "GET", url: "/tickets/123" });
    assert.equal(browserRoute.statusCode, 200);
    assert.equal(browserRoute.body, root.body);

    const worker = await app.inject({ method: "GET", url: "/service-worker.js" });
    assert.equal(worker.statusCode, 200);
    assert.equal(worker.headers["service-worker-allowed"], "/");
    assert.match(worker.body, /restore-service-shell-v1/);
  });
});

test("DEP bootstrap registers accepted UI read and intent routes without SPA fallback", async () => {
  await withServer(async (app) => {
    const workQueue = await app.inject({ method: "GET", url: "/api/v1/ui/work-queue", headers: { accept: "text/html" } });
    assert.equal(workQueue.statusCode, 200);
    assert.equal(workQueue.json().view_id, "UX-RS-01");
    assert.doesNotMatch(workQueue.body, /Restore Service/);

    const intake = await app.inject({ method: "GET", url: "/api/v1/ui/intake/case-1", headers: { accept: "text/html" } });
    assert.equal(intake.statusCode, 200);
    assert.equal(intake.json().subject_ref, "case-1");

    const intent = await app.inject({
      method: "POST",
      url: "/api/v1/ui/intents",
      payload: { intent_contract_ref: "APPTS.CORE.D01.PRETICKET_ADMISSION.SUBMISSION / 1.0.0", payload: {} },
    });
    assert.equal(intent.statusCode, 200);
    assert.equal(intent.json().result, "ACK");

    const pending = await app.inject({ method: "POST", url: "/api/v1/ui/pending-captures", payload: {} });
    assert.equal(pending.statusCode, 200);
    assert.equal(pending.json().result, "PENDING");

    const diagnostics = await app.inject({ method: "GET", url: "/api/v1/ui/diagnostics/ref" });
    assert.equal(diagnostics.statusCode, 501);
    assert.equal(diagnostics.json().error, "DIAGNOSTIC_AUTHORITY_BINDING_REQUIRED");

    const workerApi = await app.inject({ method: "GET", url: "/api/v1/worker/reconcile", headers: { accept: "text/html" } });
    assert.equal(workerApi.statusCode, 404);
    assert.doesNotMatch(workerApi.body, /Restore Service/);
  });
});

test("DEP bootstrap fails closed for config and static bundle failures", async () => {
  await assert.rejects(
    () => createDepBootstrapServer({ env: { API_LISTEN_PORT: "3000" }, staticRoot, composition: testComposition }),
    /DATABASE_URL/,
  );

  const temporaryRoot = await mkdtemp(join(tmpdir(), "appts-dep001-static-"));
  try {
    await writeFile(join(temporaryRoot, "index.html"), "<html></html>");
    await assert.rejects(
      () => createDepBootstrapServer({ env: validEnv, staticRoot: temporaryRoot, composition: testComposition }),
      /static bundle is incomplete/,
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("DEP bootstrap binds accepted UI composition without embedding owner SQL or bypass logic", async () => {
  const source = await readFile(resolve(workspaceRoot, "apps/api/src/dep-bootstrap.ts"), "utf8");
  assert.match(source, /registerUiHttpRoutes/);
  assert.match(source, /createTrialProjectionPort/);
  assert.match(source, /createTrialPreTicketIntentDispatcher/);
  assert.doesNotMatch(source, /INSERT INTO appts\.|UPDATE appts\.|DELETE FROM appts\./);
  assert.match(source, /apiConfigFromEnv/);
  assert.match(source, /createLogger/);
  assert.match(source, /host: "0\.0\.0\.0"/);
});
