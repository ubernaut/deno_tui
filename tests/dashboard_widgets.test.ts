import { assertEquals } from "./deps.ts";
import { CommandRegistry } from "../src/app/commands.ts";
import { bindLogViewerCommands, logViewerCommands } from "../src/app/log_viewer_commands.ts";
import { bindMetricSeriesCommands, metricSeriesCommands } from "../src/app/metric_series_commands.ts";
import type { MetricSeriesCommandAction } from "../src/app/metric_series_commands.ts";
import { renderBarChart } from "../src/components/chart.ts";
import { renderGauge } from "../src/components/gauge.ts";
import { LogViewerController, visibleLogLines } from "../src/components/log_viewer.ts";
import {
  MetricSeriesController,
  metricSeriesStats,
  normalizeMetricValue,
  pushMetricValue,
} from "../src/components/metric_series.ts";
import { renderSparkline } from "../src/components/sparkline.ts";
import {
  assertThemeOptions,
  compileThemeManifestOptions,
  composeStyles,
  composeThemeOptions,
  createAnsiStyle,
  createAnsiThemeTokens,
  createTheme,
  createThemeCatalog,
  createThemeEngine,
  createThemeEngineFromManifest,
  createThemeEngineFromPalette,
  createThemeLayerStack,
  createThemePaletteRegistry,
  createThemeProvider,
  createThemeProviderReport,
  createThemeRegistry,
  createThemeRegistryFromManifests,
  defaultThemePacks,
  defaultThemePaletteDefinitions,
  diffThemeEngines,
  emptyStyle,
  formatThemeProviderReportMarkdown,
  inspectThemeCoverage,
  inspectThemeManifest,
  mergeComponentThemeDefinition,
  previewThemeManifest,
  previewThemeProvider,
  type Theme,
  ThemeEngine,
  type ThemeEngineOptions,
  ThemeInheritanceError,
  type ThemePack,
  ThemePackNotFoundError,
  ThemePaletteNotFoundError,
  themePalettes,
  themeStates,
  themeTokenNames,
  ThemeValidationError,
  validateThemeOptions,
} from "../src/theme.ts";
import { bindComponentTheme, bindComponentThemes, ComponentThemeBindingGroup } from "../src/theme_binding.ts";
import { createThemeEngineCache, createThemeProviderCache } from "../src/theme_engine_cache.ts";
import {
  createThemeEngineFactory,
  createThemeEngineFactoryCatalogReport,
  createThemeEngineFactoryRegistry,
  formatThemeEngineFactoryCatalogMarkdown,
  prewarmThemeEngines,
  queryThemeEngineFactories,
  type ThemeEngineFactoryDefinition,
  ThemeEngineFactoryNotFoundError,
} from "../src/theme_engine_factory.ts";
import { createThemeEnginePipeline, prewarmThemeEnginePipelines } from "../src/theme_engine_pipeline.ts";
import {
  createThemeGallery,
  filterThemeGalleryItems,
  rankThemeGalleryItems,
  selectThemeGalleryItem,
} from "../src/theme_gallery.ts";
import { grWizardThemePacks } from "../src/grwizard_themes.ts";
import {
  componentThemeStyleRequests,
  createThemeEngineResolver,
  createThemeProviderResolver,
  formatThemeResolutionMarkdown,
} from "../src/theme_resolver.ts";
import { createThemeWorkspace } from "../src/theme_workspace.ts";
import { AsyncScheduler } from "../src/runtime/scheduler.ts";
import { Signal } from "../src/signals/mod.ts";
import { MemoryStore } from "../src/runtime/storage.ts";

Deno.test("renderSparkline samples values into fixed width", () => {
  assertEquals(renderSparkline([0, 1, 2, 3], 4), "▁▃▆█");
});

Deno.test("renderGauge clamps the value into the available bar", () => {
  assertEquals(renderGauge(0.5, 10, 0, 1, "CPU"), "CPU [██  ]");
});

Deno.test("renderBarChart produces top-down rows", () => {
  assertEquals(renderBarChart([1, 2, 3], 3, 3), ["  █", " ██", "███"]);
});

Deno.test("visibleLogLines follows the tail by default", () => {
  assertEquals(visibleLogLines(["a", "b", "c"], 2), ["b", "c"]);
  assertEquals(visibleLogLines(["a", "b", "c"], 2, false), ["a", "b"]);
});

Deno.test("LogViewerController bounds lines and follows visible tail", () => {
  const logs = new LogViewerController({ limit: 3 });

  logs.append("boot");
  logs.appendMany(["load", "ready", "tick"]);

  assertEquals(logs.inspect(2), {
    lines: ["load", "ready", "tick"],
    lineCount: 3,
    visible: ["ready", "tick"],
    limit: 3,
    follow: true,
    empty: false,
  });
  logs.setFollow(false);
  assertEquals(logs.visible(2), ["load", "ready"]);
  assertEquals(logs.toggleFollow(), true);
  logs.setLimit(1);
  assertEquals(logs.inspect().lines, ["tick"]);
  logs.setLimit(0);
  assertEquals(logs.inspect().empty, true);
  logs.dispose();
});

Deno.test("pushMetricValue appends bounded samples", () => {
  assertEquals(pushMetricValue([1, 2, 3], 4, 3), [2, 3, 4]);
  assertEquals(pushMetricValue([1, 2, 3], 4, 0), []);
});

Deno.test("normalizeMetricValue supports finite fallback and clamp ranges", () => {
  assertEquals(normalizeMetricValue(Number.NaN), 0);
  assertEquals(normalizeMetricValue(2, true), 1);
  assertEquals(normalizeMetricValue(-5, { min: -2, max: 2 }), -2);
});

Deno.test("metricSeriesStats summarizes values", () => {
  assertEquals(metricSeriesStats([]), { count: 0, min: 0, max: 0, latest: 0, average: 0, sum: 0 });
  assertEquals(metricSeriesStats([1, 3, 5]), { count: 3, min: 1, max: 5, latest: 5, average: 3, sum: 9 });
});

Deno.test("MetricSeriesController manages bounded reactive samples", () => {
  const series = new MetricSeriesController({ limit: 3, initialValues: [0, 1], clamp: true });
  const snapshots: number[][] = [];
  series.values.subscribe((values) => snapshots.push(values));

  series.push(0.5);
  series.push(2);
  assertEquals(series.values.value, [1, 0.5, 1]);
  assertEquals(series.stats.value, { count: 3, min: 0.5, max: 1, latest: 1, average: 2.5 / 3, sum: 2.5 });
  assertEquals(series.latest(), 1);

  series.setLimit(2);
  assertEquals(series.snapshot(), [0.5, 1]);

  series.reset([Number.POSITIVE_INFINITY, -1]);
  assertEquals(series.values.value, [0, 0]);
  assertEquals(series.inspect(), {
    values: [0, 0],
    stats: { count: 2, min: 0, max: 0, latest: 0, average: 0, sum: 0 },
    limit: 2,
    empty: false,
  });
  assertEquals(snapshots, [[0, 1, 0.5], [1, 0.5, 1], [0.5, 1], [0, 0]]);
  series.dispose();
});

Deno.test("metricSeriesCommands clear samples and change window limits", async () => {
  const series = new MetricSeriesController({ limit: 4, initialValues: [1, 2, 3, 4] });
  const registry = new CommandRegistry<MetricSeriesCommandAction>();
  const dispose = bindMetricSeriesCommands(registry, series, {
    id: "cpu",
    idPrefix: "metrics.cpu",
    group: "metrics",
    includeLimitCommands: true,
    limits: [2, 4],
  });
  const actions: MetricSeriesCommandAction[] = [];

  assertEquals(registry.list("metrics").map((command) => [command.id, command.label]), [
    ["metrics.cpu.clear", "Clear Metric Series"],
    ["metrics.cpu.limit.2", "Set Metric Window: 2 samples"],
    ["metrics.cpu.limit.4", "Set Metric Window: 4 samples"],
  ]);

  assertEquals(await registry.execute("metrics.cpu.limit.2", (action) => void actions.push(action)), true);
  assertEquals(series.snapshot(), [3, 4]);
  assertEquals(actions[0], {
    type: "metricSeries.limitChanged",
    payload: {
      id: "cpu",
      limit: 2,
      inspection: {
        values: [3, 4],
        stats: { count: 2, min: 3, max: 4, latest: 4, average: 3.5, sum: 7 },
        limit: 2,
        empty: false,
      },
    },
  });

  assertEquals(await registry.execute("metrics.cpu.clear", (action) => void actions.push(action)), true);
  assertEquals(series.inspect().empty, true);
  assertEquals(actions[1]!.type, "metricSeries.cleared");

  dispose();
  assertEquals(registry.list("metrics"), []);
});

Deno.test("metricSeriesCommands can omit limit commands and disable empty series", () => {
  const series = new MetricSeriesController();
  const commands = metricSeriesCommands(series, { includeLimitCommands: false });

  assertEquals(commands.map((command) => [command.id, commandDisabled(command)]), [
    ["metric.clear", true],
  ]);
});

