import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const path = "infra/staging/probe-host.sh";
const script = readFileSync(path, "utf8");
const operationalLines = script
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("#"))
  .join("\n");

test("staging host probe has valid bash syntax", () => {
  const result = spawnSync("bash", ["-n", path], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
});

test("staging host probe remains observational and non-mutating", () => {
  const prohibited = [
    /^\s*(sudo|dnf|yum|apt|apt-get|rm|mv|cp|install|mkdir|touch|truncate|tee|chmod|chown)\b/m,
    /^\s*systemctl\s+(start|stop|restart|enable|disable|mask|unmask)\b/m,
    /^\s*firewall-cmd\b[^\n]*(--add|--remove|--reload|--permanent)/m,
    />\s*\/etc\//,
  ];
  for (const pattern of prohibited) {
    assert.doesNotMatch(operationalLines, pattern, `probe contains prohibited mutation pattern: ${pattern}`);
  }
  assert.match(script, /probe_mode" "READ_ONLY"/);
  assert.match(script, /mutation_performed" "NO"/);
});
