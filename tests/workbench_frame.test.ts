import { assertEquals } from "./deps.ts";
import {
  blitWorkbenchFrameCells,
  buttonText,
  centerCellText,
  contrastText,
  fillFrameRect,
  fillFrameRow,
  fillStringFrameRect,
  fitCellText,
  parseHexColor,
  prepareWorkbenchFrame,
  prepareWorkbenchRows,
  renderFrameRow,
  renderFrameSlice,
  toStyledCells,
  updateWorkbenchLineSignals,
  updateWorkbenchStringLineSignals,
  type WorkbenchFrame,
  type WorkbenchFrameBoxLine,
  workbenchFrameBoxLinesInto,
  writeFrame,
  writeFrameCells,
  writeFrameCellsUnchecked,
  writeStringFrameRow,
} from "../src/app/workbench_frame.ts";
import {
  type WorkbenchFrameRenderCommand,
  workbenchFrameRenderCommandsInto,
} from "../src/app/workbench_frame_render.ts";
import {
  createWorkbenchTitlebarLayout,
  layoutWorkbenchTitlebar,
  layoutWorkbenchTitlebarInto,
  workbenchTitlebarButtonRenderCommandsInto,
} from "../src/app/workbench_titlebar.ts";

const frameRenderTheme = {
  background: "#000",
  panel: "#111",
  panelSoft: "#222",
  border: "#333",
  borderStrong: "#444",
  accent: "#0f0",
};

Deno.test("workbench frame helpers preserve ANSI styling per terminal cell", () => {
  assertEquals(toStyledCells("\x1b[31mAB\x1b[0m C"), [
    "\x1b[31mA\x1b[0m",
    "\x1b[31mB\x1b[0m",
    " ",
    "C",
  ]);

  const frame: WorkbenchFrame = [[], []];
  writeFrame(frame, 5, 0, 1, "\x1b[31mAB\x1b[0m");
  assertEquals(renderFrameRow(frame[0]!, 5), " \x1b[31mAB\x1b[0m  ");
  assertEquals(renderFrameSlice(frame[0]!, 1, 2), "\x1b[31mAB\x1b[0m");
});

Deno.test("workbenchFrameRenderCommandsInto projects active frame fill border and title styles", () => {
  const lines: WorkbenchFrameBoxLine[] = [];
  const commands = workbenchFrameRenderCommandsInto([], lines, {
    rect: { column: 1, row: 2, width: 8, height: 4 },
    title: "Panel",
    active: true,
    theme: frameRenderTheme,
  });

  assertEquals(commands[0], {
    kind: "fill",
    rect: { column: 1, row: 2, width: 8, height: 4 },
    bg: "#222",
  });
  assertEquals(commands[1], {
    kind: "text",
    row: 2,
    column: 1,
    text: "┌──────┐",
    style: { fg: "#0f0", bg: "#222", bold: true },
    lineKind: "border",
  });
  assertEquals(commands.find((command) => command.kind === "text" && command.lineKind === "title"), {
    kind: "text",
    row: 2,
    column: 3,
    text: " PANEL ",
    style: { fg: "#000", bg: "#0f0", bold: true },
    lineKind: "title",
  });
});

Deno.test("workbenchFrameRenderCommandsInto projects inactive frame colors and reuses buffers", () => {
  const lines: WorkbenchFrameBoxLine[] = [];
  const target: WorkbenchFrameRenderCommand[] = [];
  const first = workbenchFrameRenderCommandsInto(target, lines, {
    rect: { column: 0, row: 0, width: 6, height: 3 },
    title: "A",
    active: true,
    theme: frameRenderTheme,
  });
  const fill = first[0];
  const text = first[1];

  const second = workbenchFrameRenderCommandsInto(target, lines, {
    rect: { column: 2, row: 1, width: 6, height: 3 },
    title: "B",
    active: false,
    theme: frameRenderTheme,
  });

  assertEquals(second === target, true);
  assertEquals(second[0] === fill, true);
  assertEquals(second[1] === text, true);
  assertEquals(second[0], {
    kind: "fill",
    rect: { column: 2, row: 1, width: 6, height: 3 },
    bg: "#111",
  });
  assertEquals(second[1], {
    kind: "text",
    row: 1,
    column: 2,
    text: "┌────┐",
    style: { fg: "#444", bg: "#111", bold: false },
    lineKind: "border",
  });
});

