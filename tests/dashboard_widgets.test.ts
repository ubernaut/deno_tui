import { assertEquals } from "./deps.ts";
import { renderBarChart } from "../src/components/chart.ts";
import { renderGauge } from "../src/components/gauge.ts";
import { visibleLogLines } from "../src/components/log_viewer.ts";
import { renderSparkline } from "../src/components/sparkline.ts";
import {
  composeThemeOptions,
  createTheme,
  createThemeEngine,
  createThemeProvider,
  createThemeRegistry,
  defaultThemePacks,
  emptyStyle,
  mergeComponentThemeDefinition,
  ThemeEngine,
  ThemePackNotFoundError,
  themePalettes,
} from "../src/theme.ts";

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
    { id: "plain", palette: "plain", options: { tokens: { foreground: plain } } },
    { id: "bright", palette: "plain", options: { tokens: { foreground: bright } } },
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
