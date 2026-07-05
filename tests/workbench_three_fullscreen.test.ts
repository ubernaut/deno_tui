import { assertEquals, assertStrictEquals } from "./deps.ts";
import { createDefaultWorkbenchAsciiOptions } from "../src/app/workbench_ascii.ts";
import {
  resolveWorkbenchThreeFullscreenAsciiOptions,
  resolveWorkbenchThreeRuntimeBudgetSnapshot,
  sameWorkbenchThreeAsciiOptions,
} from "../src/app/workbench_three_fullscreen.ts";
import { WORKBENCH_THREE_FULLSCREEN_MIN_CELLS } from "../src/app/workbench_three_policy.ts";

Deno.test("resolveWorkbenchThreeFullscreenAsciiOptions leaves non-fullscreen options unchanged", () => {
  const ascii = createDefaultWorkbenchAsciiOptions();
  const resolved = resolveWorkbenchThreeFullscreenAsciiOptions({
    id: "three",
    fullscreenId: "logs",
    ascii,
    fullscreenMinCells: 3_840,
  });

  assertStrictEquals(resolved, ascii);
});

Deno.test("resolveWorkbenchThreeFullscreenAsciiOptions raises only runtime render cells for fullscreen", () => {
  const ascii = createDefaultWorkbenchAsciiOptions();
  const resolved = resolveWorkbenchThreeFullscreenAsciiOptions({
    id: "three",
    fullscreenId: "three",
    ascii,
    fullscreenMinCells: 3_840,
  });

  assertEquals(resolved.renderMaxCells, 3_840);
  assertEquals(ascii.renderMaxCells, 960);
  assertEquals(resolved.terminalGlyphStyle, ascii.terminalGlyphStyle);
});

Deno.test("resolveWorkbenchThreeFullscreenAsciiOptions preserves higher explicit render caps", () => {
  const ascii = { ...createDefaultWorkbenchAsciiOptions(), renderMaxCells: 7_680 };
  const resolved = resolveWorkbenchThreeFullscreenAsciiOptions({
    id: "three",
    fullscreenId: "three",
    ascii,
    fullscreenMinCells: 3_840,
  });

  assertStrictEquals(resolved, ascii);
});

Deno.test("resolveWorkbenchThreeFullscreenAsciiOptions raises to viewport-derived fullscreen caps", () => {
  const ascii = createDefaultWorkbenchAsciiOptions();
  const resolved = resolveWorkbenchThreeFullscreenAsciiOptions({
    id: "three",
    fullscreenId: "three",
    ascii,
    fullscreenMinCells: 6_600,
  });

  assertEquals(resolved.renderMaxCells, 6_600);
  assertEquals(ascii.renderMaxCells, 960);
});

Deno.test("resolveWorkbenchThreeRuntimeBudgetSnapshot projects viewport target cap and runtime ascii", () => {
  const ascii = createDefaultWorkbenchAsciiOptions();
  const snapshot = resolveWorkbenchThreeRuntimeBudgetSnapshot({
    id: "three",
    fullscreenId: "three",
    ascii,
    liveMaxCells: 480,
    fullscreenMaxCells: 1_920,
    viewport: { width: 120, height: 50 },
    fullscreenViewportPadding: { columns: 6, rows: 10 },
  });

  assertEquals(snapshot.fullscreenTargetCells, 4_560);
  assertEquals(snapshot.effectiveMaxCells, 1_920);
  assertEquals(snapshot.runtimeAscii.renderMaxCells, 4_560);
  assertEquals(ascii.renderMaxCells, 960);
});

Deno.test("resolveWorkbenchThreeRuntimeBudgetSnapshot keeps live cap outside fullscreen Three panes", () => {
  const ascii = createDefaultWorkbenchAsciiOptions();
  const snapshot = resolveWorkbenchThreeRuntimeBudgetSnapshot({
    id: "three",
    fullscreenId: "logs",
    ascii,
    liveMaxCells: 480,
    fullscreenMaxCells: 1_920,
    viewport: { width: 20, height: 10 },
    isThreeWindow: (id) => id === "three",
  });

  assertEquals(snapshot.fullscreenTargetCells, WORKBENCH_THREE_FULLSCREEN_MIN_CELLS);
  assertEquals(snapshot.effectiveMaxCells, 480);
  assertStrictEquals(snapshot.runtimeAscii, ascii);
});

Deno.test("sameWorkbenchThreeAsciiOptions compares every runtime option", () => {
  const base = createDefaultWorkbenchAsciiOptions();

  assertEquals(sameWorkbenchThreeAsciiOptions(base, { ...base }), true);
  assertEquals(sameWorkbenchThreeAsciiOptions(base, { ...base, renderMaxCells: base.renderMaxCells + 1 }), false);
  assertEquals(sameWorkbenchThreeAsciiOptions(base, { ...base, kittyGraphics: !base.kittyGraphics }), false);
  assertEquals(sameWorkbenchThreeAsciiOptions(base, { ...base, terminalGlyphStyle: "glyphs" }), false);
});
