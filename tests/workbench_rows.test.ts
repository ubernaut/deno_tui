// Copyright 2023 Im-Beast. MIT license.
import { assertEquals } from "./deps.ts";
import { dataFooterRows, threeHeaderRows, type WorkbenchRowTheme } from "../src/app/workbench_rows.ts";

const theme: WorkbenchRowTheme = {
  buttonActiveText: "#101010",
  buttonActiveBg: "#aaff00",
  muted: "#888888",
  panelSoft: "#202020",
  soft: "#999999",
  surface: "#000000",
};

Deno.test("threeHeaderRows adapts title and geometry labels to width", () => {
  assertEquals(threeHeaderRows("studio", 80, theme), [
    { text: " ACEROLA THREE.JS ASCII · studio · STUDIO GEOMETRY ", fg: "#101010", bg: "#aaff00", bold: true },
    { text: "torus knot · sphere · block · floor plane", fg: "#999999", bg: "#000000" },
    { text: "", bg: "#000000" },
  ]);
  assertEquals(threeHeaderRows("studio", 16, theme)[0]?.text, " THREE ASCII · studio ");
  assertEquals(threeHeaderRows("studio", 16, theme)[1]?.text, "torus · sphere · block · floor");
});

Deno.test("threeHeaderRows includes compact renderer telemetry when it fits", () => {
  const rows = threeHeaderRows("BLOCKS", 150, theme, {
    totalMs: 17.4,
    sceneMs: 12.2,
    readbackMs: 4.1,
    assemblyMs: 1.3,
    cells: 1920,
    deferredReadbackSlots: 6,
    deferredReadbackUnresolved: 2,
    sourceMaxCells: 3840,
    targetFps: 14.2,
    measuredFps: 11.8,
    pressureCells: 60,
    pressureHighFrames: 0,
    pressureLowFrames: 12,
    pressureByteRate: 12_581,
    pressureScoped: true,
  });
  assertEquals(
    rows[1]?.text,
    "torus knot · sphere · block · floor plane · frame 17ms scene 12 read 4 asm 1 1920c cap 3840c @14fps live 12fps q2/6 io 13KB/s tier 60c h0/l12",
  );
  assertEquals(
    threeHeaderRows("BLOCKS", 132, theme, {
      totalMs: 612.4,
      initMs: 590.2,
      sceneMs: 604.3,
      readbackMs: 4.1,
      assemblyMs: 1.3,
      cells: 240,
    })[1]?.text,
    "torus knot · sphere · block · floor plane · frame 612ms init 590 scene 604 read 4 asm 1 240c",
  );
  assertEquals(
    threeHeaderRows("BLOCKS", 30, theme, {
      totalMs: 17.4,
      sceneMs: 12.2,
      readbackMs: 4.1,
      assemblyMs: 1.3,
      cells: 1920,
      deferredReadbackSlots: 6,
      deferredReadbackUnresolved: 6,
      deferredReadbackSaturated: true,
      targetFps: 18,
      measuredFps: 9.7,
      pressureCells: 30,
      pressureHighFrames: 1,
      pressureLowFrames: 0,
      pressureScoped: false,
    })[1]?.text,
    "17ms 1920c live 10fps",
  );
});

Deno.test("dataFooterRows returns styled footer rows and wraps narrow widths", () => {
  assertEquals(dataFooterRows({ page: 1, pageCount: 3, selectedKey: "cpu", width: 80, theme, fit: crop }), [
    {
      text: "page 1/3 selected cpu arrows/page keys S sort",
      fg: "#888888",
      bg: "#202020",
    },
  ]);

  const rows = dataFooterRows({ page: 1, pageCount: 3, selectedKey: "cpu", width: 14, theme, fit: crop });
  assertEquals(rows.every((row) => row.fg === "#888888" && row.bg === "#202020"), true);
  assertEquals(rows.length > 1, true);
});

function crop(text: string, width: number): string {
  return text.slice(0, Math.max(0, width));
}
