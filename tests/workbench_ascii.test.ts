import { assert, assertEquals } from "jsr:@std/assert";
import {
  applyWorkbenchAsciiConfigRowAction,
  asciiNumericOptionRatio,
  closestAsciiControlValueIndex,
  createDefaultWorkbenchAsciiOptions,
  defaultWorkbenchAsciiConfigRows,
  formatWorkbenchAsciiConfigRowText,
  formatWorkbenchAsciiConfigTitle,
  moveWorkbenchAsciiConfigSelection,
  resolveWorkbenchAsciiConfigKey,
  stepWorkbenchAsciiGlyphStyle,
  stepWorkbenchAsciiNumericOption,
  stepWorkbenchAsciiPreset,
  toggleWorkbenchAsciiOption,
  WorkbenchAsciiConfigController,
  workbenchAsciiConfigVisibleRowStart,
  workbenchAsciiRendererModeLabel,
} from "../src/app/workbench_ascii.ts";
import {
  layoutWorkbenchAsciiConfigModal,
  type WorkbenchAsciiConfigModalAction,
  workbenchAsciiConfigModalActionItemsInto,
  workbenchAsciiConfigModalActionRenderCommandsInto,
  WorkbenchAsciiConfigModalBufferCache,
  workbenchAsciiConfigRowPlacementsInto,
  workbenchAsciiConfigRowRenderCommandsInto,
} from "../src/app/workbench_ascii_modal.ts";
import type { WorkbenchButtonRowItem, WorkbenchButtonRowPlacement } from "../src/app/workbench_control_layout.ts";

Deno.test("workbench ascii controller owns root and per-window config signals", () => {
  const controller = new WorkbenchAsciiConfigController<"three" | "viz">("three");
  const root = controller.signalForWindow("three");
  const viz = controller.signalForWindow("viz");

  assertEquals(root, controller.root);
  assert(viz !== root);
  assertEquals(viz.peek(), root.peek());

  const next = { ...viz.peek(), terminalGlyphStyle: "glyphs" as const };
  controller.setForWindow("viz", next);
  assertEquals(controller.signalForWindow("viz").peek().terminalGlyphStyle, "glyphs");
  assertEquals(controller.configuredWindow("viz", (id) => id === "viz"), "viz");
  assertEquals(controller.configuredWindow("viz", (id) => id === "three"), "three");

  controller.disposeWindow("viz");
  assert(controller.signalForWindow("viz") !== viz);
  controller.dispose();
});

Deno.test("workbench ascii option helpers step presets glyphs toggles and numeric values", () => {
  const initial = createDefaultWorkbenchAsciiOptions();

  const preset = stepWorkbenchAsciiPreset(initial, ["opentui-blocks", "glyph-atlas"], 1);
  assertEquals(preset.presetId, "glyph-atlas");
  assertEquals(preset.options.terminalGlyphStyle, "glyphs");
  assertEquals(preset.options.renderMaxCells, initial.renderMaxCells);

  const glyph = stepWorkbenchAsciiGlyphStyle(initial, 1);
  assertEquals(glyph.terminalGlyphStyle, "glyphs");
  assertEquals(glyph.preset, "custom");

  const toggled = toggleWorkbenchAsciiOption(initial, "edges");
  assertEquals(toggled.edges, !initial.edges);
  assertEquals(toggled.preset, "custom");

  const stepped = stepWorkbenchAsciiNumericOption(initial, "wireframeThickness", 1);
  assert(stepped.wireframeThickness >= initial.wireframeThickness);
  assertEquals(stepped.preset, "custom");

  const renderCells = stepWorkbenchAsciiNumericOption(initial, "renderMaxCells", 1);
  assertEquals(renderCells.renderMaxCells, 1920);
  assertEquals(renderCells.preset, "custom");

  const readbackSlots = stepWorkbenchAsciiNumericOption(initial, "deferredReadbackSlots", 1);
  assertEquals(readbackSlots.deferredReadbackSlots, 8);
  assertEquals(readbackSlots.preset, "custom");
});

