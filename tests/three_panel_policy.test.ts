import { assert, assertEquals } from "./deps.ts";
import { createDefaultAsciiOptions } from "../app/ascii_options.ts";
import { resolveThreePanelRenderPolicy, resolveThreePanelRenderSize } from "../app/three_panel_policy.ts";

Deno.test("resolveThreePanelRenderPolicy selects ASCII-only rendering by default", () => {
  const ascii = createDefaultAsciiOptions("sharp");
  assertEquals(
    resolveThreePanelRenderPolicy({
      ascii,
      graphicsAvailable: true,
      graphicsRectangle: { width: 8, height: 4 },
      rendererSupportsImage: true,
    }),
    {
      kittyActive: false,
      renderAscii: true,
      renderImage: false,
      frameOptions: { ansi: true, image: false },
    },
  );
});

Deno.test("resolveThreePanelRenderPolicy supports dual and kitty-only graphics modes", () => {
  const ascii = createDefaultAsciiOptions("sharp");
  assertEquals(
    resolveThreePanelRenderPolicy({
      ascii: { ...ascii, kittyGraphics: true, kittyDisableAscii: false },
      graphicsAvailable: true,
      graphicsRectangle: { width: 8, height: 4 },
      rendererSupportsImage: true,
    }),
    {
      kittyActive: true,
      renderAscii: true,
      renderImage: true,
      frameOptions: { ansi: true, image: true },
    },
  );

  assertEquals(
    resolveThreePanelRenderPolicy({
      ascii: { ...ascii, kittyGraphics: true, kittyDisableAscii: true },
      graphicsAvailable: true,
      graphicsRectangle: { width: 8, height: 4 },
      rendererSupportsImage: true,
    }),
    {
      kittyActive: true,
      renderAscii: false,
      renderImage: true,
      frameOptions: { ansi: false, image: true },
    },
  );
});

Deno.test("resolveThreePanelRenderPolicy disables kitty graphics without a usable surface", () => {
  const ascii = { ...createDefaultAsciiOptions("sharp"), kittyGraphics: true, kittyDisableAscii: true };
  assertEquals(
    resolveThreePanelRenderPolicy({
      ascii,
      graphicsAvailable: true,
      graphicsRectangle: { width: 0, height: 4 },
      rendererSupportsImage: true,
    }).kittyActive,
    false,
  );
});

Deno.test("resolveThreePanelRenderSize preserves small panes and caps large panes by area", () => {
  assertEquals(resolveThreePanelRenderSize({ width: 80, height: 24 }, 3_840), { columns: 80, rows: 24 });

  const capped = resolveThreePanelRenderSize({ width: 160, height: 60 }, 3_840);
  assert(capped.columns < 160);
  assert(capped.rows < 60);
  assert(capped.columns * capped.rows <= 3_840);
  assert(capped.columns / capped.rows > 160 / 60 - 0.2);
});