Deno.test("logViewerCommands clear logs and toggle follow mode", async () => {
  const logs = new LogViewerController({ lines: ["a", "b"], follow: true });
  const registry = new CommandRegistry();
  const actions: unknown[] = [];
  const dispose = bindLogViewerCommands(registry, logs, {
    id: "system",
    idPrefix: "logs.system",
    group: "logs",
  });

  assertEquals(logViewerCommands(new LogViewerController()).map((command) => [command.id, commandDisabled(command)]), [
    ["log.clear", true],
    ["log.toggleFollow", undefined],
  ]);
  assertEquals(registry.list("logs").map((command) => command.id), ["logs.system.clear", "logs.system.toggleFollow"]);

  assertEquals(await registry.execute("logs.system.toggleFollow", (action) => void actions.push(action)), true);
  assertEquals(logs.follow.peek(), false);
  assertEquals(actions[0], {
    type: "logViewer.followChanged",
    payload: {
      id: "system",
      follow: false,
      inspection: {
        lines: ["a", "b"],
        lineCount: 2,
        visible: ["a", "b"],
        limit: 500,
        follow: false,
        empty: false,
      },
    },
  });

  assertEquals(await registry.execute("logs.system.clear", (action) => void actions.push(action)), true);
  assertEquals(logs.inspect().empty, true);

  dispose();
  assertEquals(registry.list("logs"), []);
  logs.dispose();
});

Deno.test("createTheme fills semantic token defaults", () => {
  const theme = createTheme({ accent: emptyStyle });
  assertEquals(theme.focused, emptyStyle);
  assertEquals(theme.tokens.warning, emptyStyle);
});

Deno.test("theme constants expose stable token and state names", () => {
  assertEquals(themeTokenNames, ["foreground", "muted", "accent", "success", "warning", "danger", "surface"]);
  assertEquals(themeStates, ["base", "focused", "active", "disabled"]);
});

Deno.test("ANSI theme style specs create reusable terminal styles", () => {
  assertEquals(createAnsiStyle({})("x"), "x");
  assertEquals(createAnsiStyle({ foreground: "cyan", bold: true })("x"), "\x1b[1;36mx\x1b[0m");
  assertEquals(
    createAnsiStyle({ foreground: [31.4, 231.2, 210.8], background: 17, underline: true })("x"),
    "\x1b[4;38;2;31;231;211;48;5;17mx\x1b[0m",
  );
});

Deno.test("ANSI theme token specs build semantic token maps", () => {
  const tokens = createAnsiThemeTokens({
    foreground: { foreground: "white" },
    accent: { foreground: [31, 231, 210] },
    surface: { background: 235 },
  });

  assertEquals(tokens.foreground?.("x"), "\x1b[37mx\x1b[0m");
  assertEquals(tokens.accent?.("x"), "\x1b[38;2;31;231;210mx\x1b[0m");
  assertEquals(tokens.surface?.("x"), "\x1b[48;5;235mx\x1b[0m");
});

Deno.test("theme palette registries build custom palette-backed engines", () => {
  const registry = createThemePaletteRegistry([
    "plain",
    {
      id: "matrix",
      label: "Matrix",
      tokens: {
        foreground: (value) => `fg:${value}`,
        accent: (value) => `accent:${value}`,
      },
    },
  ]);

  registry.register({
    id: "matrix",
    label: "Matrix Reloaded",
    tokens: {
      foreground: (value) => `green:${value}`,
      danger: (value) => `danger:${value}`,
    },
  });

  const engine = registry.engine("matrix", {
    components: {
      Button: {
        base: { base: "foreground", active: "danger" },
      },
    },
  });
  const direct = createThemeEngineFromPalette(registry.tokens("matrix"), {
    components: { Badge: { base: { base: "foreground" } } },
  });

  assertEquals(defaultThemePaletteDefinitions().map((palette) => palette.id), ["plain", "neon", "terminal"]);
  assertEquals(registry.ids(), ["matrix", "plain"]);
  assertEquals(registry.inspect(), [
    { id: "matrix", label: "Matrix Reloaded", tokens: ["foreground", "danger"] },
    {
      id: "plain",
      label: "Plain",
      tokens: ["foreground", "muted", "accent", "success", "warning", "danger", "surface"],
    },
  ]);
  assertEquals(engine.component("Button").base("x"), "green:x");
  assertEquals(engine.component("Button").active("x"), "danger:x");
  assertEquals(direct.component("Badge").base("x"), "green:x");

  try {
    registry.tokens("missing");
    throw new Error("expected missing palette");
  } catch (error) {
    assertEquals(error instanceof ThemePaletteNotFoundError, true);
  }
});

Deno.test("theme manifests compile serializable packs into engines and registries", () => {
  const manifest = {
    id: "ops",
    label: "Operations",
    palette: "plain",
    options: {
      tokens: {
        foreground: { foreground: "white" },
        accent: { foreground: [31, 231, 210], bold: true },
        danger: { foreground: "red", underline: true },
      },
      components: {
        Field: {
          base: {
            base: "foreground",
            focused: ["accent", { underline: true }],
          },
        },
        Button: {
          extends: "Field",
          variants: {
            danger: {
              active: ["danger", { bold: true }],
            },
          },
        },
      },
    },
  } as const;

  const options = compileThemeManifestOptions(manifest.options);
  const engine = createThemeEngineFromManifest(manifest);
  const registry = createThemeRegistryFromManifests([manifest]);

  assertEquals(options.tokens?.accent?.("x"), "\x1b[1;38;2;31;231;210mx\x1b[0m");
  assertEquals(engine.component("Button").base("x"), "\x1b[37mx\x1b[0m");
  assertEquals(engine.component("Button").focused("x"), "\x1b[4m\x1b[1;38;2;31;231;210mx\x1b[0m\x1b[0m");
  assertEquals(
    engine.component("Button", "danger").active("x"),
    "\x1b[1m\x1b[4;31mx\x1b[0m\x1b[0m",
  );
  assertEquals(registry.ids(), ["ops"]);
  assertEquals(registry.engine("ops").variants("Button"), ["danger"]);
});

Deno.test("theme manifests reuse theme option validation", () => {
  const options = compileThemeManifestOptions({
    components: {
      Button: {
        extends: "Missing",
        base: { base: "brand" },
      },
    },
  });
  const issues = validateThemeOptions(options);

  assertEquals(issues.map((issue) => issue.kind), ["unknown-component", "unknown-token"]);
  assertEquals(issues[1].reference, "brand");
});

Deno.test("theme manifests expose inspection and preview data for authoring tools", () => {
  const manifest = {
    id: "ops",
    label: "Operations",
    palette: "plain",
    options: {
      tokens: {
        accent: { foreground: "cyan", bold: true },
        danger: { foreground: "red" },
      },
      components: {
        Field: {
          base: {
            base: "foreground",
            focused: "accent",
          },
        },
        Button: {
          extends: "Field",
          variants: {
            danger: {
              active: ["danger", { underline: true }],
            },
          },
        },
      },
    },
  } as const;

  const inspection = inspectThemeManifest(manifest);
  const preview = previewThemeManifest(manifest, {
    sample: "OK",
    tokens: ["accent"],
    components: ["Button"],
    states: ["base", "active"],
  });

  assertEquals(inspection, {
    id: "ops",
    label: "Operations",
    palette: "plain",
    tokens: ["accent", "danger"],
    components: [
      { name: "Button", extends: ["Field"], states: [], variants: [{ name: "danger", states: ["active"] }] },
      { name: "Field", extends: [], states: ["base", "focused"], variants: [] },
    ],
    issues: [],
  });
  assertEquals(preview.tokens, [{ token: "accent", preview: { raw: "OK", styled: "\x1b[1;36mOK\x1b[0m" } }]);
  assertEquals(
    preview.components.map((entry) => [entry.component, entry.variant, entry.state, entry.preview.styled]),
    [
      ["Button", "default", "base", "OK"],
      ["Button", "default", "active", "OK"],
      ["Button", "danger", "base", "OK"],
      ["Button", "danger", "active", "\x1b[4m\x1b[31mOK\x1b[0m\x1b[0m"],
    ],
  );
});

Deno.test("ThemeEngine resolves component variants over global tokens", () => {
  const engine = new ThemeEngine({
    tokens: { foreground: (value) => `fg:${value}` },
    components: {
      Button: {
        variants: {
          danger: { base: (value) => `danger:${value}` },
        },
      },
    },
  });

  assertEquals(engine.resolve("Button", "base")("x"), "fg:x");
  assertEquals(engine.resolve("Button", "base", "danger")("x"), "danger:x");
});

Deno.test("ThemeEngine resolves component token references through active tokens", () => {
  const engine = new ThemeEngine({
    tokens: {
      foreground: (value) => `fg:${value}`,
      accent: (value) => `accent:${value}`,
      danger: (value) => `danger:${value}`,
    },
    components: {
      Button: {
        base: { base: "foreground", focused: "accent" },
        variants: {
          danger: { base: "danger" },
        },
      },
    },
  });

  assertEquals(engine.component("Button").base("x"), "fg:x");
  assertEquals(engine.component("Button").focused("x"), "accent:x");
  assertEquals(engine.component("Button", "danger").base("x"), "danger:x");
});

