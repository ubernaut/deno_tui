export type ApiExportKind = "star" | "named";
export type ApiSymbolKind =
  | "class"
  | "const"
  | "enum"
  | "function"
  | "interface"
  | "type"
  | "variable";

export interface ApiExportDeclaration {
  module: string;
  target: string;
  kind: ApiExportKind;
  names: string[];
}

export interface ApiSymbolDeclaration {
  module: string;
  name: string;
  kind: ApiSymbolKind;
  typeOnly: boolean;
  documented: boolean;
}

export interface ApiModuleInventory {
  module: string;
  exports: ApiExportDeclaration[];
  symbols: ApiSymbolDeclaration[];
  missingTargets: string[];
}

export interface ApiInventory {
  entrypoint: string;
  modules: ApiModuleInventory[];
  exportCount: number;
  symbolCount: number;
  documentedSymbolCount: number;
  undocumentedSymbolCount: number;
  documentationCoverage: number;
  duplicateSymbols: Record<string, string[]>;
  missingTargets: string[];
}

export interface ApiInventoryOptions {
  root?: string;
  readTextFile?: (path: string) => string | Promise<string>;
  exists?: (path: string) => boolean | Promise<boolean>;
}

export interface ApiInventorySuccessOptions {
  failDuplicates?: boolean;
  minDocumentationCoverage?: number;
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

export function parseApiSymbols(source: string, module: string): ApiSymbolDeclaration[] {
  const symbols: ApiSymbolDeclaration[] = [];
  const declarationPattern =
    /export\s+(?:(declare)\s+)?(?:(async)\s+)?(class|function|interface|type|enum|const|let|var)\s+([A-Za-z_$][\w$]*)/g;
  const namedExportPattern = /export\s+\{([\s\S]*?)\}(?!\s+from\s+["'])/g;

  for (const match of source.matchAll(declarationPattern)) {
    const [, , , rawKind, name] = match;
    const kind = normalizeSymbolKind(rawKind);
    symbols.push({
      module,
      name,
      kind,
      typeOnly: kind === "interface" || kind === "type",
      documented: hasLeadingJSDoc(source, match.index ?? 0),
    });
  }

  for (const match of source.matchAll(namedExportPattern)) {
    for (const part of (match[1] ?? "").split(",")) {
      const parsed = parseNamedSymbol(part);
      if (!parsed) continue;
      symbols.push({
        module,
        name: parsed.name,
        kind: parsed.typeOnly ? "type" : "variable",
        typeOnly: parsed.typeOnly,
        documented: hasLeadingJSDoc(source, match.index ?? 0),
      });
    }
  }

  return uniqueSymbols(symbols);
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
    const symbols = parseApiSymbols(source, module);
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
      symbols,
      missingTargets: [...new Set(missingTargets)].sort(),
    });
  }

  const sortedModules = modules.sort((left, right) => left.module.localeCompare(right.module));
  const missingTargets = [...new Set(modules.flatMap((module) => module.missingTargets))].sort();
  const symbolCount = modules.reduce((total, module) => total + module.symbols.length, 0);
  const documentedSymbolCount = modules.reduce(
    (total, module) => total + module.symbols.filter((symbol) => symbol.documented).length,
    0,
  );
  return {
    entrypoint: normalizeModulePath(entrypoint),
    modules: sortedModules,
    exportCount: modules.reduce((total, module) => total + module.exports.length, 0),
    symbolCount,
    documentedSymbolCount,
    undocumentedSymbolCount: symbolCount - documentedSymbolCount,
    documentationCoverage: symbolCount === 0 ? 1 : documentedSymbolCount / symbolCount,
    duplicateSymbols: duplicateApiSymbols(sortedModules),
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
    `Exported symbols: ${inventory.symbolCount}`,
    `Documented symbols: ${inventory.documentedSymbolCount}`,
    `Documentation coverage: ${formatPercent(inventory.documentationCoverage)}`,
    `Duplicate symbols: ${Object.keys(inventory.duplicateSymbols).length}`,
    `Missing targets: ${inventory.missingTargets.length}`,
    ``,
    `| Module | Re-exports | Symbols | Missing Targets |`,
    `| ------ | ---------- | ------- | --------------- |`,
  ];

