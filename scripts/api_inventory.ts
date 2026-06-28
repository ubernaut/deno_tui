export type ApiExportKind = "star" | "named";

export interface ApiExportDeclaration {
  module: string;
  target: string;
  kind: ApiExportKind;
  names: string[];
}

export interface ApiModuleInventory {
  module: string;
  exports: ApiExportDeclaration[];
  missingTargets: string[];
}

export interface ApiInventory {
  entrypoint: string;
  modules: ApiModuleInventory[];
  exportCount: number;
  missingTargets: string[];
}

export interface ApiInventoryOptions {
  root?: string;
  readTextFile?: (path: string) => string | Promise<string>;
  exists?: (path: string) => boolean | Promise<boolean>;
}

export function parseApiExports(source: string, module: string): ApiExportDeclaration[] {
  const exports: ApiExportDeclaration[] = [];
  const declarationPattern = /export\s+(?:(type)\s+)?(?:(\*)|\{([\s\S]*?)\})\s+from\s+["']([^"']+)["'];?/g;

  for (const match of source.matchAll(declarationPattern)) {
    const [, typeOnly, star, namesSource, target] = match;
    if (!target) continue;
    exports.push({
      module,
      target: normalizeModuleTarget(module, target),
      kind: star ? "star" : "named",
      names: star ? [] : parseExportNames(namesSource ?? "", typeOnly === "type"),
    });
  }

  return exports;
}

export async function createApiInventory(
  entrypoint = "mod.ts",
  options: ApiInventoryOptions = {},
): Promise<ApiInventory> {
  const root = options.root ?? Deno.cwd();
  const readTextFile = options.readTextFile ?? ((path: string) => Deno.readTextFile(path));
  const exists = options.exists ?? existsOnDisk;
  const queue = [normalizeModulePath(entrypoint)];
  const seen = new Set<string>();
  const modules: ApiModuleInventory[] = [];

  while (queue.length > 0) {
    const module = queue.shift()!;
    if (seen.has(module)) continue;
    seen.add(module);

    const absoluteModule = joinPath(root, module);
    const source = await readTextFile(absoluteModule);
    const exports = parseApiExports(source, module);
    const missingTargets: string[] = [];

    for (const declaration of exports) {
      if (!isLocalTypeScriptModule(declaration.target)) continue;
      const targetPath = normalizeModulePath(declaration.target);
      if (!(await exists(joinPath(root, targetPath)))) {
        missingTargets.push(targetPath);
        continue;
      }
      if (!seen.has(targetPath)) queue.push(targetPath);
    }

    modules.push({
      module,
      exports,
      missingTargets: [...new Set(missingTargets)].sort(),
    });
  }

  const missingTargets = [...new Set(modules.flatMap((module) => module.missingTargets))].sort();
  return {
    entrypoint: normalizeModulePath(entrypoint),
    modules: modules.sort((left, right) => left.module.localeCompare(right.module)),
    exportCount: modules.reduce((total, module) => total + module.exports.length, 0),
    missingTargets,
  };
}

export function formatApiInventory(inventory: ApiInventory): string {
  const lines = [
    `# API Inventory`,
    ``,
    `Entrypoint: \`${inventory.entrypoint}\``,
    `Modules: ${inventory.modules.length}`,
    `Re-export declarations: ${inventory.exportCount}`,
    `Missing targets: ${inventory.missingTargets.length}`,
    ``,
    `| Module | Exports | Missing Targets |`,
    `| ------ | ------- | --------------- |`,
  ];

  for (const module of inventory.modules) {
    lines.push(
      `| \`${module.module}\` | ${module.exports.length} | ${
        module.missingTargets.length === 0 ? "none" : module.missingTargets.map((target) => `\`${target}\``).join(", ")
      } |`,
    );
  }

  return lines.join("\n");
}

export function inventorySucceeded(inventory: ApiInventory): boolean {
  return inventory.missingTargets.length === 0;
}

function parseExportNames(source: string, typeOnly: boolean): string[] {
  return source
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => part.replace(/^type\s+/, ""))
    .map((part) => part.split(/\s+as\s+/)[0].trim())
    .map((part) => typeOnly ? `type ${part}` : part)
    .sort();
}

function normalizeModuleTarget(module: string, target: string): string {
  if (!target.startsWith(".")) return target;
  return normalizeModulePath(joinPath(dirname(module), target));
}

function normalizeModulePath(path: string): string {
  const normalized = normalizePath(path);
  return normalized.endsWith(".ts") ? normalized : `${normalized}.ts`;
}

function isLocalTypeScriptModule(path: string): boolean {
  return path.endsWith(".ts") && !path.startsWith("http:") && !path.startsWith("https:") && !path.startsWith("npm:");
}

async function existsOnDisk(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return false;
    throw error;
  }
}

function dirname(path: string): string {
  const normalized = normalizePath(path);
  const index = normalized.lastIndexOf("/");
  return index < 0 ? "." : normalized.slice(0, index);
}

function joinPath(...parts: string[]): string {
  return normalizePath(parts.filter((part) => part.length > 0).join("/"));
}

function normalizePath(path: string): string {
  const absolute = path.startsWith("/");
  const parts: string[] = [];
  for (const part of path.replaceAll("\\", "/").split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      parts.pop();
    } else {
      parts.push(part);
    }
  }
  return `${absolute ? "/" : ""}${parts.join("/")}`;
}

if (import.meta.main) {
  const json = Deno.args.includes("--json");
  const check = Deno.args.includes("--check");
  const quiet = Deno.args.includes("--quiet");
  const entrypoint = Deno.args.find((arg) => !arg.startsWith("--")) ?? "mod.ts";
  const inventory = await createApiInventory(entrypoint);

  if (quiet) {
    // Check-only mode for contributor health gates.
  } else if (json) {
    console.log(JSON.stringify(inventory, null, 2));
  } else {
    console.log(formatApiInventory(inventory));
  }

  if (check && !inventorySucceeded(inventory)) {
    Deno.exit(1);
  }
}
