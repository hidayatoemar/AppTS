import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const rel = (path) => relative(root, path).replaceAll("\\", "/");

const expectedNode = "24.19.0";
const expectedNpm = "11.17.0";
const npmUserAgent = process.env.npm_config_user_agent ?? "";
const npmVersion = /(?:^|\s)npm\/([^\s]+)/.exec(npmUserAgent)?.[1] ?? "unknown";

check(process.version === `v${expectedNode}`, `Node must be v${expectedNode}; observed ${process.version}`);
check(npmVersion === expectedNpm, `npm must be ${expectedNpm}; observed ${npmVersion}`);

const rootManifest = readJson(join(root, "package.json"));
check(rootManifest.packageManager === `npm@${expectedNpm}`, "packageManager must be npm@11.17.0");
check(rootManifest.engines?.node === expectedNode, "root engines.node must be 24.19.0");
check(rootManifest.engines?.npm === expectedNpm, "root engines.npm must be 11.17.0");
check(JSON.stringify(rootManifest.workspaces) === JSON.stringify(["apps/*", "packages/*"]), "workspaces must be apps/* and packages/*");
check(readFileSync(join(root, ".node-version"), "utf8").trim() === expectedNode, ".node-version must be 24.19.0");

const npmrc = new Set(readFileSync(join(root, ".npmrc"), "utf8").split(/\r?\n/).map((line) => line.trim()).filter(Boolean));
check(npmrc.has("save-exact=true"), ".npmrc must set save-exact=true");
check(npmrc.has("engine-strict=true"), ".npmrc must set engine-strict=true");

const tsconfig = readJson(join(root, "tsconfig.base.json"));
const requiredCompilerOptions = {
  target: "ES2024",
  module: "NodeNext",
  moduleResolution: "NodeNext",
  strict: true,
  noImplicitOverride: true,
  noUncheckedIndexedAccess: true,
  exactOptionalPropertyTypes: true,
  useUnknownInCatchVariables: true,
  noFallthroughCasesInSwitch: true,
  sourceMap: true,
  noEmitOnError: true,
  rewriteRelativeImportExtensions: true
};
for (const [key, value] of Object.entries(requiredCompilerOptions)) {
  check(tsconfig.compilerOptions?.[key] === value, `tsconfig compilerOptions.${key} must be ${JSON.stringify(value)}`);
}

const workspaceManifestPaths = [];
for (const workspaceRoot of ["apps", "packages"]) {
  for (const entry of readdirSync(join(root, workspaceRoot), { withFileTypes: true })) {
    if (entry.isDirectory()) workspaceManifestPaths.push(join(root, workspaceRoot, entry.name, "package.json"));
  }
}
workspaceManifestPaths.sort();
check(workspaceManifestPaths.length === 15, `expected 15 workspace manifests; observed ${workspaceManifestPaths.length}`);

const manifests = [[join(root, "package.json"), rootManifest], ...workspaceManifestPaths.map((path) => [path, readJson(path)])];
const names = new Set();
for (const [path, manifest] of manifests) {
  check(manifest.private === true, `${rel(path)} must be private`);
  check(manifest.type === "module", `${rel(path)} must use ESM (type=module)`);
  check(!names.has(manifest.name), `${rel(path)} duplicates package name ${manifest.name}`);
  names.add(manifest.name);
}

const expectedDirect = new Map([
  ["package.json:devDependencies:@types/node", "24.13.3"],
  ["package.json:devDependencies:typescript", "6.0.3"],
  ["apps/api/package.json:dependencies:@fastify/static", "10.1.2"],
  ["apps/api/package.json:dependencies:fastify", "5.10.0"],
  ["apps/web/package.json:dependencies:react", "19.2.8"],
  ["apps/web/package.json:dependencies:react-dom", "19.2.8"],
  ["apps/web/package.json:devDependencies:@types/react", "19.2.17"],
  ["apps/web/package.json:devDependencies:@types/react-dom", "19.2.3"],
  ["apps/web/package.json:devDependencies:@vitejs/plugin-react", "6.0.4"],
  ["apps/web/package.json:devDependencies:vite", "8.1.0"],
  ["packages/persistence/package.json:dependencies:pg", "8.22.0"],
  ["packages/persistence/package.json:devDependencies:@types/pg", "8.20.0"],
  ["packages/core-d01/package.json:dependencies:@appts-restore-service/contracts", "0.0.0"],
  ["packages/core-d02/package.json:dependencies:@appts-restore-service/contracts", "0.0.0"],
  ["packages/core-d03/package.json:dependencies:@appts-restore-service/contracts", "0.0.0"],
  ["packages/runtime-d04/package.json:dependencies:@appts-restore-service/contracts", "0.0.0"],
  ["packages/adapters-d05/package.json:dependencies:@appts-restore-service/contracts", "0.0.0"],
  ["packages/interaction-d06/package.json:dependencies:@appts-restore-service/contracts", "0.0.0"],
  ["packages/diagnostics/package.json:dependencies:@appts-restore-service/contracts", "0.0.0"],
  ["packages/observability/package.json:dependencies:pino", "10.3.1"]
]);
const observedDirect = new Map();
for (const [path, manifest] of manifests) {
  for (const section of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]) {
    for (const [name, version] of Object.entries(manifest[section] ?? {})) {
      const key = `${rel(path)}:${section}:${name}`;
      observedDirect.set(key, version);
      check(/^\d+\.\d+\.\d+$/.test(version), `${key} must use an exact stable version; observed ${version}`);
    }
  }
}
for (const [key, version] of expectedDirect) check(observedDirect.get(key) === version, `${key} must be ${version}`);
for (const key of observedDirect.keys()) check(expectedDirect.has(key), `${key} is not in the controlled direct dependency set`);

const lockfile = readJson(join(root, "package-lock.json"));
check(lockfile.lockfileVersion === 3, `package-lock lockfileVersion must be 3; observed ${lockfile.lockfileVersion}`);
check(lockfile.packages?.[""]?.engines?.node === expectedNode, "lockfile root engines.node mismatch");
check(lockfile.packages?.[""]?.engines?.npm === expectedNpm, "lockfile root engines.npm mismatch");
for (const [path, manifest] of manifests) {
  const key = rel(dirname(path)) === "" ? "" : rel(dirname(path));
  const locked = lockfile.packages?.[key];
  check(Boolean(locked), `lockfile missing workspace entry ${key || "<root>"}`);
  if (!locked) continue;
  for (const section of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]) {
    for (const [name, version] of Object.entries(manifest[section] ?? {})) {
      check(locked[section]?.[name] === version, `lockfile ${key || "<root>"} ${section}.${name} mismatch`);
    }
  }
}

const summary = {
  classification: failures.length === 0 ? "PASS" : "FAIL",
  node: process.version,
  npm: npmVersion,
  typescript: rootManifest.devDependencies.typescript,
  packageManager: rootManifest.packageManager,
  lockfileVersion: lockfile.lockfileVersion,
  workspaceCount: workspaceManifestPaths.length,
  directDependencyCount: observedDirect.size,
  lockedDirectDependencies: Object.fromEntries(expectedDirect),
  postgresFlywayCheck: "NOT_APPLICABLE_CF06_B00_NO_DB_OR_MIGRATION_COMMAND_INVOKED",
  failures
};
console.log(JSON.stringify(summary, null, 2));
if (failures.length > 0) process.exitCode = 1;