Deno.test("workbench ascii config action helper applies rows and formats messages", () => {
  const initial = createDefaultWorkbenchAsciiOptions();

  const preset = applyWorkbenchAsciiConfigRowAction(
    initial,
    { kind: "preset", label: "Preset" },
    "next",
    ["opentui-blocks", "glyph-atlas"],
  );
  assertEquals(preset.options.terminalGlyphStyle, "glyphs");
  assertEquals(preset.message, "preset Glyph Atlas");

  const glyph = applyWorkbenchAsciiConfigRowAction(
    initial,
    { kind: "glyphStyle", label: "Glyph style" },
    "next",
    [],
  );
  assertEquals(glyph.options.terminalGlyphStyle, "glyphs");
  assertEquals(glyph.message, "glyph style Glyphs");

  const toggle = applyWorkbenchAsciiConfigRowAction(
    initial,
    { kind: "toggle", key: "edges", label: "Edge pass" },
    "activate",
    [],
  );
  assertEquals(toggle.options.edges, !initial.edges);
  assertEquals(toggle.message, `edges ${toggle.options.edges ? "on" : "off"}`);

  const numeric = applyWorkbenchAsciiConfigRowAction(
    initial,
    { kind: "numeric", key: "wireframeThickness", label: "Wire thickness" },
    "next",
    [],
  );
  assertEquals(numeric.options.wireframeThickness, 12);
  assertEquals(numeric.message, "wireframeThickness 12.00");

  const renderCells = applyWorkbenchAsciiConfigRowAction(
    initial,
    { kind: "numeric", key: "renderMaxCells", label: "Render cells" },
    "previous",
    [],
  );
  assertEquals(renderCells.options.renderMaxCells, 480);
  assertEquals(renderCells.message, "renderMaxCells 480");

  const readbackSlots = applyWorkbenchAsciiConfigRowAction(
    initial,
    { kind: "numeric", key: "deferredReadbackSlots", label: "Readback slots" },
    "next",
    [],
  );
  assertEquals(readbackSlots.options.deferredReadbackSlots, 8);
  assertEquals(readbackSlots.message, "deferredReadbackSlots 8");
});

Deno.test("workbench ascii config selection helpers wrap and keep selected row visible", () => {
  assertEquals(moveWorkbenchAsciiConfigSelection(0, 18, -1), 17);
  assertEquals(moveWorkbenchAsciiConfigSelection(17, 18, 1), 0);
  assertEquals(moveWorkbenchAsciiConfigSelection(5, 0, 1), 0);

  assertEquals(workbenchAsciiConfigVisibleRowStart(0, 18, 4), 0);
  assertEquals(workbenchAsciiConfigVisibleRowStart(3, 18, 4), 3);
  assertEquals(workbenchAsciiConfigVisibleRowStart(17, 18, 4), 14);
  assertEquals(workbenchAsciiConfigVisibleRowStart(99, 18, 4), 14);
  assertEquals(workbenchAsciiConfigVisibleRowStart(3, 18, 0), 0);
});

Deno.test("workbench ascii config key resolver maps keyboard controls", () => {
  assertEquals(resolveWorkbenchAsciiConfigKey({ key: "escape" }), { kind: "modal", action: "cancel" });
  assertEquals(resolveWorkbenchAsciiConfigKey({ key: "q" }), { kind: "modal", action: "cancel" });
  assertEquals(resolveWorkbenchAsciiConfigKey({ key: "A" }), { kind: "modal", action: "apply" });
  assertEquals(resolveWorkbenchAsciiConfigKey({ key: "o" }), { kind: "modal", action: "ok" });
  assertEquals(resolveWorkbenchAsciiConfigKey({ key: "up" }), { kind: "selection", delta: -1 });
  assertEquals(resolveWorkbenchAsciiConfigKey({ key: "down" }), { kind: "selection", delta: 1 });
  assertEquals(resolveWorkbenchAsciiConfigKey({ key: "tab", shift: true }), { kind: "selection", delta: -1 });
  assertEquals(resolveWorkbenchAsciiConfigKey({ key: "left" }), { kind: "row", action: "previous" });
  assertEquals(resolveWorkbenchAsciiConfigKey({ key: "right" }), { kind: "row", action: "next" });
  assertEquals(resolveWorkbenchAsciiConfigKey({ key: "return" }), { kind: "row", action: "next" });
  assertEquals(resolveWorkbenchAsciiConfigKey({ key: "x" }), { kind: "none" });
});