Deno.test("composeStyles builds reusable style pipelines", () => {
  const wrap = (value: string) => `[${value}]`;
  const shout = (value: string) => value.toUpperCase();

  assertEquals(composeStyles(emptyStyle)("x"), "x");
  assertEquals(composeStyles(wrap, emptyStyle, shout)("x"), "[X]");
});

Deno.test("ThemeEngine resolves layered state styles", () => {
  const engine = new ThemeEngine({
    tokens: {
      accent: (value) => `accent:${value}`,
      danger: (value) => `danger:${value}`,
    },
    components: {
      Button: {
        variants: {
          danger: {
            active: ["danger", (value) => `<${value}>`, "accent"],
          },
        },
      },
    },
  });

  assertEquals(engine.component("Button", "danger").active("x"), "accent:<danger:x>");
});

Deno.test("createThemeEngine merges preset palettes with overrides", () => {
  const engine = createThemeEngine("terminal", {
    tokens: {
      accent: (value) => `custom:${value}`,
    },
  });

  assertEquals(themePalettes.terminal.success?.("x"), "\x1b[32mx\x1b[0m");
  assertEquals(engine.theme.tokens.accent("x"), "custom:x");
});

Deno.test("custom palettes flow through theme packs providers and factories", () => {
  const palette = {
    id: "contrast",
    label: "Contrast",
    tokens: {
      foreground: (value: string) => `contrast:${value}`,
      accent: (value: string) => `accent:${value}`,
    },
  };
  const registry = createThemeRegistry([
    {
      id: "contrast-pack",
      label: "Contrast Pack",
      palette,
      options: {
        components: {
          Button: { base: { base: "foreground", focused: "accent" } },
        },
      },
    },
  ]);
  const provider = createThemeProvider({ registry, activeId: "contrast-pack" });
  const factory = createThemeEngineFactory({
    id: "contrast-factory",
    palette,
    options: {
      components: {
        Badge: { base: { base: "foreground" } },
      },
    },
  });

  assertEquals(registry.inspect()[0].palette, "contrast");
  assertEquals(provider.engine.peek().component("Button").focused("x"), "accent:x");
  assertEquals(provider.catalog().themes[0].palette, "contrast");
  assertEquals(factory.inspect().palette, "contrast");
  assertEquals(factory.build().component("Badge").base("x"), "contrast:x");
});

Deno.test("theme definitions compose component bases and variants", () => {
  const danger = (value: string) => `danger:${value}`;
  const active = (value: string) => `active:${value}`;
  const merged = mergeComponentThemeDefinition(
    { base: { base: emptyStyle }, variants: { danger: { base: danger } } },
    { base: { active }, variants: { danger: { active } } },
  );

  assertEquals(merged.base?.base, emptyStyle);
  assertEquals(merged.base?.active, active);
  assertEquals(merged.variants?.danger.base, danger);
  assertEquals(merged.variants?.danger.active, active);
});

Deno.test("theme definitions compose component inheritance", () => {
  const merged = mergeComponentThemeDefinition(
    { extends: "Input" },
    { extends: ["Focusable", "Input"] },
  );

  assertEquals(merged.extends, ["Input", "Focusable"]);
});

Deno.test("composeThemeOptions preserves component variants while overriding tokens", () => {
  const accentA = (value: string) => `a:${value}`;
  const accentB = (value: string) => `b:${value}`;
  const composed = composeThemeOptions(
    {
      tokens: { accent: accentA },
      components: { Button: { variants: { danger: { base: accentA } } } },
    },
    {
      tokens: { accent: accentB },
      components: { Button: { variants: { quiet: { base: emptyStyle } } } },
    },
  );

  assertEquals(composed.tokens?.accent, accentB);
  assertEquals(Object.keys(composed.components?.Button.variants ?? {}).sort(), ["danger", "quiet"]);
});

Deno.test("inspectThemeCoverage reports authored state coverage after inheritance", () => {
  const coverage = inspectThemeCoverage({
    components: {
      Field: {
        base: { base: emptyStyle, focused: emptyStyle },
      },
      Button: {
        extends: "Field",
        variants: {
          danger: { active: emptyStyle, disabled: emptyStyle },
        },
      },
    },
  }, {
    components: ["Button", "Field", "Missing"],
  });

  assertEquals(coverage, {
    componentCount: 3,
    variantCount: 4,
    stateCount: 16,
    coveredStateCount: 8,
    missingStateCount: 8,
    complete: false,
    components: [
      {
        name: "Button",
        extends: ["Field"],
        variants: [
          { name: "default", states: ["base", "focused"], missingStates: ["active", "disabled"], complete: false },
          { name: "danger", states: ["base", "focused", "active", "disabled"], missingStates: [], complete: true },
        ],
        stateCount: 8,
        coveredStateCount: 6,
        missingStateCount: 2,
        complete: false,
      },
      {
        name: "Field",
        extends: [],
        variants: [
          { name: "default", states: ["base", "focused"], missingStates: ["active", "disabled"], complete: false },
        ],
        stateCount: 4,
        coveredStateCount: 2,
        missingStateCount: 2,
        complete: false,
      },
      {
        name: "Missing",
        extends: [],
        variants: [
          {
            name: "default",
            states: [],
            missingStates: ["base", "focused", "active", "disabled"],
            complete: false,
          },
        ],
        stateCount: 4,
        coveredStateCount: 0,
        missingStateCount: 4,
        complete: false,
      },
    ],
  });
});

Deno.test("ThemeEngine supports component inheritance and aliases", () => {
  const input = (value: string) => `input:${value}`;
  const focus = (value: string) => `focus:${value}`;
  const danger = (value: string) => `danger:${value}`;
  const engine = new ThemeEngine({
    components: {
      Input: {
        base: { base: input, focused: focus },
        variants: { invalid: { base: danger } },
      },
      ComboBox: {
        extends: "Input",
        variants: { compact: { active: focus } },
      },
      SearchBox: {
        extends: ["ComboBox"],
        base: { disabled: danger },
      },
    },
  });

  assertEquals(engine.component("ComboBox").base("x"), "input:x");
  assertEquals(engine.component("ComboBox", "invalid").base("x"), "danger:x");
  assertEquals(engine.component("SearchBox").disabled("x"), "danger:x");
  assertEquals(engine.variants("SearchBox"), ["compact", "invalid"]);
});

Deno.test("ThemeEngine rejects component inheritance cycles", () => {
  const engine = new ThemeEngine({
    components: {
      A: { extends: "B" },
      B: { extends: "A" },
    },
  });

  try {
    engine.component("A");
    throw new Error("expected cycle");
  } catch (error) {
    assertEquals(error instanceof ThemeInheritanceError, true);
  }
});

Deno.test("ThemeEngine can be extended and inspected without mutating the source", () => {
  const engine = new ThemeEngine({
    components: { Button: { variants: { danger: { base: emptyStyle } } } },
  });
  const extended = engine.extend({
    components: {
      Modal: { variants: { palette: { focused: emptyStyle } } },
      Button: { variants: { quiet: { disabled: emptyStyle } } },
    },
  });

  assertEquals(engine.componentNames(), ["Button"]);
  assertEquals(engine.variants("Button"), ["danger"]);
  assertEquals(extended.componentNames(), ["Button", "Modal"]);
  assertEquals(extended.variants("Button"), ["danger", "quiet"]);
  assertEquals(extended.inspect().components, [
    { name: "Button", variants: ["danger", "quiet"] },
    { name: "Modal", variants: ["palette"] },
  ]);
});

Deno.test("ThemeEngineFactory builds inspectable reusable engine presets", () => {
  const factory = createThemeEngineFactory({
    id: "ops",
    label: "Operations",
    description: "Operational dashboard theme.",
    palette: "terminal",
    tags: ["ops", "dark", "ops"],
    priority: 5,
    options: {
      tokens: {
        foreground: (value) => `fg:${value}`,
        accent: (value) => `accent:${value}`,
      },
      components: {
        Button: {
          base: { base: "foreground", focused: "accent" },
          variants: { danger: { active: "danger" } },
        },
      },
    },
  });
  const engine = factory.build({
    components: {
      Button: {
        variants: { quiet: { base: "muted" } },
      },
    },
  });

  assertEquals(engine.component("Button").base("x"), "fg:x");
  assertEquals(engine.component("Button").focused("x"), "accent:x");
  assertEquals(engine.variants("Button"), ["danger", "quiet"]);
  assertEquals(factory.inspect(), {
    id: "ops",
    label: "Operations",
    description: "Operational dashboard theme.",
    palette: "terminal",
    tags: ["dark", "ops"],
    priority: 5,
    tokenOverrides: ["foreground", "accent"],
    components: ["Button"],
    variants: { Button: ["danger"] },
    issues: [],
    valid: true,
  });
});