Deno.test("workbenchFrameRenderCommandsInto clears target for empty bounds", () => {
  const target: WorkbenchFrameRenderCommand[] = [{
    kind: "fill",
    rect: { column: 0, row: 0, width: 1, height: 1 },
    bg: "stale",
  }];

  const commands = workbenchFrameRenderCommandsInto(target, [], {
    rect: { column: 0, row: 0, width: 0, height: 3 },
    title: "Hidden",
    active: false,
    theme: frameRenderTheme,
  });

  assertEquals(commands, []);
  assertEquals(commands === target, true);
});

Deno.test("workbench frame row assembly fast paths empty and out-of-range rows", () => {
  assertEquals(renderFrameRow([], 5), "     ");
  assertEquals(renderFrameRow([], 0), "");
  assertEquals(renderFrameSlice(["A", "B"], 2, 4), "    ");
  assertEquals(renderFrameSlice(["A", "B"], -1, 3), " AB");
});

Deno.test("workbench frame row assembly compresses adjacent truecolor background cells", () => {
  const frame: WorkbenchFrame = [[
    "\x1b[48;2;10;20;30m \x1b[0m",
    "\x1b[48;2;11;21;31m \x1b[0m",
    "\x1b[48;2;11;21;31m \x1b[0m",
  ]];

  assertEquals(
    renderFrameRow(frame[0]!, 3),
    "\x1b[48;2;10;20;30m \x1b[48;2;11;21;31m  \x1b[0m",
  );
});

Deno.test("workbench frame row assembly keeps block-mode truecolor cells compact", () => {
  const frame: WorkbenchFrame = [[
    "\x1b[48;2;1;2;3m \x1b[0m",
    "\x1b[48;2;1;2;3m \x1b[0m",
    "\x1b[48;2;4;5;6m \x1b[0m",
    "\x1b[48;2;4;5;6m \x1b[0m",
  ]];

  assertEquals(renderFrameRow(frame[0]!, 4), "\x1b[48;2;1;2;3m  \x1b[48;2;4;5;6m  \x1b[0m");
});

Deno.test("workbench frame row assembly compresses background cells with shared style and different text", () => {
  const frame: WorkbenchFrame = [[]];
  writeFrame(frame, 5, 0, 0, "\x1b[1;38;2;9;4;15;48;2;156;255;79m API \x1b[0m");

  assertEquals(
    renderFrameRow(frame[0]!, 5),
    "\x1b[1;38;2;9;4;15;48;2;156;255;79m API \x1b[0m",
  );
});

Deno.test("workbench frame helpers keep repeated SGR background cells compact", () => {
  const cells = toStyledCells(
    "\x1b[38;2;9;8;7mX\x1b[48;2;1;2;3m \x1b[48;2;4;5;6m \x1b[48;2;7;8;9m ",
  );

  assertEquals(cells, [
    "\x1b[38;2;9;8;7mX\x1b[0m",
    "\x1b[38;2;9;8;7;48;2;1;2;3m \x1b[0m",
    "\x1b[38;2;9;8;7;48;2;4;5;6m \x1b[0m",
    "\x1b[38;2;9;8;7;48;2;7;8;9m \x1b[0m",
  ]);

  const frame: WorkbenchFrame = [[]];
  writeFrame(frame, 4, 0, 0, cells.join(""));
  assertEquals(
    renderFrameRow(frame[0]!, 4),
    "\x1b[38;2;9;8;7mX\x1b[0m\x1b[38;2;9;8;7;48;2;1;2;3m \x1b[38;2;9;8;7;48;2;4;5;6m \x1b[38;2;9;8;7;48;2;7;8;9m \x1b[0m",
  );
});

Deno.test("workbench frame writes single-style ANSI rows through the fast path", () => {
  const frame: WorkbenchFrame = [[]];
  writeFrame(frame, 5, 0, 0, "\x1b[1;38;2;9;4;15;48;2;156;255;79m API \x1b[0m");

  assertEquals(frame[0], [
    "\x1b[1;38;2;9;4;15;48;2;156;255;79m \x1b[0m",
    "\x1b[1;38;2;9;4;15;48;2;156;255;79mA\x1b[0m",
    "\x1b[1;38;2;9;4;15;48;2;156;255;79mP\x1b[0m",
    "\x1b[1;38;2;9;4;15;48;2;156;255;79mI\x1b[0m",
    "\x1b[1;38;2;9;4;15;48;2;156;255;79m \x1b[0m",
  ]);
  assertEquals(
    renderFrameRow(frame[0]!, 5),
    "\x1b[1;38;2;9;4;15;48;2;156;255;79m API \x1b[0m",
  );
});

