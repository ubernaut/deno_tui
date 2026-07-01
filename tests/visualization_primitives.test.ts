import { assertEquals, assertStringIncludes } from "./deps.ts";
import {
  barChart,
  createMatrix,
  crop,
  drawEllipse,
  drawLine,
  gridify,
  miniMeter,
  plotHistory,
  renderMatrix,
  setCell,
  signalChart,
} from "../app/visualization_primitives.ts";

Deno.test("visualization primitives crop and gridify text cells", () => {
  assertEquals(crop("abcdef", 4), "abc…");
  assertEquals(crop("abc", 4), "abc");
  const grid = gridify(["alpha", "beta", "gamma"], 36);
  assertStringIncludes(grid, "alpha");
  assertStringIncludes(grid, "gamma");
});

Deno.test("visualization primitives render meters and charts", () => {
  assertEquals(miniMeter(0.5, 6, 0.1), "[▒▒▒···]");
  assertStringIncludes(signalChart([0, 0.5, 1], 6, 3, "*"), "*");
  assertStringIncludes(plotHistory([0, 0.5, 1], 6, 3, "*"), "*");
  assertStringIncludes(barChart([0, 0.5, 1], 6, 3, [" ", ".", "#"]), "#");
});

Deno.test("visualization primitives draw bounded matrix shapes", () => {
  const matrix = createMatrix(8, 4, ".");
  setCell(matrix, 1, 1, "A");
  setCell(matrix, -1, 1, "X");
  drawLine(matrix, 0, 0, 7, 3, "/");
  drawEllipse(matrix, 4, 2, 2, 1, "o");

  const rendered = renderMatrix(matrix);
  assertStringIncludes(rendered, "A");
  assertStringIncludes(rendered, "/");
  assertStringIncludes(rendered, "o");
  assertEquals(rendered.split("\n").length, 4);
});
