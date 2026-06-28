/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
import { BoxObject, createAnsiStyle, createWebTui, Signal, TextObject } from "../../mod.web.ts";

const root = document.querySelector<HTMLElement>("#app");
if (!root) {
  throw new Error("Missing #app mount element.");
}

const host = createWebTui({
  root,
  columns: 96,
  rows: 28,
  sinkOptions: {
    cellWidth: 10,
    cellHeight: 20,
    foreground: "#dbeafe",
    background: "#05070d",
  },
});

const title = new Signal("DENO TUI WEB / STANDALONE CLIENT");
const clock = new Signal(new Date().toLocaleTimeString());
const pulse = new Signal("▁▂▃▄▅▆▇█▇▆▅▄▃▂▁");

new BoxObject({
  canvas: host.canvas,
  rectangle: { column: 0, row: 0, width: 96, height: 28 },
  filler: " ",
  style: createAnsiStyle({ background: [5, 7, 13] }),
  zIndex: -1,
}).draw();

new TextObject({
  canvas: host.canvas,
  rectangle: { column: 3, row: 2, width: 42 },
  value: title,
  overwriteRectangle: true,
  style: createAnsiStyle({ foreground: [45, 212, 191], bold: true }),
  zIndex: 1,
}).draw();

new TextObject({
  canvas: host.canvas,
  rectangle: { column: 72, row: 2, width: 16 },
  value: clock,
  overwriteRectangle: true,
  style: createAnsiStyle({ foreground: [250, 204, 21], bold: true }),
  zIndex: 1,
}).draw();

new BoxObject({
  canvas: host.canvas,
  rectangle: { column: 3, row: 5, width: 40, height: 14 },
  filler: " ",
  style: createAnsiStyle({ background: [15, 23, 42] }),
  zIndex: 0,
}).draw();

new TextObject({
  canvas: host.canvas,
  rectangle: { column: 6, row: 7, width: 34 },
  value: "Shared Canvas compositor",
  overwriteRectangle: true,
  style: createAnsiStyle({ foreground: [147, 197, 253], bold: true }),
  zIndex: 2,
}).draw();

new TextObject({
  canvas: host.canvas,
  rectangle: { column: 6, row: 10, width: 34 },
  value: "DOM-free Canvas2D sink",
  overwriteRectangle: true,
  style: createAnsiStyle({ foreground: [134, 239, 172] }),
  zIndex: 2,
}).draw();

new TextObject({
  canvas: host.canvas,
  rectangle: { column: 6, row: 13, width: 34 },
  value: pulse,
  overwriteRectangle: true,
  style: createAnsiStyle({ foreground: [251, 113, 133], bold: true }),
  zIndex: 2,
}).draw();

new BoxObject({
  canvas: host.canvas,
  rectangle: { column: 48, row: 5, width: 40, height: 14 },
  filler: " ",
  style: createAnsiStyle({ background: [17, 24, 39] }),
  zIndex: 0,
}).draw();

new TextObject({
  canvas: host.canvas,
  rectangle: { column: 51, row: 7, width: 34 },
  value: "Browser APIs only",
  overwriteRectangle: true,
  style: createAnsiStyle({ foreground: [216, 180, 254], bold: true }),
  zIndex: 2,
}).draw();

new TextObject({
  canvas: host.canvas,
  rectangle: { column: 51, row: 10, width: 34 },
  value: "Workers / IndexedDB / WebGPU ready",
  overwriteRectangle: true,
  style: createAnsiStyle({ foreground: [103, 232, 249] }),
  zIndex: 2,
}).draw();

new TextObject({
  canvas: host.canvas,
  rectangle: { column: 51, row: 13, width: 34 },
  value: "No Deno stdio runtime required",
  overwriteRectangle: true,
  style: createAnsiStyle({ foreground: [253, 224, 71] }),
  zIndex: 2,
}).draw();

host.start();

setInterval(() => {
  clock.value = new Date().toLocaleTimeString();
  pulse.value = pulse.peek().slice(1) + pulse.peek()[0];
}, 500);

globalThis.addEventListener("beforeunload", () => host.destroy());
