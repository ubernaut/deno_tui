import { assertEquals } from "./deps.ts";
import { Canvas, DirtyRegion, MemoryCanvasSink } from "../src/canvas/mod.ts";
import { BoxObject } from "../src/canvas/box.ts";
import { DrawObjectSpatialIndex } from "../src/canvas/spatial_index.ts";
import { TextObject, type TextRectangle } from "../src/canvas/text.ts";
import { Signal } from "../src/signals/mod.ts";
import { assertTerminalSnapshot, canvasRowText, canvasSnapshot, createTestCanvas } from "../src/testing/mod.ts";
import { View } from "../src/view.ts";
import { BrowserCellCanvasSink } from "../src/web/mod.ts";

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

Deno.test("canvas intersection updates use row-indexed candidates for sparse panes", () => {
  const canvas = createTestCanvas({ size: { columns: 80, rows: 48 } });
  const boxes: BoxObject[] = [];

  for (let index = 0; index < 20; index += 1) {
    const box = new BoxObject({
      canvas,
      rectangle: { column: 0, row: index * 2, width: 12, height: 1 },
      filler: ".",
      style: (text: string) => text,
      zIndex: 1,
    });
    box.draw();
    boxes.push(box);
  }

  const moverRectangle = new Signal({ column: 2, row: 1, width: 6, height: 1 });
  const mover = new BoxObject({
    canvas,
    rectangle: moverRectangle,
    filler: "#",
    style: (text: string) => text,
    zIndex: 2,
  });
  mover.draw();
  canvas.render();

  moverRectangle.value = { column: 2, row: 2, width: 6, height: 1 };
  canvas.render();

  assertEquals(canvas.inspectRender().intersectionsDirty, true);
  assertEquals(canvas.inspectRender().intersectionUpdates, 2);
  assertEquals(canvas.inspectRender().intersectionCandidateChecks <= boxes.length, true);
});

Deno.test("canvas rerenders overlapping cells when z-index order changes", () => {
  const canvas = createTestCanvas({ size: { columns: 12, rows: 2 } });
  const overlayZIndex = new Signal(2);
  const background = new BoxObject({
    canvas,
    rectangle: { column: 0, row: 0, width: 12, height: 2 },
    filler: ".",
    style: (text: string) => text,
    zIndex: 1,
  });
  const overlay = new TextObject({
    canvas,
    rectangle: { column: 2, row: 0, width: 4 },
    value: "HELP",
    overwriteRectangle: true,
    style: (text: string) => text,
    zIndex: overlayZIndex,
  });

  background.draw();
  overlay.draw();
  canvas.render();

  assertEquals(canvasRowText(canvas, 0, 12), "..HELP......");

  overlayZIndex.value = 0;
  canvas.render();

  assertEquals(canvasRowText(canvas, 0, 12), "............");
  assertEquals(canvas.drawnOrderVersion, 3);

  overlayZIndex.value = 3;
  canvas.render();

  assertEquals(canvasRowText(canvas, 0, 12), "..HELP......");
  assertEquals(canvas.drawnOrderVersion, 4);
});

Deno.test("canvas clears stale cells after move resize and erase with ANSI stdout sink", () => {
  runInvalidationScenario(createTestCanvas({ size: { columns: 10, rows: 4 } }));
});

Deno.test("canvas clears stale cells after move resize and erase with memory sink", () => {
  runInvalidationScenario(
    new Canvas({
      sink: new MemoryCanvasSink(),
      size: { columns: 10, rows: 4 },
    }),
  );
});

