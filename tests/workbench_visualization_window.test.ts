// Copyright 2023 Im-Beast. MIT license.
import { assertEquals, assertStringIncludes } from "./deps.ts";
import { createDefaultWorkbenchAsciiOptions } from "../src/app/workbench_ascii.ts";
import {
  compactSpaces,
  maxTrimmedTextWidth,
  threeRendererModeLabel,
  visualizationTextContentSize,
  visualizationThreeStatusLine,
  visualizationWindowRows,
  visualizationWindowRowsInto,
  workbenchThreeFallbackRowsInto,
  type WorkbenchVisualizationWindowOption,
} from "../app/workbench_visualization_window.ts";
import type { PanelRender } from "../app/types.ts";

const option: WorkbenchVisualizationWindowOption = {
  label: "CPU Hex Grid",
  description: "core utilization topology",
  group: "Monitor",
};

const render: PanelRender = {
  title: "Hex Grid",
  body: "core 0  12%\ncore 1  95%      ",
  footer: "selected cpu-1",
  alert: "",
  accent: "signal",
  severity: "info",
};

const rowTheme = {
  buttonActiveText: "#ffffff",
  buttonActiveBg: "#7a2cff",
  accent: "#9cff3a",
  good: "#1ee7d2",
  warn: "#ffb02e",
  soft: "#c7b8ff",
  surface: "#101018",
};

Deno.test("visualizationWindowRows assembles title description body and footer", () => {
  assertEquals(visualizationWindowRows(option, render), [
    " MONITOR · Hex Grid ",
    "core utilization topology",
    "core 0  12%",
    "core 1  95%      ",
    "selected cpu-1",
  ]);
  assertEquals(visualizationWindowRows(option, { ...render, alert: "thermal warning" })[1], "! thermal warning");
});

Deno.test("visualizationWindowRowsInto reuses caller storage", () => {
  const target = ["stale", "rows"];
  const rows = visualizationWindowRowsInto(target, option, render);

  assertEquals(rows, target);
  assertEquals(rows, [
    " MONITOR · Hex Grid ",
    "core utilization topology",
    "core 0  12%",
    "core 1  95%      ",
    "selected cpu-1",
  ]);
});

Deno.test("visualizationTextContentSize expands to rendered text dimensions", () => {
  assertEquals(visualizationTextContentSize(option, render, 8, 3), {
    width: "selected cpu-1".length,
    height: 5,
  });
  assertEquals(visualizationTextContentSize(option, render, 40, 8), {
    width: 40,
    height: 8,
  });
});

Deno.test("visualizationThreeStatusLine uses renderer mode labels and compact spacing", () => {
  const ascii = createDefaultWorkbenchAsciiOptions();
  const status = visualizationThreeStatusLine(
    {
      ...render,
      three: {
        mode: "lattice",
        signal: { x: 0, y: 0, depth: 0, twist: 0, lift: 0, pulse: 0, active: true, pressed: false },
      },
    },
    option,
    ascii,
  );
  assertStringIncludes(status, "ACEROLA LATTICE");
  assertStringIncludes(status, threeRendererModeLabel(ascii).toUpperCase());
  assertStringIncludes(status, option.label);
});

Deno.test("workbenchThreeFallbackRowsInto projects styled fallback rows", () => {
  const target = [{ text: "stale" }];
  const rows = workbenchThreeFallbackRowsInto(target, {
    width: 48,
    height: 10,
    terminalGlyphStyle: "blocks",
    rendererAvailable: false,
    theme: rowTheme,
    center: (text) => text,
  });

  assertEquals(rows, target);
  assertEquals(rows[0], {
    text: " THREE ASCII FALLBACK · BLOCKS ",
    fg: rowTheme.buttonActiveText,
    bg: rowTheme.buttonActiveBg,
    bold: true,
  });
  assertEquals(rows[1], {
    text: "WebGPU/WebGL backend unavailable; text preview active",
    fg: rowTheme.warn,
    bg: rowTheme.surface,
    bold: true,
  });
  assertStringIncludes(rows.map((row) => row.text).join("\n"), "TORUS");
  assertEquals(rows.at(-1), {
    text: "scene: torus knot + sphere + box + floor",
    fg: rowTheme.soft,
    bg: rowTheme.surface,
  });
});

Deno.test("workbenchThreeFallbackRowsInto reports warming state without alarm bold", () => {
  const rows = workbenchThreeFallbackRowsInto([], {
    width: 24,
    height: 3,
    terminalGlyphStyle: "mixed",
    rendererAvailable: true,
    theme: rowTheme,
  });

  assertEquals(rows[0]?.text, " THREE ASCII FALLBACK · MIXED ");
  assertEquals(rows[1], { text: "renderer warming up", fg: rowTheme.warn, bg: rowTheme.surface, bold: false });
  assertEquals(rows.length, 4);
});

Deno.test("compactSpaces and maxTrimmedTextWidth keep display helpers deterministic", () => {
  assertEquals(compactSpaces("  a   b\n c  "), "a b c");
  assertEquals(maxTrimmedTextWidth(["abc   ", "abcdef", "x"]), 6);
});