Deno.test("workbench ascii helpers report ratios closest values and renderer modes", () => {
  assertEquals(closestAsciiControlValueIndex([0, 10, 20], 14), 1);
  assertEquals(asciiNumericOptionRatio([0, 10, 20], 10), 0.5);

  const options = { ...createDefaultWorkbenchAsciiOptions(), kittyGraphics: true, kittyDisableAscii: false };
  assertEquals(
    workbenchAsciiRendererModeLabel(options, (style) => style.toUpperCase()),
    "BLOCKS · Kitty + ASCII",
  );
  assertEquals(
    workbenchAsciiRendererModeLabel({ ...options, kittyDisableAscii: true }, (style) => style.toUpperCase()),
    "BLOCKS · Kitty only",
  );
});

Deno.test("workbench ascii config rows expose reusable modal text", () => {
  const options = {
    ...createDefaultWorkbenchAsciiOptions(),
    edges: true,
    kittyGraphics: true,
    wireframeThickness: 8,
  };

  assertEquals(defaultWorkbenchAsciiConfigRows.map((row) => row.kind), [
    "preset",
    "glyphStyle",
    "kitty",
    "kitty",
    "numeric",
    "numeric",
    "numeric",
    "numeric",
    "toggle",
    "toggle",
    "toggle",
    "numeric",
    "numeric",
    "numeric",
    "numeric",
    "numeric",
    "numeric",
    "numeric",
    "numeric",
  ]);
  assertEquals(
    formatWorkbenchAsciiConfigRowText({ kind: "preset", label: "Preset" }, options),
    "Preset             [<] CUSTOM [>]",
  );
  assertEquals(
    formatWorkbenchAsciiConfigRowText({ kind: "toggle", key: "edges", label: "Edge pass" }, options),
    "Edge pass          [x]",
  );
  assertEquals(
    formatWorkbenchAsciiConfigRowText({ kind: "kitty", key: "kittyGraphics", label: "Kitty graphics" }, options, {
      kittyStatus: "[direct]",
    }),
    "Kitty graphics             [x] [direct]",
  );
  assertEquals(
    formatWorkbenchAsciiConfigRowText(
      { kind: "numeric", key: "wireframeThickness", label: "Wire thickness" },
      options,
      { trackWidth: 4 },
    ),
    "Wire thickness     [<] █░░░  8.00 [>]",
  );
  assertEquals(
    formatWorkbenchAsciiConfigRowText(
      { kind: "numeric", key: "renderMaxCells", label: "Render cells" },
      options,
      { trackWidth: 4 },
    ),
    "Render cells       [<] ░░░░   960 [>]",
  );
  assertEquals(
    formatWorkbenchAsciiConfigRowText(
      { kind: "numeric", key: "deferredReadbackSlots", label: "Readback slots" },
      options,
      { trackWidth: 4 },
    ),
    "Readback slots     [<] ██░░     6 [>]",
  );
});

Deno.test("workbench ascii config title composes window preset and glyph style", () => {
  const options = {
    ...createDefaultWorkbenchAsciiOptions(),
    terminalGlyphStyle: "mixed" as const,
    preset: "glyph-atlas",
  };

  assertEquals(
    formatWorkbenchAsciiConfigTitle("Neon Torus", options),
    "ASCII Neon Torus · Mixed · Glyph Atlas",
  );
  assertEquals(
    formatWorkbenchAsciiConfigTitle("Neon Torus", options, { prefix: "Renderer" }),
    "Renderer Neon Torus · Mixed · Glyph Atlas",
  );
});

