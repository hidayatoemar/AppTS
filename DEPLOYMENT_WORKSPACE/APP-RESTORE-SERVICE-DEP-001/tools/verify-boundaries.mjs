import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const failures = [];
const rel = (path) => relative(root, path).replaceAll("\\", "/");
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const dependencySections = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"];

const workspaces = [];
for (const workspaceRoot of ["apps", "packages"]) {
  for (const entry of readdirSync(join(root, workspaceRoot), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const directory = join(root, workspaceRoot, entry.name);
    const manifestPath = join(directory, "package.json");
    if (!existsSync(manifestPath)) {
      failures.push(`missing workspace manifest ${rel(manifestPath)}`);
      continue;
    }
    workspaces.push({ directory, manifestPath, manifest: readJson(manifestPath), kind: workspaceRoot, id: entry.name });
  }
}
workspaces.sort((a, b) => a.manifest.name.localeCompare(b.manifest.name));
const byName = new Map(workspaces.map((workspace) => [workspace.manifest.name, workspace]));
const graph = new Map(workspaces.map((workspace) => [workspace.manifest.name, new Set()]));

for (const workspace of workspaces) {
  const allDependencies = Object.assign({}, ...dependencySections.map((section) => workspace.manifest[section] ?? {}));
  for (const dependency of Object.keys(allDependencies)) {
    if (byName.has(dependency)) graph.get(workspace.manifest.name).add(dependency);
    if (dependency === "pg" && workspace.id !== "persistence") {
      failures.push(`${rel(workspace.manifestPath)} declares pg outside packages/persistence`);
    }
  }
  if (workspace.kind === "packages") {
    for (const dependency of graph.get(workspace.manifest.name)) {
      if (byName.get(dependency).kind === "apps") failures.push(`${workspace.manifest.name} depends on app ${dependency}`);
    }
  }
  if (workspace.id === "contracts" && graph.get(workspace.manifest.name).size > 0) {
    failures.push("packages/contracts may not depend on implementation workspaces");
  }
}

const visiting = new Set();
const visited = new Set();
const stack = [];
const visit = (name) => {
  if (visiting.has(name)) {
    const start = stack.indexOf(name);
    failures.push(`circular workspace dependency: ${[...stack.slice(start), name].join(" -> ")}`);
    return;
  }
  if (visited.has(name)) return;
  visiting.add(name);
  stack.push(name);
  for (const dependency of graph.get(name)) visit(dependency);
  stack.pop();
  visiting.delete(name);
  visited.add(name);
};
for (const name of graph.keys()) visit(name);

const sourceExtensions = new Set([".js", ".mjs", ".cjs", ".ts", ".tsx"]);
const sourceFiles = [];
const collectFiles = (directory) => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name === "coverage") continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) collectFiles(path);
    else if (sourceExtensions.has(extname(entry.name))) sourceFiles.push(path);
  }
};
for (const workspace of workspaces) collectFiles(workspace.directory);

const ownerForPath = (path) => workspaces.find((workspace) => path === workspace.directory || path.startsWith(`${workspace.directory}${sep}`));
const importPattern = /(?:\bfrom\s*|\bimport\s*\(|\brequire\s*\()\s*["']([^"']+)["']/g;
for (const file of sourceFiles) {
  const owner = ownerForPath(file);
  const text = readFileSync(file, "utf8");
  for (const match of text.matchAll(importPattern)) {
    const specifier = match[1];
    if (specifier === "pg" || specifier.startsWith("pg/")) {
      if (owner?.id !== "persistence") failures.push(`${rel(file)} imports pg outside packages/persistence`);
    }
    for (const [name, target] of byName) {
      if (specifier.startsWith(`${name}/`)) failures.push(`${rel(file)} imports private cross-package path ${specifier}`);
      if (specifier === name && owner?.kind === "packages" && target.kind === "apps") {
        failures.push(`${rel(file)} imports application workspace ${name}`);
      }
    }
    if (specifier.startsWith(".")) {
      const resolved = resolve(dirname(file), specifier);
      const target = ownerForPath(resolved);
      if (target && owner && target !== owner) failures.push(`${rel(file)} uses relative private cross-workspace import ${specifier}`);
    }
  }
}

const edges = [];
for (const [from, dependencies] of graph) for (const to of dependencies) edges.push(`${from} -> ${to}`);
const summary = {
  classification: failures.length === 0 ? "PASS" : "FAIL",
  workspaceNodes: [...graph.keys()],
  workspaceEdges: edges,
  sourceFilesScanned: sourceFiles.length,
  pgOwners: workspaces.filter((workspace) => Object.values(Object.assign({}, ...dependencySections.map((section) => workspace.manifest[section] ?? {}))).includes("8.22.0") && Object.keys(Object.assign({}, ...dependencySections.map((section) => workspace.manifest[section] ?? {}))).includes("pg")).map((workspace) => workspace.manifest.name),
  productBehaviorAuthorityCheck: "NOT_APPLICABLE_CF06_B00_NO_PRODUCT_SOURCE_FILES",
  failures
};
console.log(JSON.stringify(summary, null, 2));
if (failures.length > 0) process.exitCode = 1;
