import { assertEquals } from "./deps.ts";
import { writeWorkbenchThreeGrid } from "../app/workbench_three_grid.ts";
import type { WorkbenchFrame } from "../src/app/workbench_frame.ts";

Deno.test("workbench three grid writes ANSI cells into a frame rectangle", () => {
  const frame: WorkbenchFrame = [];
  writeWorkbenchThreeGrid(
    frame,
    { column: 2, row: 1, width: 3, height: 2 },
    [["A", "B", "C"], ["D", "E", "F"]],
    ".",
  );

  assertEquals(frame[0], undefined);
  assertEquals(frame[1]?.[0], undefined);
  assertEquals(frame[1]?.[1], undefined);
  assertEquals(frame[1]?.slice(2, 5), ["A", "B", "C"]);
  assertEquals(frame[2]?.[0], undefined);
  assertEquals(frame[2]?.[1], undefined);
  assertEquals(frame[2]?.slice(2, 5), ["D", "E", "F"]);
});

Deno.test("workbench three grid uses caller-provided fallback cells", () => {
  const frame: WorkbenchFrame = [];
  writeWorkbenchThreeGrid(
    frame,
    { column: 0, row: 0, width: 4, height: 2 },
    [["A"], undefined],
    "\x1b[48;2;1;2;3m \x1b[0m",
  );

  assertEquals(frame[0], ["A", "\x1b[48;2;1;2;3m \x1b[0m", "\x1b[48;2;1;2;3m \x1b[0m", "\x1b[48;2;1;2;3m \x1b[0m"]);
  assertEquals(frame[1], [
    "\x1b[48;2;1;2;3m \x1b[0m",
    "\x1b[48;2;1;2;3m \x1b[0m",
    "\x1b[48;2;1;2;3m \x1b[0m",
    "\x1b[48;2;1;2;3m \x1b[0m",
  ]);
});

Deno.test("workbench three grid ignores empty rectangles", () => {
  const frame: WorkbenchFrame = [["keep"]];
  writeWorkbenchThreeGrid(frame, { column: 0, row: 0, width: 0, height: 2 }, [["A"]], ".");
  writeWorkbenchThreeGrid(frame, { column: 0, row: 0, width: 2, height: 0 }, [["B"]], ".");

  assertEquals(frame, [["keep"]]);
});
