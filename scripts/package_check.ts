import { type PackageEntrypointManifest, packageEntrypoints } from "../src/api_stability.ts";

export interface PackageExportValidation {
  ok: boolean;
  missingExports: string[];
  mismatchedExports: Array<{ specifier: string; expected: string; actual: string }>;
  unexpectedExports: string[];
  missingFiles: string[];
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

  for (const entrypoint of entrypoints) {
    const actualPath = actual.get(entrypoint.specifier);
    if (actualPath === undefined) {
      missingExports.push(entrypoint.specifier);
    } else if (actualPath !== entrypoint.path) {
      mismatchedExports.push({ specifier: entrypoint.specifier, expected: entrypoint.path, actual: actualPath });
    }
    if (!exists(entrypoint.path.replace(/^\.\//, ""))) {
      missingFiles.push(entrypoint.path);
    }
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
  return lines.join("\n");
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

  if (json) {
    console.log(JSON.stringify(validation, null, 2));
  } else if (!quiet) {
    console.log(formatPackageExportValidation(validation));
  }

  if (!validation.ok) Deno.exit(1);
}
