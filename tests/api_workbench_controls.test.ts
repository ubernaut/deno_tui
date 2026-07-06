import { assertEquals } from "./deps.ts";
import {
  apiWorkbenchButtonRowInto,
  apiWorkbenchCheckboxRowsInto,
  apiWorkbenchComboHeaderRowsInto,
  apiWorkbenchControlAt,
  apiWorkbenchControlAtEdge,
  apiWorkbenchControlBaseStyle,
  apiWorkbenchControlButtonDetailStyle,
  type ApiWorkbenchControlHitPlacement,
  apiWorkbenchControlIds,
  apiWorkbenchControlLineInto,
  type ApiWorkbenchControlLineRenderCommand,
  apiWorkbenchControlLineRenderCommandsInto,
  type ApiWorkbenchControlLineSegment,
  apiWorkbenchControlsRowsInto,
  apiWorkbenchControlsSnapshotRowsInto,
  apiWorkbenchControlTrack,
  apiWorkbenchDropdownHeaderRowInto,
  apiWorkbenchDropdownPopoverRect,
  apiWorkbenchInputRowInto,
  apiWorkbenchProgressRowInto,
  apiWorkbenchRadioRowsInto,
  apiWorkbenchSliderRowInto,
  apiWorkbenchSliderSetHitInto,
  apiWorkbenchStepperHitPlacementsInto,
  apiWorkbenchStepperRowInto,
  apiWorkbenchTextboxCommandStyle,
  apiWorkbenchTextboxProjection,
  apiWorkbenchTextboxProjectionInto,
  type ApiWorkbenchTextboxRenderCommand,
  apiWorkbenchTextboxRenderCommandsInto,
  type ApiWorkbenchWrappedOptionsRenderCommand,
  apiWorkbenchWrappedOptionsRenderCommandsInto,
  apiWorkbenchWrappedOptionStyle,
  expandedApiWorkbenchTouchHitRect,
  findApiWorkbenchHitTarget,
  isApiWorkbenchTextControlActive,
  isApiWorkbenchTouchOptimizedLayout,
  nextApiWorkbenchControlId,
  nextSortableDataColumn,
  resolveApiWorkbenchControlKey,
  resolveApiWorkbenchHitWindowId,
  resolveApiWorkbenchTitlebarHitAction,
  resolveApiWorkbenchWindowHScrollbarOffset,
  resolveApiWorkbenchWindowVScrollbarOffset,
  resolveApiWorkbenchWorkspaceScrollbarOffset,
} from "../app/api_workbench_controls.ts";
import type { Rectangle } from "../src/types.ts";

const controlTheme = {
  background: "#000000",
  text: "#eeeeee",
  surface: "#111111",
  warn: "#ffaa00",
};

const workbenchWindowIds = {
  terminalShell: "terminal-shell",
  controls: "controls",
  data: "data",
  explorer: "explorer",
} as const;

Deno.test("api workbench control ids preserve keyboard traversal order", () => {
  assertEquals(apiWorkbenchControlIds[0], "button");
  assertEquals(apiWorkbenchControlIds.at(-1), "textbox");
  assertEquals(nextApiWorkbenchControlId("button", 1), "genericButton");
  assertEquals(nextApiWorkbenchControlId("textbox", -1), "stepper");
});

Deno.test("api workbench control traversal supports wrap and edge-aware tabbing", () => {
  assertEquals(nextApiWorkbenchControlId("textbox", 1), undefined);
  assertEquals(nextApiWorkbenchControlId("button", -1), undefined);
  assertEquals(nextApiWorkbenchControlId("textbox", 1, { wrap: true }), "button");
  assertEquals(nextApiWorkbenchControlId("button", -1, { wrap: true }), "textbox");
  assertEquals(nextApiWorkbenchControlId("radio", 3), "input");
  assertEquals(apiWorkbenchControlAt("textbox", 1), "button");
  assertEquals(apiWorkbenchControlAt("button", -1), "textbox");
  assertEquals(apiWorkbenchControlAtEdge("textbox", 1), undefined);
  assertEquals(apiWorkbenchControlAtEdge("button", 1), "genericButton");
  assertEquals(isApiWorkbenchTextControlActive("controls", "controls", "input"), true);
  assertEquals(isApiWorkbenchTextControlActive("controls", "controls", "textbox"), true);
  assertEquals(isApiWorkbenchTextControlActive("data", "controls", "input"), false);
  assertEquals(isApiWorkbenchTextControlActive("controls", "controls", "slider"), false);
});

Deno.test("api workbench control key resolver shares text dropdown radio and action policy", () => {
  assertEquals(resolveApiWorkbenchControlKey("input", { key: "left" }), { type: "textInput" });
  assertEquals(resolveApiWorkbenchControlKey("textbox", { key: "return" }), { type: "textInput" });
  assertEquals(resolveApiWorkbenchControlKey("dropdown", { key: "down" }, { dropdownExpanded: true }), {
    type: "dropdown",
    action: "move",
    delta: 1,
  });
  assertEquals(resolveApiWorkbenchControlKey("dropdown", { key: "home" }, { dropdownExpanded: true }), {
    type: "dropdown",
    action: "first",
  });
  assertEquals(resolveApiWorkbenchControlKey("dropdown", { key: "escape" }, { dropdownExpanded: true }), {
    type: "dropdown",
    action: "close",
  });
  assertEquals(resolveApiWorkbenchControlKey("radio", { key: "up" }), { type: "radio", delta: -1 });
  assertEquals(resolveApiWorkbenchControlKey("slider", { key: "down" }), { type: "focus", delta: 1 });
  assertEquals(resolveApiWorkbenchControlKey("slider", { key: "right" }), { type: "control", action: "next" });
  assertEquals(resolveApiWorkbenchControlKey("button", { key: "return" }), { type: "control", action: "activate" });
  assertEquals(resolveApiWorkbenchControlKey("button", { key: "tab" }), { type: "none" });
});

