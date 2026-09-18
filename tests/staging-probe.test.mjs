import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const path = "infra/staging/probe-host.sh";
const script = readFileSync(path, "utf8");

test("staging host probe has valid bash syntax", () => {
  const result = spawnSync("bash", ["-n", path], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
});

test("staging host probe remains observational and non-mutating", () => {
  const prohibited = [
    /\bsudo\b/,
    /\bdnf\b/,
    /\byum\b/,
    /\bapt(?:-get)?\b/,
    /\bsystemctl\s+(start|stop|restart|enable|disable|mask|unmask)\b/,
    /\bfirewall-cmd\b[^\n]*(--add|--remove|--reload|--permanent)/,
    /\b(rm|mv|cp|install|mkdir|touch|truncate|tee)\b/,
    />\s*\/etc\//,
    /\bchmod\b/,
    /\bchown\b/,
  ];
  for (const pattern of prohibited) {
    assert.doesNotMatch(script, pattern, `probe contains prohibited mutation pattern: ${pattern}`);
  }
  assert.match(script, /probe_mode" "READ_ONLY"/);
  assert.match(script, /mutation_performed" "NO"/);
});
