import { invalidValueError, missingRequiredError } from "./errors.ts";

export type Env = Readonly<Record<string, string | undefined>>;

const POSTGRES_CONNECTION_SCHEMES = new Set(["postgres", "postgresql"]);

export function requireString(env: Env, key: string): string {
  const value = env[key];
  if (value === undefined || value === "") {
    throw missingRequiredError(key);
  }
  return value;
}

export function parseInteger(env: Env, key: string, min: number, max: number): number {
  const raw = requireString(env, key);
  if (!/^[0-9]+$/.test(raw)) {
    throw invalidValueError(key, `expected an integer, received "${raw}"`);
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw invalidValueError(key, `expected an integer between ${min} and ${max}, received "${raw}"`);
  }
  return value;
}

export function parsePostgresConnectionUrl(env: Env, key: string): string {
  const raw = requireString(env, key);
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw invalidValueError(key, "not a valid URL");
  }
  const scheme = url.protocol.slice(0, -1).toLowerCase();
  if (!POSTGRES_CONNECTION_SCHEMES.has(scheme)) {
    throw invalidValueError(key, `URL scheme "${url.protocol}" is not a supported PostgreSQL connection scheme`);
  }
  if (url.hostname === "") {
    throw invalidValueError(key, "URL must include a host");
  }
  if (url.port !== "" && (Number(url.port) < 1 || Number(url.port) > 65535)) {
    throw invalidValueError(key, `URL port "${url.port}" is out of range`);
  }
  return raw;
}
