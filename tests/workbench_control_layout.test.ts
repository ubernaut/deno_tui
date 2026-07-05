// Copyright 2023 Im-Beast. MIT license.
import { assertEquals } from "./deps.ts";
import {
  projectWorkbenchButton,
  projectWorkbenchButtonCommand,
  workbenchButtonPaintOptions,
  type WorkbenchButtonTheme,
} from "../src/app/workbench_button_style.ts";
import {
  layoutWorkbenchButtonRow,
  layoutWorkbenchButtonRowInto,
  layoutWorkbenchControlButtonLine,
  layoutWrappedControlOptions,
  type WorkbenchButtonRowPlacement,
  workbenchButtonRowRenderCommandsInto,
  type WorkbenchMobileCommandAction,
  workbenchMobileCommandStripItemsInto,
  wrappedControlOptionRowCount,
} from "../src/app/workbench_control_layout.ts";

const buttonTheme: WorkbenchButtonTheme = {
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
  assertEquals(workbenchButtonPaintOptions(buttonTheme, contrast), {
    fg: "contrast:#2255ff",
    bg: buttonTheme.buttonBg,
    bold: true,
  });
  assertEquals(workbenchButtonPaintOptions(buttonTheme, contrast, "active"), {
    fg: "contrast:#00ffaa",
    bg: buttonTheme.buttonActiveBg,
    bold: true,
  });
  assertEquals(workbenchButtonPaintOptions(buttonTheme, contrast, "disabled"), {
    fg: buttonTheme.buttonMutedText,
    bg: buttonTheme.buttonMutedBg,
    bold: false,
  });
});

Deno.test("workbenchButtonPaintOptions lets semantic tones override active color", () => {
  assertEquals(workbenchButtonPaintOptions(buttonTheme, contrast, "active", "danger"), {
    fg: "contrast:#ff2255",
    bg: buttonTheme.danger,
    bold: true,
  });
  assertEquals(workbenchButtonPaintOptions(buttonTheme, contrast, "base", "warning"), {
    fg: "contrast:#ffcc33",
    bg: buttonTheme.warn,
    bold: true,
  });
  assertEquals(workbenchButtonPaintOptions(buttonTheme, contrast, "base", "success"), {
    fg: "contrast:#44dd66",
    bg: buttonTheme.good,
    bold: true,
  });
  assertEquals(workbenchButtonPaintOptions(buttonTheme, contrast, "base", "muted"), {
    fg: "contrast:#444444",
    bg: buttonTheme.border,
    bold: true,
  });
});

Deno.test("projectWorkbenchButton clips text and resolves shared paint options", () => {
  assertEquals(projectWorkbenchButton(" Launch ", buttonTheme, contrast, { maxWidth: 5 }), {
    text: "[ La…",
    width: 5,
    style: {
      fg: "contrast:#2255ff",
      bg: buttonTheme.buttonBg,
      bold: true,
    },
  });
  assertEquals(projectWorkbenchButton("x", buttonTheme, contrast, { compact: true, tone: "danger" }), {
    text: "[x]",
    width: 3,
    style: {
      fg: "contrast:#ff2255",
      bg: buttonTheme.danger,
      bold: true,
    },
  });
});

Deno.test("projectWorkbenchButtonCommand preserves pre-clipped text and resolves paint", () => {
  assertEquals(projectWorkbenchButtonCommand({ text: "[Save]", state: "active" }, buttonTheme, contrast), {
    text: "[Save]",
    width: 6,
    style: {
      fg: "contrast:#00ffaa",
      bg: buttonTheme.buttonActiveBg,
      bold: true,
    },
  });
  assertEquals(
    projectWorkbenchButtonCommand({ text: "[Delete]", state: "disabled", tone: "danger" }, buttonTheme, contrast),
    {
      text: "[Delete]",
      width: 8,
      style: {
        fg: buttonTheme.buttonMutedText,
        bg: buttonTheme.buttonMutedBg,
        bold: false,
      },
    },
  );
});

Deno.test("layoutWorkbenchControlButtonLine keeps button background scoped to the button token", () => {
  assertEquals(layoutWorkbenchControlButtonLine("> ", "[ Run ] presses=2", 24), [
    { kind: "prefix", text: "> ", columnOffset: 0, width: 2 },
    { kind: "button", text: "[ Run ]", columnOffset: 2, width: 7 },
    { kind: "detail", text: " presses=2", columnOffset: 9, width: 10 },
  ]);
});

