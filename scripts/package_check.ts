import { type ApiStabilityTier, type PackageEntrypointManifest, packageEntrypoints } from "../src/api_stability.ts";
import { createApiInventory } from "./api_inventory.ts";

export interface PackageExportValidation {
  ok: boolean;
  missingExports: string[];
  mismatchedExports: Array<{ specifier: string; expected: string; actual: string }>;
  unexpectedExports: string[];
  missingFiles: string[];
  byStability: Record<ApiStabilityTier, PackageExportStabilityValidation>;
}

export interface PackageExportStabilityValidation {
  stability: ApiStabilityTier;
  ok: boolean;
  missingExports: string[];
  mismatchedExports: Array<{ specifier: string; expected: string; actual: string }>;
  missingFiles: string[];
}

export interface StableDemoExportValidation {
  ok: boolean;
  legacyAllowedModules: string[];
  unexpectedModules: string[];
}

type PackageConfig = {
  exports?: string | Record<string, string>;
};

export function validatePackageExports(
  config: PackageConfig,
  entrypoints: readonly PackageEntrypointManifest[] = packageEntrypoints,
  options: { exists?: (path: string) => boolean } = {},
): PackageExportValidation {
  const exists = options.exists ?? existsOnDisk;
  const actual = normalizeExports(config.exports);
  const expected = new Map<string, string>(entrypoints.map((entrypoint) => [entrypoint.specifier, entrypoint.path]));
  const missingExports: string[] = [];
  const mismatchedExports: Array<{ specifier: string; expected: string; actual: string }> = [];
  const missingFiles: string[] = [];
  const byStability = emptyStabilityValidation();

  for (const entrypoint of entrypoints) {
    const tier = byStability[entrypoint.stability];
    const actualPath = actual.get(entrypoint.specifier);
    if (actualPath === undefined) {
      missingExports.push(entrypoint.specifier);
      tier.missingExports.push(entrypoint.specifier);
    } else if (actualPath !== entrypoint.path) {
      const mismatch = { specifier: entrypoint.specifier, expected: entrypoint.path, actual: actualPath };
      mismatchedExports.push(mismatch);
      tier.mismatchedExports.push(mismatch);
    }
    if (!exists(entrypoint.path.replace(/^\.\//, ""))) {
      missingFiles.push(entrypoint.path);
      tier.missingFiles.push(entrypoint.path);
    }
  }

  for (const tier of Object.values(byStability)) {
    tier.ok = tier.missingExports.length === 0 &&
      tier.mismatchedExports.length === 0 &&
      tier.missingFiles.length === 0;
  }

  const unexpectedExports = [...actual.keys()]
    .filter((specifier) => !expected.has(specifier))
    .sort();

  return {
    ok: missingExports.length === 0 &&
      mismatchedExports.length === 0 &&
      unexpectedExports.length === 0 &&
      missingFiles.length === 0,
    missingExports,
    mismatchedExports,
    unexpectedExports,
    missingFiles,
    byStability,
  };
}

export function formatPackageExportValidation(validation: PackageExportValidation): string {
  const lines = [
    validation.ok ? "ok package exports match the stability manifest" : "fail package exports drifted from manifest",
  ];
  for (const specifier of validation.missingExports) {
    lines.push(`missing export: ${specifier}`);
  }
  for (const mismatch of validation.mismatchedExports) {
    lines.push(`mismatched export: ${mismatch.specifier} expected ${mismatch.expected} got ${mismatch.actual}`);
  }
  for (const specifier of validation.unexpectedExports) {
    lines.push(`unexpected export: ${specifier}`);
  }
  for (const path of validation.missingFiles) {
    lines.push(`missing file: ${path}`);
  }
  for (const tier of stabilityTiers()) {
    const tierValidation = validation.byStability[tier];
    lines.push(`${tier}: ${tierValidation.ok ? "ok" : "drift"}`);
    for (const specifier of tierValidation.missingExports) {
      lines.push(`  missing export: ${specifier}`);
    }
    for (const mismatch of tierValidation.mismatchedExports) {
      lines.push(`  mismatched export: ${mismatch.specifier} expected ${mismatch.expected} got ${mismatch.actual}`);
    }
    for (const path of tierValidation.missingFiles) {
      lines.push(`  missing file: ${path}`);
    }
  }
  return lines.join("\n");
}

const DEFAULT_LEGACY_STABLE_DEMO_MODULES = [
  "src/markup/demo_fixtures.ts",
  "src/three_ascii/demo_presets.ts",
] as const;

export function validateStableDemoExports(
  inventory: { modules: ReadonlyArray<{ module: string }> },
  options: { legacyAllowedModules?: readonly string[] } = {},
): StableDemoExportValidation {
  const legacyAllowedModules = [...(options.legacyAllowedModules ?? DEFAULT_LEGACY_STABLE_DEMO_MODULES)].sort();
  const allowed = new Set(legacyAllowedModules);
  const unexpectedModules = inventory.modules
    .map((entry) => entry.module)
    .filter(isDemoLikeStableModule)
    .filter((module) => !allowed.has(module))
    .sort();

  return {
    ok: unexpectedModules.length === 0,
    legacyAllowedModules,
    unexpectedModules,
  };
}

export function formatStableDemoExportValidation(validation: StableDemoExportValidation): string {
  const lines = [
    validation.ok
      ? "ok stable exports contain no new demo-only modules"
      : "fail stable exports include new demo-only modules",
  ];
  if (validation.legacyAllowedModules.length > 0) {
    lines.push(`legacy allowed: ${validation.legacyAllowedModules.join(", ")}`);
  }
  for (const module of validation.unexpectedModules) {
    lines.push(`unexpected stable demo export: ${module}`);
  }
  return lines.join("\n");
}

function emptyStabilityValidation(): Record<ApiStabilityTier, PackageExportStabilityValidation> {
  return {
    stable: { stability: "stable", ok: true, missingExports: [], mismatchedExports: [], missingFiles: [] },
    beta: { stability: "beta", ok: true, missingExports: [], mismatchedExports: [], missingFiles: [] },
    experimental: { stability: "experimental", ok: true, missingExports: [], mismatchedExports: [], missingFiles: [] },
    internal: { stability: "internal", ok: true, missingExports: [], mismatchedExports: [], missingFiles: [] },
  };
}

function stabilityTiers(): ApiStabilityTier[] {
  return ["stable", "beta", "experimental", "internal"];
}

function normalizeExports(exportsValue: PackageConfig["exports"]): Map<string, string> {
  if (typeof exportsValue === "string") return new Map([[".", exportsValue]]);
  return new Map(Object.entries(exportsValue ?? {}).sort(([left], [right]) => left.localeCompare(right)));
}

function existsOnDisk(path: string): boolean {
  try {
    Deno.statSync(path);
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return false;
    throw error;
  }
}

function stripJsonComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

if (import.meta.main) {
  const json = Deno.args.includes("--json");
  const quiet = Deno.args.includes("--quiet");
  const source = await Deno.readTextFile("deno.jsonc");
  const config = JSON.parse(stripJsonComments(source)) as PackageConfig;
  const validation = validatePackageExports(config);
  const stableDemoValidation = validateStableDemoExports(await createApiInventory("mod.ts"));

  if (json) {
    console.log(JSON.stringify({ ...validation, stableDemoExports: stableDemoValidation }, null, 2));
  } else if (!quiet) {
    console.log(formatPackageExportValidation(validation));
    console.log(formatStableDemoExportValidation(stableDemoValidation));
  }

  if (!validation.ok || !stableDemoValidation.ok) Deno.exit(1);
}

function isDemoLikeStableModule(module: string): boolean {
  return /(^|\/)(demo|example)s?([_.-]|\/)/i.test(module) ||
    /(^|\/)[^/]*(demo|fixture|sample)[^/]*\.ts$/i.test(module);
}
