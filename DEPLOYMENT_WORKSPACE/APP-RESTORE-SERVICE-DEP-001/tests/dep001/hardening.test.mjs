import assert from "node:assert/strict";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repositoryRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const readDeployDb = (name) => readFileSync(join(repositoryRoot, "deploy/db", name), "utf8");

test("migration entrypoint verifies the frozen inventory before migration commands", () => {
  const migrate = readDeployDb("migrate.sh");
  const freezeCall = migrate.indexOf("verify-schema-frozen.mjs");
  const migrationLoop = migrate.indexOf("for migration in");

  assert.notEqual(freezeCall, -1);
  assert.ok(freezeCall < migrationLoop);
  assert.doesNotMatch(migrate, /--write-baseline/);
});

test("runtime privilege construction is quarantined and has no grant SQL", () => {
  const grantRuntime = readDeployDb("grant-runtime.sh");

  assert.doesNotMatch(grantRuntime, /^\s*GRANT\b/m);
  assert.match(grantRuntime, /REVOKE CONNECT, TEMPORARY ON DATABASE/);
  assert.match(grantRuntime, /appts_sys/);
  assert.match(grantRuntime, /intentionally STOPPED/);
  assert.match(grantRuntime, /has_database_privilege/);
  assert.match(grantRuntime, /pg_auth_members/);
});

test("bootstrap hardening is scoped to the disposable DEP database", () => {
  const bootstrap = readDeployDb("bootstrap-roles.sh");

  assert.match(bootstrap, /REVOKE CONNECT, TEMPORARY ON DATABASE/);
  assert.match(bootstrap, /REVOKE %I FROM %I/);
  assert.match(bootstrap, /NOREPLICATION/);
  assert.match(bootstrap, /ALL PRIVILEGES ON ALL TABLES IN SCHEMA/);
  assert.match(bootstrap, /--dbname=\"\$APPTS_DB_NAME\"/);
});

test("runtime quarantine verifies with a shell-level fake client and then STOPs", () => {
  const temporaryRoot = mkdtempSync(join(tmpdir(), "appts-dep001-runtime-quarantine-test-"));
  const fakeBin = join(temporaryRoot, "bin");
  try {
    mkdirSync(fakeBin, { recursive: true });
    const fakePsql = join(fakeBin, "psql");
    writeFileSync(fakePsql, "#!/bin/sh\ncase \"$*\" in\n  *WITH\\ runtime_role*) printf '%s\\n' PASS ;;\n  *--version*) printf '%s\\n' 'psql (PostgreSQL) 17.0' ;;\n  *) exit 0 ;;\nesac\n");
    chmodSync(fakePsql, 0o755);

    const environment = {
      ...process.env,
      PATH: `${fakeBin}${process.platform === "win32" ? ";" : ":"}${process.env.PATH ?? ""}`,
      APPTS_DB_NETWORK_MODE: "LOOPBACK",
      APPTS_STAGING_LABEL: "STAGING SIMULATION / NON-PRODUCTION",
      APPTS_DISPOSABLE_DATABASE: "true",
      APPTS_DB_NAME: "appts_dep001_quarantine_probe",
      PGHOST: "localhost",
      PGPORT: "5432",
      PGDATABASE: "appts_dep001_quarantine_probe",
      PGUSER: "appts_migration",
      PGPASSWORD: "placeholder",
      APPTS_MIGRATION_ROLE: "appts_migration",
      APPTS_RUNTIME_ROLE: "appts_runtime",
    };
    const result = spawnSync("sh", ["deploy/db/grant-runtime.sh"], {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: environment,
    });

    assert.equal(result.status, 2, `${result.stdout}\n${result.stderr}`);
    assert.match(`${result.stdout}\n${result.stderr}`, /runtime role has no elevated/);
    assert.match(`${result.stdout}\n${result.stderr}`, /intentionally STOPPED/);
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
});