Deno.test("workbench frame reuses full-row single-style render hints safely", () => {
  const frame: WorkbenchFrame = [[]];
  writeFrame(frame, 4, 0, -1, "\x1b[32mABCDE\x1b[0m");

  assertEquals(renderFrameRow(frame[0]!, 4), "\x1b[32mBCDE\x1b[0m");
  assertEquals(renderFrameRow(frame[0]!, 3), "\x1b[32mBCD\x1b[0m");

  prepareWorkbenchFrame(frame, 1);
  writeFrame(frame, 4, 0, 0, "\x1b[35mWXYZ\x1b[0m");

  assertEquals(renderFrameRow(frame[0]!, 4), "\x1b[35mWXYZ\x1b[0m");
});

Deno.test("workbench frame keeps mixed ANSI sequences on the general parser", () => {
  const frame: WorkbenchFrame = [[]];
  writeFrame(frame, 3, 0, 0, "\x1b[31mA\x1b[32mB\x1b[0m");

  assertEquals(frame[0], ["\x1b[31mA\x1b[0m", "\x1b[32mB\x1b[0m"]);
});

Deno.test("workbench frame row assembly resets before foreground-only cells after backgrounds", () => {
  const frame: WorkbenchFrame = [[
    "\x1b[48;2;10;20;30m \x1b[0m",
    "\x1b[31mX\x1b[0m",
  ]];

  assertEquals(
    renderFrameRow(frame[0]!, 2),
    "\x1b[48;2;10;20;30m \x1b[0m\x1b[31mX\x1b[0m",
  );
});

Deno.test("workbench frame writes clip negative columns without sparse negative keys", () => {
  const frame: WorkbenchFrame = [[]];
  writeFrame(frame, 3, 0, -2, "\x1b[32mABCDE\x1b[0m");

  assertEquals(renderFrameRow(frame[0]!, 3), "\x1b[32mCDE\x1b[0m");
  assertEquals(Object.hasOwn(frame[0]!, "-1"), false);
});

Deno.test("workbench frame span writes clip negative columns without sparse negative keys", () => {
  const row: string[] = [];
  writeFrameCells(row, -2, ["A", "B", "C", "D"], 0, 4);

  assertEquals(row.slice(0, 2), ["C", "D"]);
  assertEquals(Object.hasOwn(row, "-1"), false);
});

Deno.test("workbench frame unchecked span writes caller-clipped cells", () => {
  const row = ["x"];
  writeFrameCellsUnchecked(row, 1, ["A", "B", "C"], 2);

  assertEquals(row, ["x", "A", "B"]);
});

Deno.test("workbench frame unchecked full-row writes can provide rendered hints", () => {
  const row: string[] = [];
  writeFrameCellsUnchecked(row, 0, ["A", "B"], 2, "cached");

  assertEquals(renderFrameRow(row, 2), "cached");

  writeFrameCellsUnchecked(row, 1, ["C"], 1);
  assertEquals(renderFrameRow(row, 2), "AC");
});

Deno.test("workbench frame unchecked partial-row hints are ignored", () => {
  const row = ["x"];
  writeFrameCellsUnchecked(row, 1, ["A", "B"], 2, "wrong");

  assertEquals(renderFrameRow(row, 3), "xAB");
});