Deno.test("ThemeEngineFactoryRegistry orders replaces and prewarms factories", async () => {
  const registry = createThemeEngineFactoryRegistry([
    {
      id: "low",
      palette: "plain",
      priority: 1,
      options: { components: { Button: { base: { base: (value) => `low:${value}` } } } },
    },
    {
      id: "high",
      palette: "plain",
      priority: 10,
      options: {
        components: {
          Button: {
            base: { base: (value) => `high:${value}` },
            variants: { danger: { active: "danger" } },
          },
        },
      },
    },
  ]);

  registry.register({
    id: "low",
    palette: "terminal",
    priority: 20,
    options: { components: { Field: { base: { focused: "accent" } } } },
  });

  assertEquals(registry.ids(), ["low", "high"]);
  assertEquals(registry.inspect().map((factory) => [factory.id, factory.palette, factory.priority]), [
    ["low", "terminal", 20],
    ["high", "plain", 10],
  ]);
  assertEquals(registry.build("high").component("Button").base("x"), "high:x");

  const warmed = await registry.prewarm({
    ids: ["high"],
    overrides: (_id, factory) => ({
      components: {
        Button: {
          variants: { preview: { active: factory.id === "high" ? "success" : "warning" } },
        },
      },
    }),
  });

  assertEquals(warmed.map((entry) => entry.id), ["high"]);
  assertEquals(warmed[0].engine.variants("Button"), ["danger", "preview"]);
  assertEquals(warmed[0].inspection.components, ["Button"]);

  try {
    registry.build("missing");
    throw new Error("expected missing factory");
  } catch (error) {
    assertEquals(error instanceof ThemeEngineFactoryNotFoundError, true);
  }
});

Deno.test("theme engine factory catalogs filter inspect and format reports", () => {
  const factories: ThemeEngineFactoryDefinition[] = [
    {
      id: "ops",
      label: "Ops Neon",
      description: "Operational dashboard theme.",
      palette: "neon",
      tags: ["dashboard", "dark"],
      priority: 20,
      options: {
        tokens: { accent: (value: string) => `accent:${value}` },
        components: {
          Button: {
            base: { focused: "accent" },
            variants: { danger: { active: "danger" } },
          },
        },
      },
    },
    {
      id: "console",
      label: "Field Console",
      palette: "terminal",
      tags: ["remote"],
      priority: 10,
      options: { components: { Input: { base: { focused: "foreground" } } } },
    },
    {
      id: "broken",
      label: "Broken",
      palette: "plain",
      tags: ["draft"],
      options: { components: { Badge: { base: { base: "missing-token" as "accent" } } } },
    },
  ];
  const registry = createThemeEngineFactoryRegistry(factories);

  assertEquals(queryThemeEngineFactories(factories, { search: "dashboard danger" }).map((factory) => factory.id), [
    "ops",
  ]);
  assertEquals(queryThemeEngineFactories(factories, { tag: "remote" }).map((factory) => factory.id), ["console"]);
  assertEquals(queryThemeEngineFactories(factories, { palette: "plain", valid: false }).map((factory) => factory.id), [
    "broken",
  ]);
  assertEquals(
    queryThemeEngineFactories(factories, { hasTokenOverrides: true }).map((factory) => factory.id),
    ["ops"],
  );

  const report = createThemeEngineFactoryCatalogReport({ factories });
  assertEquals(report.inspection, {
    count: 3,
    valid: 2,
    invalid: 1,
    palettes: ["neon", "plain", "terminal"],
    tags: ["dark", "dashboard", "draft", "remote"],
    components: ["Badge", "Button", "Input"],
    tokenOverrides: ["accent"],
  });
  assertEquals(registry.catalog({ hasComponents: true }).inspection.count, 3);
  assertEquals(registry.catalog({ valid: false }).factories.map((factory) => factory.id), ["broken"]);
  assertEquals(
    formatThemeEngineFactoryCatalogMarkdown({ factories, query: { valid: true }, title: "Themes" }),
    [
      "# Themes",
      "",
      "2 factories, 2 valid, 0 invalid.",
      "",
      "| Factory | Palette | Priority | Tags | Components | Valid |",
      "| --- | --- | ---: | --- | ---: | --- |",
      "| Ops Neon | neon | 20 | dark, dashboard | 1 | yes |",
      "| Field Console | terminal | 10 | remote | 1 | yes |",
    ].join("\n"),
  );
});

Deno.test("prewarmThemeEngines accepts a scheduler and preserves input order", async () => {
  const scheduler = new AsyncScheduler({ concurrency: 1 });
  const first = createThemeEngineFactory({
    id: "first",
    options: { components: { Button: { base: { base: (value) => `first:${value}` } } } },
  });
  const second = createThemeEngineFactory({
    id: "second",
    options: { components: { Button: { base: { base: (value) => `second:${value}` } } } },
  });

  const warmed = prewarmThemeEngines([first, second], {
    scheduler,
    overrides: (id) => {
      return {
        components: {
          Button: {
            variants: { preview: { active: id === "first" ? "success" : "warning" } },
          },
        },
      };
    },
  });

  const results = await warmed;

  assertEquals(results.map((result) => result.id), ["first", "second"]);
  assertEquals(results[0].engine.component("Button").base("x"), "first:x");
  assertEquals(results[1].engine.component("Button").base("x"), "second:x");
  assertEquals(results[0].engine.variants("Button"), ["preview"]);
  assertEquals(scheduler.inspect(), { concurrency: 1, running: 0, pending: 0, idle: true });
});

Deno.test("ThemeEnginePipeline applies ordered theme transforms and exposes inspection", () => {
  const pipeline = createThemeEnginePipeline({
    id: "runtime",
    label: "Runtime",
    description: "Runtime theme modifiers.",
    steps: [
      {
        id: "contrast",
        label: "Contrast",
        options: {
          tokens: {
            accent: (value) => `contrast:${value}`,
          },
          components: {
            Button: {
              base: { focused: "accent" },
              variants: { danger: { active: "danger" } },
            },
          },
        },
      },
      {
        id: "brand",
        enabled: false,
        transform: (engine) =>
          engine.extend({
            components: {
              Button: {
                variants: { brand: { active: (value) => `brand:${value}` } },
              },
            },
          }),
      },
      {
        id: "density",
        transform: (_engine, context) => ({
          components: {
            Badge: { base: { base: (value) => `${context.stepId}:${value}` } },
          },
        }),
      },
    ],
  });

  const base = createThemeEngine("plain", {
    tokens: { danger: (value) => `danger:${value}` },
    components: { Button: { base: { base: (value) => `base:${value}` } } },
  });
  const themed = pipeline.apply(base);

  assertEquals(themed.component("Button").base("x"), "base:x");
  assertEquals(themed.component("Button").focused("x"), "contrast:x");
  assertEquals(themed.component("Button", "danger").active("x"), "danger:x");
  assertEquals(themed.component("Badge").base("x"), "density:x");
  assertEquals(themed.variants("Button"), ["danger"]);
  assertEquals(pipeline.activeIds(), ["contrast", "density"]);
  assertEquals(pipeline.inspect(), {
    id: "runtime",
    label: "Runtime",
    description: "Runtime theme modifiers.",
    stepCount: 3,
    activeStepCount: 2,
    steps: [
      {
        id: "contrast",
        label: "Contrast",
        description: undefined,
        enabled: true,
        hasTransform: false,
        tokenOverrides: ["accent"],
        components: ["Button"],
        variants: { Button: ["danger"] },
      },
      {
        id: "brand",
        label: "brand",
        description: undefined,
        enabled: false,
        hasTransform: true,
        tokenOverrides: [],
        components: [],
        variants: {},
      },
      {
        id: "density",
        label: "density",
        description: undefined,
        enabled: true,
        hasTransform: true,
        tokenOverrides: [],
        components: [],
        variants: {},
      },
    ],
  });

  assertEquals(pipeline.enable("brand"), true);
  assertEquals(pipeline.toggle("density"), true);
  const branded = pipeline.apply(base);
  assertEquals(branded.variants("Button"), ["brand", "danger"]);
  assertEquals(branded.component("Button", "brand").active("x"), "brand:x");
  assertEquals(branded.componentNames(), ["Button"]);

  const changes: string[][] = [];
  const unsubscribe = pipeline.subscribe(() => changes.push(pipeline.activeIds()));
  pipeline.setActiveIds(["density", "missing"]);
  assertEquals(pipeline.activeIds(), ["density"]);
  assertEquals(changes, [["density"]]);
  pipeline.setActiveIds(["density"]);
  assertEquals(changes, [["density"]]);
  assertEquals(pipeline.unregister("density"), true);
  assertEquals(changes, [["density"], []]);
  unsubscribe();
});

