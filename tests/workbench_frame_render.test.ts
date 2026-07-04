import { assertEquals, assertStrictEquals } from "./deps.ts";
import {
  type WorkbenchFrameRenderCommand,
  workbenchFrameRenderCommandsInto,
} from "../src/app/workbench_frame_render.ts";
import type { WorkbenchFrameBoxLine } from "../src/app/workbench_frame.ts";

const theme = {
  background: "#000",
  panel: "#111",
  panelSoft: "#222",
  border: "#333",
  borderStrong: "#444",
  accent: "#0f0",
};

Deno.test("workbenchFrameRenderCommandsInto projects active frame fill border and title styles", () => {
  const lines: WorkbenchFrameBoxLine[] = [];
  const commands = workbenchFrameRenderCommandsInto([], lines, {
    rect: { column: 1, row: 2, width: 8, height: 4 },
    title: "Panel",
    active: true,
    theme,
  });

  assertEquals(commands[0], {
    kind: "fill",
    rect: { column: 1, row: 2, width: 8, height: 4 },
    bg: "#222",
  });
  assertEquals(commands[1], {
    kind: "text",
    row: 2,
    column: 1,
    text: "┌──────┐",
    style: { fg: "#0f0", bg: "#222", bold: true },
    lineKind: "border",
  });
  assertEquals(commands.find((command) => command.kind === "text" && command.lineKind === "title"), {
    kind: "text",
    row: 2,
    column: 3,
    text: " PANEL ",
    style: { fg: "#000", bg: "#0f0", bold: true },
    lineKind: "title",
  });
});

Deno.test("workbenchFrameRenderCommandsInto projects inactive frame colors and reuses buffers", () => {
  const lines: WorkbenchFrameBoxLine[] = [];
  const target: WorkbenchFrameRenderCommand[] = [];
  const first = workbenchFrameRenderCommandsInto(target, lines, {
    rect: { column: 0, row: 0, width: 6, height: 3 },
    title: "A",
    active: true,
    theme,
  });
  const fill = first[0];
  const text = first[1];

  const second = workbenchFrameRenderCommandsInto(target, lines, {
    rect: { column: 2, row: 1, width: 6, height: 3 },
    title: "B",
    active: false,
    theme,
  });

  assertStrictEquals(second, target);
  assertStrictEquals(second[0], fill);
  assertStrictEquals(second[1], text);
  assertEquals(second[0], {
    kind: "fill",
    rect: { column: 2, row: 1, width: 6, height: 3 },
    bg: "#111",
  });
  assertEquals(second[1], {
    kind: "text",
    row: 1,
    column: 2,
    text: "┌────┐",
    style: { fg: "#444", bg: "#111", bold: false },
    lineKind: "border",
  });
});

Deno.test("workbenchFrameRenderCommandsInto clears target for empty bounds", () => {
  const target: WorkbenchFrameRenderCommand[] = [{
    kind: "fill",
    rect: { column: 0, row: 0, width: 1, height: 1 },
    bg: "stale",
  }];

  const commands = workbenchFrameRenderCommandsInto(target, [], {
    rect: { column: 0, row: 0, width: 0, height: 3 },
    title: "Hidden",
    active: false,
    theme,
  });

  assertEquals(commands, []);
  assertStrictEquals(commands, target);
});
