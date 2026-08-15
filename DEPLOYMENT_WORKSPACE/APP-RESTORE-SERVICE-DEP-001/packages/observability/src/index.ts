import { hostname } from "node:os";
import pino from "pino";

export type LogLevel = "fatal" | "error" | "warn" | "info" | "debug" | "trace";
export type LogDestination = NodeJS.WritableStream;

export interface LoggerOptions {
  readonly component: string;
  readonly level?: LogLevel;
  readonly destination?: LogDestination;
}

export interface LogFn {
  (msg: string, ...args: unknown[]): void;
  (obj: Readonly<Record<string, unknown>>, msg?: string, ...args: unknown[]): void;
}

export interface Logger {
  readonly component: string;
  readonly fatal: LogFn;
  readonly error: LogFn;
  readonly warn: LogFn;
  readonly info: LogFn;
  readonly debug: LogFn;
  readonly trace: LogFn;
  child(bindings: Record<string, unknown>): Logger;
}

const CENSOR = "[REDACTED]";

// Field-name redaction paths applied by pino (censors the whole value).
const REDACT_PATHS = [
  // transport header blocks carry cookies/authorization as a unit
  "request.headers",
  "req.headers",
  "response.headers",
  "res.headers",
  // common secret-bearing field names at any depth
  "*.password",
  "*.passwd",
  "*.pwd",
  "*.secret",
  "*.secrets",
  "*.token",
  "*.access_token",
  "*.refresh_token",
  "*.api_key",
  "*.apikey",
  "*.apiKey",
  "*.authorization",
  "*.cookie",
  "*.cookies",
  "*.set_cookie",
  "*.credentials",
  "*.credential",
  "*.client_secret",
  "*.private_key",
  "*.privateKey",
  "*.session",
  "*.session_id",
  "*.csrf_token",
  // top-level aliases
  "password",
  "passwd",
  "pwd",
  "secret",
  "secrets",
  "token",
  "access_token",
  "refresh_token",
  "api_key",
  "apikey",
  "apiKey",
  "authorization",
  "cookie",
  "cookies",
  "set_cookie",
  "credentials",
  "credential",
  "client_secret",
  "private_key",
  "privateKey",
  "session",
  "session_id",
  "csrf_token",
];

const SECRET_KEY_PATTERN = /^(password|passwd|pwd|secret|secrets|token|access_token|refresh_token|api_key|apikey|apiKey|authorization|cookie|cookies|set_cookie|credentials|credential|client_secret|private_key|privateKey|session|session_id|csrf_token)$/i;

// Matches connection URLs carrying credentials: scheme://<userinfo>@ embedded anywhere in a string
// (non-anchored, global) so occurrences inside Error message/stack and other free text are redacted too.
const URL_CREDENTIALS_PATTERN = /(postgres|postgresql|mysql|mariadb|redis|rediss|amqp|amqps|mongodb|mongodb\+srv|https?):\/\/[^@\s/]+@/gi;

function redactString(input: string): string {
  return input.replace(URL_CREDENTIALS_PATTERN, (match) => {
    const prefix = match.slice(0, match.indexOf("://") + 3);
    return `${prefix}${CENSOR}@`;
  });
}

function redactValue(value: unknown, key: string): unknown {
  if (typeof value === "string") {
    if (SECRET_KEY_PATTERN.test(key)) return CENSOR;
    return redactString(value);
  }
  if (Array.isArray(value)) {
    return value.map((item, index) => redactValue(item, String(index)));
  }
  if (value !== null && typeof value === "object" && !(value instanceof Date) && !(value instanceof Error) && !(value instanceof URL) && !(value instanceof RegExp)) {
    const out: Record<string, unknown> = {};
    for (const [entryKey, entryValue] of Object.entries(value)) {
      out[entryKey] = redactValue(entryValue, entryKey);
    }
    return out;
  }
  return value;
}

function redactLogObject(log: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(log)) {
    out[key] = redactValue(value, key);
  }
  return out;
}

const logFormatter = (log: Record<string, unknown>): Record<string, unknown> => redactLogObject(log);

function sanitizeErrorLike(value: unknown): Record<string, unknown> {
  if (value instanceof Error) {
    return redactLogObject({
      type: value.name,
      message: value.message,
      ...(typeof value.stack === "string" ? { stack: value.stack } : {}),
    });
  }
  const result = redactValue(value, "err");
  return typeof result === "object" && result !== null ? (result as Record<string, unknown>) : { value: result };
}

const SERIALIZERS = {
  err: (value: unknown): unknown => sanitizeErrorLike(value),
  error: (value: unknown): unknown => sanitizeErrorLike(value),
  request: (value: unknown): unknown => redactValue(value, "request"),
  req: (value: unknown): unknown => redactValue(value, "req"),
  response: (value: unknown): unknown => redactValue(value, "response"),
  res: (value: unknown): unknown => redactValue(value, "res"),
};

function wrap(instance: pino.Logger, component: string): Logger {
  const makeLogFn = (method: LogLevel): LogFn =>
    ((first: Record<string, unknown> | string, ...rest: unknown[]) => {
      (instance[method] as unknown as (...args: unknown[]) => void)(first, ...rest);
    }) as LogFn;
  return {
    component,
    fatal: makeLogFn("fatal"),
    error: makeLogFn("error"),
    warn: makeLogFn("warn"),
    info: makeLogFn("info"),
    debug: makeLogFn("debug"),
    trace: makeLogFn("trace"),
    child: (bindings) => wrap(instance.child(bindings), component),
  };
}

export function createLogger(options: LoggerOptions): Logger {
  // pino(7+) does NOT accept `destination` inside the options object; the destination is
  // the documented second argument. Omitting it keeps the default stdout JSON behavior.
  const pinoOptions = {
    level: options.level ?? "info",
    base: { pid: process.pid, hostname: hostname(), component: options.component },
    redact: { paths: REDACT_PATHS, censor: CENSOR },
    serializers: SERIALIZERS,
    formatters: { log: logFormatter },
  };
  const instance = options.destination !== undefined ? pino(pinoOptions, options.destination) : pino(pinoOptions);
  return wrap(instance, options.component);
}
