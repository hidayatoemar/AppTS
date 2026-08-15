import { parseInteger, parsePostgresConnectionUrl } from "./validation.ts";
import type { Env } from "./validation.ts";

export const API_LISTEN_PORT_MIN = 1;
export const API_LISTEN_PORT_MAX = 65535;

export interface ApiConfig {
  readonly kind: "api";
  readonly databaseUrl: string;
  readonly apiPort: number;
}

export function apiConfigFromEnv(env: Env): ApiConfig {
  const config: ApiConfig = {
    kind: "api",
    databaseUrl: parsePostgresConnectionUrl(env, "DATABASE_URL"),
    apiPort: parseInteger(env, "API_LISTEN_PORT", API_LISTEN_PORT_MIN, API_LISTEN_PORT_MAX),
  };
  return Object.freeze(config);
}
