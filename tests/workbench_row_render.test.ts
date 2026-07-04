import { assertEquals } from "./deps.ts";
import { workbenchStyledRowsRenderCommandsInto } from "../app/workbench_row_render.ts";
import type { RowStyle } from "../app/workbench_rows.ts";

const theme = { text: "#eee", surface: "#111" };
const fit = (text: string, width: number) => text.slice(0, Math.max(0, width)).padEnd(Math.max(0, width));

Deno.test("workbenchStyledRowsRenderCommandsInto clips rows and applies theme fallbacks", () => {
  const rows: RowStyle[] = [
    { text: "alpha" },
    { text: "beta", fg: "#f00", bg: "#00f", bold: true },
    { text: "gamma" },
  ];

  const commands = workbenchStyledRowsRenderCommandsInto([], {
    rect: { column: 2, row: 3, width: 4, height: 2 },
    rows,
    theme,
    fit,
  });

  assertEquals(commands, [
    { row: 3, column: 2, text: "alph", fg: "#eee", bg: "#111", bold: false },
    { row: 4, column: 2, text: "beta", fg: "#f00", bg: "#00f", bold: true },
  ]);
});

Deno.test("workbenchStyledRowsRenderCommandsInto supports source offsets for scrolled panels", () => {
  const target = [{ row: 99, column: 99, text: "stale", fg: "x", bg: "y", bold: true }];
  const commands = workbenchStyledRowsRenderCommandsInto(target, {
    rect: { column: 0, row: 10, width: 8, height: 3 },
    rows: [{ text: "hidden" }, { text: "visible" }],
    sourceStart: 1,
    theme,
    fit,
  });

  assertEquals(commands, [
    { row: 10, column: 0, text: "visible ", fg: "#eee", bg: "#111", bold: false },
  ]);
  assertEquals(commands, target);
});

Deno.test("workbenchStyledRowsRenderCommandsInto clears target for empty bounds", () => {
  const target = [{ row: 1, column: 1, text: "stale", fg: "x", bg: "y", bold: true }];
  const commands = workbenchStyledRowsRenderCommandsInto(target, {
    rect: { column: 0, row: 0, width: 0, height: 1 },
    rows: [{ text: "hidden" }],
    theme,
    fit,
  });

  assertEquals(commands, []);
  assertEquals(commands, target);
});
