import assert from "node:assert/strict";
import test from "node:test";
// PREREQUISITE: run `npm run typecheck:projects` first — it emits packages/*/dist.
// These tests exercise the workspace package public API, which resolves to the compiled
// ESM in dist (built ESM keeps valid .js imports and cannot coexist with .ts sources).
import { ConfigError, STAGING_SIMULATION_LABEL, apiConfigFromEnv, workerConfigFromEnv } from "@appts-restore-service/config";
import type { ApiConfig, Env, WorkerConfig } from "@appts-restore-service/config";

const VALID_API_ENV: Env = {
  DATABASE_URL: "postgres://appts:appts@localhost:5432/appts",
  API_LISTEN_PORT: "3000",
};

const VALID_WORKER_ENV: Env = {
  DATABASE_URL: "postgres://appts:appts@localhost:5432/appts",
  WORKER_POLL_INTERVAL_MS: "5000",
  STAGING_SIMULATION: STAGING_SIMULATION_LABEL,
};

function expectConfigError(field: string, code: ConfigError["code"], messagePattern: RegExp) {
  return (err: unknown): boolean => {
    assert.ok(err instanceof ConfigError, `expected ConfigError, received ${String(err)}`);
    assert.equal(err.code, code);
    assert.equal(err.field, field);
    assert.match(err.message, messagePattern);
    return true;
  };
}

test("api config: accepts a valid caller-supplied environment", () => {
  const config: ApiConfig = apiConfigFromEnv(VALID_API_ENV);
  assert.equal(config.kind, "api");
  assert.equal(config.apiPort, 3000);
  assert.equal(config.databaseUrl, "postgres://appts:appts@localhost:5432/appts");
  assert.ok(Object.isFrozen(config));
});

test("api config: rejects missing required values without defaulting", () => {
  assert.throws(
    () => apiConfigFromEnv({ DATABASE_URL: "postgres://appts:appts@localhost:5432/appts" }),
    expectConfigError("API_LISTEN_PORT", "CONFIG_MISSING_REQUIRED", /API_LISTEN_PORT/),
  );
  assert.throws(
    () => apiConfigFromEnv({ API_LISTEN_PORT: "3000" }),
    expectConfigError("DATABASE_URL", "CONFIG_MISSING_REQUIRED", /DATABASE_URL/),
  );
  assert.throws(
    () => apiConfigFromEnv({ ...VALID_API_ENV, API_LISTEN_PORT: "" }),
    expectConfigError("API_LISTEN_PORT", "CONFIG_MISSING_REQUIRED", /API_LISTEN_PORT/),
  );
});

test("api config: rejects an invalid PostgreSQL connection URL", () => {
  assert.throws(
    () => apiConfigFromEnv({ ...VALID_API_ENV, DATABASE_URL: "not-a-url" }),
    expectConfigError("DATABASE_URL", "CONFIG_INVALID_VALUE", /not a valid URL/),
  );
  assert.throws(
    () => apiConfigFromEnv({ ...VALID_API_ENV, DATABASE_URL: "http://example.com/db" }),
    expectConfigError("DATABASE_URL", "CONFIG_INVALID_VALUE", /not a supported PostgreSQL connection scheme/),
  );
  assert.throws(
    () => apiConfigFromEnv({ ...VALID_API_ENV, DATABASE_URL: "postgres:///appts" }),
    expectConfigError("DATABASE_URL", "CONFIG_INVALID_VALUE", /must include a host/),
  );
});

test("api config: rejects a non-numeric or out-of-range listen port", () => {
  assert.throws(
    () => apiConfigFromEnv({ ...VALID_API_ENV, API_LISTEN_PORT: "abc" }),
    expectConfigError("API_LISTEN_PORT", "CONFIG_INVALID_VALUE", /expected an integer/),
  );
  assert.throws(
    () => apiConfigFromEnv({ ...VALID_API_ENV, API_LISTEN_PORT: "3000.5" }),
    expectConfigError("API_LISTEN_PORT", "CONFIG_INVALID_VALUE", /expected an integer/),
  );
  assert.throws(
    () => apiConfigFromEnv({ ...VALID_API_ENV, API_LISTEN_PORT: "0" }),
    expectConfigError("API_LISTEN_PORT", "CONFIG_INVALID_VALUE", /between 1 and 65535/),
  );
  assert.throws(
    () => apiConfigFromEnv({ ...VALID_API_ENV, API_LISTEN_PORT: "65536" }),
    expectConfigError("API_LISTEN_PORT", "CONFIG_INVALID_VALUE", /between 1 and 65535/),
  );
});

test("api config: unknown environment keys are ignored and no time authority is configurable", () => {
  const config = apiConfigFromEnv({ ...VALID_API_ENV, TIME_AUTHORITY: "NTP", EXTRA: "x" });
  assert.equal(config.apiPort, 3000);
  assert.ok(!("timeAuthority" in config));
  assert.ok(!("TIME_AUTHORITY" in config));
});

