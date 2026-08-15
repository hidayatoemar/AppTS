import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repositoryRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const databaseLibrary = "./deploy/db/lib.sh";
const scripts = ["bootstrap-roles.sh", "migrate.sh", "grant-runtime.sh", "backup.sh", "restore.sh"];

function runNetworkProbe(mode, host) {
  const probe = [
    `. ${databaseLibrary}`,
    `APPTS_DB_NETWORK_MODE='${mode}'`,
    `PGHOST='${host}'`,
    "PGPORT='5432'",
    "require_database_network",
  ].join("\n");
  return spawnSync("sh", ["-c", probe], { cwd: repositoryRoot, encoding: "utf8" });
}

test("network guard permits loopback and isolated internal Compose modes", () => {
  for (const [mode, host] of [["LOOPBACK", "localhost"], ["LOOPBACK", "127.0.0.1"], ["INTERNAL_COMPOSE", "postgres"]]) {
    const result = runNetworkProbe(mode, host);
    assert.equal(result.status, 0, `${mode}/${host}: ${result.stdout}\n${result.stderr}`);
  }
});

test("network guard rejects unsafe host/mode combinations before database access", () => {
  for (const [mode, host] of [["LOOPBACK", "postgres"], ["INTERNAL_COMPOSE", "127.0.0.1"], ["INTERNAL_COMPOSE", "db.internal"], ["PUBLIC", "localhost"]]) {
    const result = runNetworkProbe(mode, host);
    assert.notEqual(result.status, 0, `${mode}/${host} unexpectedly passed`);
    assert.match(`${result.stdout}\n${result.stderr}`, /STOP:/);
  }
});

test("all database entrypoint scripts use the explicit network guard", () => {
  for (const script of scripts) {
    const content = readFileSync(join(repositoryRoot, "deploy/db", script), "utf8");
    assert.match(content, /require_database_network/);
    assert.doesNotMatch(content, /require_loopback/);
  }
  const template = readFileSync(join(repositoryRoot, "deploy/config/db.env.template"), "utf8");
  const readme = readFileSync(join(repositoryRoot, "deploy/db/README.md"), "utf8");
  assert.match(template, /APPTS_DB_NETWORK_MODE/);
  assert.match(readme, /INTERNAL_COMPOSE/);
  assert.match(readme, /postgres/);
  assert.match(readme, /no implication of a published host port/);
});
