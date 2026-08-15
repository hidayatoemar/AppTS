// MCR-004-authorized minimum Service Worker packaging correction (DEP-001).
// The web app previously registered "/src/offline/service-worker.ts", which does not
// exist after a Vite production build. This test pins the corrected packaging:
//   - main.tsx registers the worker through Vite's native `?worker&url` asset import
//     (never a /src/ path), with an explicit whole-origin scope;
//   - vite.config.ts emits the worker bundle at the output root as service-worker.js
//     so the default service worker scope is "/" (static shell precache of "/" and
//     "/index.html" plus the "/api/" bypass remain unchanged);
//   - a real production build produces dist/service-worker.js whose content still
//     contains the precache cache name and the /api/ bypass, and no built chunk
//     references the old /src/offline/service-worker.ts path.
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const webAppDir = resolve(workspaceRoot, "apps/web");

function readWebApp(relativePath: string): string {
  return readFileSync(resolve(webAppDir, relativePath), "utf8");
}

function collectJsFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) files.push(...collectJsFiles(fullPath));
    else if (entry.endsWith(".js")) files.push(fullPath);
  }
  return files;
}

test("main.tsx registers the service worker via a Vite worker asset URL, never a /src/ path", () => {
  const mainSource = readWebApp("src/main.tsx");
  assert.match(mainSource, /\?worker&url/, "expected a Vite ?worker&url import");
  assert.match(
    mainSource,
    /serviceWorker\.register\(serviceWorkerUrl/,
    "registration must use the imported worker asset URL",
  );
  assert.doesNotMatch(
    mainSource,
    /serviceWorker\.register\(\s*["'`]\/src\//,
    "registration must not reference a /src/ path",
  );
});

test("vite.config.ts emits the worker bundle at the output root as service-worker.js", () => {
  const configSource = readWebApp("vite.config.ts");
  assert.match(configSource, /worker\s*:/, "expected a worker config block");
  assert.match(
    configSource,
    /entryFileNames\s*:\s*["'`]service-worker\.js["'`]/,
    "worker must be emitted as service-worker.js at the output root",
  );
});

test("production build emits a root-level service worker asset with unchanged precache and /api/ bypass", async () => {
  await build({
    configFile: resolve(webAppDir, "vite.config.ts"),
    root: webAppDir,
    logLevel: "error",
  });

  const distDir = resolve(webAppDir, "dist");
  const workerPath = resolve(distDir, "service-worker.js");
  assert.ok(existsSync(workerPath), "dist/service-worker.js must exist after build");

  const workerSource = readFileSync(workerPath, "utf8");
  assert.match(workerSource, /restore-service-shell-v1/, "static shell precache cache name must be preserved");
  assert.match(workerSource, /\/api\//, "/api/ bypass must be preserved");

  const builtJs = collectJsFiles(distDir).map((file) => readFileSync(file, "utf8")).join("\n");
  assert.match(builtJs, /service-worker\.js/, "a built chunk must reference the emitted worker asset");
  assert.doesNotMatch(builtJs, /\/src\/offline\/service-worker\.ts/, "no built chunk may reference the old /src/ path");
});