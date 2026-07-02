import { assert, assertEquals } from "jsr:@std/assert";
import {
  asciiNumericOptionRatio,
  closestAsciiControlValueIndex,
  createDefaultWorkbenchAsciiOptions,
  defaultWorkbenchAsciiConfigRows,
  formatWorkbenchAsciiConfigRowText,
  stepWorkbenchAsciiGlyphStyle,
  stepWorkbenchAsciiNumericOption,
  stepWorkbenchAsciiPreset,
  toggleWorkbenchAsciiOption,
  WorkbenchAsciiConfigController,
  workbenchAsciiRendererModeLabel,
} from "../src/app/workbench_ascii.ts";
import { layoutWorkbenchAsciiConfigModal } from "../src/app/workbench_ascii_modal.ts";

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

  const glyph = stepWorkbenchAsciiGlyphStyle(initial, 1);
  assertEquals(glyph.terminalGlyphStyle, "glyphs");
  assertEquals(glyph.preset, "custom");

  const toggled = toggleWorkbenchAsciiOption(initial, "edges");
  assertEquals(toggled.edges, !initial.edges);
  assertEquals(toggled.preset, "custom");

  const stepped = stepWorkbenchAsciiNumericOption(initial, "wireframeThickness", 1);
  assert(stepped.wireframeThickness >= initial.wireframeThickness);
  assertEquals(stepped.preset, "custom");
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
});

Deno.test("workbench ascii config modal layout centers rows actions and footer", () => {
  const layout = layoutWorkbenchAsciiConfigModal({
    bounds: { column: 0, row: 0, width: 120, height: 40 },
    rowCount: defaultWorkbenchAsciiConfigRows.length,
  });

  assertEquals(layout.rect, { column: 19, row: 8, width: 82, height: 24 });
  assertEquals(layout.inner, { column: 20, row: 9, width: 80, height: 22 });
  assertEquals(layout.rowsTop, 11);
  assertEquals(layout.actionRow, 29);
  assertEquals(layout.footerRow, 30);
  assertEquals(layout.visibleRows, 18);
  assertEquals(layout.shadow, { column: 21, row: 9, width: 82, height: 24 });
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
