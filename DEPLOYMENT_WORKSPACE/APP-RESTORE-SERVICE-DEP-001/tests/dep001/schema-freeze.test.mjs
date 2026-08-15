import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(testDirectory, "../..");
const guardPath = join(repositoryRoot, "tools/verify-schema-frozen.mjs");

function runGuard(root) {
  return spawnSync(process.execPath, [guardPath, "--root", root], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
}

function runBaselineWriter(root, manifest, authorized) {
  const environment = { ...process.env };
  if (authorized) environment.APPTS_SCHEMA_FREEZE_MAINTAINER_AUTH = "DEP001_SCHEMA_FREEZE_MAINTAINER_WRITE_V1";
  else delete environment.APPTS_SCHEMA_FREEZE_MAINTAINER_AUTH;
  return spawnSync(process.execPath, [guardPath, "--root", root, "--manifest", manifest, "--write-baseline"], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: environment,
  });
}

test("schema freeze guard passes without mutating the deployment source", () => {
  const before = readFileSync(join(repositoryRoot, "db/migrations/V001__cf01_core_schema.sql"));
  const result = runGuard(repositoryRoot);
  const after = readFileSync(join(repositoryRoot, "db/migrations/V001__cf01_core_schema.sql"));

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /PASS: schema freeze verified/);
  assert.deepEqual(after, before);
});

test("schema freeze guard rejects a mutation in a temporary copied migration", () => {
  const temporaryRoot = mkdtempSync(join(tmpdir(), "appts-dep001-freeze-test-"));
  try {
    mkdirSync(join(temporaryRoot, "db"), { recursive: true });
    mkdirSync(join(temporaryRoot, "deploy/db"), { recursive: true });
    cpSync(join(repositoryRoot, "db/migrations"), join(temporaryRoot, "db/migrations"), { recursive: true });
    cpSync(join(repositoryRoot, "db/verify"), join(temporaryRoot, "db/verify"), { recursive: true });
    cpSync(join(repositoryRoot, "deploy/db/schema-freeze-baseline.json"), join(temporaryRoot, "deploy/db/schema-freeze-baseline.json"));

    const copiedMigration = join(temporaryRoot, "db/migrations/V001__cf01_core_schema.sql");
    const originalSource = readFileSync(join(repositoryRoot, "db/migrations/V001__cf01_core_schema.sql"));
    writeFileSync(copiedMigration, Buffer.concat([readFileSync(copiedMigration), Buffer.from("\n-- temporary mutation probe\n")]));

    const result = runGuard(temporaryRoot);
    assert.notEqual(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(`${result.stdout}\n${result.stderr}`, /CHANGED db\/migrations\/V001__cf01_core_schema\.sql/);
    assert.deepEqual(readFileSync(join(repositoryRoot, "db/migrations/V001__cf01_core_schema.sql")), originalSource);
    assert.ok(existsSync(copiedMigration));
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test("baseline writing is rejected without maintainer authorization", () => {
  const temporaryRoot = mkdtempSync(join(tmpdir(), "appts-dep001-freeze-auth-test-"));
  try {
    mkdirSync(join(temporaryRoot, "db"), { recursive: true });
    mkdirSync(join(temporaryRoot, "deploy/db"), { recursive: true });
    cpSync(join(repositoryRoot, "db/migrations"), join(temporaryRoot, "db/migrations"), { recursive: true });
    cpSync(join(repositoryRoot, "db/verify"), join(temporaryRoot, "db/verify"), { recursive: true });
    const manifest = join(temporaryRoot, "deploy/db/temporary-baseline.json");

    const result = runBaselineWriter(temporaryRoot, manifest, false);
    assert.notEqual(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(`${result.stdout}\n${result.stderr}`, /APPTS_SCHEMA_FREEZE_MAINTAINER_AUTH/);
    assert.equal(existsSync(manifest), false);
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test("authorized baseline writing only writes a temporary manifest", () => {
  const temporaryRoot = mkdtempSync(join(tmpdir(), "appts-dep001-freeze-write-test-"));
  try {
    mkdirSync(join(temporaryRoot, "db"), { recursive: true });
    mkdirSync(join(temporaryRoot, "deploy/db"), { recursive: true });
    cpSync(join(repositoryRoot, "db/migrations"), join(temporaryRoot, "db/migrations"), { recursive: true });
    cpSync(join(repositoryRoot, "db/verify"), join(temporaryRoot, "db/verify"), { recursive: true });
    const manifest = join(temporaryRoot, "deploy/db/temporary-baseline.json");
    const sourceBefore = readFileSync(join(repositoryRoot, "db/migrations/V001__cf01_core_schema.sql"));

    const result = runBaselineWriter(temporaryRoot, manifest, true);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /WROTE:/);
    assert.equal(existsSync(manifest), true);
    assert.deepEqual(readFileSync(join(repositoryRoot, "db/migrations/V001__cf01_core_schema.sql")), sourceBefore);
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test("migrate stops on a frozen-schema mismatch before invoking psql", () => {
  const temporaryRoot = mkdtempSync(join(tmpdir(), "appts-dep001-migrate-freeze-test-"));
  try {
    mkdirSync(join(temporaryRoot, "db"), { recursive: true });
    mkdirSync(join(temporaryRoot, "deploy/db"), { recursive: true });
    mkdirSync(join(temporaryRoot, "tools"), { recursive: true });
    cpSync(join(repositoryRoot, "db/migrations"), join(temporaryRoot, "db/migrations"), { recursive: true });
    cpSync(join(repositoryRoot, "db/verify"), join(temporaryRoot, "db/verify"), { recursive: true });
    cpSync(join(repositoryRoot, "deploy/db/schema-freeze-baseline.json"), join(temporaryRoot, "deploy/db/schema-freeze-baseline.json"));
    cpSync(join(repositoryRoot, "deploy/db/lib.sh"), join(temporaryRoot, "deploy/db/lib.sh"));
    cpSync(join(repositoryRoot, "deploy/db/migrate.sh"), join(temporaryRoot, "deploy/db/migrate.sh"));
    cpSync(join(repositoryRoot, "tools/verify-schema-frozen.mjs"), join(temporaryRoot, "tools/verify-schema-frozen.mjs"));
    writeFileSync(join(temporaryRoot, "db/migrations/V001__cf01_core_schema.sql"), `${readFileSync(join(temporaryRoot, "db/migrations/V001__cf01_core_schema.sql"), "utf8")}\n-- temporary migration probe\n`);

    const environment = {
      ...process.env,
      APPTS_DB_NETWORK_MODE: "LOOPBACK",
      APPTS_STAGING_LABEL: "STAGING SIMULATION / NON-PRODUCTION",
      APPTS_DISPOSABLE_DATABASE: "true",
      APPTS_DB_NAME: "appts_dep001_migrate_probe",
      PGHOST: "localhost",
      PGPORT: "5432",
      PGDATABASE: "appts_dep001_migrate_probe",
      PGUSER: "appts_migration",
      PGPASSWORD: "placeholder",
      APPTS_MIGRATION_ROLE: "appts_migration",
    };
    const result = spawnSync("sh", ["deploy/db/migrate.sh"], {
      cwd: temporaryRoot,
      encoding: "utf8",
      env: environment,
    });

    assert.notEqual(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(`${result.stdout}\n${result.stderr}`, /CHANGED db\/migrations\/V001__cf01_core_schema\.sql/);
    assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, /psql/);
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
});
