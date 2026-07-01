// Copyright 2023 Im-Beast. MIT license.
import { assertEquals } from "./deps.ts";
import { workbenchButtonPaintOptions, type WorkbenchButtonTheme } from "../src/app/workbench_button_style.ts";

const theme: WorkbenchButtonTheme = {
  background: "#000000",
  border: "#444444",
  buttonActiveBg: "#00ffaa",
  buttonBg: "#2255ff",
  buttonMutedBg: "#202020",
  buttonMutedText: "#777777",
  danger: "#ff2255",
  good: "#44dd66",
  text: "#eeeeee",
  warn: "#ffcc33",
};

const contrast = (color: string) => `contrast:${color}`;

Deno.test("workbenchButtonPaintOptions resolves base active and disabled states", () => {
  assertEquals(workbenchButtonPaintOptions(theme, contrast), {
    fg: "contrast:#2255ff",
    bg: theme.buttonBg,
    bold: true,
  });
  assertEquals(workbenchButtonPaintOptions(theme, contrast, "active"), {
    fg: "contrast:#00ffaa",
    bg: theme.buttonActiveBg,
    bold: true,
  });
  assertEquals(workbenchButtonPaintOptions(theme, contrast, "disabled"), {
    fg: theme.buttonMutedText,
    bg: theme.buttonMutedBg,
    bold: false,
  });
});

Deno.test("workbenchButtonPaintOptions lets semantic tones override active color", () => {
  assertEquals(workbenchButtonPaintOptions(theme, contrast, "active", "danger"), {
    fg: "contrast:#ff2255",
    bg: theme.danger,
    bold: true,
  });
  assertEquals(workbenchButtonPaintOptions(theme, contrast, "base", "warning"), {
    fg: "contrast:#ffcc33",
    bg: theme.warn,
    bold: true,
  });
  assertEquals(workbenchButtonPaintOptions(theme, contrast, "base", "success"), {
    fg: "contrast:#44dd66",
    bg: theme.good,
    bold: true,
  });
  assertEquals(workbenchButtonPaintOptions(theme, contrast, "base", "muted"), {
    fg: "contrast:#444444",
    bg: theme.border,
    bold: true,
  });
});
