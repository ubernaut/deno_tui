import { assertEquals } from "./deps.ts";
import {
  clampSelectionIndex,
  createSelection,
  moveSelection,
  selectIndex,
  SelectionController,
  selectionWindow,
  selectRange,
  toggleSelection,
} from "../src/selection.ts";
import { bindSelectionValue } from "../src/app/selection_bindings.ts";
import { Signal } from "../src/signals/mod.ts";

Deno.test("selection helpers clamp and move single selection", () => {
  const state = createSelection(4, 1);

  assertEquals(state, { activeIndex: 1, anchorIndex: 1, selected: [1] });
  assertEquals(clampSelectionIndex(4, 10), 3);
  assertEquals(moveSelection(state, 4, 2), { activeIndex: 3, anchorIndex: 3, selected: [3] });
  assertEquals(moveSelection(state, 4, -2), { activeIndex: 0, anchorIndex: 0, selected: [0] });
  assertEquals(moveSelection(state, 4, -2, { wrap: true }), { activeIndex: 3, anchorIndex: 3, selected: [3] });
});

Deno.test("selection helpers support multi select toggle and range", () => {
  const state = createSelection(6, 2, "multiple");
  const toggled = toggleSelection(state, 6, 4);

  assertEquals(toggled, { activeIndex: 4, anchorIndex: 4, selected: [2, 4] });
  assertEquals(toggleSelection(toggled, 6, 2), { activeIndex: 2, anchorIndex: 2, selected: [4] });
  assertEquals(selectRange({ ...state, anchorIndex: 1 }, 6, 4), {
    activeIndex: 4,
    anchorIndex: 1,
    selected: [1, 2, 3, 4],
  });
  assertEquals(moveSelection({ ...state, anchorIndex: 2 }, 6, 2, { mode: "multiple", extend: true }), {
    activeIndex: 4,
    anchorIndex: 2,
    selected: [2, 3, 4],
  });
});

Deno.test("selectIndex accumulates only in multiple mode", () => {
  const state = createSelection(4, 1, "multiple");

  assertEquals(selectIndex(state, 4, 3, "multiple"), { activeIndex: 3, anchorIndex: 3, selected: [1, 3] });
  assertEquals(selectIndex(state, 4, 3, "single"), { activeIndex: 3, anchorIndex: 3, selected: [3] });
});

Deno.test("selectionWindow centers active rows and handles empty inputs", () => {
  assertEquals(selectionWindow(10, 5, 4), { start: 3, end: 7 });
  assertEquals(selectionWindow(10, 9, 4), { start: 6, end: 10 });
  assertEquals(selectionWindow(0, 0, 4), { start: 0, end: 0 });
  assertEquals(selectionWindow(10, 5, 0), { start: 0, end: 0 });
});

Deno.test("SelectionController normalizes when length changes", () => {
  const length = new Signal(5);
  const controller = new SelectionController({
    length,
    mode: "multiple",
    initialState: { activeIndex: 4, anchorIndex: 2, selected: [2, 4] },
  });

  controller.move(-1, true);
  assertEquals(controller.state.peek(), { activeIndex: 3, anchorIndex: 2, selected: [2, 3] });

  length.value = 2;
  assertEquals(controller.state.peek(), { activeIndex: 1, anchorIndex: 1, selected: [1] });

  controller.toggle(0);
  assertEquals(controller.state.peek(), { activeIndex: 0, anchorIndex: 0, selected: [0, 1] });
  assertEquals(controller.window(1), { start: 0, end: 1 });
});

Deno.test("bindSelectionValue synchronizes active selection with selected values", () => {
  const rows = new Signal([
    { id: "alpha", label: "Alpha" },
    { id: "beta", label: "Beta" },
    { id: "gamma", label: "Gamma" },
  ]);
  const selectedId = new Signal<string | undefined>("beta");
  const controller = new SelectionController({ length: 0 });

  const dispose = bindSelectionValue(controller, rows, selectedId, {
    valueForItem: (row) => row.id,
    initialSync: "value",
  });

  assertEquals(controller.length.peek(), 3);
  assertEquals(controller.state.peek().activeIndex, 1);

  controller.move(1);
  assertEquals(selectedId.peek(), "gamma");

  selectedId.value = "alpha";
  assertEquals(controller.state.peek().activeIndex, 0);

  dispose();
  controller.move(1);
  assertEquals(selectedId.peek(), "alpha");
});

Deno.test("bindSelectionValue repairs missing values when item sources change", () => {
  const rows = new Signal([
    { id: "alpha", label: "Alpha" },
    { id: "beta", label: "Beta" },
    { id: "gamma", label: "Gamma" },
  ]);
  const missing: string[] = [];
  const selectedId = new Signal<string | undefined>("gamma");
  const controller = new SelectionController({ length: rows.peek().length });

  bindSelectionValue(controller, rows, selectedId, {
    valueForItem: (row) => row.id,
    initialSync: "value",
    onMissingValue: (value) => missing.push(value),
  });

  rows.value = [{ id: "alpha", label: "Alpha" }];

  assertEquals(controller.length.peek(), 1);
  assertEquals(controller.state.peek().activeIndex, 0);
  assertEquals(selectedId.peek(), "alpha");
  assertEquals(missing, ["gamma"]);

  rows.value = [];

  assertEquals(controller.length.peek(), 0);
  assertEquals(controller.state.peek().selected, []);
  assertEquals(selectedId.peek(), undefined);
});
