import { assertEquals } from "./deps.ts";
import {
  buttonText,
  centerCellText,
  contrastText,
  fillFrameRect,
  fillFrameRow,
  fitCellText,
  parseHexColor,
  prepareWorkbenchFrame,
  prepareWorkbenchRows,
  renderFrameRow,
  renderFrameSlice,
  toStyledCells,
  type WorkbenchFrame,
  writeFrame,
  writeStringFrameRow,
} from "../src/app/workbench_frame.ts";

Deno.test("workbench frame helpers preserve ANSI styling per terminal cell", () => {
  assertEquals(toStyledCells("\x1b[31mAB\x1b[0m C"), [
    "\x1b[31mA\x1b[0m",
    "\x1b[31mB\x1b[0m",
    " ",
    "C",
  ]);

  const frame: WorkbenchFrame = [[], []];
  writeFrame(frame, 5, 0, 1, "\x1b[31mAB\x1b[0m");
  assertEquals(renderFrameRow(frame[0]!, 5), " \x1b[31mA\x1b[0m\x1b[31mB\x1b[0m  ");
  assertEquals(renderFrameSlice(frame[0]!, 1, 2), "\x1b[31mA\x1b[0m\x1b[31mB\x1b[0m");
});

Deno.test("workbench frame writes clip negative columns without sparse negative keys", () => {
  const frame: WorkbenchFrame = [[]];
  writeFrame(frame, 3, 0, -2, "\x1b[32mABCDE\x1b[0m");

  assertEquals(renderFrameRow(frame[0]!, 3), "\x1b[32mC\x1b[0m\x1b[32mD\x1b[0m\x1b[32mE\x1b[0m");
  assertEquals(Object.hasOwn(frame[0]!, "-1"), false);
});

Deno.test("workbench frame writes ANSI strings into string-backed rows", () => {
  const frame = ["....."];
  writeStringFrameRow(frame, 5, 0, 1, "\x1b[31mAB\x1b[0m");
  assertEquals(frame[0], ".\x1b[31mA\x1b[0m\x1b[31mB\x1b[0m..");

  writeStringFrameRow(frame, 5, 0, -1, "\x1b[32mXY\x1b[0m");
  assertEquals(frame[0], "\x1b[32mY\x1b[0m\x1b[31mA\x1b[0m\x1b[31mB\x1b[0m..");
});

Deno.test("workbench frame row preparation reuses arrays and clears retained sparse rows", () => {
  const rows: WorkbenchFrame = [["x"], ["y"], ["z"]];
  const originalFirstRow = rows[0];
  const prepared = prepareWorkbenchFrame(rows, 2);

  assertEquals(prepared, [[], []]);
  assertEquals(prepared === rows, true);
  assertEquals(prepared[0] === originalFirstRow, true);

  const textRows = ["old"];
  const expanded = prepareWorkbenchRows(
    textRows,
    3,
    (index) => `new-${index}`,
    (row, index) => index === 0 ? row.toUpperCase() : row,
  );
  assertEquals(expanded === textRows, true);
  assertEquals(expanded, ["OLD", "new-1", "new-2"]);
});

Deno.test("workbench frame fill helpers clip to the configured width", () => {
  const frame: WorkbenchFrame = [[], [], []];
  let styleCalls = 0;
  const style = (text: string) => {
    styleCalls += 1;
    return text.replaceAll(" ", ".");
  };

  fillFrameRow(frame, 4, 0, style);
  fillFrameRect(frame, 4, { column: 2, row: 1, width: 4, height: 2 }, style);

  assertEquals(renderFrameRow(frame[0]!, 4), "....");
  assertEquals(renderFrameRow(frame[1]!, 4), "  ..");
  assertEquals(renderFrameRow(frame[2]!, 4), "  ..");
  assertEquals(styleCalls, 2);
});

Deno.test("workbench frame text helpers fit center and format buttons", () => {
  assertEquals(fitCellText("abc", 5), "abc  ");
  assertEquals(fitCellText("abcdef", 4), "abc…");
  assertEquals(centerCellText("hi", 6), "hi    ");
  assertEquals(buttonText(" Run "), "[ Run ]");
  assertEquals(buttonText("x", { compact: true }), "[x]");
});

Deno.test("workbench frame color helpers parse hex and choose contrast text", () => {
  assertEquals(parseHexColor("#0a141e"), [10, 20, 30]);
  assertEquals(parseHexColor("bad"), undefined);
  assertEquals(contrastText("#000000", "#000000", "#ffffff"), "#ffffff");
  assertEquals(contrastText("#ffffff", "#000000", "#ffffff"), "#000000");
});