Deno.test("prewarmThemeEnginePipelines builds selected pipelines through a scheduler", async () => {
  const scheduler = new AsyncScheduler({ concurrency: 1 });
  const first = createThemeEnginePipeline({
    id: "first",
    steps: [
      { id: "accent", options: { components: { Button: { base: { base: (value) => `first:${value}` } } } } },
    ],
  });
  const second = createThemeEnginePipeline({
    id: "second",
    steps: [
      { id: "accent", options: { components: { Button: { base: { base: (value) => `second:${value}` } } } } },
    ],
  });

  const warmed = await prewarmThemeEnginePipelines([first, second], {
    scheduler,
    ids: ["second"],
    base: () => new ThemeEngine(),
  });

  assertEquals(warmed.map((result) => result.id), ["second"]);
  assertEquals(warmed[0].engine.component("Button").base("x"), "second:x");
  assertEquals(warmed[0].inspection.activeStepCount, 1);
  assertEquals(scheduler.inspect(), { concurrency: 1, running: 0, pending: 0, idle: true });
});

Deno.test("ThemeWorkspace composes provider factories pipelines and inspection", () => {
  const provider = createThemeProvider({
    registry: createThemeRegistry([
      {
        id: "base",
        palette: "plain",
        options: { components: { Button: { base: { base: (value) => `base:${value}` } } } },
      },
    ]),
    activeId: "base",
  });
  const pipeline = createThemeEnginePipeline({
    id: "runtime",
    steps: [
      {
        id: "accent",
        options: { components: { Button: { base: { focused: (value) => `focus:${value}` } } } },
      },
    ],
  });
  const workspace = createThemeWorkspace({
    provider,
    factories: [
      {
        id: "factory",
        palette: "plain",
        options: { components: { Button: { variants: { danger: { active: (value) => `danger:${value}` } } } } },
      },
    ],
    pipelines: pipeline,
  });

  assertEquals(workspace.pipelineIds(), ["runtime"]);
  assertEquals(workspace.activeEngine().component("Button").base("x"), "base:x");
  assertEquals(workspace.activeEngine().component("Button").focused("x"), "focus:x");
  assertEquals(workspace.factoryEngine("factory").component("Button", "danger").active("x"), "danger:x");
  assertEquals(workspace.factoryEngine("factory", { pipelines: false }).component("Button").focused("x"), "x");
  assertEquals(workspace.inspect().factories.inspection.count, 1);
  assertEquals(workspace.inspect().pipelines[0].activeStepCount, 1);
});

Deno.test("ThemeWorkspace prewarms factories pipelines and active provider through one scheduler", async () => {
  const scheduler = new AsyncScheduler({ concurrency: 2 });
  const workspace = createThemeWorkspace({
    providerOptions: {
      registry: createThemeRegistry([
        {
          id: "base",
          palette: "plain",
          options: { components: { Badge: { base: { base: (value) => `base:${value}` } } } },
        },
      ]),
      activeId: "base",
    },
    factories: [
      {
        id: "first",
        priority: 10,
        options: { components: { Button: { base: { base: (value) => `first:${value}` } } } },
      },
      {
        id: "second",
        options: { components: { Button: { base: { base: (value) => `second:${value}` } } } },
      },
    ],
    pipelines: [
      createThemeEnginePipeline({
        id: "runtime",
        steps: [
          { id: "accent", options: { components: { Badge: { base: { focused: (value) => `focus:${value}` } } } } },
        ],
      }),
    ],
  });

  const warmed = await workspace.prewarm({
    scheduler,
    factories: ["first"],
    includeActiveProvider: true,
    factoryOverrides: {
      components: { Button: { variants: { preview: { active: "success" } } } },
    },
  });

  assertEquals(warmed.factories.map((result) => result.id), ["first"]);
  assertEquals(warmed.factories[0].engine.variants("Button"), ["preview"]);
  assertEquals(warmed.pipelines.map((result) => result.id), ["runtime"]);
  assertEquals(warmed.pipelines[0].engine.component("Badge").focused("x"), "focus:x");
  assertEquals(warmed.activeProvider?.component("Badge").base("x"), "base:x");
  assertEquals(warmed.scheduler, { concurrency: 2, running: 0, pending: 0, idle: true });
  assertEquals(scheduler.inspect(), warmed.scheduler);
});

Deno.test("ThemeEngineCache memoizes component themes and resolved styles", () => {
  const engine = new ThemeEngine({
    tokens: { foreground: (value) => `fg:${value}` },
    components: {
      Button: {
        base: { base: "foreground" },
        variants: { danger: { active: (value) => `danger:${value}` } },
      },
    },
  });
  const cache = createThemeEngineCache(engine);

  const button = cache.component("Button");
  const sameButton = cache.component("Button");
  const danger = cache.component("Button", "danger");
  const active = cache.resolve("Button", "active", "danger");
  const sameActive = cache.resolve("Button", "active", "danger");

  assertEquals(button, sameButton);
  assertEquals(danger.active, active);
  assertEquals(active, sameActive);
  assertEquals(active("x"), "danger:x");
  assertEquals(cache.inspect(), {
    themeEntries: 2,
    styleEntries: 1,
    hits: 3,
    misses: 3,
  });

  cache.clear();
  assertEquals(cache.inspect().themeEntries, 0);
  assertEquals(cache.inspect().styleEntries, 0);
});

Deno.test("ThemeProviderCache invalidates when active provider engine changes", async () => {
  const registry = createThemeRegistry([
    {
      id: "plain",
      palette: "plain",
      options: {
        tokens: { foreground: (value) => `plain:${value}` },
        components: { Button: { base: { base: "foreground" } } },
      },
    },
    {
      id: "bright",
      palette: "plain",
      options: {
        tokens: { foreground: (value) => `bright:${value}` },
        components: { Button: { base: { base: "foreground" } } },
      },
    },
  ]);
  const provider = createThemeProvider({ registry, activeId: "plain" });
  const cache = createThemeProviderCache(provider);

  await Promise.resolve();

  const plain = cache.component("Button");
  assertEquals(plain.base("x"), "plain:x");
  assertEquals(cache.component("Button"), plain);
  assertEquals(cache.inspect(), {
    activeId: "plain",
    themeEntries: 1,
    styleEntries: 0,
    hits: 1,
    misses: 1,
  });

  provider.setTheme("bright");
  await Promise.resolve();

  const bright = cache.component("Button");
  assertEquals(bright.base("x"), "bright:x");
  assertEquals(bright === plain, false);
  assertEquals(cache.inspect(), {
    activeId: "bright",
    themeEntries: 1,
    styleEntries: 0,
    hits: 0,
    misses: 1,
  });

  cache.dispose();
});

Deno.test("ThemeResolver batches token and component state lookups", () => {
  const engine = new ThemeEngine({
    tokens: {
      foreground: (value) => `fg:${value}`,
      accent: (value) => `accent:${value}`,
    },
    components: {
      Button: {
        base: { base: "foreground", focused: "accent" },
        variants: { danger: { active: (value) => `danger:${value}` } },
      },
    },
  });
  const resolver = createThemeEngineResolver(engine);
  const styles = componentThemeStyleRequests(["Button"], {
    states: ["base", "focused", "active"],
    variants: () => ["default", "danger"],
  });

  const snapshot = resolver.snapshot({
    sample: "x",
    tokens: ["foreground", "accent"],
    styles,
  });

  assertEquals(snapshot.tokens.map((token) => [token.token, token.preview]), [
    ["foreground", "fg:x"],
    ["accent", "accent:x"],
  ]);
  assertEquals(snapshot.styles.map((style) => [style.component, style.variant, style.state, style.preview]), [
    ["Button", "default", "base", "fg:x"],
    ["Button", "default", "focused", "accent:x"],
    ["Button", "default", "active", "accent:x"],
    ["Button", "danger", "base", "fg:x"],
    ["Button", "danger", "focused", "accent:x"],
    ["Button", "danger", "active", "danger:x"],
  ]);
  assertEquals(snapshot.cache, {
    themeEntries: 2,
    styleEntries: 6,
    hits: 4,
    misses: 8,
  });

  assertEquals(
    formatThemeResolutionMarkdown(resolver, {
      sample: "x",
      tokens: ["foreground"],
      styles: [{ component: "Button", variant: "danger", state: "active" }],
      title: "Resolved",
    }),
    [
      "# Resolved",
      "",
      "| Token | Preview |",
      "| --- | --- |",
      "| foreground | fg:x |",
      "",
      "| Component | Variant | State | Preview |",
      "| --- | --- | --- | --- |",
      "| Button | danger | active | danger:x |",
      "",
      "| Cache | Value |",
      "| --- | --- |",
      "| themes | 2 |",
      "| styles | 6 |",
      "| hits | 5 |",
      "| misses | 8 |",
    ].join("\n"),
  );
});