  for (const module of inventory.modules) {
    lines.push(
      `| \`${module.module}\` | ${module.exports.length} | ${module.symbols.length} | ${
        module.missingTargets.length === 0 ? "none" : module.missingTargets.map((target) => `\`${target}\``).join(", ")
      } |`,
    );
  }

  if (Object.keys(inventory.duplicateSymbols).length > 0) {
    lines.push("", "## Duplicate Symbols", "");
    for (const [name, modules] of Object.entries(inventory.duplicateSymbols)) {
      lines.push(`- \`${name}\`: ${modules.map((module) => `\`${module}\``).join(", ")}`);
    }
  }

  return lines.join("\n");
}

export function inventorySucceeded(
  inventory: ApiInventory,
  options: ApiInventorySuccessOptions = {},
): boolean {
  return inventory.missingTargets.length === 0 &&
    (!(options.failDuplicates ?? false) || Object.keys(inventory.duplicateSymbols).length === 0) &&
    inventory.documentationCoverage >= (options.minDocumentationCoverage ?? 0);
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

function parseNamedSymbol(source: string): { name: string; typeOnly: boolean } | undefined {
  const trimmed = source.trim();
  if (!trimmed) return undefined;
  const typeOnly = trimmed.startsWith("type ");
  const withoutType = trimmed.replace(/^type\s+/, "");
  const [, alias] = withoutType.split(/\s+as\s+/);
  const name = (alias ?? withoutType).trim();
  return name ? { name, typeOnly } : undefined;
}

function normalizeSymbolKind(kind: string): ApiSymbolKind {
  if (kind === "let" || kind === "var") return "variable";
  return kind as ApiSymbolKind;
}

function uniqueSymbols(symbols: ApiSymbolDeclaration[]): ApiSymbolDeclaration[] {
  const byKey = new Map<string, ApiSymbolDeclaration>();
  for (const symbol of symbols) {
    byKey.set(`${symbol.module}\0${symbol.name}\0${symbol.kind}\0${symbol.typeOnly}`, symbol);
  }
  return [...byKey.values()].sort((left, right) =>
    left.name.localeCompare(right.name) || left.kind.localeCompare(right.kind)
  );
}

function duplicateApiSymbols(modules: readonly ApiModuleInventory[]): Record<string, string[]> {
  const byName = new Map<string, Set<string>>();
  for (const module of modules) {
    for (const symbol of module.symbols) {
      const modulesForName = byName.get(symbol.name) ?? new Set<string>();
      modulesForName.add(module.module);
      byName.set(symbol.name, modulesForName);
    }
  }

  const duplicates: Record<string, string[]> = {};
  for (const [name, moduleNames] of [...byName.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    if (moduleNames.size > 1) {
      duplicates[name] = [...moduleNames].sort();
    }
  }
  return duplicates;
}

function hasLeadingJSDoc(source: string, index: number): boolean {
  const prefix = source.slice(0, index).trimEnd();
  if (!prefix.endsWith("*/")) return false;
  const start = prefix.lastIndexOf("/**");
  if (start < 0) return false;
  const between = prefix.slice(start + 3, -2);
  return !between.includes("*/");
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
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
  const failDuplicates = Deno.args.includes("--fail-duplicates");
  const minDocumentationCoverage = parseMinimumDocumentationCoverage(Deno.args);
  const entrypoint = Deno.args.find((arg) => !arg.startsWith("--")) ?? "mod.ts";
  const inventory = await createApiInventory(entrypoint);

  if (quiet) {
    // Check-only mode for contributor health gates.
  } else if (json) {
    console.log(JSON.stringify(inventory, null, 2));
  } else {
    console.log(formatApiInventory(inventory));
  }

  if (check && !inventorySucceeded(inventory, { failDuplicates, minDocumentationCoverage })) {
    Deno.exit(1);
  }
}

function parseMinimumDocumentationCoverage(args: readonly string[]): number | undefined {
  const prefix = "--min-doc-coverage=";
  const match = args.find((arg) => arg.startsWith(prefix));
  if (!match) return undefined;
  const raw = Number(match.slice(prefix.length));
  if (!Number.isFinite(raw)) return undefined;
  return raw > 1 ? raw / 100 : Math.max(0, raw);
}
