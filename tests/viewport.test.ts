import { assertEquals } from "./deps.ts";
import {
  clampViewportOffset,
  inspectViewport,
  maxViewportOffset,
  viewportOffsetBy,
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