Deno.test("workbench frame writes ANSI strings into string-backed rows", () => {
  const frame = ["....."];
  writeStringFrameRow(frame, 5, 0, 1, "\x1b[31mAB\x1b[0m");
  assertEquals(frame[0], ".\x1b[31mAB\x1b[0m..");

  writeStringFrameRow(frame, 5, 0, -1, "\x1b[32mXY\x1b[0m");
  assertEquals(frame[0], "\x1b[32mY\x1b[0m\x1b[31mAB\x1b[0m..");

  writeStringFrameRow(frame, 5, 0, 0, "\x1b[35m12345\x1b[0m");
  assertEquals(frame[0], "\x1b[35m12345\x1b[0m");

  writeStringFrameRow(frame, 5, 0, -2, "\x1b[36mabcdefg\x1b[0m");
  assertEquals(frame[0], "\x1b[36mcdefg\x1b[0m");

  writeStringFrameRow(frame, 5, 0, 0, "\x1b[48;2;1;2;3m\x1b[38;2;4;5;6mVWXYZ\x1b[0m");
  assertEquals(frame[0], "\x1b[38;2;4;5;6;48;2;1;2;3mVWXYZ\x1b[0m");

  const rectFrame = [".....", ".....", "....."];
  fillStringFrameRect(rectFrame, 5, { column: 1, row: 1, width: 3, height: 2 }, "\x1b[34m...\x1b[0m");
  assertEquals(rectFrame[0], ".....");
  assertEquals(rectFrame[1], ".\x1b[34m...\x1b[0m.");
  assertEquals(rectFrame[2], ".\x1b[34m...\x1b[0m.");
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

Deno.test("workbench frame cell blit preserves styled cells through viewport offsets", () => {
  const target: WorkbenchFrame = [[], [], []];
  const source: WorkbenchFrame = [
    ["skip"],
    ["A", "\x1b[48;2;1;2;3m \x1b[0m", "\x1b[31mB\x1b[0m", "C"],
    ["D", "E", "F", "G"],
  ];

  blitWorkbenchFrameCells(
    target,
    source,
    { column: 2, row: 1, width: 2, height: 2 },
    { columns: 1, rows: 1 },
  );

  assertEquals(target[0], []);
  assertEquals(Object.hasOwn(target[1]!, 0), false);
  assertEquals(Object.hasOwn(target[1]!, 1), false);
  assertEquals(target[1]?.slice(2, 4), ["\x1b[48;2;1;2;3m \x1b[0m", "\x1b[31mB\x1b[0m"]);
  assertEquals(Object.hasOwn(target[2]!, 0), false);
  assertEquals(Object.hasOwn(target[2]!, 1), false);
  assertEquals(target[2]?.slice(2, 4), ["E", "F"]);
});

Deno.test("workbench frame cell blit keeps clipped fallback for negative target columns", () => {
  const target: WorkbenchFrame = [[], []];
  const source: WorkbenchFrame = [
    ["A", "B", "C"],
    ["\x1b[31mD\x1b[0m", "E", "F"],
  ];

  blitWorkbenchFrameCells(
    target,
    source,
    { column: -1, row: 0, width: 3, height: 2 },
    { columns: 0, rows: 0 },
  );

  assertEquals(target[0]?.slice(0, 2), ["B", "C"]);
  assertEquals(target[1]?.slice(0, 2), ["E", "F"]);
  assertEquals(Object.hasOwn(target[0]!, -1), false);
  assertEquals(Object.hasOwn(target[1]!, -1), false);
});

Deno.test("workbench frame line signal updates skip unchanged rows and clear stale rows", () => {
  const frame: WorkbenchFrame = [[], []];
  writeFrame(frame, 5, 0, 0, "hello");
  writeFrame(frame, 5, 1, 0, "\x1b[31mAB\x1b[0m");
  const signals = [
    new FakeLineSignal("hello"),
    new FakeLineSignal(""),
    new FakeLineSignal("stale"),
  ];

  assertEquals(updateWorkbenchLineSignals(signals, frame, 5, 2), { rows: 2, changed: 1, cleared: 1 });
  assertEquals(signals.map((signal) => signal.peek()), ["hello", "\x1b[31mAB\x1b[0m   ", ""]);
  assertEquals(signals.map((signal) => signal.writes), [0, 1, 1]);

  assertEquals(updateWorkbenchLineSignals(signals, frame, 5, 2), { rows: 2, changed: 0, cleared: 0 });
  assertEquals(signals.map((signal) => signal.writes), [0, 1, 1]);
});

Deno.test("workbench frame line signal cache restores externally changed retained rows", () => {
  const frame: WorkbenchFrame = [[]];
  writeFrame(frame, 5, 0, 0, "\x1b[32mAB\x1b[0m");
  const signal = new FakeLineSignal("");

  assertEquals(updateWorkbenchLineSignals([signal], frame, 5, 1), { rows: 1, changed: 1, cleared: 0 });
  assertEquals(signal.peek(), "\x1b[32mAB\x1b[0m   ");

  signal.force("external");
  assertEquals(updateWorkbenchLineSignals([signal], frame, 5, 1), { rows: 1, changed: 1, cleared: 0 });
  assertEquals(signal.peek(), "\x1b[32mAB\x1b[0m   ");
  assertEquals(signal.writes, 2);
});

Deno.test("workbench frame line signal cache scans rows directly mutated after prepare", () => {
  const frame: WorkbenchFrame = [[]];
  prepareWorkbenchFrame(frame, 1);
  frame[0]![0] = "A";
  const signal = new FakeLineSignal("");

  assertEquals(updateWorkbenchLineSignals([signal], frame, 3, 1), { rows: 1, changed: 1, cleared: 0 });
  assertEquals(signal.peek(), "A  ");
});

Deno.test("workbench string frame line signal updates skip unchanged fitted rows and clear stale rows", () => {
  const frame = ["hello", "\x1b[31mAB\x1b[0m"];
  const signals = [
    new FakeLineSignal("hello"),
    new FakeLineSignal(""),
    new FakeLineSignal("stale"),
  ];

  assertEquals(updateWorkbenchStringLineSignals(signals, frame, 5, 2), { rows: 2, changed: 1, cleared: 1 });
  assertEquals(signals.map((signal) => signal.peek()), ["hello", "\x1b[31mAB\x1b[0m   ", ""]);
  assertEquals(signals.map((signal) => signal.writes), [0, 1, 1]);

  assertEquals(updateWorkbenchStringLineSignals(signals, frame, 5, 2), { rows: 2, changed: 0, cleared: 0 });
  assertEquals(signals.map((signal) => signal.writes), [0, 1, 1]);
});

Deno.test("workbench string frame line signal cache restores externally changed retained rows", () => {
  const signal = new FakeLineSignal("");
  const frame = ["\x1b[32mAB\x1b[0m"];

  assertEquals(updateWorkbenchStringLineSignals([signal], frame, 5, 1), { rows: 1, changed: 1, cleared: 0 });
  assertEquals(signal.peek(), "\x1b[32mAB\x1b[0m   ");

  signal.force("external");
  assertEquals(updateWorkbenchStringLineSignals([signal], frame, 5, 1), { rows: 1, changed: 1, cleared: 0 });
  assertEquals(signal.peek(), "\x1b[32mAB\x1b[0m   ");
  assertEquals(signal.writes, 2);
});

Deno.test("workbench string frame line signal cache updates when raw row changes", () => {
  const signal = new FakeLineSignal("");
  const frame = ["alpha"];

  assertEquals(updateWorkbenchStringLineSignals([signal], frame, 5, 1), { rows: 1, changed: 1, cleared: 0 });
  frame[0] = "bravo";

  assertEquals(updateWorkbenchStringLineSignals([signal], frame, 5, 1), { rows: 1, changed: 1, cleared: 0 });
  assertEquals(signal.peek(), "bravo");
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

Deno.test("workbench frame box projection reuses storage and emits border and title lines", () => {
  const target = [{ kind: "border" as const, row: 99, column: 99, text: "stale" }];
  const lines = workbenchFrameBoxLinesInto(target, { column: 2, row: 3, width: 6, height: 4 }, "Logs");

  assertEquals(lines === target, true);
  assertEquals(lines, [
    { kind: "border", row: 3, column: 2, text: "┌────┐" },
    { kind: "border", row: 4, column: 2, text: "│" },
    { kind: "border", row: 4, column: 7, text: "│" },
    { kind: "border", row: 5, column: 2, text: "│" },
    { kind: "border", row: 5, column: 7, text: "│" },
    { kind: "border", row: 6, column: 2, text: "└────┘" },
    { kind: "title", row: 3, column: 4, text: " LOGS " },
  ]);
  assertEquals(workbenchFrameBoxLinesInto(target, { column: 0, row: 0, width: 0, height: 4 }, "x"), []);
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

Deno.test("workbench titlebar layout anchors window controls inside the right border", () => {
  const layout = layoutWorkbenchTitlebar({
    rect: { column: 2, row: 4, width: 48, height: 8 },
    title: "Data Table",
  });

  assertEquals(layout.hasWindowControls, true);
  assertEquals(layout.buttons.map((button) => [button.kind, button.label, button.rect]), [
    ["minimize", "-", { column: 34, row: 4, width: 3, height: 1 }],
    ["maximize", "M", { column: 38, row: 4, width: 3, height: 1 }],
    ["restore", "R", { column: 42, row: 4, width: 3, height: 1 }],
    ["close", "x", { column: 46, row: 4, width: 3, height: 1 }],
  ]);
});

Deno.test("workbench titlebar layout hides controls when the window is too narrow", () => {
  const layout = layoutWorkbenchTitlebar({
    rect: { column: 0, row: 0, width: 15, height: 5 },
    title: "Tiny",
  });

  assertEquals(layout.hasWindowControls, false);
  assertEquals(layout.buttons, []);
});

Deno.test("workbench titlebar layout keeps compact controls in tight panes", () => {
  const layout = layoutWorkbenchTitlebar({
    rect: { column: 0, row: 0, width: 18, height: 5 },
    title: "Three",
  });

  assertEquals(layout.hasWindowControls, true);
  assertEquals(layout.buttons.map((button) => [button.kind, button.rect]), [
    ["minimize", { column: 2, row: 0, width: 3, height: 1 }],
    ["maximize", { column: 6, row: 0, width: 3, height: 1 }],
    ["restore", { column: 10, row: 0, width: 3, height: 1 }],
    ["close", { column: 14, row: 0, width: 3, height: 1 }],
  ]);
});

Deno.test("workbench titlebar layout only adds config when it fits between title and controls", () => {
  const wide = layoutWorkbenchTitlebar({
    rect: { column: 0, row: 0, width: 64, height: 8 },
    title: "Three",
    showConfig: true,
  });
  const narrow = layoutWorkbenchTitlebar({
    rect: { column: 0, row: 0, width: 30, height: 8 },
    title: "Long Three Renderer",
    showConfig: true,
  });

  assertEquals(wide.buttons.find((button) => button.kind === "config")?.rect, {
    column: 37,
    row: 0,
    width: 10,
    height: 1,
  });
  assertEquals(narrow.buttons.some((button) => button.kind === "config"), false);
});

Deno.test("workbench titlebar layout can reuse caller-owned button geometry", () => {
  const target = createWorkbenchTitlebarLayout();
  const first = layoutWorkbenchTitlebarInto(target, {
    rect: { column: 0, row: 0, width: 64, height: 8 },
    title: "Three",
    showConfig: true,
  });
  const config = first.buttons[0];

  const second = layoutWorkbenchTitlebarInto(target, {
    rect: { column: 4, row: 3, width: 48, height: 8 },
    title: "Data",
    showConfig: false,
  });

  assertEquals(second === target, true);
  assertEquals(second.buttons.length, 4);
  assertEquals(second.buttons[0] === config, true);
  assertEquals(second.buttons.some((button) => button.kind === "config"), false);
  assertEquals(second.buttons[0].rect, { column: 36, row: 3, width: 3, height: 1 });
  assertEquals(second.buttons[3].rect, { column: 48, row: 3, width: 3, height: 1 });
});

Deno.test("workbench titlebar render commands expose clipped text and hit rectangles", () => {
  const layout = layoutWorkbenchTitlebar({
    rect: { column: 0, row: 2, width: 64, height: 8 },
    title: "Three",
    showConfig: true,
  });
  const commands = workbenchTitlebarButtonRenderCommandsInto([], layout);

  assertEquals(commands.map((command) => [command.kind, command.label, command.text, command.rect]), [
    ["config", "config", "[ config ]", { column: 37, row: 2, width: 10, height: 1 }],
    ["minimize", "-", "[-]", { column: 48, row: 2, width: 3, height: 1 }],
    ["maximize", "M", "[M]", { column: 52, row: 2, width: 3, height: 1 }],
    ["restore", "R", "[R]", { column: 56, row: 2, width: 3, height: 1 }],
    ["close", "x", "[x]", { column: 60, row: 2, width: 3, height: 1 }],
  ]);
  assertEquals(commands.map((command) => command.hitRect), commands.map((command) => command.rect));
});

Deno.test("workbench titlebar render commands reuse caller-owned storage", () => {
  const layout = layoutWorkbenchTitlebar({
    rect: { column: 0, row: 0, width: 48, height: 8 },
    title: "Data",
  });
  const first = workbenchTitlebarButtonRenderCommandsInto([], layout);
  const firstCommand = first[0];

  const second = workbenchTitlebarButtonRenderCommandsInto(
    first,
    layoutWorkbenchTitlebar({
      rect: { column: 4, row: 3, width: 48, height: 8 },
      title: "Data",
    }),
  );

  assertEquals(second === first, true);
  assertEquals(second[0] === firstCommand, true);
  assertEquals(second[0]?.rect, { column: 36, row: 3, width: 3, height: 1 });
});

class FakeLineSignal {
  writes = 0;

  constructor(private current: string) {}

  peek(): string {
    return this.current;
  }

  set value(value: string) {
    this.writes += 1;
    this.current = value;
  }

  force(value: string): void {
    this.current = value;
  }
}
