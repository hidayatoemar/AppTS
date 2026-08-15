// PREREQUISITE: run `npm run typecheck:projects` first — it emits packages/*/dist.
// These tests exercise the workspace package public API, which resolves to the compiled
// ESM in dist (built ESM keeps valid .js imports and cannot coexist with .ts sources).
import assert from "node:assert/strict";
import test from "node:test";
import { once } from "node:events";
import { Writable } from "node:stream";
import { createLogger } from "@appts-restore-service/observability";

function collectLines(): { stream: Writable; lines: string[] } {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      lines.push(String(chunk));
      callback();
    },
  });
  return { stream, lines };
}

// Deterministic flush: pino writes are synchronous, but ending the stream and awaiting
// the 'finish' event guarantees every emitted line has reached the destination before
// assertions run (no setImmediate/settling heuristics).
async function drain(stream: Writable): Promise<void> {
  stream.end();
  await once(stream, "finish");
}

// Narrowing helpers: `noUncheckedIndexedAccess` makes every index read yield `T | undefined`,
// so we assert the entry exists — with a clear per-test failure when no log line was captured —
// before any property access or parsing happens.
function firstLine(lines: string[]): string {
  const line = lines[0];
  assert.ok(line !== undefined, `expected at least one log line, received ${lines.length}`);
  return line;
}

function parseFirstLine(lines: string[]): Record<string, unknown> {
  return JSON.parse(firstLine(lines)) as Record<string, unknown>;
}

test("logger: writes JSON with structured component field to the configured destination", async () => {
  const { stream, lines } = collectLines();
  const logger = createLogger({ component: "api", destination: stream });
  logger.info("hello");
  await drain(stream);
  assert.equal(lines.length, 1);
  const parsed = parseFirstLine(lines);
  assert.equal(parsed.component, "api");
  assert.equal(parsed.msg, "hello");
  assert.equal(typeof parsed.level, "number");
  assert.equal(typeof parsed.time, "number");
});

test("logger: redacts common secret-bearing fields", async () => {
  const { stream, lines } = collectLines();
  const logger = createLogger({ component: "worker", destination: stream });
  logger.info({ password: "hunter2", token: "tok-123", user: "alice" }, "login attempt");
  await drain(stream);
  const parsed = parseFirstLine(lines);
  assert.equal(parsed.password, "[REDACTED]");
  assert.equal(parsed.token, "[REDACTED]");
  assert.equal(parsed.user, "alice");
  assert.ok(!JSON.stringify(lines).includes("hunter2"));
  assert.ok(!JSON.stringify(lines).includes("tok-123"));
});

test("logger: redacts connection URL credentials while preserving host/path", async () => {
  const { stream, lines } = collectLines();
  const logger = createLogger({ component: "api", destination: stream });
  logger.info({ databaseUrl: "postgres://appts:supersecret@localhost:5432/appts" }, "db configured");
  await drain(stream);
  const json = JSON.stringify(lines);
  assert.ok(!json.includes("supersecret"), "credential must not appear in output");
  assert.ok(json.includes("localhost:5432/appts"), "non-secret URL parts must be preserved");
  const parsed = parseFirstLine(lines);
  assert.equal(parsed.databaseUrl, "postgres://[REDACTED]@localhost:5432/appts");
});

test("logger: redacts nested secret values inside err and request objects", async () => {
  const { stream, lines } = collectLines();
  const logger = createLogger({ component: "api", destination: stream });
  logger.error(
    {
      err: { message: "connection failed", password: "supersecret" },
      request: { url: "https://internal/api", headers: { authorization: "Bearer abc" } },
    },
    "failure",
  );
  await drain(stream);
  const json = JSON.stringify(lines);
  assert.ok(!json.includes("supersecret"), "nested err secret must not appear");
  assert.ok(!json.includes("Bearer abc"), "nested request header secret must not appear");
  const parsed = parseFirstLine(lines);
  assert.equal((parsed.err as Record<string, unknown>).password, "[REDACTED]");
  assert.equal((parsed.request as Record<string, unknown>).url, "https://internal/api");
  assert.equal((parsed.request as Record<string, unknown>).headers, "[REDACTED]");
});

test("logger: error serializer keeps metadata and scrubs embedded connection credentials", async () => {
  const { stream, lines } = collectLines();
  const logger = createLogger({ component: "worker", destination: stream });
  logger.error({ err: new Error("db postgres://appts:supersecret@localhost:5432/appts unreachable") }, "boom");
  await drain(stream);
  const json = JSON.stringify(lines);
  assert.ok(!json.includes("supersecret"), "credential embedded in error message must not appear");
  const parsed = parseFirstLine(lines);
  const err = parsed.err as Record<string, unknown>;
  assert.equal(err.type, "Error");
  assert.equal(typeof err.message, "string");
  assert.ok((err.message as string).includes("unreachable"));
  assert.ok(!(err.message as string).includes("supersecret"));
});

test("logger: default level info suppresses debug/trace output", async () => {
  const { stream, lines } = collectLines();
  const logger = createLogger({ component: "api", destination: stream });
  logger.debug("not shown");
  logger.trace("not shown");
  logger.info("shown");
  await drain(stream);
  assert.equal(lines.length, 1);
  assert.ok(firstLine(lines).includes('"msg":"shown"'));
});

test("logger: explicit level allows debug output", async () => {
  const { stream, lines } = collectLines();
  const logger = createLogger({ component: "api", level: "debug", destination: stream });
  logger.debug({ detail: 1 }, "debug shown");
  await drain(stream);
  assert.equal(lines.length, 1);
  assert.ok(firstLine(lines).includes('"msg":"debug shown"'));
});

test("logger: child logger inherits component and merges bindings", async () => {
  const { stream, lines } = collectLines();
  const logger = createLogger({ component: "api", destination: stream });
  const child = logger.child({ requestId: "req-1" });
  child.info("handled");
  await drain(stream);
  const parsed = parseFirstLine(lines);
  assert.equal(parsed.component, "api");
  assert.equal(parsed.requestId, "req-1");
});