Deno.test("layoutWorkbenchControlButtonLine clips by segment without padding the button across the row", () => {
  assertEquals(layoutWorkbenchControlButtonLine("> ", "[ Long Button ] trailing detail", 12), [
    { kind: "prefix", text: "> ", columnOffset: 0, width: 2 },
    { kind: "button", text: "[ Long Bu…", columnOffset: 2, width: 10 },
  ]);
});

Deno.test("layoutWrappedControlOptions keeps option tokens and hit offsets stable", () => {
  const rows = layoutWrappedControlOptions(["Unit-01", "Signal", "Arcane"], 1, 80);
  assertEquals(rows.map((row) => row.text), [" Unit-01  [Signal]  Arcane  "]);
  assertEquals(rows[0]?.tokens, [
    { index: 0, text: " Unit-01  ", columnOffset: 0, width: 10 },
    { index: 1, text: "[Signal] ", columnOffset: 10, width: 9 },
    { index: 2, text: " Arcane  ", columnOffset: 19, width: 9 },
  ]);
});

Deno.test("layoutWrappedControlOptions wraps tokens without splitting individual options", () => {
  const rows = layoutWrappedControlOptions(["alpha", "beta", "gamma", "delta"], undefined, 16);
  assertEquals(rows.map((row) => row.text), [
    " alpha   beta  ",
    " gamma   delta  ",
  ]);
  assertEquals(rows[1]?.tokens.map((token) => token.columnOffset), [0, 8]);
  assertEquals(wrappedControlOptionRowCount(["alpha", "beta", "gamma", "delta"], undefined, 16), 2);
});

Deno.test("wrappedControlOptionRowCount matches projected row count without requiring row allocation", () => {
  const items = ["Unit-01", "Signal", "Arcane Tide", "Forge Ember", "Verdant Grove"];
  for (const width of [4, 8, 14, 24, 80]) {
    for (const selected of [undefined, 0, 2, 4]) {
      assertEquals(
        wrappedControlOptionRowCount(items, selected, width),
        layoutWrappedControlOptions(items, selected, width).length,
      );
    }
  }
});

Deno.test("layoutWrappedControlOptions returns one empty row for empty option lists", () => {
  assertEquals(layoutWrappedControlOptions([], undefined, 4), [{ text: "", tokens: [] }]);
  assertEquals(wrappedControlOptionRowCount([], undefined, 4), 1);
});

Deno.test("layoutWorkbenchButtonRow wraps buttons and reports paint state", () => {
  const result = layoutWorkbenchButtonRow(
    [
      { label: "Run", action: "run", tone: "success" },
      { label: "Stop", action: "stop", disabled: true, tone: "danger" },
      { label: "Raw", action: "raw", active: true },
    ],
    { column: 2, row: 4, width: 16, height: 3 },
    4,
  );

  assertEquals(result, {
    placements: [
      {
        item: { label: "Run", action: "run", tone: "success" },
        rect: { column: 2, row: 4, width: 7, height: 1 },
        state: "base",
        tone: "success",
      },
      {
        item: { label: "Stop", action: "stop", disabled: true, tone: "danger" },
        rect: { column: 10, row: 4, width: 8, height: 1 },
        state: "disabled",
        tone: "danger",
      },
      {
        item: { label: "Raw", action: "raw", active: true },
        rect: { column: 2, row: 5, width: 7, height: 1 },
        state: "active",
        tone: undefined,
      },
    ],
    nextRow: 6,
  });
});

Deno.test("layoutWorkbenchButtonRow clips overwide buttons and stops at bottom", () => {
  const result = layoutWorkbenchButtonRow(
    [
      { label: "Very Wide Button", action: "wide" },
      { label: "Hidden", action: "hidden" },
    ],
    { column: 0, row: 0, width: 8, height: 1 },
    0,
  );

  assertEquals(result, {
    placements: [
      {
        item: { label: "Very Wide Button", action: "wide" },
        rect: { column: 0, row: 0, width: 8, height: 1 },
        state: "base",
        tone: undefined,
      },
    ],
    nextRow: 1,
  });
});

