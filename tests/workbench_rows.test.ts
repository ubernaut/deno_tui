// Copyright 2023 Im-Beast. MIT license.
import { assertEquals } from "./deps.ts";
import { dataFooterRows, threeHeaderRows, type WorkbenchRowTheme } from "../app/workbench_rows.ts";

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
