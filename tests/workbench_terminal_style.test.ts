// Copyright 2023 Im-Beast. MIT license.
import { assertEquals } from "./deps.ts";
import {
  terminalAnsiColor,
  terminalCellStyle,
  terminalOutputLineStyle,
  terminalStatusToneColor,
  type WorkbenchTerminalTheme,
} from "../src/app/workbench_terminal_style.ts";

const theme: WorkbenchTerminalTheme = {
  accent: "#66d9ef",
  background: "#090909",
  borderStrong: "#ae81ff",
  danger: "#f92672",
  good: "#a6e22e",
  panelSoft: "#202020",
  surface: "#111111",
  text: "#f8f8f2",
  warn: "#e6db74",
};

Deno.test("terminalAnsiColor maps foreground and background ANSI codes to theme colors", () => {
  assertEquals(terminalAnsiColor(30, theme, false), theme.background);
  assertEquals(terminalAnsiColor(31, theme, false), theme.danger);
  assertEquals(terminalAnsiColor(32, theme, false), theme.good);
  assertEquals(terminalAnsiColor(33, theme, false), theme.warn);
  assertEquals(terminalAnsiColor(34, theme, false), theme.accent);
  assertEquals(terminalAnsiColor(35, theme, false), theme.borderStrong);
  assertEquals(terminalAnsiColor(36, theme, false), theme.accent);
  assertEquals(terminalAnsiColor(37, theme, false), theme.text);
  assertEquals(terminalAnsiColor(44, theme, true), theme.accent);
  assertEquals(terminalAnsiColor(undefined, theme, false), undefined);
  assertEquals(terminalAnsiColor(99, theme, false), undefined);
});

Deno.test("terminalCellStyle uses defaults, ANSI colors, bold, and cursor override", () => {
  assertEquals(terminalCellStyle({}, theme, false), {
    fg: theme.text,
    bg: theme.surface,
    bold: undefined,
  });
  assertEquals(terminalCellStyle({ foreground: 31, background: 42, bold: true }, theme, false), {
    fg: theme.danger,
    bg: theme.good,
    bold: true,
  });
  assertEquals(terminalCellStyle({ foreground: 31, background: 42 }, theme, true), {
    fg: theme.background,
    bg: theme.accent,
    bold: true,
  });
});

Deno.test("terminalOutputLineStyle maps process streams to readable theme styles", () => {
  assertEquals(terminalOutputLineStyle("stdout", theme), { fg: theme.text, bg: theme.surface });
  assertEquals(terminalOutputLineStyle("stderr", theme), {
    fg: theme.danger,
    bg: theme.surface,
    bold: true,
  });
  assertEquals(terminalOutputLineStyle("system", theme), {
    fg: theme.warn,
    bg: theme.panelSoft,
    bold: true,
  });
});

Deno.test("terminalStatusToneColor maps runtime terminal states to theme colors", () => {
  assertEquals(terminalStatusToneColor("running", theme), theme.good);
  assertEquals(terminalStatusToneColor("failed", theme), theme.danger);
  assertEquals(terminalStatusToneColor("cancelled", theme), theme.warn);
  assertEquals(terminalStatusToneColor("starting", theme), theme.accent);
  assertEquals(terminalStatusToneColor("idle", theme), theme.borderStrong);
});