Deno.test("api workbench hit resolution returns explicit window ids for chrome hits", () => {
  for (
    const type of [
      "focus",
      "minimize",
      "maximize",
      "restore",
      "close",
      "windowVScrollbar",
      "windowHScrollbar",
      "threeViewport",
    ] as const
  ) {
    assertEquals(resolveApiWorkbenchHitWindowId({ type, id: "three" }, workbenchWindowIds), "three");
  }
});

Deno.test("api workbench hit resolution maps titlebar button kinds", () => {
  assertEquals(resolveApiWorkbenchTitlebarHitAction("three", "config"), { type: "threeConfig", id: "three" });
  assertEquals(resolveApiWorkbenchTitlebarHitAction("data", "minimize"), { type: "minimize", id: "data" });
  assertEquals(resolveApiWorkbenchTitlebarHitAction("data", "maximize"), { type: "maximize", id: "data" });
  assertEquals(resolveApiWorkbenchTitlebarHitAction("data", "restore"), { type: "restore", id: "data" });
  assertEquals(resolveApiWorkbenchTitlebarHitAction("data", "close"), { type: "close", id: "data" });
});

Deno.test("api workbench hit resolution maps content hits to owning built-in windows", () => {
  assertEquals(resolveApiWorkbenchHitWindowId({ type: "terminalShellContent" }, workbenchWindowIds), "terminal-shell");
  assertEquals(resolveApiWorkbenchHitWindowId({ type: "control" }, workbenchWindowIds), "controls");
  assertEquals(resolveApiWorkbenchHitWindowId({ type: "dataRow" }, workbenchWindowIds), "data");
  assertEquals(resolveApiWorkbenchHitWindowId({ type: "explorerRow" }, workbenchWindowIds), "explorer");
});

Deno.test("api workbench hit resolution ignores actions without an owning window", () => {
  assertEquals(resolveApiWorkbenchHitWindowId({ type: "theme" }, workbenchWindowIds), undefined);
  assertEquals(resolveApiWorkbenchHitWindowId({ type: "workspace" }, workbenchWindowIds), undefined);
  assertEquals(resolveApiWorkbenchHitWindowId({ type: "modalAction" }, workbenchWindowIds), undefined);
});

Deno.test("api workbench scrollbar hit offsets preserve the non-scrolled axis", () => {
  assertEquals(
    resolveApiWorkbenchWindowVScrollbarOffset({
      contentHeight: 40,
      viewportHeight: 10,
      currentColumns: 7,
      pointerRow: 9,
    }),
    { columns: 7, rows: 30 },
  );
  assertEquals(
    resolveApiWorkbenchWindowHScrollbarOffset({
      contentWidth: 80,
      viewportWidth: 20,
      currentRows: 6,
      pointerColumn: 10,
    }),
    { columns: 32, rows: 6 },
  );
});

Deno.test("api workbench workspace scrollbar hit offset scrolls rows only", () => {
  assertEquals(
    resolveApiWorkbenchWorkspaceScrollbarOffset({
      contentHeight: 100,
      viewportHeight: 20,
      pointerRow: 10,
    }),
    { columns: 0, rows: 42 },
  );
  assertEquals(
    resolveApiWorkbenchWorkspaceScrollbarOffset({
      contentHeight: 100,
      viewportHeight: 20,
      pointerRow: -4,
    }),
    { columns: 0, rows: 0 },
  );
});

Deno.test("api workbench touch layout expands on coarse or compact screens", () => {
  assertEquals(isApiWorkbenchTouchOptimizedLayout({ columns: 120, rows: 40 }), false);
  assertEquals(isApiWorkbenchTouchOptimizedLayout({ coarsePointer: true, columns: 120, rows: 40 }), true);
  assertEquals(isApiWorkbenchTouchOptimizedLayout({ columns: 91, rows: 40 }), true);
  assertEquals(isApiWorkbenchTouchOptimizedLayout({ columns: 120, rows: 29 }), true);
});

Deno.test("api workbench expanded touch hit rect grows small targets and clips to bounds", () => {
  assertEquals(
    expandedApiWorkbenchTouchHitRect({
      rect: { column: 10, row: 5, width: 2, height: 1 },
      bounds: { column: 0, row: 0, width: 40, height: 20 },
    }),
    { column: 8, row: 4, width: 6, height: 3 },
  );
  assertEquals(
    expandedApiWorkbenchTouchHitRect({
      rect: { column: 0, row: 0, width: 2, height: 1 },
      bounds: { column: 0, row: 0, width: 5, height: 2 },
    }),
    { column: 0, row: 0, width: 4, height: 2 },
  );
});

Deno.test("api workbench shared hit lookup expands targets only for touch layouts", () => {
  const targets = hitStack([
    { rect: { column: 10, row: 5, width: 2, height: 1 }, action: "small" },
    { rect: { column: 20, row: 5, width: 4, height: 1 }, action: "direct" },
  ]);
  const bounds = { column: 0, row: 0, width: 40, height: 20 };

  assertEquals(findApiWorkbenchHitTarget({ targets, x: 21, y: 5, bounds })?.action, "direct");
  assertEquals(findApiWorkbenchHitTarget({ targets, x: 8, y: 4, bounds })?.action, undefined);
  assertEquals(findApiWorkbenchHitTarget({ targets, x: 8, y: 4, bounds, touchOptimized: true })?.action, "small");
});

