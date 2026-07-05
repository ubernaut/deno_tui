import { assertEquals } from "./deps.ts";
import { Canvas, DirtyRegion, MemoryCanvasSink, mergeDirtyRowSegmentsInPlace } from "../src/canvas/mod.ts";
import { BoxObject } from "../src/canvas/box.ts";
import {
  queueRerenderCellInto,
  queueRerenderRangeInto,
  queueRerenderRangeOnlyInto,
} from "../src/canvas/rerender_queue.ts";
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

Deno.test("DirtyRegion merges overlapping and adjacent row segments", () => {
  const region = new DirtyRegion();
  region.addSegment(2, 8, 12);
  region.addSegment(2, 4, 9);
  region.addSegment(2, 12, 14);
  region.addSegment(1, 0, 2);

  assertEquals(region.inspect(), [
    { row: 1, startColumn: 0, endColumn: 2 },
    { row: 2, startColumn: 4, endColumn: 14 },
  ]);
});

Deno.test("mergeDirtyRowSegmentsInPlace sorts and compacts retained row queues", () => {
  const ranges = [
    { row: 2, startColumn: 8, endColumn: 12 },
    { row: 2, startColumn: 1, endColumn: 3 },
    { row: 2, startColumn: 3, endColumn: 6 },
    { row: 2, startColumn: 7, endColumn: 8 },
  ];

  mergeDirtyRowSegmentsInPlace(ranges);

  assertEquals(ranges, [
    { row: 2, startColumn: 1, endColumn: 6 },
    { row: 2, startColumn: 7, endColumn: 12 },
  ]);
});

Deno.test("DirtyRegion expands rectangles into clipped row intersections", () => {
  const region = DirtyRegion.fromRectangles([
    { row: 1, column: 3, width: 5, height: 3 },
    { row: 3, column: 6, width: 4, height: 1 },
  ]);

  assertEquals(region.intersects({ row: 0, column: 0, width: 2, height: 2 }), false);
  assertEquals(region.intersects({ row: 2, column: 7, width: 2, height: 1 }), true);
  assertEquals(region.intersections({ row: 2, column: 5, width: 4, height: 3 }), [
    { row: 2, startColumn: 5, endColumn: 8 },
    { row: 3, startColumn: 5, endColumn: 9 },
  ]);
  const visited: unknown[] = [];
  region.forEachIntersection({ row: 2, column: 5, width: 4, height: 3 }, (segment) => {
    visited.push({ ...segment });
  });
  assertEquals(visited, [
    { row: 2, startColumn: 5, endColumn: 8 },
    { row: 3, startColumn: 5, endColumn: 9 },
  ]);

  const visitedValues: unknown[] = [];
  region.forEachIntersectionValue({ row: 2, column: 5, width: 4, height: 3 }, (row, startColumn, endColumn) => {
    visitedValues.push({ row, startColumn, endColumn });
  });
  assertEquals(visitedValues, [
    { row: 2, startColumn: 5, endColumn: 8 },
    { row: 3, startColumn: 5, endColumn: 9 },
  ]);
});

Deno.test("DirtyRegion ignores empty dimensions and supports clearing", () => {
  const region = DirtyRegion.fromRectangles([
    { row: 0, column: 0, width: 0, height: 10 },
    { row: 2, column: 4, width: 3, height: 0 },
  ]);

  assertEquals(region.isEmpty(), true);
  region.addSegment(0, 3, 1);
  assertEquals(region.inspect(), [{ row: 0, startColumn: 1, endColumn: 3 }]);
  region.clear();
  assertEquals(region.isEmpty(), true);
});

Deno.test("DirtyRegion can reset from rectangle batches", () => {
  const region = DirtyRegion.fromRectangles([{ row: 0, column: 0, width: 10, height: 1 }]);
  assertEquals(region.inspect(), [{ row: 0, startColumn: 0, endColumn: 10 }]);

  region.resetFromRectangles([
    { row: 2, column: 5, width: 3, height: 1 },
    { row: 2, column: 7, width: 4, height: 1 },
  ]);

  assertEquals(region.inspect(), [{ row: 2, startColumn: 5, endColumn: 11 }]);
});

