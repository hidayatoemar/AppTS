import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const toolPath = fileURLToPath(import.meta.url);
const repositoryRoot = dirname(dirname(toolPath));
const baselineRelativePath = "deploy/db/schema-freeze-baseline.json";
const frozenRoots = ["db/migrations", "db/verify"];
const baselineWriteAuthorizationVariable = "APPTS_SCHEMA_FREEZE_MAINTAINER_AUTH";
const baselineWriteAuthorization = "DEP001_SCHEMA_FREEZE_MAINTAINER_WRITE_V1";

function stop(message) {
  console.error(`STOP: ${message}`);
  process.exitCode = 2;
}

function parseArguments(argv) {
  let root = repositoryRoot;
  let manifest = null;
  let writeBaseline = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--root") {
      root = resolve(argv[++index] ?? "");
    } else if (argument === "--manifest") {
      manifest = resolve(argv[++index] ?? "");
    } else if (argument === "--write-baseline") {
      writeBaseline = true;
    } else {
      throw new Error(`unknown argument: ${argument}`);
    }
  }

  return { root, manifest: manifest ?? join(root, baselineRelativePath), writeBaseline };
}

function relativePosix(root, filePath) {
  return relative(root, filePath).split(sep).join("/");
}

function collectFiles(root, relativeDirectory) {
  const directory = join(root, relativeDirectory);
  const files = [];

  function visit(currentDirectory) {
    for (const entry of readdirSync(currentDirectory, { withFileTypes: true })) {
      const currentPath = join(currentDirectory, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error(`symbolic links are not permitted in frozen roots: ${relativePosix(root, currentPath)}`);
      }
      if (entry.isDirectory()) {
        visit(currentPath);
      } else if (entry.isFile()) {
        const digest = createHash("sha256").update(readFileSync(currentPath)).digest("hex");
        files.push({ path: relativePosix(root, currentPath), sha256: digest });
      } else {
        throw new Error(`unsupported filesystem entry in frozen roots: ${relativePosix(root, currentPath)}`);
      }
    }
  }

  visit(directory);
  return files;
}

function inventory(root) {
  const files = frozenRoots.flatMap((directory) => collectFiles(root, directory));
  files.sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));
  return files;
}

function readBaseline(manifestPath) {
  const parsed = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (
    parsed.format !== "appts-dep001-schema-freeze-v1"
    || JSON.stringify(parsed.roots) !== JSON.stringify(frozenRoots)
    || !Array.isArray(parsed.files)
    || parsed.files.some((entry) => !entry || typeof entry.path !== "string" || !/^[a-f0-9]{64}$/.test(entry.sha256))
  ) {
    throw new Error(`invalid schema-freeze manifest: ${manifestPath}`);
  }
  return parsed.files;
}

function compare(expected, actual) {
  const expectedByPath = new Map(expected.map((entry) => [entry.path, entry.sha256]));
  const actualByPath = new Map(actual.map((entry) => [entry.path, entry.sha256]));
  const differences = [];

  for (const path of [...new Set([...expectedByPath.keys(), ...actualByPath.keys()])].sort()) {
    const expectedHash = expectedByPath.get(path);
    const actualHash = actualByPath.get(path);
    if (expectedHash === undefined) differences.push(`ADDED ${path}\n  actual:   ${actualHash}`);
    else if (actualHash === undefined) differences.push(`MISSING ${path}\n  baseline: ${expectedHash}`);
    else if (expectedHash !== actualHash) differences.push(`CHANGED ${path}\n  baseline: ${expectedHash}\n  actual:   ${actualHash}`);
  }

  return differences;
}

function main() {
  let argumentsValue;
  try {
    argumentsValue = parseArguments(process.argv.slice(2));
    const actual = inventory(argumentsValue.root);

    if (argumentsValue.writeBaseline) {
      if (process.env[baselineWriteAuthorizationVariable] !== baselineWriteAuthorization) {
        throw new Error(`--write-baseline requires ${baselineWriteAuthorizationVariable}=${baselineWriteAuthorization}.`);
      }
      writeFileSync(
        argumentsValue.manifest,
        `${JSON.stringify({ format: "appts-dep001-schema-freeze-v1", roots: frozenRoots, files: actual }, null, 2)}\n`,
        "utf8",
      );
      console.log(`WROTE: ${relativePosix(argumentsValue.root, argumentsValue.manifest)}`);
      return;
    }

    const expected = readBaseline(argumentsValue.manifest);
    const differences = compare(expected, actual);
    if (differences.length > 0) {
      stop(`schema freeze mismatch against ${relativePosix(argumentsValue.root, argumentsValue.manifest)}\n${differences.map((difference) => `- ${difference}`).join("\n")}`);
      return;
    }

    console.log(`PASS: schema freeze verified (${actual.length} files; V001–V003 and db/verify baseline unchanged).`);
  } catch (error) {
    stop(error instanceof Error ? error.message : String(error));
  }
}

main();