Deno.test("workbench ascii config modal layout centers rows actions and footer", () => {
  const layout = layoutWorkbenchAsciiConfigModal({
    bounds: { column: 0, row: 0, width: 120, height: 40 },
    rowCount: defaultWorkbenchAsciiConfigRows.length,
  });

  assertEquals(layout.rect, { column: 19, row: 7, width: 82, height: 26 });
  assertEquals(layout.inner, { column: 20, row: 8, width: 80, height: 24 });
  assertEquals(layout.rowsTop, 10);
  assertEquals(layout.actionRow, 30);
  assertEquals(layout.footerRow, 31);
  assertEquals(layout.visibleRows, 20);
  assertEquals(layout.shadow, { column: 21, row: 8, width: 82, height: 26 });
});

Deno.test("workbench ascii config modal layout stays inside cramped bounds", () => {
  const layout = layoutWorkbenchAsciiConfigModal({
    bounds: { column: 3, row: 2, width: 38, height: 13 },
    rowCount: defaultWorkbenchAsciiConfigRows.length,
  });

  assertEquals(layout.rect, { column: 3, row: 3, width: 38, height: 10 });
  assertEquals(layout.inner, { column: 4, row: 4, width: 36, height: 8 });
  assertEquals(layout.rowsTop, 6);
  assertEquals(layout.actionRow, 10);
  assertEquals(layout.footerRow, 11);
  assertEquals(layout.visibleRows, 4);
  assertEquals(layout.shadow, { column: 5, row: 4, width: 36, height: 10 });
});

Deno.test("workbench ascii config row placements keep selected rows visible and split hits", () => {
  const layout = layoutWorkbenchAsciiConfigModal({
    bounds: { column: 3, row: 2, width: 38, height: 13 },
    rowCount: defaultWorkbenchAsciiConfigRows.length,
  });
  const placements = workbenchAsciiConfigRowPlacementsInto([], defaultWorkbenchAsciiConfigRows, {
    inner: layout.inner,
    rowsTop: layout.rowsTop,
    visibleRows: layout.visibleRows,
    selectedIndex: 16,
  });

  assertEquals(placements.length, 4);
  assertEquals(placements.map((placement) => placement.rowIndex), [15, 16, 17, 18]);
  assertEquals(placements[1]?.selected, true);
  assertEquals(placements[0]?.rect, { column: 4, row: 6, width: 36, height: 1 });
  assertEquals(placements[0]?.previousRect, { column: 4, row: 6, width: 18, height: 1 });
  assertEquals(placements[0]?.nextRect, { column: 22, row: 6, width: 18, height: 1 });
});

Deno.test("workbench ascii config row render commands project fill and text rows", () => {
  const layout = layoutWorkbenchAsciiConfigModal({
    bounds: { column: 3, row: 2, width: 38, height: 13 },
    rowCount: defaultWorkbenchAsciiConfigRows.length,
  });
  const placements = workbenchAsciiConfigRowPlacementsInto([], defaultWorkbenchAsciiConfigRows, {
    inner: layout.inner,
    rowsTop: layout.rowsTop,
    visibleRows: 2,
    selectedIndex: 0,
  });
  const commands = workbenchAsciiConfigRowRenderCommandsInto([], placements, {
    text: (row) => row.label,
  });

  assertEquals(commands.map((command) => command.kind), ["fill", "text", "fill", "text"]);
  assertEquals(commands.map((command) => command.rowIndex), [0, 0, 1, 1]);
  assertEquals(commands.map((command) => command.selected), [true, true, false, false]);
  assertEquals(commands.map((command) => command.text), ["", "Preset", "", "Glyph style"]);
  assertEquals(commands[0]?.rect, { column: 4, row: 6, width: 36, height: 1 });
});

Deno.test("workbench ascii config row render commands reuse caller-owned commands", () => {
  const placements = workbenchAsciiConfigRowPlacementsInto([], defaultWorkbenchAsciiConfigRows.slice(0, 1), {
    inner: { column: 4, row: 4, width: 36, height: 8 },
    rowsTop: 6,
    visibleRows: 1,
    selectedIndex: 0,
  });
  const commands = workbenchAsciiConfigRowRenderCommandsInto([], placements, {
    text: (row) => row.label,
  });
  const firstFill = commands[0];
  const firstText = commands[1];
  const next = workbenchAsciiConfigRowRenderCommandsInto(commands, placements, {
    text: (row) => `${row.label}!`,
  });
  assertEquals(next[0], firstFill);
  assertEquals(next[1], firstText);
  assertEquals(next[1]?.text, "Preset!");
});