test("worker config: accepts a valid caller-supplied environment with the exact staging simulation label", () => {
  const config: WorkerConfig = workerConfigFromEnv(VALID_WORKER_ENV);
  assert.equal(config.kind, "worker");
  assert.equal(config.workerPollIntervalMs, 5000);
  assert.equal(config.stagingSimulation, STAGING_SIMULATION_LABEL);
  assert.equal(config.stagingSimulation, "STAGING SIMULATION / NON-PRODUCTION");
  assert.ok(Object.isFrozen(config));
});

test("worker config: rejects missing required values without defaulting", () => {
  assert.throws(
    () => workerConfigFromEnv({ DATABASE_URL: "postgres://appts:appts@localhost:5432/appts", WORKER_POLL_INTERVAL_MS: "5000" }),
    expectConfigError("STAGING_SIMULATION", "CONFIG_MISSING_REQUIRED", /STAGING_SIMULATION/),
  );
  assert.throws(
    () => workerConfigFromEnv({ ...VALID_WORKER_ENV, WORKER_POLL_INTERVAL_MS: undefined }),
    expectConfigError("WORKER_POLL_INTERVAL_MS", "CONFIG_MISSING_REQUIRED", /WORKER_POLL_INTERVAL_MS/),
  );
  assert.throws(
    () => workerConfigFromEnv({ ...VALID_WORKER_ENV, DATABASE_URL: undefined }),
    expectConfigError("DATABASE_URL", "CONFIG_MISSING_REQUIRED", /DATABASE_URL/),
  );
});

test("worker config: rejects any staging simulation label other than the exact literal", () => {
  assert.throws(
    () => workerConfigFromEnv({ ...VALID_WORKER_ENV, STAGING_SIMULATION: "SIMULATION" }),
    (err: unknown): boolean => {
      assert.ok(err instanceof ConfigError);
      assert.equal(err.code, "CONFIG_INVALID_VALUE");
      assert.equal(err.field, "STAGING_SIMULATION");
      assert.match(err.message, /must equal "STAGING SIMULATION \/ NON-PRODUCTION"/);
      return true;
    },
  );
  assert.throws(
    () => workerConfigFromEnv({ ...VALID_WORKER_ENV, STAGING_SIMULATION: "staging simulation / non-production" }),
    expectConfigError("STAGING_SIMULATION", "CONFIG_INVALID_VALUE", /must equal/),
  );
  assert.throws(
    () => workerConfigFromEnv({ ...VALID_WORKER_ENV, STAGING_SIMULATION: "" }),
    expectConfigError("STAGING_SIMULATION", "CONFIG_MISSING_REQUIRED", /STAGING_SIMULATION/),
  );
});

test("worker config: rejects a non-numeric or out-of-range poll interval", () => {
  assert.throws(
    () => workerConfigFromEnv({ ...VALID_WORKER_ENV, WORKER_POLL_INTERVAL_MS: "fast" }),
    expectConfigError("WORKER_POLL_INTERVAL_MS", "CONFIG_INVALID_VALUE", /expected an integer/),
  );
  assert.throws(
    () => workerConfigFromEnv({ ...VALID_WORKER_ENV, WORKER_POLL_INTERVAL_MS: "5000.5" }),
    expectConfigError("WORKER_POLL_INTERVAL_MS", "CONFIG_INVALID_VALUE", /expected an integer/),
  );
  assert.throws(
    () => workerConfigFromEnv({ ...VALID_WORKER_ENV, WORKER_POLL_INTERVAL_MS: "0" }),
    expectConfigError("WORKER_POLL_INTERVAL_MS", "CONFIG_INVALID_VALUE", /between 1000 and 86400000/),
  );
  assert.throws(
    () => workerConfigFromEnv({ ...VALID_WORKER_ENV, WORKER_POLL_INTERVAL_MS: "999" }),
    expectConfigError("WORKER_POLL_INTERVAL_MS", "CONFIG_INVALID_VALUE", /between 1000 and 86400000/),
  );
  assert.throws(
    () => workerConfigFromEnv({ ...VALID_WORKER_ENV, WORKER_POLL_INTERVAL_MS: "86400001" }),
    expectConfigError("WORKER_POLL_INTERVAL_MS", "CONFIG_INVALID_VALUE", /between 1000 and 86400000/),
  );
});

test("worker config: exposes no time-authority configuration surface", () => {
  const config = workerConfigFromEnv({ ...VALID_WORKER_ENV, TIME_AUTHORITY: "NTP" });
  assert.ok(!("timeAuthority" in config));
  assert.ok(!("authoritativeTime" in config));
  assert.deepEqual(Object.keys(config).sort(), ["databaseUrl", "kind", "stagingSimulation", "workerPollIntervalMs"]);
});
