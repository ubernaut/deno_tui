import { assertEquals } from "./deps.ts";
import { BoxObject } from "../src/canvas/box.ts";
import { Canvas } from "../src/canvas/canvas.ts";
import { TextObject, type TextRectangle } from "../src/canvas/text.ts";
import { Signal } from "../src/signals/mod.ts";

function createStdout(): typeof Deno.stdout {
  return {
    writeSync(_data: Uint8Array) {
      return 0;
    },
  } as typeof Deno.stdout;
}

function rowText(canvas: Canvas, row: number, width: number) {
  return Array.from({ length: width }, (_, column) => String(canvas.frameBuffer[row]?.[column] ?? " ")).join("");
}

Deno.test("canvas keeps higher z overlays visible after lower z redraws", () => {
  const canvas = new Canvas({
    stdout: createStdout(),
    size: { columns: 12, rows: 3 },
  });

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

  assertEquals(rowText(canvas, 1, 12), "............");

  overlayRect.value = { column: 2, row: 1, width: 4 };
  canvas.render();

  assertEquals(rowText(canvas, 1, 12), "..HELP......");

  backgroundStyle.value = () => "#";
  canvas.render();

  assertEquals(rowText(canvas, 1, 12), "##HELP######");
});