Deno.test("api workbench sortable column traversal skips disabled columns", () => {
  const columns = [
    { id: "name", label: "Name" },
    { id: "status", label: "Status", sortable: false },
    { id: "cpu", label: "CPU" },
    { id: "memory", label: "Memory" },
  ] as const;

  assertEquals(nextSortableDataColumn(columns, "name", 1)?.id, "cpu");
  assertEquals(nextSortableDataColumn(columns, "cpu", -1)?.id, "name");
  assertEquals(nextSortableDataColumn(columns, "memory", 1)?.id, "name");
  assertEquals(nextSortableDataColumn(columns, "status", 1)?.id, "cpu");
});

Deno.test("api workbench sortable column traversal handles empty sortable sets", () => {
  assertEquals(
    nextSortableDataColumn(
      [
        { id: "name", sortable: false },
        { id: "status", sortable: false },
      ],
      "name",
      1,
    ),
    undefined,
  );
});

Deno.test("api workbench control styles preserve shared active and detail colors", () => {
  assertEquals(apiWorkbenchControlBaseStyle(controlTheme, false), {
    fg: "#eeeeee",
    bg: "#111111",
    bold: false,
  });
  assertEquals(apiWorkbenchControlBaseStyle(controlTheme, true), {
    fg: "#000000",
    bg: "#ffaa00",
    bold: true,
  });
  assertEquals(apiWorkbenchControlButtonDetailStyle(controlTheme, true), {
    fg: "#ffaa00",
    bg: "#111111",
    bold: true,
  });
});

Deno.test("api workbench textbox and wrapped-option styles share highlight policy", () => {
  assertEquals(apiWorkbenchTextboxCommandStyle(controlTheme, { role: "label", header: true }, true), {
    fg: "#000000",
    bg: "#ffaa00",
    bold: true,
  });
  assertEquals(apiWorkbenchTextboxCommandStyle(controlTheme, { role: "label", header: false }, true), {
    fg: "#eeeeee",
    bg: "#111111",
    bold: false,
  });
  assertEquals(apiWorkbenchWrappedOptionStyle(controlTheme, true), {
    fg: "#000000",
    bg: "#ffaa00",
    bold: true,
  });
});

Deno.test("api workbench control line projection emits segments and hit regions", () => {
  const segments: ApiWorkbenchControlLineSegment[] = [];
  const hits: ApiWorkbenchControlHitPlacement[] = [];
  const nextRow = apiWorkbenchControlLineInto(
    segments,
    hits,
    "slider",
    "Slider  ███░ 3/10",
    { column: 2, row: 5, width: 20, height: 4 },
    6,
    "slider",
    { previous: true, next: true },
  );

  assertEquals(nextRow, 7);
  assertEquals(segments, [{
    kind: "line",
    text: "> Slider  ███░ 3/10 ",
    column: 2,
    row: 6,
    width: 20,
    active: true,
  }]);
  assertEquals(hits, [
    { column: 2, row: 6, width: 20, height: 1, id: "slider", action: "activate", index: undefined },
    { column: 2, row: 6, width: 10, height: 1, id: "slider", action: "previous", index: undefined },
    { column: 12, row: 6, width: 10, height: 1, id: "slider", action: "next", index: undefined },
  ]);
});

Deno.test("api workbench control line projection keeps button token segments scoped", () => {
  const segments: ApiWorkbenchControlLineSegment[] = [];
  const hits: ApiWorkbenchControlHitPlacement[] = [];
  apiWorkbenchControlLineInto(
    segments,
    hits,
    "button",
    "[ Run ] presses=2",
    { column: 4, row: 1, width: 24, height: 3 },
    1,
    "textbox",
    { button: true, action: "focus", index: 3 },
  );

  assertEquals(segments, [
    { kind: "prefix", text: "  ", column: 4, row: 1, width: 2, active: false },
    { kind: "button", text: "[ Run ]", column: 6, row: 1, width: 7, active: false },
    { kind: "detail", text: " presses=2", column: 13, row: 1, width: 10, active: false },
  ]);
  assertEquals(hits, [
    { column: 4, row: 1, width: 24, height: 1, id: "button", action: "focus", index: 3 },
  ]);

  const firstSegment = segments[0];
  const firstHit = hits[0];
  apiWorkbenchControlLineInto(
    segments,
    hits,
    "checkbox",
    "Checkboxes",
    { column: 0, row: 0, width: 8, height: 1 },
    0,
    "checkbox",
  );
  assertEquals(segments[0] === firstSegment, true);
  assertEquals(hits[0] === firstHit, true);
  assertEquals(hits.length, 1);
});

Deno.test("api workbench control line render commands classify fill button and detail segments", () => {
  const segments: ApiWorkbenchControlLineSegment[] = [];
  const hits: ApiWorkbenchControlHitPlacement[] = [];
  apiWorkbenchControlLineInto(
    segments,
    hits,
    "genericButton",
    "[ Apply ] count=3",
    { column: 3, row: 8, width: 24, height: 2 },
    8,
    "genericButton",
    { button: true },
  );
  const commands = apiWorkbenchControlLineRenderCommandsInto([], segments, {
    rect: { column: 3, row: 8, width: 24, height: 2 },
    row: 8,
    button: true,
  });

  assertEquals(commands, [
    { kind: "fill", role: "base", text: "", column: 3, row: 8, width: 24, active: false },
    { kind: "segment", role: "base", text: "> ", column: 3, row: 8, width: 2, active: true },
    { kind: "segment", role: "button", text: "[ Apply ]", column: 5, row: 8, width: 9, active: true },
    { kind: "segment", role: "detail", text: " count=3", column: 14, row: 8, width: 8, active: true },
  ]);
});

