import { assertEquals } from "./deps.ts";
import { renderBarChart } from "../src/components/chart.ts";
import { renderGauge } from "../src/components/gauge.ts";
import { visibleLogLines } from "../src/components/log_viewer.ts";
import {
  MetricSeriesController,
  metricSeriesStats,
  normalizeMetricValue,
  pushMetricValue,
} from "../src/components/metric_series.ts";
import { renderSparkline } from "../src/components/sparkline.ts";
import {
  composeStyles,
  composeThemeOptions,
  createTheme,
  createThemeEngine,
  createThemeProvider,
  createThemeRegistry,
  defaultThemePacks,
  emptyStyle,
  mergeComponentThemeDefinition,
  type Theme,
  ThemeEngine,
  ThemeInheritanceError,
  ThemePackNotFoundError,
  themePalettes,
} from "../src/theme.ts";
import { bindComponentTheme } from "../src/theme_binding.ts";
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
  assertEquals(snapshots, [[0, 1, 0.5], [1, 0.5, 1], [0.5, 1], [0, 0]]);
  series.dispose();
});

Deno.test("createTheme fills semantic token defaults", () => {
  const theme = createTheme({ accent: emptyStyle });
  assertEquals(theme.focused, emptyStyle);
  assertEquals(theme.tokens.warning, emptyStyle);
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
