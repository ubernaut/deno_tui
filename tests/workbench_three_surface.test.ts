import { assertEquals } from "./deps.ts";
import type { WorkbenchFrame } from "../src/app/workbench_frame.ts";
import { WorkbenchThreeGridProjectionCache } from "../src/app/workbench_three_grid.ts";
import { renderWorkbenchThreeSurface } from "../src/app/workbench_three_surface.ts";
import type { RowStyle } from "../src/app/workbench_rows.ts";
import type { Rectangle } from "../src/types.ts";

Deno.test("workbench Three surface writes status rows for empty grids", () => {
  const frame: WorkbenchFrame = [];
  const cache = new WorkbenchThreeGridProjectionCache();
  const writes: Array<{ rect: Rectangle; rows: readonly RowStyle[] }> = [];

  const result = renderWorkbenchThreeSurface({
    frame,
    rect: { column: 0, row: 0, width: 4, height: 2 },
    grid: [],
    fallbackCell: ".",
    projectionCache: cache,
    statusRows: [{ text: "warming" }],
    writeRows: (_frame, rect, rows) => writes.push({ rect, rows }),
  });

  assertEquals(result, { kind: "status" });
  assertEquals(writes, [{ rect: { column: 0, row: 0, width: 4, height: 2 }, rows: [{ text: "warming" }] }]);
});

Deno.test("workbench Three surface renders grids without building lazy status rows", () => {
  const frame: WorkbenchFrame = [];
  const cache = new WorkbenchThreeGridProjectionCache();
  let statusCalls = 0;
  let pressureRows = 0;

  const result = renderWorkbenchThreeSurface({
    frame,
    rect: { column: 0, row: 0, width: 4, height: 2 },
    grid: [["A", "B"], ["C", "D"]],
    fallbackCell: ".",
    projectionCache: cache,
    scale: true,
    statusRows: () => {
      statusCalls += 1;
      return [{ text: "unused" }];
    },
    writeRows: () => {
      throw new Error("status rows should not render for non-empty grids");
    },
    onPressureRows: (rows) => pressureRows = rows,
  });

  assertEquals(result.kind, "grid");
  assertEquals(result.projection?.targetHeight, 2);
  assertEquals(frame, [
    ["A", "A", "B", "B"],
    ["C", "C", "D", "D"],
  ]);
  assertEquals(statusCalls, 0);
  assertEquals(pressureRows, 2);
});

Deno.test("workbench Three surface can suppress pressure accounting", () => {
  const frame: WorkbenchFrame = [];
  let pressureCalls = 0;

  renderWorkbenchThreeSurface({
    frame,
    rect: { column: 0, row: 0, width: 2, height: 1 },
    grid: [["A", "B"]],
    fallbackCell: ".",
    projectionCache: new WorkbenchThreeGridProjectionCache(),
    writeRows: () => {},
    countForPressure: false,
    onPressureRows: () => pressureCalls += 1,
  });

  assertEquals(frame, [["A", "B"]]);
  assertEquals(pressureCalls, 0);
});