Deno.test("api workbench control line render commands reuse caller storage", () => {
  const target: ApiWorkbenchControlLineRenderCommand[] = [];
  const first = apiWorkbenchControlLineRenderCommandsInto(target, [
    { kind: "line", text: "> Slider", column: 1, row: 2, width: 8, active: true },
  ], {
    rect: { column: 1, row: 2, width: 20, height: 1 },
    row: 2,
  })[0];

  apiWorkbenchControlLineRenderCommandsInto(target, [
    { kind: "button", text: "[ Run ]", column: 4, row: 5, width: 7, active: false },
  ], {
    rect: { column: 2, row: 5, width: 16, height: 1 },
    row: 5,
    button: true,
  });

  assertEquals(target[0] === first, true);
  assertEquals(target, [
    { kind: "fill", role: "base", text: "", column: 2, row: 5, width: 16, active: false },
    { kind: "segment", role: "button", text: "[ Run ]", column: 4, row: 5, width: 7, active: false },
  ]);
  assertEquals(
    apiWorkbenchControlLineRenderCommandsInto(target, [], {
      rect: { column: 0, row: 0, width: 10, height: 1 },
      row: 0,
    }),
    [],
  );
});

Deno.test("api workbench control track projects clamped fill and slider hit geometry", () => {
  const track = apiWorkbenchControlTrack({ ratio: 0.42, boundsWidth: 80, reservedWidth: 20, maxWidth: 24 });
  assertEquals(track, {
    width: 24,
    filled: 10,
    text: "██████████░░░░░░░░░░░░░░",
  });
  assertEquals(
    apiWorkbenchSliderSetHitInto(
      { column: 0, row: 0, width: 0, height: 1, id: "slider", action: "set" },
      { column: 3, row: 4, width: 80, height: 2 },
      9,
      track,
    ),
    { column: 15, row: 9, width: 24, height: 1, id: "slider", action: "set", index: undefined },
  );
  assertEquals(
    apiWorkbenchControlTrack({ ratio: 2, boundsWidth: 14, reservedWidth: 20, minWidth: 8, maxWidth: 24 }),
    { width: 8, filled: 8, text: "████████" },
  );
});

Deno.test("api workbench dropdown popover rectangle follows shared adapter geometry", () => {
  assertEquals(
    apiWorkbenchDropdownPopoverRect({
      rect: { column: 10, row: 4, width: 42, height: 12 },
      row: 9,
      items: ["Alpha", "Longer choice"],
      label: "Current",
    }),
    { column: 12, row: 9, width: 19, height: 4 },
  );
  assertEquals(
    apiWorkbenchDropdownPopoverRect({
      rect: { column: 1, row: 2, width: 10, height: 5 },
      row: 4,
      items: ["A", "B", "C"],
      label: "Tiny",
    }),
    { column: 3, row: 4, width: 16, height: 5 },
  );
});

Deno.test("api workbench wrapped option render commands project rows and token hits", () => {
  const hits: ApiWorkbenchControlHitPlacement[] = [];
  const commands = apiWorkbenchWrappedOptionsRenderCommandsInto([], hits, {
    rect: { column: 4, row: 10, width: 20, height: 4 },
    startRow: 11,
    id: "combo",
    items: ["Unit-01", "Signal", "Arcane"],
    selectedIndex: 1,
    activeId: "combo",
  });

  assertEquals(commands, [
    {
      text: " Unit-01        ",
      column: 6,
      row: 11,
      width: 16,
      active: true,
    },
    {
      text: "[Signal]        ",
      column: 6,
      row: 12,
      width: 16,
      active: true,
    },
    {
      text: " Arcane         ",
      column: 6,
      row: 13,
      width: 16,
      active: true,
    },
  ]);
  assertEquals(hits, [
    { column: 6, row: 11, width: 10, height: 1, id: "combo", action: "activate", index: 0 },
    { column: 6, row: 12, width: 9, height: 1, id: "combo", action: "activate", index: 1 },
    { column: 6, row: 13, width: 9, height: 1, id: "combo", action: "activate", index: 2 },
  ]);
});

Deno.test("api workbench wrapped option render commands clip and reuse caller storage", () => {
  const target: ApiWorkbenchWrappedOptionsRenderCommand[] = [];
  const hits: ApiWorkbenchControlHitPlacement[] = [];
  apiWorkbenchWrappedOptionsRenderCommandsInto(target, hits, {
    rect: { column: 0, row: 0, width: 18, height: 3 },
    startRow: 1,
    id: "radio",
    items: ["Alpha", "Beta"],
    selectedIndex: 0,
    activeId: "button",
  });
  const firstCommand = target[0];
  const firstHit = hits[0];

  apiWorkbenchWrappedOptionsRenderCommandsInto(target, hits, {
    rect: { column: 2, row: 4, width: 12, height: 1 },
    startRow: 4,
    id: "radio",
    items: ["One", "Two"],
    selectedIndex: undefined,
    activeId: "radio",
  });
  assertEquals(target[0] === firstCommand, true);
  assertEquals(hits[0] === firstHit, true);
  assertEquals(target, [{ text: " One    ", column: 4, row: 4, width: 8, active: true }]);
  assertEquals(hits, [{ column: 4, row: 4, width: 6, height: 1, id: "radio", action: "activate", index: 0 }]);

  assertEquals(
    apiWorkbenchWrappedOptionsRenderCommandsInto(target, hits, {
      rect: { column: 0, row: 0, width: 10, height: 1 },
      startRow: 2,
      id: "radio",
      items: ["Hidden"],
      selectedIndex: undefined,
      activeId: "radio",
    }),
    [],
  );
  assertEquals(hits, []);
});

