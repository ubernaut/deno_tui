import { assertEquals } from "./deps.ts";
import { BoxObject } from "../src/canvas/box.ts";
import { TextObject, type TextRectangle } from "../src/canvas/text.ts";
import { Signal } from "../src/signals/mod.ts";
import { canvasRowText, createTestCanvas } from "../src/testing/mod.ts";

Deno.test("canvas keeps higher z overlays visible after lower z redraws", () => {
  const canvas = createTestCanvas({ size: { columns: 12, rows: 3 } });

  const backgroundStyle = new Signal<(text: string) => string>((text: string) => text);
  const overlayRect = new Signal<TextRectangle>({ column: 2, row: 4, width: 4 });

  const background = new BoxObject({
    canvas,
    rectangle: { column: 0, row: 0, width: 12, height: 3 },
    filler: ".",
    style: backgroundStyle,
    zIndex: 1,
  });
  const overlay = new TextObject({
    canvas,
    rectangle: overlayRect,
    value: "HELP",
    overwriteRectangle: true,
    style: (text: string) => text,
    zIndex: 2,
  });

  background.draw();
  overlay.draw();
  canvas.render();

  assertEquals(canvasRowText(canvas, 1, 12), "............");

  overlayRect.value = { column: 2, row: 1, width: 4 };
  canvas.render();

  assertEquals(canvasRowText(canvas, 1, 12), "..HELP......");

  backgroundStyle.value = () => "#";
  canvas.render();

  assertEquals(canvasRowText(canvas, 1, 12), "##HELP######");
});
