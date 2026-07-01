import { assertEquals } from "./deps.ts";
import { BoxObject } from "../src/canvas/box.ts";
import { TextObject, type TextRectangle } from "../src/canvas/text.ts";
import { Signal } from "../src/signals/mod.ts";
import { canvasRowText, createTestCanvas } from "../src/testing/mod.ts";
import { View } from "../src/view.ts";

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
  assertEquals(canvas.inspectRender().intersectionsDirty, true);
  assertEquals(canvas.inspectRender().intersectionUpdates, 2);

  overlayRect.value = { column: 2, row: 1, width: 4 };
  canvas.render();

  assertEquals(canvasRowText(canvas, 1, 12), "..HELP......");
  assertEquals(canvas.inspectRender().intersectionsDirty, true);
  assertEquals(canvas.inspectRender().intersectionUpdates, 2);
  assertEquals(canvas.inspectRender().renderedObjects, 1);
  assertEquals(canvas.inspectRender().rerenderedObjects, 1);

  overlayRect.value = { column: 4, row: 1, width: 4 };
  canvas.render();

  assertEquals(canvasRowText(canvas, 1, 12), "....HELP....");
  assertEquals(canvas.inspectRender().intersectionsDirty, true);
  assertEquals(canvas.inspectRender().intersectionUpdates, 2);
  assertEquals(canvas.inspectRender().renderedObjects, 1);
  assertEquals(canvas.inspectRender().rerenderedObjects, 1);

  backgroundStyle.value = () => "#";
  canvas.render();

  assertEquals(canvasRowText(canvas, 1, 12), "####HELP####");
  assertEquals(canvas.inspectRender().intersectionsDirty, false);
  assertEquals(canvas.inspectRender().intersectionUpdates, 0);
  assertEquals(canvas.inspectRender().renderedObjects, 1);
  assertEquals(canvas.inspectRender().rerenderedObjects, 0);
});

Deno.test("canvas render inspection reports repaint and idle passes", () => {
  const canvas = createTestCanvas({ size: { columns: 8, rows: 2 } });
  const style = new Signal<(text: string) => string>((text: string) => text);
  const background = new BoxObject({
    canvas,
    rectangle: { column: 0, row: 0, width: 8, height: 2 },
    filler: ".",
    style,
    zIndex: 1,
  });

  background.draw();
  canvas.render();

  assertEquals(canvas.inspectRender(), {
    updatedObjects: 1,
    renderedObjects: 1,
    rerenderedObjects: 0,
    intersectionUpdates: 1,
    intersectionCandidateChecks: 0,
    intersectionsDirty: true,
    dirtyRectangles: 1,
    dirtyRowRanges: 2,
    dirtyRows: 2,
    dirtyCells: 16,
    fullRedraws: 1,
    flushedCells: 16,
  });

  style.value = (text: string) => text.toUpperCase();
  canvas.render();

  assertEquals(canvas.inspectRender(), {
    updatedObjects: 1,
    renderedObjects: 1,
    rerenderedObjects: 0,
    intersectionUpdates: 0,
    intersectionCandidateChecks: 0,
    intersectionsDirty: false,
    dirtyRectangles: 0,
    dirtyRowRanges: 2,
    dirtyRows: 2,
    dirtyCells: 16,
    fullRedraws: 1,
    flushedCells: 16,
  });

  canvas.render();

  assertEquals(canvas.inspectRender(), {
    updatedObjects: 0,
    renderedObjects: 0,
    rerenderedObjects: 0,
    intersectionUpdates: 0,
    intersectionCandidateChecks: 0,
    intersectionsDirty: false,
    dirtyRectangles: 0,
    dirtyRowRanges: 0,
    dirtyRows: 0,
    dirtyCells: 0,
    fullRedraws: 0,
    flushedCells: 0,
  });
});

Deno.test("draw objects track views attached after construction", () => {
  const canvas = createTestCanvas({ size: { columns: 12, rows: 3 } });
  const view = new Signal<View | undefined>(undefined);

  const background = new BoxObject({
    canvas,
    rectangle: { column: 0, row: 0, width: 12, height: 3 },
    filler: ".",
    style: (text: string) => text,
    zIndex: 1,
  });
  const overlay = new TextObject({
    canvas,
    rectangle: { column: 0, row: 0, width: 4 },
    value: "HELP",
    overwriteRectangle: true,
    view,
    style: (text: string) => text,
    zIndex: 2,
  });

  background.draw();
  overlay.draw();
  canvas.render();

  assertEquals(canvasRowText(canvas, 0, 12), "HELP........");

  view.value = new View({
    rectangle: { column: 2, row: 1, width: 4, height: 1 },
  });
  canvas.render();

  assertEquals(canvasRowText(canvas, 0, 12), "............");
  assertEquals(canvasRowText(canvas, 1, 12), "..HELP......");
});