Deno.test("ThemeProviderResolver follows active theme changes", async () => {
  const registry = createThemeRegistry([
    {
      id: "plain",
      palette: "plain",
      options: {
        tokens: { foreground: (value) => `plain:${value}` },
        components: { Button: { base: { base: "foreground" } } },
      },
    },
    {
      id: "bright",
      palette: "plain",
      options: {
        tokens: { foreground: (value) => `bright:${value}` },
        components: { Button: { base: { base: "foreground" } } },
      },
    },
  ]);
  const provider = createThemeProvider({ registry, activeId: "plain" });
  const resolver = createThemeProviderResolver(provider);

  assertEquals(resolver.resolve("Button", "base")("x"), "plain:x");
  assertEquals(resolver.snapshot({ tokens: ["foreground"], sample: "x" }).tokens[0].preview, "plain:x");

  provider.setTheme("bright");
  await Promise.resolve();

  assertEquals(resolver.resolve("Button", "base")("x"), "bright:x");
  assertEquals(resolver.snapshot({ tokens: ["foreground"], sample: "x" }).tokens[0].preview, "bright:x");
  assertEquals(resolver.inspect(), {
    activeId: "bright",
    themeEntries: 1,
    styleEntries: 1,
    hits: 0,
    misses: 2,
  });

  resolver.dispose();
});

Deno.test("validateThemeOptions reports bad token references parents and cycles", () => {
  const issues = validateThemeOptions({
    components: {
      Field: {
        extends: "Missing",
        base: {
          base: "foreground",
          focused: "brandAccent" as "accent",
        },
        variants: {
          invalid: {
            active: ["danger", "missingTone" as "danger"],
          },
        },
      },
      A: { extends: "B" },
      B: { extends: "A" },
    },
  });

  assertEquals(issues.map((issue) => issue.kind), [
    "unknown-component",
    "unknown-token",
    "unknown-token",
    "inheritance-cycle",
  ]);
  assertEquals(issues[1].path, "components.Field.base.focused");
  assertEquals(issues[2].path, "components.Field.variants.invalid.active[1]");

  try {
    assertThemeOptions({ components: { Button: { base: { base: "missing" as "accent" } } } });
    throw new Error("expected invalid theme options");
  } catch (error) {
    assertEquals(error instanceof ThemeValidationError, true);
    assertEquals((error as ThemeValidationError).issues[0].reference, "missing");
  }
});

Deno.test("diffThemeEngines previews changed tokens and component states", () => {
  const base = new ThemeEngine({
    tokens: {
      foreground: (value) => `fg:${value}`,
      accent: (value) => `accent:${value}`,
    },
    components: {
      Button: { base: { base: "foreground" } },
    },
  });
  const next = base.extend({
    tokens: {
      foreground: (value) => `bright:${value}`,
    },
    components: {
      Button: {
        base: { focused: "foreground" },
        variants: { danger: { base: (value) => `danger:${value}` } },
      },
    },
  });

  const diff = diffThemeEngines(base, next, { sample: "x", components: ["Button"] });

  assertEquals(diff.tokens.map((entry) => [entry.token, entry.before.styled, entry.after.styled]), [
    ["foreground", "fg:x", "bright:x"],
  ]);
  assertEquals(
    diff.components.map((entry) => [
      entry.component,
      entry.variant,
      entry.state,
      entry.before.styled,
      entry.after.styled,
    ]),
    [
      ["Button", "default", "base", "fg:x", "bright:x"],
      ["Button", "default", "focused", "accent:x", "bright:x"],
      ["Button", "default", "active", "accent:x", "fg:x"],
      ["Button", "danger", "base", "fg:x", "danger:x"],
      ["Button", "danger", "focused", "accent:x", "bright:x"],
      ["Button", "danger", "active", "accent:x", "fg:x"],
    ],
  );
});

Deno.test("ThemeLayerStack composes active layers in registration order", async () => {
  const baseAccent = (value: string) => `base:${value}`;
  const denseAccent = (value: string) => `dense:${value}`;
  const focusStyle = (value: string) => `focus:${value}`;
  const layers = createThemeLayerStack([
    {
      id: "density",
      label: "Compact Density",
      options: {
        tokens: { accent: baseAccent },
        components: { Button: { base: { focused: "accent" } } },
      },
    },
    {
      id: "focus",
      enabled: false,
      options: {
        tokens: { accent: denseAccent },
        components: { Button: { variants: { keyboard: { active: focusStyle } } } },
      },
    },
  ]);

  await Promise.resolve();

  assertEquals(layers.ids(), ["density", "focus"]);
  assertEquals(layers.activeIds(), ["density"]);
  assertEquals(layers.options.value.tokens?.accent, baseAccent);
  assertEquals(layers.enable("focus"), true);
  await Promise.resolve();
  assertEquals(layers.options.value.tokens?.accent, denseAccent);
  assertEquals(Object.keys(layers.options.value.components?.Button.variants ?? {}), ["keyboard"]);
  assertEquals(layers.disable("missing"), false);
  assertEquals(layers.toggle("focus"), true);
  await Promise.resolve();
  assertEquals(layers.activeIds(), ["density"]);
  assertEquals(layers.inspect(), [
    {
      id: "density",
      label: "Compact Density",
      enabled: true,
      components: [{ name: "Button", variants: [] }],
    },
    {
      id: "focus",
      label: "focus",
      enabled: false,
      components: [{ name: "Button", variants: ["keyboard"] }],
    },
  ]);
  layers.dispose();
});

Deno.test("ThemeRegistry registers packs and composes overrides into engines", () => {
  const packAccent = (value: string) => `pack:${value}`;
  const overrideAccent = (value: string) => `override:${value}`;
  const registry = createThemeRegistry([
    {
      id: "ops",
      label: "Operations",
      palette: "terminal",
      options: {
        tokens: { accent: packAccent },
        components: { Button: { variants: { danger: { base: packAccent } } } },
      },
    },
  ]);

  const engine = registry.engine("ops", {
    tokens: { accent: overrideAccent },
    components: { Button: { variants: { quiet: { base: emptyStyle } } } },
  });

  assertEquals(registry.ids(), ["ops"]);
  assertEquals(engine.theme.focused("x"), "override:x");
  assertEquals(engine.variants("Button"), ["danger", "quiet"]);
  assertEquals(registry.inspect(), [
    {
      id: "ops",
      label: "Operations",
      palette: "terminal",
      components: [{ name: "Button", variants: ["danger"] }],
    },
  ]);
});

Deno.test("ThemeRegistry throws for unknown packs", () => {
  const registry = createThemeRegistry([]);

  try {
    registry.engine("missing");
    throw new Error("expected registry.engine to throw");
  } catch (error) {
    assertEquals(error instanceof ThemePackNotFoundError, true);
  }
});

Deno.test("ThemeProvider exposes active engine selection and component theme signals", async () => {
  const plain = (value: string) => `plain:${value}`;
  const bright = (value: string) => `bright:${value}`;
  const registry = createThemeRegistry([
    {
      id: "plain",
      palette: "plain",
      options: {
        tokens: { foreground: plain },
        components: { Button: { base: { base: "foreground" } } },
      },
    },
    {
      id: "bright",
      palette: "plain",
      options: {
        tokens: { foreground: bright },
        components: { Button: { base: { base: "foreground" } } },
      },
    },
  ]);
  const provider = createThemeProvider({ registry, activeId: "plain" });
  const buttonTheme = provider.component("Button");

  await Promise.resolve();

  assertEquals(defaultThemePacks.map((pack) => pack.id), ["plain", "neon", "terminal"]);
  assertEquals(buttonTheme.value.base("x"), "plain:x");
  assertEquals(provider.inspect().activeId, "plain");
  assertEquals(provider.setTheme("missing"), false);
  assertEquals(provider.setTheme("bright"), true);

  await Promise.resolve();

  assertEquals(buttonTheme.value.base("x"), "bright:x");
  assertEquals(provider.resolve("Button", "base").value("x"), "bright:x");
});

Deno.test("ThemeProvider catalogs themes layers tokens states and merged component variants", () => {
  const provider = createThemeProvider({
    registry: createThemeRegistry([
      {
        id: "plain",
        label: "Plain Pack",
        palette: "plain",
        options: {
          components: {
            Button: { variants: { danger: { base: "danger" } } },
          },
        },
      },
      {
        id: "ops",
        label: "Ops Pack",
        palette: "terminal",
        options: {
          components: {
            Field: { base: { focused: "accent" } },
          },
        },
      },
    ]),
    activeId: "plain",
    layers: [
      {
        id: "density",
        label: "Compact Density",
        options: {
          components: {
            Button: { variants: { quiet: { base: "muted" } } },
          },
        },
      },
      {
        id: "contrast",
        enabled: false,
        options: {
          components: {
            Modal: { base: { active: "warning" } },
          },
        },
      },
    ],
  });

  assertEquals(createThemeCatalog(provider), provider.catalog());
  assertEquals(provider.catalog().activeId, "plain");
  assertEquals(provider.catalog().tokens, [...themeTokenNames]);
  assertEquals(provider.catalog().states, [...themeStates]);
  assertEquals(provider.catalog().themes.map((theme) => [theme.id, theme.active]), [
    ["ops", false],
    ["plain", true],
  ]);
  assertEquals(provider.catalog().layers.map((layer) => [layer.id, layer.active]), [
    ["density", true],
    ["contrast", false],
  ]);
  assertEquals(provider.catalog().components, [
    { name: "Button", variants: ["default", "danger", "quiet"] },
    { name: "Field", variants: ["default"] },
    { name: "Modal", variants: ["default"] },
  ]);
});