Deno.test("canvas clears stale cells after move resize and erase with browser canvas sink", () => {
  const browserCanvas = new FakeBrowserCanvas();
  const sink = new BrowserCellCanvasSink({
    canvas: browserCanvas as unknown as HTMLCanvasElement,
    cellWidth: 1,
    cellHeight: 1,
    devicePixelRatio: 1,
    foreground: "#fff",
    background: ".",
  });
  const canvas = new Canvas({
    sink,
    size: { columns: 10, rows: 4 },
  });

  runInvalidationScenario(canvas);

  assertEquals(browserCanvas.textAt(2, 1), ".");
  assertEquals(browserCanvas.textAt(4, 0), ".");
  assertEquals(browserCanvas.textAt(1, 2), ".");
  assertEquals(sink.inspectSink().lastStats?.flushedCells, 6);
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

Deno.test("canvas restores scrolled viewport content after modal overlay closes", async () => {
  const canvas = createTestCanvas({ size: { columns: 16, rows: 3 } });
  const view = new View({
    rectangle: { column: 0, row: 0, width: 16, height: 3 },
    offset: { columns: 0, rows: 0 },
    maxOffset: { columns: 0, rows: 1 },
  });
  const background = new BoxObject({
    canvas,
    rectangle: { column: 0, row: 0, width: 16, height: 3 },
    filler: ".",
    style: (text: string) => text,
    zIndex: 0,
  });
  const rows = ["ALPHA", "BETA", "GAMMA", "DELTA"].map((value, row) =>
    new TextObject({
      canvas,
      rectangle: { column: 0, row, width: 16 },
      value: value.padEnd(16, " "),
      overwriteRectangle: true,
      view,
      style: (text: string) => text,
      zIndex: 1,
    })
  );

  background.draw();
  for (const row of rows) row.draw();
  await Promise.resolve();
  canvas.render();

  assertEquals(canvasRowText(canvas, 0, 16), "ALPHA           ");
  assertEquals(canvasRowText(canvas, 1, 16), "BETA            ");
  assertEquals(canvasRowText(canvas, 2, 16), "GAMMA           ");

  view.offset.value = { columns: 0, rows: 1 };
  canvas.render();
  assertEquals(canvasRowText(canvas, 0, 16), "BETA            ");
  assertEquals(canvasRowText(canvas, 1, 16), "GAMMA           ");
  assertEquals(canvasRowText(canvas, 2, 16), "DELTA           ");

  const modal = new BoxObject({
    canvas,
    rectangle: { column: 2, row: 0, width: 12, height: 3 },
    filler: "#",
    style: (text: string) => text,
    zIndex: 10,
  });
  const modalTitle = new TextObject({
    canvas,
    rectangle: { column: 5, row: 1, width: 6 },
    value: "MODAL",
    overwriteRectangle: true,
    style: (text: string) => text,
    zIndex: 11,
  });
  modal.draw();
  modalTitle.draw();
  canvas.render();

  assertEquals(canvasRowText(canvas, 0, 16), "BE############  ");
  assertEquals(canvasRowText(canvas, 1, 16), "GA###MODAL ###  ");
  assertEquals(canvasRowText(canvas, 2, 16), "DE############  ");

  modalTitle.erase();
  modal.erase();
  canvas.render();

  assertEquals(canvasRowText(canvas, 0, 16), "BETA            ");
  assertEquals(canvasRowText(canvas, 1, 16), "GAMMA           ");
  assertEquals(canvasRowText(canvas, 2, 16), "DELTA           ");
  assertEquals(canvas.inspectRender().intersectionsDirty, true);
});

Deno.test("DrawObjectSpatialIndex returns unique row-overlap candidates", () => {
  const canvas = createTestCanvas({ size: { columns: 80, rows: 20 } });
  const top = new BoxObject({
    canvas,
    rectangle: { column: 0, row: 0, width: 8, height: 3 },
    style: (text: string) => text,
    zIndex: 1,
  });
  const middle = new BoxObject({
    canvas,
    rectangle: { column: 10, row: 2, width: 8, height: 4 },
    style: (text: string) => text,
    zIndex: 2,
  });
  const bottom = new BoxObject({
    canvas,
    rectangle: { column: 30, row: 12, width: 8, height: 3 },
    style: (text: string) => text,
    zIndex: 3,
  });

  const index = DrawObjectSpatialIndex.fromObjects([top, middle, bottom]);

  assertEquals(index.query({ column: 0, row: 2, width: 80, height: 1 }), [top, middle]);
  assertEquals(index.query({ column: 9, row: 2, width: 1, height: 1 }), []);
  assertEquals(index.query({ column: 10, row: 2, width: 1, height: 1 }), [middle]);
  assertEquals(index.query({ column: 0, row: 10, width: 80, height: 2 }), []);
  assertEquals(index.query({ column: 0, row: 12, width: 80, height: 6 }), [bottom]);
  const buffer = [bottom];
  assertEquals(index.queryInto(buffer, { column: 0, row: 2, width: 80, height: 1 }), [top, middle]);
  assertEquals(index.queryInto(buffer, { column: 0, row: 2, width: 80, height: 1 }), buffer);
  const dirtyRegion = DirtyRegion.fromRectangles([{ column: 0, row: 2, width: 80, height: 1 }]);
  assertEquals(index.queryDirtyRegionInto(buffer, dirtyRegion), [top, middle]);
  assertEquals(index.queryDirtyRegionInto(buffer, DirtyRegion.fromRectangles([])), buffer);
  assertEquals(buffer, []);
  assertEquals(index.inspect(), { objects: 3, rows: 9, rowEntries: 10 });
});

Deno.test("DrawObjectSpatialIndex ignores empty and out-of-bounds objects", () => {
  const canvas = createTestCanvas({ size: { columns: 12, rows: 4 } });
  const visible = new BoxObject({
    canvas,
    rectangle: { column: 0, row: 1, width: 4, height: 2 },
    style: (text: string) => text,
    zIndex: 1,
  });
  const empty = new BoxObject({
    canvas,
    rectangle: { column: 3, row: 1, width: 0, height: 2 },
    style: (text: string) => text,
    zIndex: 2,
  });
  const hidden = new BoxObject({
    canvas,
    rectangle: { column: 30, row: 30, width: 4, height: 2 },
    style: (text: string) => text,
    zIndex: 3,
  });
  hidden.outOfBounds = true;

  const index = DrawObjectSpatialIndex.fromObjects([visible, empty, hidden]);

  assertEquals(index.query({ column: 0, row: 0, width: 12, height: 4 }), [visible]);
  assertEquals(index.inspect(), { objects: 1, rows: 2, rowEntries: 2 });
});

Deno.test("DrawObjectSpatialIndex reset reuses row storage without reporting inactive rows", () => {
  const canvas = createTestCanvas({ size: { columns: 10, rows: 5 } });
  const first = new BoxObject({
    canvas,
    rectangle: { column: 0, row: 1, width: 4, height: 2 },
    style: (text: string) => text,
    zIndex: 1,
  });
  const second = new BoxObject({
    canvas,
    rectangle: { column: 6, row: 4, width: 2, height: 1 },
    style: (text: string) => text,
    zIndex: 2,
  });
  const index = DrawObjectSpatialIndex.fromObjects([first, second]);

  assertEquals(index.inspect(), { objects: 2, rows: 3, rowEntries: 3 });

  index.resetFromObjects([second]);

  assertEquals(index.inspect(), { objects: 1, rows: 1, rowEntries: 1 });

  index.clear();

  assertEquals(index.inspect(), { objects: 0, rows: 0, rowEntries: 0 });
});

function runInvalidationScenario(canvas: Canvas): void {
  const overlayRect = new Signal({ column: 2, row: 1, width: 4, height: 2 });
  const background = new BoxObject({
    canvas,
    rectangle: { column: 0, row: 0, width: 10, height: 4 },
    filler: ".",
    style: (text: string) => text,
    zIndex: 1,
  });
  const overlay = new BoxObject({
    canvas,
    rectangle: overlayRect,
    filler: "@",
    style: (text: string) => text,
    zIndex: 2,
  });

  background.draw();
  overlay.draw();
  canvas.render();
  assertTerminalSnapshot(
    canvasSnapshot(canvas),
    [
      "..........",
      "..@@@@....",
      "..@@@@....",
      "..........",
    ].join("\n"),
  );

  overlayRect.value = { column: 4, row: 0, width: 3, height: 2 };
  canvas.render();
  assertTerminalSnapshot(
    canvasSnapshot(canvas),
    [
      "....@@@...",
      "....@@@...",
      "..........",
      "..........",
    ].join("\n"),
  );

  overlayRect.value = { column: 1, row: 2, width: 6, height: 1 };
  canvas.render();
  assertTerminalSnapshot(
    canvasSnapshot(canvas),
    [
      "..........",
      "..........",
      ".@@@@@@...",
      "..........",
    ].join("\n"),
  );

  overlay.erase();
  canvas.render();
  assertTerminalSnapshot(
    canvasSnapshot(canvas),
    [
      "..........",
      "..........",
      "..........",
      "..........",
    ].join("\n"),
  );
}

class FakeBrowserCanvas {
  width = 0;
  height = 0;
  readonly context = new FakeBrowserContext();

  getContext(kind: string): FakeBrowserContext | null {
    return kind === "2d" ? this.context : null;
  }

  textAt(column: number, row: number): string | undefined {
    return this.context.textCells.get(`${column},${row}`);
  }
}

class FakeBrowserContext {
  canvas = { width: 0, height: 0 };
  fillStyle: string | CanvasGradient | CanvasPattern = "";
  font = "";
  textBaseline: CanvasTextBaseline = "top";
  readonly textCells = new Map<string, string>();

  fillRect(x: number, y: number, width: number, height: number): void {
    for (let row = y; row < y + height; row += 1) {
      for (let column = x; column < x + width; column += 1) {
        this.textCells.set(`${column},${row}`, String(this.fillStyle));
      }
    }
  }

  fillText(text: string, x: number, y: number): void {
    this.textCells.set(`${x},${y}`, text);
  }

  scale(): void {
    // Fake canvas context used only for deterministic cell-level sink tests.
  }

  setTransform(): void {
    // Fake canvas context used only for deterministic cell-level sink tests.
  }
}