Deno.test("api workbench textbox projection wraps reveals cursor and emits shared hit geometry", () => {
  const projection = apiWorkbenchTextboxProjection({
    rect: { column: 5, row: 10, width: 24, height: 8 },
    row: 12,
    lines: ["alpha beta gamma delta", "second line"],
    cursor: { x: 18, y: 0 },
    active: true,
  });

  assertEquals(projection.height, 5);
  assertEquals(projection.nextRow, 17);
  assertEquals(projection.hit, { column: 5, row: 12, width: 24, height: 5, id: "textbox", action: "focus" });
  assertEquals(
    projection.rows.map((entry) => ({
      row: entry.row,
      label: entry.labelText,
      body: entry.bodyText,
      cursor: entry.cursor,
      continuation: entry.continuation,
      header: entry.header,
      labelWidth: entry.labelWidth,
      bodyWidth: entry.bodyWidth,
    })),
    [
      {
        row: 12,
        label: "> TextBox",
        body: "alpha beta",
        cursor: false,
        continuation: false,
        header: true,
        labelWidth: 10,
        bodyWidth: 14,
      },
      {
        row: 13,
        label: "          ",
        body: "gamma delta",
        cursor: true,
        continuation: true,
        header: false,
        labelWidth: 10,
        bodyWidth: 14,
      },
      {
        row: 14,
        label: "          ",
        body: "second line",
        cursor: false,
        continuation: false,
        header: false,
        labelWidth: 10,
        bodyWidth: 14,
      },
      {
        row: 15,
        label: "          ",
        body: "",
        cursor: false,
        continuation: false,
        header: false,
        labelWidth: 10,
        bodyWidth: 14,
      },
      {
        row: 16,
        label: "          ",
        body: "",
        cursor: false,
        continuation: false,
        header: false,
        labelWidth: 10,
        bodyWidth: 14,
      },
    ],
  );
});

Deno.test("api workbench textbox projection can reuse caller-owned rows", () => {
  const rows = apiWorkbenchTextboxProjection({
    rect: { column: 2, row: 4, width: 22, height: 6 },
    row: 5,
    lines: ["alpha beta gamma", "tail"],
    cursor: { x: 2, y: 0 },
    active: false,
  }).rows;
  const first = rows[0];

  const projection = apiWorkbenchTextboxProjectionInto(rows, {
    rect: { column: 3, row: 8, width: 20, height: 5 },
    row: 9,
    lines: ["short"],
    cursor: { x: 5, y: 0 },
    active: true,
  });

  assertEquals(projection.rows === rows, true);
  assertEquals(projection.rows[0] === first, true);
  assertEquals(projection.rows.length, 4);
  assertEquals(projection.rows[0]?.row, 9);
  assertEquals(projection.rows[0]?.labelColumn, 3);
  assertEquals(projection.rows[0]?.bodyText, "short");

  const clipped = apiWorkbenchTextboxProjectionInto(rows, {
    rect: { column: 3, row: 8, width: 0, height: 5 },
    row: 9,
    lines: ["short"],
    cursor: { x: 0, y: 0 },
    active: true,
  });
  assertEquals(clipped.rows === rows, true);
  assertEquals(clipped.rows.length, 0);
});

Deno.test("api workbench textbox render commands project label and body rows", () => {
  const projection = apiWorkbenchTextboxProjection({
    rect: { column: 5, row: 10, width: 24, height: 8 },
    row: 12,
    lines: ["alpha beta gamma delta"],
    cursor: { x: 18, y: 0 },
    active: true,
  });
  const commands = apiWorkbenchTextboxRenderCommandsInto([], projection.rows);

  assertEquals(commands.slice(0, 4), [
    { role: "label", text: "> TextBox ", column: 5, row: 12, width: 10, active: true, header: true },
    { role: "body", text: " alpha beta   ", column: 15, row: 12, width: 14, active: true, header: true },
    { role: "label", text: "          ", column: 5, row: 13, width: 10, active: true, header: false },
    { role: "body", text: "↳gamma delta▌ ", column: 15, row: 13, width: 14, active: true, header: false },
  ]);
});

Deno.test("api workbench textbox render commands support glyph overrides and reuse", () => {
  const target: ApiWorkbenchTextboxRenderCommand[] = [];
  const first = apiWorkbenchTextboxRenderCommandsInto(target, [{
    row: 2,
    labelColumn: 1,
    labelWidth: 6,
    labelText: "> Box",
    bodyColumn: 7,
    bodyWidth: 8,
    bodyText: "value",
    visualLine: { text: "value", lineIndex: 0, startColumn: 0, endColumn: 5, continuation: true },
    cursor: true,
    continuation: true,
    active: false,
    header: true,
  }], {
    cursorGlyph: "|",
    continuationGlyph: ">",
  })[0];

  assertEquals(target, [
    { role: "label", text: "> Box ", column: 1, row: 2, width: 6, active: false, header: true },
    { role: "body", text: ">value| ", column: 7, row: 2, width: 8, active: false, header: true },
  ]);

  apiWorkbenchTextboxRenderCommandsInto(target, [{
    row: 3,
    labelColumn: 2,
    labelWidth: 4,
    labelText: "L",
    bodyColumn: 6,
    bodyWidth: 4,
    bodyText: "B",
    visualLine: { text: "B", lineIndex: 0, startColumn: 0, endColumn: 1, continuation: false },
    cursor: false,
    continuation: false,
    active: true,
    header: false,
  }]);
  assertEquals(target[0] === first, true);
  assertEquals(apiWorkbenchTextboxRenderCommandsInto(target, [], { cursorGlyph: "|" }), []);
});

