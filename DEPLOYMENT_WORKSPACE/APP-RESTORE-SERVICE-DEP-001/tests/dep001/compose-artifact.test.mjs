import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repositoryRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const read = (relativePath) => readFileSync(resolve(repositoryRoot, relativePath), "utf8");

const compose = read("deploy/compose/compose.yaml");
const dockerfile = read("Dockerfile.dep");
const entrypoint = read("deploy/compose/entrypoint.sh");
const crashEntrypoint = read("deploy/compose/entrypoint.g6-crash-once.test.sh");
const envTemplate = read("deploy/compose/.env.template");
const readme = read("deploy/compose/README.md");
const crashCompose = read("deploy/compose/compose.g6-crash-once.test.yaml");
const servicesSection = compose.slice(compose.indexOf("services:"), compose.indexOf("\nnetworks:"));
const apiService = compose.slice(compose.indexOf("\n  api:"), compose.indexOf("\n  postgres:"));
const postgresService = compose.slice(compose.indexOf("\n  postgres:"), compose.indexOf("\nnetworks:"));
const networksSection = compose.slice(compose.indexOf("\nnetworks:"));
const composeOperational = compose.split("\n").filter((line) => !line.startsWith("name:")).join("\n");

test("DEP Compose has exactly the approved two-service internal topology", () => {
  assert.match(compose, /^services:\n/m);
  assert.match(compose, /^  api:\n/m);
  assert.match(compose, /^  postgres:\n/m);
  assert.equal((servicesSection.match(/^  [a-z][a-z-]+:\n/gm) ?? []).length, 2);
  assert.doesNotMatch(compose, /^  (worker|migration|bootstrap|grant|backup|restore):/im);
  assert.equal((compose.match(/platform: linux\/amd64/g) ?? []).length, 2);
  assert.equal((networksSection.match(/^  [a-z][a-z-]+:\n/gm) ?? []).length, 2);
  assert.match(networksSection, /^  dep-ingress:\n    driver: bridge\n    internal: false\n    attachable: false$/m);
  assert.match(networksSection, /^  dep-db-internal:\n    driver: bridge\n    internal: true\n    attachable: false$/m);
  assert.equal((networksSection.match(/internal: true/g) ?? []).length, 1);
  assert.equal((networksSection.match(/internal: false/g) ?? []).length, 1);
  assert.equal((networksSection.match(/attachable: false/g) ?? []).length, 2);
  assert.equal((networksSection.match(/driver: bridge/g) ?? []).length, 2);
  assert.doesNotMatch(networksSection, /^  default:/m);
  assert.match(apiService, /networks:\n\s+- dep-ingress\n\s+- dep-db-internal/);
  assert.match(postgresService, /networks:\n\s+- dep-db-internal/);
  assert.doesNotMatch(postgresService, /- dep-ingress/);
  assert.doesNotMatch(compose, /external:\s*true|network_mode:\s*host|proxy|cors/i);
});

