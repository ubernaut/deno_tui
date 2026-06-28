import { assertEquals } from "./deps.ts";
import { renderBarChart } from "../src/components/chart.ts";
import { renderGauge } from "../src/components/gauge.ts";
import { visibleLogLines } from "../src/components/log_viewer.ts";
import { renderSparkline } from "../src/components/sparkline.ts";
import { createTheme, createThemeEngine, emptyStyle, ThemeEngine, themePalettes } from "../src/theme.ts";

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