Deno.test("api workbench textbox projection reuses caller-owned visual lines", () => {
  const visualLines = apiWorkbenchTextboxProjection({
    rect: { column: 2, row: 4, width: 18, height: 4 },
    row: 5,
    lines: ["alpha beta gamma"],
    cursor: { x: 0, y: 0 },
    active: false,
  }).rows.map((row) => row.visualLine);
  const firstVisualLine = visualLines[0];

  const projection = apiWorkbenchTextboxProjection({
    rect: { column: 2, row: 4, width: 18, height: 4 },
    row: 5,
    lines: ["short"],
    visualLines,
    cursor: { x: 0, y: 0 },
    active: false,
  });

  assertEquals(projection.rows[0]?.visualLine === firstVisualLine, true);
  assertEquals(projection.rows[0]?.visualLine.text, "short");
  assertEquals(visualLines.length, 1);
});

Deno.test("api workbench option rows project checkbox and radio controls with reusable storage", () => {
  const rows = apiWorkbenchCheckboxRowsInto([], [
    { label: "live preview", checked: true },
    { label: "compact rows", checked: false },
  ]);
  const first = rows[0];

  assertEquals(rows, [
    { id: "checkbox", value: "Checkboxes", options: undefined },
    { id: "checkbox", value: "✓ live preview", options: { indent: true, index: 0 } },
    { id: "checkbox", value: "✗ compact rows", options: { indent: true, index: 1 } },
  ]);

  apiWorkbenchRadioRowsInto(rows, [
    { label: "Fast", selected: false },
    { label: "Unit-01 Signal", selected: true },
  ], 1);

  assertEquals(rows[0] === first, true);
  assertEquals(rows, [
    { id: "radio", value: "Radio", options: { previous: true, next: true } },
    { id: "radio", value: "  ○ Fast", options: { indent: true, index: 0 } },
    { id: "radio", value: "> ● Unit-01 Signal", options: { indent: true, index: 1 } },
  ]);
});

Deno.test("api workbench combo header projection preserves responsive split and hit options", () => {
  assertEquals(
    apiWorkbenchComboHeaderRowsInto([], {
      title: "Theme",
      label: "Unit-01 Signal",
      expanded: true,
      rectWidth: 48,
    }),
    [
      {
        id: "combo",
        value: "Theme  ▾ Unit-01 Signal",
        options: { action: "activate", previous: undefined, next: undefined },
      },
    ],
  );

  assertEquals(
    apiWorkbenchComboHeaderRowsInto([], {
      title: "Theme combo",
      label: "Unit-01 Signal",
      expanded: false,
      rectWidth: 18,
      expandedGlyph: "v",
      collapsedGlyph: ">",
      previous: true,
      next: true,
    }),
    [
      {
        id: "combo",
        value: "Theme combo  >",
        options: { action: "activate", previous: true, next: true },
      },
      { id: "combo", value: "Unit-01 Signal", options: { indent: true } },
    ],
  );
});

Deno.test("api workbench simple control row projectors preserve renderer-neutral values", () => {
  const button = apiWorkbenchButtonRowInto(undefined, {
    id: "genericButton",
    label: "Generic Button",
    detail: "presses=3",
  });
  assertEquals(button, {
    id: "genericButton",
    value: "[ Generic Button ] presses=3",
    options: { button: true, action: undefined },
  });

  const reused = apiWorkbenchDropdownHeaderRowInto(button, {
    title: "Dropdown",
    label: "Primary",
    expanded: false,
    expandedGlyph: "v",
    collapsedGlyph: ">",
  });
  assertEquals(reused === button, true);
  assertEquals(reused, {
    id: "dropdown",
    value: "Dropdown  > Primary",
    options: { action: "toggle" },
  });

  assertEquals(
    apiWorkbenchInputRowInto(undefined, {
      title: "Input",
      text: "deno task health",
      active: true,
      cursorGlyph: "|",
    }),
    {
      id: "input",
      value: "Input     deno task health|",
      options: { action: "focus" },
    },
  );

  assertEquals(
    apiWorkbenchSliderRowInto(undefined, {
      track: { text: "██░░" },
      value: 5,
      max: 10,
    }),
    {
      id: "slider",
      value: "Slider    ██░░ 5/10",
      options: { previous: true, next: true },
    },
  );

  assertEquals(
    apiWorkbenchStepperRowInto(undefined, {
      steps: [
        { id: "draft", label: "Draft", completed: true },
        { id: "review", label: "Review" },
        { id: "ship", label: "Ship" },
      ],
      activeIndex: 1,
      rectWidth: 48,
    }),
    {
      id: "stepper",
      value: "Stepper   ✓ Draft → [Review] → Ship",
      options: { previous: true, next: true },
    },
  );

  assertEquals(
    apiWorkbenchProgressRowInto(undefined, {
      track: { text: "██░░" },
      value: 50,
    }),
    {
      id: "slider",
      value: "Progress  ██░░ 50%",
      options: undefined,
    },
  );
});

