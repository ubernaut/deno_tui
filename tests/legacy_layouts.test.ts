import { assertEquals, assertThrows } from "./deps.ts";
import {
  GridLayout,
  HorizontalLayout,
  LayoutInvalidElementsPatternError,
  LayoutMissingElementError,
  VerticalLayout,
} from "../src/layout/mod.ts";
import { Signal } from "../src/signals/mod.ts";
import type { Rectangle } from "../src/types.ts";

Deno.test("HorizontalLayout indexes elements and drops stale entries when pattern shrinks", async () => {
  const pattern = new Signal(["left", "left", "main", "tools"]);
  const layout = new HorizontalLayout({
    pattern,
    rectangle: rect(0, 0, 80, 10),
    gapX: 0,
    gapY: 0,
  });

  assertEquals([...layout.elementNameToIndex.keys()], ["left", "main", "tools"]);
  assertEquals(layout.element("left").peek(), rect(0, 0, 40, 10));
  assertEquals(layout.element("tools").peek(), rect(60, 0, 20, 10));

  await settleEffects();
  pattern.value = ["main"];

  assertEquals([...layout.elementNameToIndex.keys()], ["main"]);
  assertEquals(layout.elements.map((element) => element.name), ["main"]);
  assertThrows(() => layout.element("tools"), LayoutMissingElementError);
  assertEquals(layout.element("main").peek(), rect(0, 0, 80, 10));

  layout.dispose();
});

Deno.test("VerticalLayout indexes elements handles empty patterns and stops reacting after dispose", async () => {
  const bounds = new Signal(rect(0, 0, 20, 12));
  const pattern = new Signal(["top", "body", "body"]);
  const layout = new VerticalLayout({
    pattern,
    rectangle: bounds,
    gapX: 0,
    gapY: 0,
  });

  assertEquals([...layout.elementNameToIndex.keys()], ["top", "body"]);
  assertEquals(layout.element("body").peek(), rect(0, 4, 20, 8));

  await settleEffects();
  pattern.value = [];
  assertEquals(layout.elements.length, 0);
  assertEquals([...layout.elementNameToIndex.keys()], []);
  assertThrows(() => layout.element("body"), LayoutMissingElementError);

  pattern.value = ["body"];
  const beforeDispose = layout.element("body").peek();
  layout.dispose();
  bounds.value = rect(0, 0, 20, 20);

  assertEquals(layout.element("body").peek(), beforeDispose);
});

Deno.test("GridLayout trims stale cells and rejects ragged row patterns", async () => {
  const pattern = new Signal([
    ["header", "header"],
    ["nav", "main"],
  ]);
  const layout = new GridLayout({
    pattern,
    rectangle: rect(0, 0, 40, 10),
    gapX: 0,
    gapY: 0,
  });

  assertEquals([...layout.elementNameToIndex.keys()], ["header", "nav", "main"]);
  assertEquals(layout.element("header").peek(), rect(0, 0, 40, 5));

  await settleEffects();
  pattern.value = [["main"]];

  assertEquals([...layout.elementNameToIndex.keys()], ["main"]);
  assertEquals(layout.elements.map((element) => element.name), ["main"]);
  assertThrows(() => layout.element("header"), LayoutMissingElementError);
  assertEquals(layout.element("main").peek(), rect(0, 0, 40, 10));

  assertThrows(() => {
    pattern.value = [["a", "b"], ["a"]];
  }, LayoutInvalidElementsPatternError);

  layout.dispose();
});

function rect(column: number, row: number, width: number, height: number): Rectangle {
  return { column, row, width, height };
}

async function settleEffects(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}
