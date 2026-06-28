/// <reference lib="dom" />
import { assertEquals, assertExists } from "./deps.ts";
import { createAnsiThemeTokens, createTheme } from "../src/theme.ts";
import {
  BrowserCellCanvasSink,
  parseAnsiCell,
  renderDomNodeToHtml,
  themeTokensToCssVariables,
} from "../src/web/mod.ts";

Deno.test("mod.web imports without constructing terminal runtime", async () => {
  const web = await import("../mod.web.ts");
  const exports = web as Record<string, unknown>;

  assertEquals(typeof web.createWebTui, "function");
  assertEquals(typeof web.BrowserCellCanvasSink, "function");
  assertEquals(typeof exports.Tui, "undefined");
});

Deno.test("parseAnsiCell extracts text and ANSI colors for browser rendering", () => {
  assertEquals(parseAnsiCell("\x1b[48;2;1;2;3m\x1b[38;5;196mX\x1b[0m"), {
    text: "X",
    foreground: "rgb(255,0,0)",
    background: "rgb(1,2,3)",
    bold: false,
    dim: false,
  });
  assertEquals(parseAnsiCell("\x1b[1;38;2;10;20;30;48;5;17mZ"), {
    text: "Z",
    foreground: "rgb(10,20,30)",
    background: "rgb(0,0,95)",
    bold: true,
    dim: false,
  });
});

Deno.test("BrowserCellCanvasSink paints dirty cells to a 2D context", () => {
  const operations: unknown[][] = [];
  const context = {
    fillStyle: "",
    font: "",
    textBaseline: "top" as CanvasTextBaseline,
    scale: (x: number, y: number) => operations.push(["scale", x, y]),
    setTransform: (...args: number[]) => operations.push(["setTransform", ...args]),
    fillRect: (x: number, y: number, width: number, height: number) =>
      operations.push(["fillRect", x, y, width, height, context.fillStyle]),
    fillText: (text: string, x: number, y: number) => operations.push(["fillText", text, x, y, context.fillStyle]),
  };
  const canvas = {
    width: 0,
    height: 0,
    getContext: (kind: string) => kind === "2d" ? context : null,
  };
  const sink = new BrowserCellCanvasSink({
    canvas: canvas as unknown as HTMLCanvasElement,
    cellWidth: 8,
    cellHeight: 16,
    devicePixelRatio: 1,
    foreground: "#fff",
    background: "#000",
  });

  sink.resize(2, 1);
  sink.flush([
    { row: 0, column: 1, value: "\x1b[31;44mA" },
  ], {
    updatedObjects: 0,
    renderedObjects: 0,
    rerenderedObjects: 0,
    intersectionUpdates: 0,
    intersectionsDirty: false,
    flushedCells: 1,
  });

  assertEquals(canvas.width, 16);
  assertEquals(canvas.height, 16);
  assertExists(operations.find((operation) => operation[0] === "fillRect" && operation[5] === "#3b82f6"));
  assertExists(operations.find((operation) => operation[0] === "fillText" && operation[1] === "A"));
  assertEquals(sink.inspectSink().lastStats?.flushedCells, 1);
});

Deno.test("renderDomNodeToHtml serializes semantic DOM nodes safely", () => {
  assertEquals(
    renderDomNodeToHtml({
      tag: "section",
      role: "region",
      ariaLabel: "Demo <panel>",
      className: "demo",
      style: { backgroundColor: "#000", padding: "8px" },
      children: [
        { tag: "h2", text: "Deno TUI" },
        { tag: "button", text: "Run", attributes: { type: "button", disabled: true } },
      ],
    }),
    '<section role="region" aria-label="Demo &lt;panel&gt;" class="demo" style="background-color:#000;padding:8px"><h2>Deno TUI</h2><button type="button" disabled>Run</button></section>',
  );
});

Deno.test("themeTokensToCssVariables converts ANSI theme tokens to CSS variables", () => {
  const theme = createTheme(createAnsiThemeTokens({
    foreground: { foreground: [10, 20, 30] },
    surface: { background: [1, 2, 3] },
  }));

  assertEquals(themeTokensToCssVariables(theme), {
    "--deno-tui-foreground-fg": "rgb(10,20,30)",
    "--deno-tui-muted-fg": "rgb(10,20,30)",
    "--deno-tui-accent-fg": "rgb(10,20,30)",
    "--deno-tui-success-fg": "rgb(10,20,30)",
    "--deno-tui-warning-fg": "rgb(10,20,30)",
    "--deno-tui-danger-fg": "rgb(10,20,30)",
    "--deno-tui-surface-bg": "rgb(1,2,3)",
  });
});