Deno.test("previewThemeProvider renders the active engine and layers", () => {
  const foreground = (value: string) => `foreground:${value}`;
  const accent = (value: string) => `accent:${value}`;
  const danger = (value: string) => `danger:${value}`;
  const layerActive = (value: string) => `layer:${value}`;
  const provider = createThemeProvider({
    registry: createThemeRegistry([
      {
        id: "ops",
        label: "Ops",
        palette: "plain",
        options: {
          tokens: { foreground, accent, success: accent, danger },
          components: {
            Button: {
              base: { base: "foreground", focused: "accent" },
              variants: { danger: { base: "danger" } },
            },
          },
        },
      },
    ]),
    activeId: "ops",
    layers: createThemeLayerStack([
      {
        id: "alerts",
        label: "Alert Overrides",
        options: {
          components: {
            Button: { variants: { danger: { active: layerActive } } },
          },
        },
      },
    ]),
  });

  const preview = previewThemeProvider(provider, {
    sample: "OK",
    tokens: ["accent", "foreground"],
    components: ["Button"],
    states: ["base", "active"],
  });

  assertEquals(preview.activeId, "ops");
  assertEquals(preview.activeLayers, ["alerts"]);
  assertEquals(preview.tokens.map((entry) => [entry.token, entry.preview.styled]), [
    ["foreground", "foreground:OK"],
    ["accent", "accent:OK"],
  ]);
  assertEquals(
    preview.components.map((entry) => [entry.component, entry.variant, entry.state, entry.preview.styled]),
    [
      ["Button", "default", "base", "foreground:OK"],
      ["Button", "default", "active", "accent:OK"],
      ["Button", "danger", "base", "danger:OK"],
      ["Button", "danger", "active", "layer:OK"],
    ],
  );
  assertEquals(preview.catalog.layers.map((layer) => [layer.id, layer.active]), [["alerts", true]]);
});

Deno.test("theme provider reports combine catalog preview validation and coverage", () => {
  const provider = createThemeProvider({
    registry: createThemeRegistry([
      {
        id: "ops",
        label: "Ops",
        palette: "plain",
        options: {
          components: {
            Field: { base: { base: "foreground", focused: "accent" } },
            Button: {
              extends: "Field",
              variants: { danger: { active: "danger" } },
            },
          },
        },
      },
      {
        id: "broken",
        label: "Broken",
        palette: "plain",
        options: {
          components: { Badge: { base: { base: "missing-token" } } },
        } as unknown as ThemeEngineOptions,
      },
    ]),
    activeId: "ops",
    layers: [
      {
        id: "contrast",
        label: "Contrast",
        options: {
          components: {
            Button: { variants: { quiet: { base: "warning" } } },
          },
        },
      },
      {
        id: "broken-layer",
        enabled: false,
        options: {
          components: { Banner: { base: { active: "unknown-token" } } },
        } as unknown as ThemeEngineOptions,
      },
    ],
  });

  const report = createThemeProviderReport(provider, {
    title: "Theme Audit",
    preview: { sample: "OK", components: ["Button"], states: ["base"] },
    coverage: { components: ["Button"] },
  });
  const markdown = formatThemeProviderReportMarkdown(provider, {
    title: "Theme Audit",
    preview: false,
    coverage: { components: ["Button"] },
  });

  assertEquals(report.activeId, "ops");
  assertEquals(report.activeLayers, ["contrast"]);
  assertEquals(report.summary, {
    themeCount: 2,
    layerCount: 2,
    activeLayerCount: 1,
    componentCount: 4,
    variantCount: 6,
    issueCount: 2,
    missingStateCount: 5,
    completeCoverage: false,
  });
  assertEquals(report.issues.map((issue) => [issue.source, issue.sourceId, issue.kind, issue.reference]), [
    ["theme", "broken", "unknown-token", "missing-token"],
    ["layer", "broken-layer", "unknown-token", "unknown-token"],
  ]);
  assertEquals(report.preview?.components.map((entry) => [entry.component, entry.variant, entry.state]), [
    ["Button", "default", "base"],
    ["Button", "danger", "base"],
    ["Button", "quiet", "base"],
  ]);
  assertEquals(markdown.includes("# Theme Audit"), true);
  assertEquals(markdown.includes("2 themes, 2 layers, 4 components, 6 variants, 2 issues."), true);
  assertEquals(markdown.includes("| unknown-token | theme:broken | components.Badge.base.base |"), true);
  assertEquals(markdown.includes("| Button | quiet | no | active, disabled |"), true);
});

Deno.test("ThemeProvider engineFor and theme gallery preview inactive engines with layers", () => {
  const plain = (value: string) => `plain:${value}`;
  const ops = (value: string) => `ops:${value}`;
  const warning = (value: string) => `warning:${value}`;
  const brokenPack = {
    id: "broken",
    label: "Broken",
    palette: "plain",
    options: {
      components: { Badge: { base: { base: "missing-token" } } },
    },
  } as unknown as ThemePack;
  const provider = createThemeProvider({
    registry: createThemeRegistry([
      {
        id: "plain",
        label: "Plain",
        palette: "plain",
        options: {
          tokens: { foreground: plain },
          components: { Button: { base: { base: "foreground" } } },
        },
      },
      {
        id: "ops",
        label: "Operations",
        palette: "terminal",
        options: {
          tokens: { foreground: ops },
          components: { Button: { base: { base: "foreground" } } },
        },
      },
      brokenPack,
    ]),
    activeId: "plain",
    overrides: { tokens: { warning } },
    layers: [
      {
        id: "accessibility",
        label: "Accessibility",
        options: {
          components: { Button: { variants: { high: { base: "warning" } } } },
        },
      },
    ],
  });

  assertEquals(provider.engineFor("ops").component("Button", "high").base("OK"), "warning:OK");

  const gallery = createThemeGallery(provider, {
    query: "terminal",
    sample: "OK",
    tokens: ["warning", "foreground"],
    components: ["Button"],
    states: ["base"],
  });
  const opsItem = gallery.items.find((item) => item.id === "ops")!;
  const brokenItem = gallery.items.find((item) => item.id === "broken")!;

  assertEquals(gallery.activeId, "plain");
  assertEquals(gallery.count, 3);
  assertEquals(gallery.matches.map((match) => match.item.id), ["ops"]);
  assertEquals(opsItem.activeLayers, ["accessibility"]);
  assertEquals(opsItem.preview.tokens.map((entry) => [entry.token, entry.preview.styled]), [
    ["foreground", "ops:OK"],
    ["warning", "warning:OK"],
  ]);
  assertEquals(
    opsItem.preview.components.map((entry) => [entry.component, entry.variant, entry.state, entry.preview.styled]),
    [
      ["Button", "default", "base", "ops:OK"],
      ["Button", "high", "base", "warning:OK"],
    ],
  );
  assertEquals(brokenItem.valid, false);
  assertEquals(brokenItem.issues.map((issue) => issue.kind), ["unknown-token"]);
  assertEquals(filterThemeGalleryItems(gallery.items, "operations").map((item) => item.id), ["ops"]);
  assertEquals(rankThemeGalleryItems(gallery.items, "broken").map((match) => [match.item.id, match.item.valid]), [
    ["broken", false],
  ]);

  provider.layers.dispose();
});

Deno.test("grWizard theme packs populate a selectable theme gallery", () => {
  const provider = createThemeProvider({
    registry: createThemeRegistry(grWizardThemePacks),
    activeId: "grwizard-arcane",
  });
  const gallery = createThemeGallery(provider, {
    query: "brass",
    sample: "OK",
    tokens: ["accent", "warning"],
    components: ["Button", "StatusBar"],
    states: ["base", "focused"],
  });

  assertEquals(gallery.count, 6);
  assertEquals(gallery.matches.map((match) => match.item.id), ["grwizard-parchment", "grwizard-arcane"]);
  assertEquals(gallery.items.every((item) => item.valid), true);
  assertEquals(gallery.items.find((item) => item.id === "grwizard-arcane")?.description?.includes("cyan"), true);

  const selected = selectThemeGalleryItem(provider, "grwizard-forge", {
    sample: "OK",
    components: ["Button"],
    states: ["base"],
  });
  assertEquals(selected, {
    selected: true,
    id: "grwizard-forge",
    previousId: "grwizard-arcane",
    activeId: "grwizard-forge",
    item: selected.item,
  });
  assertEquals(selected.item?.active, true);
  assertEquals(provider.activeId.peek(), "grwizard-forge");

  const unknown = selectThemeGalleryItem(provider, "grwizard-missing");
  assertEquals(unknown, {
    selected: false,
    id: "grwizard-missing",
    previousId: "grwizard-forge",
    activeId: "grwizard-forge",
    reason: "unknown",
  });

  provider.layers.dispose();
});

