import { assertEquals, assertStrictEquals } from "./deps.ts";
import { createDefaultWorkbenchAsciiOptions } from "../src/app/workbench_ascii.ts";
import { resolveWorkbenchThreeFullscreenAsciiOptions } from "../src/app/workbench_three_fullscreen.ts";

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