Deno.test("layoutWorkbenchButtonRowInto reuses caller-owned placement storage", () => {
  const placements: WorkbenchButtonRowPlacement<string>[] = [{
    item: { label: "stale", action: "stale" },
    rect: { column: 99, row: 99, width: 1, height: 1 },
    state: "base",
    tone: undefined,
  }];
  const nextRow = layoutWorkbenchButtonRowInto(
    placements,
    [{ label: "OK", action: "ok", active: true }],
    { column: 3, row: 2, width: 12, height: 2 },
    2,
  );

  assertEquals(nextRow, 3);
  assertEquals(placements, [{
    item: { label: "OK", action: "ok", active: true },
    rect: { column: 3, row: 2, width: 6, height: 1 },
    state: "active",
    tone: undefined,
  }]);
});

Deno.test("workbenchButtonRowRenderCommandsInto clips labels and reports exact hit rectangles", () => {
  const placements = layoutWorkbenchButtonRow(
    [
      { label: "Very Wide Button", action: "wide", tone: "warning" },
      { label: "OK", action: "ok", disabled: true },
    ],
    { column: 5, row: 1, width: 18, height: 2 },
    1,
  ).placements;

  const commands = workbenchButtonRowRenderCommandsInto([], placements);

  assertEquals(
    commands.map((command) => ({
      action: command.item.action,
      text: command.text,
      rect: command.rect,
      hitRect: command.hitRect,
      state: command.state,
      tone: command.tone,
    })),
    [
      {
        action: "wide",
        text: "[ Very Wide Butto…",
        rect: { column: 5, row: 1, width: 18, height: 1 },
        hitRect: { column: 5, row: 1, width: 18, height: 1 },
        state: "base",
        tone: "warning",
      },
      {
        action: "ok",
        text: "[ OK ]",
        rect: { column: 5, row: 2, width: 6, height: 1 },
        hitRect: { column: 5, row: 2, width: 6, height: 1 },
        state: "disabled",
        tone: undefined,
      },
    ],
  );
});

Deno.test("workbenchButtonRowRenderCommandsInto reuses caller-owned command objects", () => {
  const placements = layoutWorkbenchButtonRow(
    [{ label: "First", action: "first" }],
    { column: 0, row: 0, width: 16, height: 1 },
    0,
  ).placements;
  const commands = workbenchButtonRowRenderCommandsInto([], placements);
  const first = commands[0];

  const nextPlacements = layoutWorkbenchButtonRow(
    [{ label: "Second", action: "second", active: true }],
    { column: 2, row: 3, width: 20, height: 1 },
    3,
  ).placements;
  workbenchButtonRowRenderCommandsInto(commands, nextPlacements);

  assertEquals(commands[0] === first, true);
  assertEquals(commands[0]?.text, "[ Second ]");
  assertEquals(commands[0]?.rect, { column: 2, row: 3, width: 10, height: 1 });
  assertEquals(commands[0]?.state, "active");
});

Deno.test("workbench mobile command strip projects stable touch actions", () => {
  const target = workbenchMobileCommandStripItemsInto([], {
    activeTitle: "Data",
    controlsActive: true,
    themeActive: false,
  });

  assertEquals(target.map((item) => item.action), ["next", "controls", "theme", "help", "restore", "wide", "dense"]);
  assertEquals(target.map((item) => item.label), [
    "Next Data",
    "Controls",
    "Theme",
    "Help",
    "Restore",
    "Wide",
    "Dense",
  ]);
  assertEquals(target[1]!.active, true);
  assertEquals(target[2]!.active, false);
  assertEquals(target.slice(4).map((item) => item.tone), ["muted", "muted", "muted"]);
});

Deno.test("workbench mobile command strip uses shared wrapped button layout", () => {
  const items = workbenchMobileCommandStripItemsInto([], {
    activeTitle: "Inspector",
    themeActive: true,
  });
  const placements: WorkbenchButtonRowPlacement<WorkbenchMobileCommandAction>[] = [];
  const nextRow = layoutWorkbenchButtonRowInto(
    placements,
    items,
    { column: 1, row: 1, width: 28, height: 2 },
    1,
  );

  assertEquals(nextRow, 3);
  assertEquals(placements.map((placement) => [placement.item.action, placement.rect.row, placement.state]), [
    ["next", 1, "base"],
    ["controls", 2, "base"],
    ["theme", 2, "active"],
  ]);
});