Deno.test("ThemeProvider recomputes engines from active theme layers", async () => {
  const pack = (value: string) => `pack:${value}`;
  const layer = (value: string) => `layer:${value}`;
  const danger = (value: string) => `danger:${value}`;
  const layers = createThemeLayerStack([
    {
      id: "contrast",
      enabled: false,
      options: {
        tokens: { foreground: layer },
        components: { Button: { variants: { danger: { base: danger } } } },
      },
    },
  ]);
  const provider = createThemeProvider({
    registry: createThemeRegistry([
      {
        id: "plain",
        palette: "plain",
        options: {
          tokens: { foreground: pack },
          components: { Button: { base: { base: "foreground" } } },
        },
      },
    ]),
    activeId: "plain",
    layers,
  });
  const buttonTheme = provider.component("Button");

  await Promise.resolve();
  assertEquals(buttonTheme.value.base("x"), "pack:x");
  assertEquals(provider.inspect().layers[0].enabled, false);

  layers.enable("contrast");
  await Promise.resolve();

  assertEquals(buttonTheme.value.base("x"), "layer:x");
  assertEquals(provider.component("Button", "danger").value.base("x"), "danger:x");
  assertEquals(provider.inspect().layers[0].enabled, true);
  layers.dispose();
});

Deno.test("ThemeProvider cycles registered themes", () => {
  const provider = createThemeProvider({
    registry: createThemeRegistry([
      { id: "plain", palette: "plain" },
      { id: "neon", palette: "neon" },
      { id: "terminal", palette: "terminal" },
    ]),
    activeId: "plain",
  });

  assertEquals(provider.themeIds(), ["neon", "plain", "terminal"]);
  assertEquals(provider.nextTheme(), "terminal");
  assertEquals(provider.previousTheme(), "plain");
  assertEquals(provider.cycleTheme(-1), "neon");
  assertEquals(provider.setTheme("missing"), false);
});

Deno.test("ThemeProvider persists active theme selection", async () => {
  const store = new MemoryStore<string>();
  await store.set("app-theme", "terminal");
  const provider = createThemeProvider({
    registry: createThemeRegistry([
      { id: "plain", palette: "plain" },
      { id: "terminal", palette: "terminal" },
    ]),
    activeId: "plain",
    store,
    storageKey: "app-theme",
  });

  assertEquals(await provider.ready, "terminal");
  assertEquals(provider.inspect().activeId, "terminal");

  provider.setTheme("plain");
  await provider.flush();
  assertEquals(await store.get("app-theme"), "plain");

  assertEquals(await provider.resetTheme("terminal"), true);
  assertEquals(provider.inspect().activeId, "terminal");
  assertEquals(await store.get("app-theme"), undefined);
});

Deno.test("ThemeProvider preserves local changes made before persisted theme load finishes", async () => {
  let resolveGet!: (value: string) => void;
  const writes: Array<[string, string]> = [];
  const store = {
    get: () => new Promise<string>((resolve) => resolveGet = resolve),
    set: async (key: string, value: string) => {
      writes.push([key, value]);
    },
    delete: async () => {},
  };
  const provider = createThemeProvider({
    registry: createThemeRegistry([
      { id: "plain", palette: "plain" },
      { id: "terminal", palette: "terminal" },
    ]),
    activeId: "plain",
    store,
    storageKey: "theme",
  });

  provider.setTheme("terminal");
  resolveGet("plain");

  assertEquals(await provider.ready, "terminal");
  await provider.flush();
  assertEquals(provider.inspect().activeId, "terminal");
  assertEquals(writes, [["theme", "terminal"]]);
});

Deno.test("bindComponentTheme applies provider and variant updates to a component-like target", async () => {
  const plain = (value: string) => `plain:${value}`;
  const danger = (value: string) => `danger:${value}`;
  const bright = (value: string) => `bright:${value}`;
  const variant = new Signal("default");
  const applied: string[] = [];
  const registry = createThemeRegistry([
    {
      id: "plain",
      palette: "plain",
      options: {
        tokens: { foreground: plain },
        components: { Button: { variants: { danger: { base: danger } } } },
      },
    },
    { id: "bright", palette: "plain", options: { tokens: { foreground: bright } } },
  ]);
  const provider = createThemeProvider({ registry, activeId: "plain" });
  const dispose = bindComponentTheme(
    {
      setTheme(theme: Theme) {
        applied.push(theme.base("x"));
      },
    },
    provider,
    "Button",
    { variant },
  );

  await Promise.resolve();
  assertEquals(applied, ["plain:x"]);

  variant.value = "danger";
  await Promise.resolve();
  assertEquals(applied, ["plain:x", "danger:x"]);

  provider.setTheme("bright");
  await Promise.resolve();
  assertEquals(applied, ["plain:x", "danger:x", "bright:x"]);

  dispose();
  provider.setTheme("plain");
  variant.value = "default";
  await Promise.resolve();
  assertEquals(applied, ["plain:x", "danger:x", "bright:x"]);
});

Deno.test("ComponentThemeBindingGroup batches themed targets with inspection and replacement", async () => {
  const plain = (value: string) => `plain:${value}`;
  const danger = (value: string) => `danger:${value}`;
  const bright = (value: string) => `bright:${value}`;
  const variant = new Signal("default");
  const applied: Record<string, string[]> = { primary: [], replacement: [], badge: [] };
  const registry = createThemeRegistry([
    {
      id: "plain",
      palette: "plain",
      options: {
        tokens: { foreground: plain, accent: bright },
        components: {
          Button: { variants: { danger: { base: danger } } },
          Badge: { base: { base: "accent" } },
        },
      },
    },
    { id: "bright", palette: "plain", options: { tokens: { foreground: bright } } },
  ]);
  const provider = createThemeProvider({ registry, activeId: "plain" });
  const group = bindComponentThemes(provider, [
    {
      id: "primary",
      componentName: "Button",
      variant,
      target: { setTheme: (theme: Theme) => applied.primary.push(theme.base("x")) },
    },
    {
      id: "badge",
      componentName: "Badge",
      target: { setTheme: (theme: Theme) => applied.badge.push(theme.base("x")) },
    },
  ]);

  await Promise.resolve();
  assertEquals(applied, {
    primary: ["plain:x"],
    replacement: [],
    badge: ["bright:x"],
  });
  assertEquals(group.inspect(), {
    count: 2,
    components: ["Badge", "Button"],
    variants: ["default"],
    bindings: [
      { id: "primary", componentName: "Button", variant: "default" },
      { id: "badge", componentName: "Badge", variant: "default" },
    ],
  });

  variant.value = "danger";
  await Promise.resolve();
  assertEquals(group.inspect().variants, ["danger", "default"]);
  assertEquals(applied.primary, ["plain:x", "danger:x"]);

  group.register({
    id: "primary",
    componentName: "Button",
    target: { setTheme: (theme: Theme) => applied.replacement.push(theme.base("x")) },
  });
  await Promise.resolve();
  assertEquals(applied.replacement, ["plain:x"]);

  provider.setTheme("bright");
  await Promise.resolve();
  assertEquals(applied.primary, ["plain:x", "danger:x"]);
  assertEquals(applied.replacement, ["plain:x", "bright:x"]);
  assertEquals(applied.badge, ["bright:x", "bright:x"]);

  assertEquals(group.unregister("badge"), true);
  provider.setTheme("plain");
  await Promise.resolve();
  assertEquals(applied.badge, ["bright:x", "bright:x"]);

  group.dispose();
  provider.setTheme("bright");
  await Promise.resolve();
  assertEquals(group.inspect().count, 0);
  assertEquals(applied.replacement, ["plain:x", "bright:x", "plain:x"]);
});

Deno.test("ComponentThemeBindingGroup disposes on abort and rejects late registration", async () => {
  const controller = new AbortController();
  const applied: string[] = [];
  const provider = createThemeProvider({
    registry: createThemeRegistry([
      { id: "plain", palette: "plain" },
      { id: "terminal", palette: "terminal" },
    ]),
    activeId: "plain",
  });
  const group = new ComponentThemeBindingGroup(provider, [{
    id: "button",
    componentName: "Button",
    target: { setTheme: (theme: Theme) => applied.push(theme.base("x")) },
  }], controller.signal);

  await Promise.resolve();
  assertEquals(group.inspect().count, 1);
  const entryController = new AbortController();
  group.register({
    id: "label",
    componentName: "Label",
    abortSignal: entryController.signal,
    target: { setTheme: () => undefined },
  });
  assertEquals(group.inspect().count, 2);
  entryController.abort();
  assertEquals(group.inspect().count, 1);

  controller.abort();
  provider.setTheme("terminal");
  await Promise.resolve();
  assertEquals(group.inspect().count, 0);
  assertEquals(applied.length, 1);

  try {
    group.register({
      componentName: "Button",
      target: { setTheme: () => undefined },
    });
    throw new Error("expected group.register to throw");
  } catch (error) {
    assertEquals(error instanceof Error && error.message, "ComponentThemeBindingGroup is disposed");
  }
});

function commandDisabled(command: { disabled?: boolean | (() => boolean) }): boolean | undefined {
  return typeof command.disabled === "function" ? command.disabled() : command.disabled;
}
