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

export interface StableAppExportValidation {
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

const DEFAULT_LEGACY_STABLE_APP_MODULES = [
  "src/app/actions.ts",
  "src/app/app.ts",
  "src/app/command_bindings.ts",
  "src/app/command_search_index.ts",
  "src/app/commands.ts",
  "src/app/component_commands.ts",
  "src/app/data_query_commands.ts",
  "src/app/data_table_commands.ts",
  "src/app/disposables.ts",
  "src/app/focus_commands.ts",
  "src/app/form_commands.ts",
  "src/app/forms.ts",
  "src/app/history.ts",
  "src/app/hit_targets.ts",
  "src/app/input_commands.ts",
  "src/app/list_commands.ts",
  "src/app/log_viewer_commands.ts",
  "src/app/menu_bar_commands.ts",
  "src/app/metric_series_commands.ts",
  "src/app/mod.ts",
  "src/app/mouse_bindings.ts",
  "src/app/pad_commands.ts",
  "src/app/plugins.ts",
  "src/app/router.ts",
  "src/app/runtime_commands.ts",
  "src/app/scroll_area_commands.ts",
  "src/app/selection_bindings.ts",
  "src/app/settings.ts",
  "src/app/settings_bindings.ts",
  "src/app/split_pane_commands.ts",
  "src/app/table_commands.ts",
  "src/app/tabs_commands.ts",
  "src/app/terminal_commands.ts",
  "src/app/terminal_input.ts",
  "src/app/theme_commands.ts",
  "src/app/theme_plugin.ts",
  "src/app/toast_commands.ts",
  "src/app/tree_commands.ts",
  "src/app/widget_commands.ts",
  "src/app/window_manager_commands.ts",
  "src/app/workbench/mod.ts",
  "src/app/workbench_ansi_screen.ts",
  "src/app/workbench_button_style.ts",
  "src/app/workbench_control_layout.ts",
  "src/app/workbench_frame.ts",
  "src/app/workbench_help.ts",
  "src/app/workbench_keymap.ts",
  "src/app/workbench_layout.ts",
  "src/app/workbench_menu.ts",
  "src/app/workbench_overlay.ts",
  "src/app/workbench_panel_workspace_store.ts",
  "src/app/workbench_prompt_input.ts",
  "src/app/workbench_shelf.ts",
  "src/app/workbench_status.ts",
  "src/app/workbench_terminal.ts",
  "src/app/workbench_text.ts",
  "src/app/workbench_three_terminal_pressure.ts",
  "src/app/workbench_titlebar.ts",
  "src/app/workbench_window_registry.ts",
  "src/app/workbench_workspace.ts",
  "src/app/workbench_workspace_store.ts",
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

export function validateStableAppExports(
  inventory: { modules: ReadonlyArray<{ module: string }> },
  options: { legacyAllowedModules?: readonly string[] } = {},
): StableAppExportValidation {
  const legacyAllowedModules = [...(options.legacyAllowedModules ?? DEFAULT_LEGACY_STABLE_APP_MODULES)].sort();
  const allowed = new Set(legacyAllowedModules);
  const unexpectedModules = inventory.modules
    .map((entry) => entry.module)
    .filter((module) => module.startsWith("src/app/"))
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

export function formatStableAppExportValidation(validation: StableAppExportValidation): string {
  const lines = [
    validation.ok
      ? "ok stable exports contain no new app/workbench modules"
      : "fail stable exports include new app/workbench modules",
  ];
  lines.push(`legacy app modules allowed: ${validation.legacyAllowedModules.length}`);
  for (const module of validation.unexpectedModules) {
    lines.push(`unexpected stable app export: ${module}`);
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
  const stableInventory = await createApiInventory("mod.ts");
  const stableDemoValidation = validateStableDemoExports(stableInventory);
  const stableAppValidation = validateStableAppExports(stableInventory);

  if (json) {
    console.log(JSON.stringify(
      {
        ...validation,
        stableDemoExports: stableDemoValidation,
        stableAppExports: stableAppValidation,
      },
      null,
      2,
    ));
  } else if (!quiet) {
    console.log(formatPackageExportValidation(validation));
    console.log(formatStableDemoExportValidation(stableDemoValidation));
    console.log(formatStableAppExportValidation(stableAppValidation));
  }

  if (!validation.ok || !stableDemoValidation.ok || !stableAppValidation.ok) Deno.exit(1);
}

function isDemoLikeStableModule(module: string): boolean {
  return /(^|\/)(demo|example)s?([_.-]|\/)/i.test(module) ||
    /(^|\/)[^/]*(demo|fixture|sample)[^/]*\.ts$/i.test(module);
}
