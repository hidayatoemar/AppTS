import { appendFileSync, cpSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const action = process.argv[2];
const allowedActions = new Set(["info", "validate", "migrate", "test"]);
const allowedHosts = new Set(["localhost", "127.0.0.1", "::1"]);
const flywayExecutable = process.platform === "win32" ? "flyway.cmd" : "flyway";
const psqlExecutable = process.platform === "win32" ? "psql.exe" : "psql";

function stop(message) {
  console.error(`STOP: ${message}`);
  process.exit(2);
}

function capture(executable, args) {
  const result = spawnSync(executable, args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: process.env,
    shell: process.platform === "win32" && executable === flywayExecutable,
  });

  if (result.error) {
    stop(`${executable} is unavailable on the bounded verification command surface.`);
  }

  return {
    status: result.status,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
  };
}

function run(executable, args, { env = process.env, expectFailure = false } = {}) {
  const result = spawnSync(executable, args, {
    cwd: repositoryRoot,
    env,
    stdio: "inherit",
    shell: process.platform === "win32" && executable === flywayExecutable,
  });

  if (result.error) {
    stop(`${executable} is unavailable on the bounded verification command surface.`);
  }

  if (expectFailure) {
    if (result.status === 0) {
      stop("The immutability probe unexpectedly passed after a checksum mutation.");
    }
    return;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function normalizeHost(host) {
  return host.replace(/^\[|\]$/g, "").toLowerCase();
}

if (!allowedActions.has(action)) {
  stop("Use one of: info, validate, migrate, test.");
}

if (process.env.APPTS_B01_DISPOSABLE_DB !== "true") {
  stop("APPTS_B01_DISPOSABLE_DB=true is required.");
}

const jdbcUrl = process.env.FLYWAY_URL ?? "";
const jdbcMatch = /^jdbc:postgresql:\/\/(\[[^\]]+\]|[^:/?#]+)(?::\d+)?\/([^?]+)(?:\?.*)?$/.exec(jdbcUrl);
if (!jdbcMatch) {
  stop("FLYWAY_URL must be a PostgreSQL JDBC URL for an authorized disposable database.");
}

const jdbcHost = normalizeHost(jdbcMatch[1]);
const databaseName = decodeURIComponent(jdbcMatch[2]);
if (!allowedHosts.has(jdbcHost)) {
  stop("Only a local loopback PostgreSQL host is authorized.");
}
if (!/^appts_b01_[a-z0-9_]+$/.test(databaseName)) {
  stop("The database name must use the appts_b01_ disposable prefix.");
}

const flywayVersion = capture(flywayExecutable, ["-v"]);
if (flywayVersion.status !== 0 || !/\b13\.0\.0\b/.test(flywayVersion.output)) {
  stop("Flyway CLI 13.0.0 is required by CF06-B01.");
}

const flywayEnvironment = {
  ...process.env,
  FLYWAY_LOCATIONS: process.env.FLYWAY_LOCATIONS ?? "filesystem:db/migrations",
};

console.log(JSON.stringify({
  action,
  authorization: "CF06-B01-003C",
  databaseClass: "APPTS_B01_DISPOSABLE",
  hostClass: "LOCAL_LOOPBACK",
}));

if (action !== "test") {
  run(flywayExecutable, [action], { env: flywayEnvironment });
  process.exit(0);
}

const pgHost = normalizeHost(process.env.PGHOST ?? "");
if (!allowedHosts.has(pgHost)) {
  stop("PGHOST must identify the same local loopback verification host.");
}
if ((process.env.PGDATABASE ?? "") !== databaseName) {
  stop("PGDATABASE must match the disposable database in FLYWAY_URL.");
}

const psqlVersion = capture(psqlExecutable, ["--version"]);
if (psqlVersion.status !== 0 || !/psql \(PostgreSQL\) 17\./.test(psqlVersion.output)) {
  stop("PostgreSQL 17 psql is required by CF06-B01.");
}

const verificationFiles = [
  "db/fixtures/cf01_positive.sql",
  "db/verify/001_cf01_constraints.sql",
  "db/verify/002_cf01_history_inbox_outbox.sql",
  "db/verify/003_dg04_diagnostics.sql",
  "db/verify/004_arc013_entity_axis.sql",
  "db/fixtures/cf01_negative.sql",
];

for (const relativePath of verificationFiles) {
  if (!existsSync(resolve(repositoryRoot, relativePath))) {
    stop(`Required verification file is missing: ${relativePath}`);
  }
}

// The migrations own two application schemas outside Flyway's default `public`
// schema.  Remove only those disposable schemas so a repeated bounded test
// starts from the same empty application surface.
run(psqlExecutable, ["-X", "-v", "ON_ERROR_STOP=1", "-c", "DROP SCHEMA IF EXISTS appts CASCADE; DROP SCHEMA IF EXISTS appts_sys CASCADE;"]);
run(flywayExecutable, ["-cleanDisabled=false", "clean"], { env: flywayEnvironment });
run(flywayExecutable, ["migrate"], { env: flywayEnvironment });
run(flywayExecutable, ["validate"], { env: flywayEnvironment });
run(flywayExecutable, ["info"], { env: flywayEnvironment });

for (const relativePath of verificationFiles) {
  run(psqlExecutable, ["-X", "-v", "ON_ERROR_STOP=1", "-f", relativePath]);
}

const mutationRoot = mkdtempSync(join(tmpdir(), "appts-b01-checksum-"));
try {
  const copiedMigrations = join(mutationRoot, "migrations");
  cpSync(resolve(repositoryRoot, "db/migrations"), copiedMigrations, { recursive: true });
  appendFileSync(join(copiedMigrations, "V001__cf01_core_schema.sql"), "\n-- checksum mutation probe\n");
  const mutationLocation = `filesystem:${copiedMigrations.replaceAll("\\", "/")}`;
  run(flywayExecutable, ["validate"], {
    env: { ...flywayEnvironment, FLYWAY_LOCATIONS: mutationLocation },
    expectFailure: true,
  });
} finally {
  rmSync(mutationRoot, { recursive: true, force: true });
}

console.log("PASS: CF06-B01 bounded migration verification completed on the authorized disposable database.");