Deno.test("workbench ascii config action buttons expose stable labels and tones", () => {
  const items = workbenchAsciiConfigModalActionItemsInto([]);
  assertEquals(items, [
    { label: "Cancel", action: "cancel", tone: "muted" },
    { label: "Apply", action: "apply" },
    { label: "OK", action: "ok", active: true, tone: "success" },
  ]);
});

Deno.test("workbench ascii config action button commands project reusable render commands", () => {
  const items: WorkbenchButtonRowItem<WorkbenchAsciiConfigModalAction>[] = [];
  const placements: WorkbenchButtonRowPlacement<WorkbenchAsciiConfigModalAction>[] = [];
  const commands = workbenchAsciiConfigModalActionRenderCommandsInto([], items, placements, {
    inner: { column: 4, row: 3, width: 32, height: 8 },
    actionRow: 10,
  });

  assertEquals(commands.map((command) => command.text), ["[ Cancel ]", "[ Apply ]", "[ OK ]"]);
  assertEquals(commands.map((command) => command.item.action), ["cancel", "apply", "ok"]);
  assertEquals(commands.map((command) => command.rect), [
    { column: 4, row: 10, width: 10, height: 1 },
    { column: 15, row: 10, width: 9, height: 1 },
    { column: 25, row: 10, width: 6, height: 1 },
  ]);
  assertEquals(commands[2]?.state, "active");
  assertEquals(commands[2]?.tone, "success");

  const firstCommand = commands[0];
  const reused = workbenchAsciiConfigModalActionRenderCommandsInto(commands, items, placements, {
    inner: { column: 1, row: 0, width: 6, height: 8 },
    actionRow: 2,
  });
  assertEquals(reused, commands);
  assertEquals(reused[0], firstCommand);
  assertEquals(reused.map((command) => command.text), ["[ Can…"]);
});

Deno.test("workbench ascii config modal buffer cache preserves retained arrays", () => {
  const cache = new WorkbenchAsciiConfigModalBufferCache<(typeof defaultWorkbenchAsciiConfigRows)[number]>();
  const rowPlacements = cache.rowPlacements;
  const rowRenderCommands = cache.rowRenderCommands;
  const actionItems = cache.actionItems;
  const actionPlacements = cache.actionPlacements;
  const actionCommands = cache.actionCommands;
  const layout = layoutWorkbenchAsciiConfigModal({
    bounds: { column: 0, row: 0, width: 64, height: 18 },
    rowCount: defaultWorkbenchAsciiConfigRows.length,
  });

  workbenchAsciiConfigRowPlacementsInto(cache.rowPlacements, defaultWorkbenchAsciiConfigRows, {
    inner: layout.inner,
    rowsTop: layout.rowsTop,
    visibleRows: 2,
    selectedIndex: 0,
  });
  workbenchAsciiConfigRowRenderCommandsInto(cache.rowRenderCommands, cache.rowPlacements, {
    text: (row) => row.label,
  });
  workbenchAsciiConfigModalActionRenderCommandsInto(cache.actionCommands, cache.actionItems, cache.actionPlacements, {
    inner: layout.inner,
    actionRow: layout.actionRow,
  });

  assertEquals(cache.inspect(), {
    rowPlacements: 2,
    rowRenderCommands: 4,
    actionItems: 3,
    actionPlacements: 3,
    actionCommands: 3,
  });
  cache.clear();
  assertEquals(cache.inspect(), {
    rowPlacements: 0,
    rowRenderCommands: 0,
    actionItems: 0,
    actionPlacements: 0,
    actionCommands: 0,
  });
  assert(cache.rowPlacements === rowPlacements);
  assert(cache.rowRenderCommands === rowRenderCommands);
  assert(cache.actionItems === actionItems);
  assert(cache.actionPlacements === actionPlacements);
  assert(cache.actionCommands === actionCommands);
});