Deno.test("api workbench controls panel rows project shared adapter order", () => {
  const rows = apiWorkbenchControlsRowsInto([], {
    buttonPressCount: 2,
    genericButtonPressCount: 3,
    modalOpen: true,
    slider: { track: { text: "██░░" }, value: 5, max: 10 },
    checkboxes: [
      { label: "live preview", checked: true },
      { label: "compact rows", checked: false },
    ],
    radio: {
      items: [
        { label: "Fast", selected: false },
        { label: "Unit-01 Signal", selected: true },
      ],
      activeIndex: 1,
    },
    combo: {
      title: "Theme",
      label: "Unit-01 Signal",
      expanded: true,
      rectWidth: 18,
    },
    dropdown: {
      title: "Dropdown",
      label: "Geometry",
      expanded: false,
    },
    input: {
      title: "Input",
      text: "deno task health",
      active: true,
    },
    stepper: {
      steps: [
        { id: "draft", label: "Draft", completed: true },
        { id: "review", label: "Review" },
      ],
      activeIndex: 1,
      rectWidth: 42,
    },
    progress: {
      track: { text: "███░" },
      value: 75,
    },
  });

  assertEquals(rows.map((row) => [row.id, row.value, row.options]), [
    ["button", "[ Run Action ] presses=2", { button: true, action: undefined }],
    ["genericButton", "[ Generic Button ] presses=3", { button: true, action: undefined }],
    ["modal", "[ Open Modal ] state=open", { button: true, action: undefined }],
    ["slider", "Slider    ██░░ 5/10", { previous: true, next: true }],
    ["checkbox", "Checkboxes", undefined],
    ["checkbox", "✓ live preview", { indent: true, index: 0 }],
    ["checkbox", "✗ compact rows", { indent: true, index: 1 }],
    ["radio", "Radio", { previous: true, next: true }],
    ["radio", "  ○ Fast", { indent: true, index: 0 }],
    ["radio", "> ● Unit-01 Signal", { indent: true, index: 1 }],
    ["combo", "Theme  ▾", { action: "activate", previous: undefined, next: undefined }],
    ["combo", "Unit-01 Signal", { indent: true }],
    ["dropdown", "Dropdown  ▸ Geometry", { action: "toggle" }],
    ["input", "Input     deno task health▌", { action: "focus" }],
    ["stepper", "Stepper   ✓ Draft → [Review]", { previous: true, next: true }],
    ["textbox", "TextBox", { action: "focus" }],
    ["slider", "Progress  ███░ 75%", undefined],
  ]);

  const first = rows[0];
  apiWorkbenchControlsRowsInto(rows, {
    buttonPressCount: 4,
    genericButtonPressCount: 0,
    modalOpen: false,
    slider: { track: { text: "░░░░" }, value: 1, max: 10 },
    checkboxes: [],
    radio: { items: [], activeIndex: 0 },
    combo: { title: "Theme", label: "A", expanded: false, rectWidth: 80 },
    dropdown: { title: "Dropdown", label: "A", expanded: true },
    input: { title: "Input", text: "", active: false },
    stepper: { steps: [], activeIndex: 0, rectWidth: 20 },
    progress: { track: { text: "░░░░" }, value: 0 },
  });
  assertEquals(rows[0] === first, true);
  assertEquals(rows.at(-1), { id: "slider", value: "Progress  ░░░░ 0%", options: undefined });
});

Deno.test("api workbench controls snapshot rows assemble state into reusable buffers", () => {
  const checkboxBuffer = [{ label: "stale", checked: false }];
  const radioBuffer = [{ label: "old", selected: true }];
  const rows = apiWorkbenchControlsSnapshotRowsInto([], {
    buttonPressCount: 2,
    genericButtonPressCount: 1,
    modalOpen: false,
    slider: { track: { text: "██░░" }, value: 5, max: 10 },
    checkboxLivePreview: true,
    checkboxCompactRows: false,
    radioOptions: [
      { label: "Fast", value: "fast" },
      { label: "Unit-01 Signal", value: "unit-01" },
      { label: "Dense", value: "dense" },
    ],
    radioSelectedValue: "unit-01",
    radioActiveIndex: 2,
    combo: {
      title: "Theme",
      label: "Unit-01 Signal",
      expanded: false,
      rectWidth: 32,
    },
    dropdown: {
      title: "Dropdown",
      label: "Geometry",
      expanded: true,
    },
    input: {
      title: "Input",
      text: "deno task health",
      active: false,
    },
    stepper: {
      steps: [
        { id: "draft", label: "Draft", completed: true },
        { id: "ship", label: "Ship" },
      ],
      activeIndex: 1,
      rectWidth: 40,
    },
    progress: { track: { text: "███░" }, value: 75 },
    buffers: {
      checkboxes: checkboxBuffer,
      radio: radioBuffer,
    },
  });

  assertEquals(checkboxBuffer, [
    { label: "live preview", checked: true },
    { label: "compact rows", checked: false },
  ]);
  assertEquals(radioBuffer, [
    { label: "Fast", selected: false },
    { label: "Unit-01 Signal", selected: true },
    { label: "Dense", selected: false },
  ]);
  assertEquals(rows.map((row) => [row.id, row.value, row.options]).slice(4, 12), [
    ["checkbox", "Checkboxes", undefined],
    ["checkbox", "✓ live preview", { indent: true, index: 0 }],
    ["checkbox", "✗ compact rows", { indent: true, index: 1 }],
    ["radio", "Radio", { previous: true, next: true }],
    ["radio", "  ○ Fast", { indent: true, index: 0 }],
    ["radio", "  ● Unit-01 Signal", { indent: true, index: 1 }],
    ["radio", "> ○ Dense", { indent: true, index: 2 }],
    ["combo", "Theme  ▸ Unit-01 Signal", { action: "activate", previous: undefined, next: undefined }],
  ]);
});

