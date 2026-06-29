import { assertEquals, assertStringIncludes } from "./deps.ts";
import { Signal } from "../src/signals/mod.ts";
import { canvasRowText, createTestCanvas } from "../src/testing/mod.ts";
import { ListView, MultilineTextView, PanelView } from "../app/ui.ts";
import type { BorderMode, MenuLine, Rect } from "../app/types.ts";

Deno.test("multiline and list views only allocate visible rows and grow on resize", () => {
  const canvas = createTestCanvas({ size: { columns: 40, rows: 30 } });

  const textRect = new Signal<Rect>({ column: 0, row: 0, width: 20, height: 4 });
  const textView = new MultilineTextView({
    canvas,
    rectangle: textRect,
    text: new Signal(Array.from({ length: 64 }, (_, index) => `LINE ${index}`).join("\n")),
    style: new Signal((text: string) => text),
    zIndex: 1,
    lineLimit: 1024,
  });

  const listRect = new Signal<Rect>({ column: 0, row: 5, width: 20, height: 3 });
  const listLines = new Signal<MenuLine[]>(
    Array.from({ length: 64 }, (_, index) => ({ text: `ITEM ${index}`, style: (text: string) => text })),
  );
  const listView = new ListView({
    canvas,
    rectangle: listRect,
    lines: listLines,
    zIndex: 2,
  });

  textView.draw();
  listView.draw();

  assertEquals(textView.lines.length, 4);
  assertEquals(listView.lines.length, 3);

  textRect.value = { column: 0, row: 0, width: 20, height: 9 };
  listRect.value = { column: 0, row: 5, width: 20, height: 7 };

  assertEquals(textView.lines.length, 9);
  assertEquals(listView.lines.length, 7);
});

Deno.test("multiline views render from a scroll offset", () => {
  const canvas = createTestCanvas({ size: { columns: 32, rows: 8 } });
  const offset = new Signal(2);
  const textView = new MultilineTextView({
    canvas,
    rectangle: new Signal<Rect>({ column: 0, row: 0, width: 18, height: 3 }),
    text: new Signal(["ZERO", "ONE", "TWO", "THREE", "FOUR"].join("\n")),
    style: new Signal((text: string) => text),
    zIndex: 1,
    lineOffset: offset,
  });

  textView.draw();
  canvas.render();

  assertStringIncludes(canvasRowText(canvas, 0, 18), "TWO");
  assertStringIncludes(canvasRowText(canvas, 2, 18), "FOUR");
});

Deno.test("panel bodies keep rendering deep lines in tall single-pane layouts", () => {
  const canvas = createTestCanvas({ size: { columns: 64, rows: 360 } });

  const rect = new Signal<Rect>({ column: 0, row: 0, width: 64, height: 340 });
  const bodyLines = Array.from(
    { length: 320 },
    (_, index) => index === 300 ? `LINE ${index} RESIZE MARKER` : `LINE ${index}`,
  );

  const panel = new PanelView({
    canvas,
    rectangle: rect,
    title: new Signal("CPU / TEST"),
    alert: new Signal(""),
    body: new Signal(bodyLines.join("\n")),
    footer: new Signal("FOOTER"),
    backgroundStyle: new Signal((text: string) => text),
    frameStyle: new Signal((text: string) => text),
    titleStyle: new Signal((text: string) => text),
    alertStyle: new Signal((text: string) => text),
    bodyStyle: new Signal((text: string) => text),
    footerStyle: new Signal((text: string) => text),
    borderMode: new Signal<BorderMode>("sharp"),
    zIndex: 1,
  });

  panel.draw();
  canvas.render();

  // Panel body starts two rows below the outer rectangle origin.
  const markerRow = 2 + 300;
  assertStringIncludes(canvasRowText(canvas, markerRow, 64), "RESIZE MARKER");
});