test("DEP Compose pins images, publishes only loopback API, and externalizes values", () => {
  assert.match(compose, /image: postgres:17\.11-bookworm@sha256:07edf880f0cf3f742c990d23faf92cb19e84923a8bce30f7d8e1a8ab63cae7b3/);
  assert.equal((compose.match(/^\s+- "127\.0\.0\.1:8080:8080"$/gm) ?? []).length, 1);
  assert.doesNotMatch(postgresService, /^\s+ports:/m);
  assert.match(compose, /DATABASE_URL: \$\{APPTS_RUNTIME_DATABASE_URL:\?/);
  assert.match(compose, /APPTS_RUNTIME_DATABASE_URL: \$\{APPTS_RUNTIME_DATABASE_URL:\?/);
  assert.doesNotMatch(compose, /(?:^|\n)\s*(?:POSTGRES_PASSWORD|DATABASE_URL):\s*(?!\$\{)[^\s#]+/);
  assert.doesNotMatch(composeOperational, /initdb|migrat|grant|worker|backup|restore/i);
});

test("DEP Compose uses bounded API and database healthchecks with explicit restarts", () => {
  assert.match(compose, /restart: unless-stopped/g);
  assert.equal((compose.match(/restart: unless-stopped/g) ?? []).length, 2);
  assert.match(compose, /healthcheck:/g);
  assert.equal((compose.match(/healthcheck:/g) ?? []).length, 2);
  assert.match(compose, /127\.0\.0\.1:8080\/healthz/);
  assert.match(compose, /pg_isready/);
  assert.doesNotMatch(compose, /initdb|migrat|grant|worker|backup/i);
});

test("DEP Dockerfile builds and runs only the bounded API artifact", () => {
  assert.match(dockerfile, /^FROM node:24\.19\.0-bookworm-slim AS build$/m);
  assert.match(dockerfile, /^FROM node:24\.19\.0-bookworm-slim AS runtime$/m);
  assert.match(dockerfile, /npm ci --ignore-scripts --no-audit --no-fund/);
  assert.match(dockerfile, /npm run build:dep --workspace=apps\/api/);
  assert.match(dockerfile, /npm run build --workspace=apps\/web/);
  for (const artifact of ["apps/api/dist", "apps/web/dist", "packages/config/dist", "packages/observability/dist"]) {
    assert.match(dockerfile, new RegExp(`COPY --from=build /workspace/${artifact.replaceAll("/", "\\/")}`));
  }
  assert.match(dockerfile, /COPY deploy\/compose\/entrypoint\.sh \/usr\/local\/bin\/dep-entrypoint/);
  assert.match(dockerfile, /COPY deploy\/compose\/entrypoint\.g6-crash-once\.test\.sh \/usr\/local\/lib\/dep\/entrypoint\.g6-crash-once\.test\.sh/);
  assert.match(dockerfile, /ENTRYPOINT \["\/usr\/local\/bin\/dep-entrypoint"\]/);
  assert.doesNotMatch(dockerfile, /SOURCE_SNAPSHOT|COPY .*node_modules|deploy\/db|\bworker.*ENTRYPOINT/i);
});

test("DEP entrypoint fails closed without printing the label or secrets", () => {
  assert.match(entrypoint, /expected_label='STAGING SIMULATION \/ NON-PRODUCTION'/);
  assert.match(entrypoint, /\$\{APPTS_STAGING_LABEL:-\}/);
  assert.match(entrypoint, /DEP startup rejected/);
  assert.match(entrypoint, /exec node \/app\/apps\/api\/dist\/dep-bootstrap\.js/);
  assert.doesNotMatch(entrypoint, /echo\s+.*\$\{APPTS_|printf\s+.*\$\{APPTS_|printenv|DATABASE_URL|PASSWORD/);
});

test("normal DEP paths never reference the G6 crash sentinel", () => {
  const sentinel = /DEP_G6_CRASH_ONCE|DEP-001-G6-CRASH-ONCE/;
  assert.doesNotMatch(compose, sentinel);
  assert.doesNotMatch(envTemplate, sentinel);
  assert.doesNotMatch(entrypoint, sentinel);
  assert.match(dockerfile, /ENTRYPOINT \["\/usr\/local\/bin\/dep-entrypoint"\]/);
  assert.doesNotMatch(dockerfile, sentinel);
});

test("G6 crash override is explicit, API-only, and topology-preserving", () => {
  assert.match(crashCompose, /^services:\n  api:\n/m);
  assert.match(crashCompose, /profiles:\n\s+- g6-crash-test/);
  assert.match(crashCompose, /entrypoint: \["\/usr\/local\/lib\/dep\/entrypoint\.g6-crash-once\.test\.sh"\]/);
  assert.match(crashCompose, /DEP_G6_CRASH_ONCE: "DEP-001-G6-CRASH-ONCE"/);
  assert.equal((crashCompose.match(/DEP_G6_CRASH_ONCE|DEP-001-G6-CRASH-ONCE/g) ?? []).length, 2);
  assert.doesNotMatch(crashCompose, /postgres|image:|restart:|ports:|networks:|volumes:|mount|migration|migrat|grant|worker|backup|restore|command:/i);
  assert.doesNotMatch(crashCompose, /APPTS_STAGING_LABEL|DATABASE_URL/);
});

test("G6 crash wrapper is bounded, fail-closed, and container-local", () => {
  assert.match(crashEntrypoint, /expected_sentinel='DEP-001-G6-CRASH-ONCE'/);
  assert.match(crashEntrypoint, /\$\{DEP_G6_CRASH_ONCE:-\}/);
  assert.match(crashEntrypoint, /\/tmp\/dep-g6-crash-once\.marker/);
  assert.match(crashEntrypoint, /max_attempts=30/);
  assert.match(crashEntrypoint, /127\.0\.0\.1:8080\/healthz/);
  assert.match(crashEntrypoint, /\/usr\/local\/bin\/dep-entrypoint &/);
  assert.match(crashEntrypoint, /api_pid=\$!/);
  assert.match(crashEntrypoint, /mv -f "\$marker_tmp" "\$marker"/);
  assert.match(crashEntrypoint, /kill -KILL "\$api_pid"/);
  assert.doesNotMatch(crashEntrypoint, /kill -TERM "\$api_pid"/);
  assert.match(crashEntrypoint, /wait "\$api_pid"/);
  assert.match(crashEntrypoint, /exec \/usr\/local\/bin\/dep-entrypoint/);
  assert.doesNotMatch(crashEntrypoint, /docker|volume|mount|postgres|migrat|grant|worker|backup|restore|DATABASE_URL|PASSWORD/);
  assert.doesNotMatch(crashEntrypoint, /printf\s+.*(?:DEP_G6|sentinel)|echo\s+.*(?:DEP_G6|sentinel)/i);
  assert.doesNotMatch(crashEntrypoint, /\/app\/.*marker|[^\w]\/var\/lib\/.*marker/);
});

test("DEP template and README carry placeholders and the partial-held boundary", () => {
  assert.match(envTemplate, /^APPTS_STAGING_LABEL=STAGING SIMULATION \/ NON-PRODUCTION$/m);
  for (const name of ["APPTS_RUNTIME_DATABASE_URL", "APPTS_POSTGRES_DB", "APPTS_POSTGRES_USER", "APPTS_POSTGRES_PASSWORD"]) {
    assert.match(envTemplate, new RegExp(`^${name}=<external-[^>]+>$`, "m"));
  }
  assert.doesNotMatch(envTemplate, /postgres:\/\/[^<\s]+|password\s*[:=]\s*[^<\s]+/i);
  assert.match(readme, /MCR-004\/G6/);
  assert.match(readme, /PASS_PARTIAL_HELD/);
  assert.match(readme, /Pending capture\/business API/);
  assert.match(readme, /worker\s+activation/);
  assert.match(readme, /test-only override/);
  assert.match(readme, /requires teardown/);
  assert.match(readme, /no runtime PASS evidence/);
  assert.match(readme, /does not prove schema, migration, grant/);
  assert.match(readme, /127\.0\.0\.1:8080/);
  assert.doesNotMatch(readme, /production ready|production readiness claim/i);
});
