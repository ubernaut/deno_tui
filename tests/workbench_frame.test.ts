import { assertEquals } from "./deps.ts";
import {
  buttonText,
  centerCellText,
  contrastText,
  fillFrameRect,
  fillFrameRow,
  fitCellText,
  parseHexColor,
  renderFrameRow,
  renderFrameSlice,
  toStyledCells,
  type WorkbenchFrame,
  writeFrame,
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

Deno.test("workbench frame fill helpers clip to the configured width", () => {
  const frame: WorkbenchFrame = [[], [], []];
  const style = (text: string) => text.replaceAll(" ", ".");

  fillFrameRow(frame, 4, 0, style);
  fillFrameRect(frame, 4, { column: 2, row: 1, width: 4, height: 2 }, style);

  assertEquals(renderFrameRow(frame[0]!, 4), "....");
  assertEquals(renderFrameRow(frame[1]!, 4), "  ..");
  assertEquals(renderFrameRow(frame[2]!, 4), "  ..");
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