Deno.test("api workbench controls panel rows keep terminal and web geometry in parity", () => {
  const projectedRows = apiWorkbenchControlsRowsInto([], {
    buttonPressCount: 1,
    genericButtonPressCount: 0,
    modalOpen: false,
    slider: { track: { text: "██░░" }, value: 5, max: 10 },
    checkboxes: [{ label: "live preview", checked: true }],
    radio: {
      items: [
        { label: "Fast", selected: true },
        { label: "Ship", selected: false },
      ],
      activeIndex: 0,
    },
    combo: {
      title: "Theme",
      label: "Unit-01 Signal",
      expanded: false,
      rectWidth: 24,
      previous: true,
      next: true,
    },
    dropdown: {
      title: "Dropdown",
      label: "Geometry",
      expanded: true,
    },
    input: {
      title: "Input",
      text: "abc",
      active: false,
    },
    stepper: {
      steps: [
        { id: "draft", label: "Draft", completed: true },
        { id: "ship", label: "Ship" },
      ],
      activeIndex: 1,
      rectWidth: 40,
    },
    progress: { track: { text: "███░" }, value: 75 },
  });
  const terminal = projectRowsForAdapter(projectedRows, "radio");
  const web = projectRowsForAdapter(projectedRows, "radio");

  assertEquals(web, terminal);
  assertEquals(
    terminal.hits.filter((hit) => hit.id === "slider" && hit.action === "previous").length,
    1,
  );
  assertEquals(
    terminal.segments.some((segment) => segment.kind === "button" && segment.text === "[ Run Action ]"),
    true,
  );
});

Deno.test("api workbench stepper hit placements clip and reuse caller storage", () => {
  const target = apiWorkbenchStepperHitPlacementsInto(
    [],
    [
      { label: "Draft", completed: true },
      { label: "Review" },
      { label: "Ship", disabled: true },
    ],
    1,
    { column: 4, row: 2, width: 24, height: 1 },
    7,
  );
  const first = target[0];

  assertEquals(target.map((entry) => [entry.column, entry.row, entry.width, entry.index]), [
    [16, 7, 7, 0],
  ]);
  assertEquals(target[0]?.id, "stepper");
  assertEquals(target[0]?.action, "activate");

  apiWorkbenchStepperHitPlacementsInto(
    target,
    [{ label: "One" }, { label: "Two" }],
    0,
    { column: 0, row: 0, width: 30, height: 1 },
    3,
    { columnOffset: 2, gap: 1 },
  );

  assertEquals(target[0] === first, true);
  assertEquals(target.map((entry) => [entry.column, entry.row, entry.width, entry.index]), [
    [2, 3, 5, 0],
    [8, 3, 3, 1],
  ]);
});

function projectRowsForAdapter(
  rows: readonly { id: (typeof apiWorkbenchControlIds)[number]; value: string; options?: unknown }[],
  activeId: (typeof apiWorkbenchControlIds)[number],
): { segments: ApiWorkbenchControlLineSegment[]; hits: ApiWorkbenchControlHitPlacement[] } {
  const segments: ApiWorkbenchControlLineSegment[] = [];
  const hits: ApiWorkbenchControlHitPlacement[] = [];
  const projectedSegments: ApiWorkbenchControlLineSegment[] = [];
  const projectedHits: ApiWorkbenchControlHitPlacement[] = [];
  const rect = { column: 4, row: 2, width: 28, height: 64 };
  let row = rect.row;
  for (const controlRow of rows) {
    if (controlRow.id === "textbox" || controlRow.value.startsWith("Progress")) continue;
    row = apiWorkbenchControlLineInto(
      projectedSegments,
      projectedHits,
      controlRow.id,
      controlRow.value,
      rect,
      row,
      activeId,
      controlRow.options as Parameters<typeof apiWorkbenchControlLineInto>[7],
    );
    for (const segment of projectedSegments) segments.push({ ...segment });
    for (const hit of projectedHits) hits.push({ ...hit });
  }
  return { segments, hits };
}

function hitStack<TAction>(entries: Array<{ rect: Rectangle; action: TAction }>) {
  return {
    find(x: number, y: number) {
      for (let index = entries.length - 1; index >= 0; index -= 1) {
        const entry = entries[index]!;
        if (containsRectPoint(entry.rect, x, y)) return entry;
      }
    },
    findExpanded(
      x: number,
      y: number,
      expand: (rect: Rectangle, target: { rect: Rectangle; action: TAction }) => Rectangle | undefined,
    ) {
      for (let index = entries.length - 1; index >= 0; index -= 1) {
        const entry = entries[index]!;
        const rect = expand(entry.rect, entry);
        if (rect && containsRectPoint(rect, x, y)) return { rect, action: entry.action };
      }
    },
  };
}

function containsRectPoint(rect: Rectangle, x: number, y: number): boolean {
  return x >= rect.column && x < rect.column + rect.width && y >= rect.row && y < rect.row + rect.height;
}
