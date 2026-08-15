import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createDepBootstrapServer } from "../../apps/api/src/dep-bootstrap.ts";

const workspaceRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const staticRoot = resolve(workspaceRoot, "apps/web/dist");
const validEnv = {
  DATABASE_URL: "postgres://appts:appts@localhost:5432/appts",
  API_LISTEN_PORT: "3000",
} as const;

async function withServer(run: (base: Awaited<ReturnType<typeof createDepBootstrapServer>>["app"]) => Promise<void>): Promise<void> {
  const server = await createDepBootstrapServer({ env: validEnv, staticRoot });
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

test("DEP bootstrap never serves the SPA for API, diagnostics, intent, or worker paths", async () => {
  await withServer(async (app) => {
    for (const method of ["GET", "POST"] as const) {
      for (const url of [
        "/api/v1/ui/pending-captures",
        "/api/v1/ui/diagnostics",
        "/api/v1/ui/intents",
        "/api/v1/worker/reconcile",
      ]) {
        const response = await app.inject({ method, url, headers: { accept: "text/html" } });
        assert.ok([404, 405].includes(response.statusCode), `${method} ${url} returned ${response.statusCode}`);
        assert.doesNotMatch(response.body, /Restore Service/);
      }
    }
  });
});

test("DEP bootstrap fails closed for config and static bundle failures", async () => {
  await assert.rejects(
    () => createDepBootstrapServer({ env: { API_LISTEN_PORT: "3000" }, staticRoot }),
    /DATABASE_URL/,
  );

  const temporaryRoot = await mkdtemp(join(tmpdir(), "appts-dep001-static-"));
  try {
    await writeFile(join(temporaryRoot, "index.html"), "<html></html>");
    await assert.rejects(
      () => createDepBootstrapServer({ env: validEnv, staticRoot: temporaryRoot }),
      /static bundle is incomplete/,
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("DEP bootstrap source has no database or prohibited runtime module imports", async () => {
  const source = await readFile(resolve(workspaceRoot, "apps/api/src/dep-bootstrap.ts"), "utf8");
  assert.doesNotMatch(source, /from ["'](?:pg|@appts-restore-service\/(?:persistence|diagnostics|interaction-d06))["']/);
  assert.doesNotMatch(source, /from ["'][^"']*(?:pending-capture|worker)[^"']/);
  assert.match(source, /apiConfigFromEnv/);
  assert.match(source, /createLogger/);
  assert.match(source, /host: "0\.0\.0\.0"/);
});
