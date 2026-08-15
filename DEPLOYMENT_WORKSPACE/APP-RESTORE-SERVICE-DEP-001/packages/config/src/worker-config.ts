import { invalidValueError, missingRequiredError } from "./errors.ts";
import { parseInteger, parsePostgresConnectionUrl } from "./validation.ts";
import type { Env } from "./validation.ts";

export const STAGING_SIMULATION_LABEL = "STAGING SIMULATION / NON-PRODUCTION" as const;

export const WORKER_POLL_INTERVAL_MIN_MS = 1000;
export const WORKER_POLL_INTERVAL_MAX_MS = 86_400_000;

export interface WorkerConfig {
  readonly kind: "worker";
  readonly databaseUrl: string;
  readonly workerPollIntervalMs: number;
  readonly stagingSimulation: typeof STAGING_SIMULATION_LABEL;
}

export function workerConfigFromEnv(env: Env): WorkerConfig {
  const config: WorkerConfig = {
    kind: "worker",
    databaseUrl: parsePostgresConnectionUrl(env, "DATABASE_URL"),
    workerPollIntervalMs: parseInteger(env, "WORKER_POLL_INTERVAL_MS", WORKER_POLL_INTERVAL_MIN_MS, WORKER_POLL_INTERVAL_MAX_MS),
    stagingSimulation: readStagingSimulation(env),
  };
  return Object.freeze(config);
}

function readStagingSimulation(env: Env): typeof STAGING_SIMULATION_LABEL {
  const raw = env["STAGING_SIMULATION"];
  if (raw === undefined || raw === "") {
    throw missingRequiredError("STAGING_SIMULATION");
  }
  if (raw !== STAGING_SIMULATION_LABEL) {
    throw invalidValueError("STAGING_SIMULATION", `must equal "${STAGING_SIMULATION_LABEL}"`);
  }
  return STAGING_SIMULATION_LABEL;
}
