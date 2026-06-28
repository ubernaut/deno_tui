import { assertEquals } from "./deps.ts";
import {
  clampViewportOffset,
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