Deno.test("DirtyRegion reset can reuse storage while reporting empty batches", () => {
  const region = DirtyRegion.fromRectangles([
    { row: 0, column: 0, width: 10, height: 2 },
    { row: 4, column: 3, width: 2, height: 1 },
  ]);

  region.resetFromRectangles([]);

  assertEquals(region.isEmpty(), true);
  assertEquals(region.inspect(), []);

  region.resetFromRectangles([{ row: 4, column: 6, width: 3, height: 1 }]);

  assertEquals(region.isEmpty(), false);
  assertEquals(region.inspect(), [{ row: 4, startColumn: 6, endColumn: 9 }]);
});

Deno.test("queueRerenderRangeInto clips ranges to canvas bounds", () => {
  const queue: Array<Set<number> | undefined> = [];
  const result = queueRerenderRangeInto(queue, 1, -2, 4.2, { columns: 4, rows: 3 });

  assertEquals(result, { row: 1, startColumn: 0, endColumn: 4, queuedCells: 4 });
  assertEquals([...queue[1]!], [0, 1, 2, 3]);
});

Deno.test("queueRerenderRangeInto applies optional view clipping", () => {
  const queue: Array<Set<number> | undefined> = [];
  const result = queueRerenderRangeInto(
    queue,
    2,
    0,
    8,
    { columns: 10, rows: 5 },
    { column: 3, row: 1, width: 4, height: 2 },
  );

  assertEquals(result, { row: 2, startColumn: 3, endColumn: 7, queuedCells: 4 });
  assertEquals([...queue[2]!], [3, 4, 5, 6]);
  assertEquals(
    queueRerenderRangeInto(queue, 3, 0, 8, { columns: 10, rows: 5 }, { column: 3, row: 1, width: 4, height: 2 }),
    { row: 3, startColumn: 0, endColumn: 0, queuedCells: 0 },
  );
  assertEquals(queue[3], undefined);
});

Deno.test("queueRerenderRangeInto reports only newly queued cells", () => {
  const queue: Array<Set<number> | undefined> = [];

  assertEquals(queueRerenderRangeInto(queue, 0, 1, 4, { columns: 8, rows: 2 }).queuedCells, 3);
  assertEquals(queueRerenderRangeInto(queue, 0, 2, 6, { columns: 8, rows: 2 }), {
    row: 0,
    startColumn: 2,
    endColumn: 6,
    queuedCells: 2,
  });
  assertEquals([...queue[0]!], [1, 2, 3, 4, 5]);
});

Deno.test("queueRerenderRangeOnlyInto queues clipped ranges without cell expansion", () => {
  const ranges: Array<Array<{ row: number; startColumn: number; endColumn: number }> | undefined> = [];

  assertEquals(
    queueRerenderRangeOnlyInto(ranges, 1, -2, 5.2, { columns: 10, rows: 3 }, {
      column: 2,
      row: 0,
      width: 4,
      height: 2,
    }),
    { row: 1, startColumn: 2, endColumn: 6, queuedCells: 4 },
  );
  assertEquals(ranges[1], [{ row: 1, startColumn: 2, endColumn: 6 }]);
});

Deno.test("queueRerenderCellInto queues one floored fractional cell", () => {
  const queue: Array<Set<number> | undefined> = [];

  assertEquals(queueRerenderCellInto(queue, 2, 1.75, { columns: 8, rows: 4 }), {
    row: 2,
    startColumn: 1,
    endColumn: 2,
    queuedCells: 1,
  });
  assertEquals([...queue[2]!], [1]);
});

Deno.test("queueRerenderRangeInto ignores empty and out-of-bounds ranges", () => {
  const queue: Array<Set<number> | undefined> = [];

  assertEquals(queueRerenderRangeInto(queue, -1, 0, 2, { columns: 4, rows: 2 }).queuedCells, 0);
  assertEquals(queueRerenderRangeInto(queue, 2, 0, 2, { columns: 4, rows: 2 }).queuedCells, 0);
  assertEquals(queueRerenderRangeInto(queue, 0, 3, 3, { columns: 4, rows: 2 }).queuedCells, 0);
  assertEquals(queue, []);
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
