import { assertEquals } from "./deps.ts";
import {
  clampViewportOffset,
  inspectViewport,
  inspectViewportAxisOverflow,
  inspectViewportOverflow,
  maxViewportOffset,
  viewportOffsetBy,
  viewportOffsetForPointer,
  viewportThumb,
  viewportThumbGlyph,
  viewportWindow,
} from "../src/viewport.ts";

Deno.test("viewport offsets clamp scrolling to content bounds", () => {
  const max = maxViewportOffset(80, 40, 20, 10);

  assertEquals(max, { columns: 60, rows: 30 });
  assertEquals(clampViewportOffset({ columns: 90, rows: -5 }, max), { columns: 60, rows: 0 });
  assertEquals(viewportOffsetBy({ columns: 10, rows: 10 }, max, -2, 25), { columns: 8, rows: 30 });
});

Deno.test("viewportWindow centers active content when possible", () => {
  assertEquals(viewportWindow(10, 5, 4), { start: 3, end: 7 });
  assertEquals(viewportWindow(10, 9, 4), { start: 6, end: 10 });
  assertEquals(viewportWindow(3, 2, 8), { start: 0, end: 3 });
  assertEquals(viewportWindow(10, 5, 0), { start: 0, end: 0 });
});

Deno.test("viewportThumb maps content offsets to scrollbar glyphs", () => {
  const thumb = viewportThumb(40, 10, 15);

  assertEquals(thumb, { start: 4, size: 3, visible: true });
  assertEquals(viewportThumbGlyph(3, thumb), "│");
  assertEquals(viewportThumbGlyph(4, thumb), "█");
  assertEquals(viewportThumb(8, 10, 0), { start: 0, size: 10, visible: false });
  assertEquals(viewportThumbGlyph(0, viewportThumb(8, 10, 0)), " ");
});

Deno.test("inspectViewport returns aggregate scroll state", () => {
  assertEquals(inspectViewport(80, 40, 20, 10, { columns: 90, rows: 15 }), {
    contentWidth: 80,
    contentHeight: 40,
    viewportWidth: 20,
    viewportHeight: 10,
    maxOffset: { columns: 60, rows: 30 },
    offset: { columns: 60, rows: 15 },
    horizontalThumb: { start: 15, size: 5, visible: true },
    verticalThumb: { start: 4, size: 3, visible: true },
    visibleColumns: { start: 60, end: 80 },
    visibleRows: { start: 15, end: 25 },
    canScrollColumns: true,
    canScrollRows: true,
  });
});

Deno.test("inspectViewport handles empty and undersized content", () => {
  assertEquals(inspectViewport(8, 4, 20, 10, { columns: 4, rows: 4 }), {
    contentWidth: 8,
    contentHeight: 4,
    viewportWidth: 20,
    viewportHeight: 10,
    maxOffset: { columns: 0, rows: 0 },
    offset: { columns: 0, rows: 0 },
    horizontalThumb: { start: 0, size: 20, visible: false },
    verticalThumb: { start: 0, size: 10, visible: false },
    visibleColumns: { start: 0, end: 8 },
    visibleRows: { start: 0, end: 4 },
    canScrollColumns: false,
    canScrollRows: false,
  });
});

Deno.test("viewport overflow modes resolve scroll and scrollbar state per axis", () => {
  assertEquals(
    inspectViewportAxisOverflow({
      contentLength: 40,
      viewportLength: 10,
      offset: 15,
      overflow: "auto",
    }),
    {
      contentLength: 40,
      viewportLength: 10,
      maxOffset: 30,
      offset: 15,
      overflow: "auto",
      hasOverflow: true,
      canScroll: true,
      scrollbarVisible: true,
      thumb: { start: 4, size: 3, visible: true },
      visibleRange: { start: 15, end: 25 },
    },
  );

  assertEquals(
    inspectViewportAxisOverflow({
      contentLength: 8,
      viewportLength: 10,
      offset: 4,
      overflow: "scroll",
    }).scrollbarVisible,
    true,
  );
  assertEquals(
    inspectViewportAxisOverflow({
      contentLength: 40,
      viewportLength: 10,
      offset: 15,
      overflow: "hidden",
    }).offset,
    0,
  );
  assertEquals(
    inspectViewportAxisOverflow({
      contentLength: 40,
      viewportLength: 10,
      offset: 15,
      overflow: "visible",
    }).visibleRange,
    { start: 0, end: 40 },
  );
});

Deno.test("inspectViewportOverflow exposes shared two-axis overflow contract", () => {
  assertEquals(
    inspectViewportOverflow({
      contentWidth: 80,
      contentHeight: 40,
      viewportWidth: 20,
      viewportHeight: 10,
      offset: { columns: 90, rows: 15 },
      overflowX: "hidden",
      overflowY: "auto",
    }).offset,
    { columns: 0, rows: 15 },
  );
});

Deno.test("viewportOffsetForPointer maps scrollbar track positions to content offsets", () => {
  assertEquals(viewportOffsetForPointer(40, 10, 0), 0);
  assertEquals(viewportOffsetForPointer(40, 10, 9), 30);
  assertEquals(viewportOffsetForPointer(40, 10, 5), 17);
  assertEquals(viewportOffsetForPointer(8, 10, 8), 0);
});

Deno.test("viewport pointer and overflow invariants hold across generated dimensions", () => {
  const random = seededRandom(0x5eed);
  for (let index = 0; index < 500; index += 1) {
    const viewportLength = Math.floor(random() * 40);
    const contentLength = Math.floor(random() * 160);
    const pointer = Math.floor(random() * 80) - 20;
    const offset = viewportOffsetForPointer(contentLength, viewportLength, pointer);
    const maxOffset = Math.max(0, Math.max(0, contentLength) - Math.max(0, viewportLength));
    assertEquals(offset >= 0, true);
    assertEquals(offset <= maxOffset, true);

    const overflow = inspectViewportAxisOverflow({
      contentLength,
      viewportLength,
      offset: maxOffset + 100,
      overflow: index % 2 === 0 ? "auto" : "hidden",
    });
    assertEquals(overflow.offset >= 0, true);
    assertEquals(overflow.offset <= overflow.maxOffset, true);
    assertEquals(overflow.visibleRange.start <= overflow.visibleRange.end, true);
    assertEquals(overflow.visibleRange.end <= overflow.contentLength, true);
    if (overflow.overflow === "hidden") {
      assertEquals(overflow.canScroll, false);
      assertEquals(overflow.maxOffset, 0);
    }
  }
});

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}
